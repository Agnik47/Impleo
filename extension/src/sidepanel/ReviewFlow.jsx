import { useCallback, useMemo, useState } from 'react';
import { api } from './lib/api.js';
import ReviewCard from './components/ReviewCard.jsx';
import { extractGoogleForm, fillGoogleForm } from '../../content-scripts/google-forms.js';
import { extractLumaForm, fillLumaForm } from '../../content-scripts/luma.js';
import { extractGenericForm } from '../../content-scripts/generic-extractor.js';
import { fillGenericForm } from '../../content-scripts/generic-filler.js';

function pickPlatform(hostname) {
  if (hostname.includes('docs.google.com')) return 'google-forms';
  if (hostname.includes('lu.ma')) return 'luma';
  return 'generic';
}

const EXTRACTORS = {
  'google-forms': extractGoogleForm,
  luma: extractLumaForm,
  generic: extractGenericForm,
};

const FILLERS = {
  'google-forms': fillGoogleForm,
  luma: fillLumaForm,
  generic: fillGenericForm,
};

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('No active tab found.');
  return tab;
}

export default function ReviewFlow() {
  const [phase, setPhase] = useState('idle'); // idle | extracting | generating | reviewing | filling | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [formSchema, setFormSchema] = useState([]);
  const [reviewState, setReviewState] = useState({});
  const [fillReport, setFillReport] = useState(null);

  function resetFlow() {
    setPhase('idle');
    setErrorMessage(null);
    setPlatform(null);
    setFormSchema([]);
    setReviewState({});
    setFillReport(null);
  }

  // Stable identity (functional setState, no closed-over state) so it's safe
  // as a useCallback dependency and doesn't itself force re-renders.
  const updateReview = useCallback((id, patch) => {
    setReviewState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  // Kept as stable per-id-taking callbacks (rather than inline arrows built
  // per card on every ReviewFlow render) so React.memo on ReviewCard can
  // actually skip re-rendering cards whose own props didn't change.
  const handleAccept = useCallback((id) => updateReview(id, { status: 'accepted' }), [updateReview]);
  const handleEditAnswer = useCallback(
    (id, value) => updateReview(id, { status: 'edited', answer: value }),
    [updateReview]
  );
  const handleSkip = useCallback((id) => updateReview(id, { status: 'skipped' }), [updateReview]);

  async function generateAnswers(schema) {
    setPhase('generating');
    try {
      const { answers } = await api.generateAnswers(
        schema.map(({ id, questionText, fieldType, options, required }) => ({
          id,
          questionText,
          fieldType,
          options,
          required,
        }))
      );
      const nextReviewState = {};
      for (const q of schema) {
        const generated = answers.find((a) => a.id === q.id);
        nextReviewState[q.id] = {
          answer: generated ? generated.answer : null,
          confidence: generated ? generated.confidence : 'low',
          status: q.fieldType === 'upload' ? 'unactionable' : 'pending',
          regenerating: false,
        };
      }
      setReviewState(nextReviewState);
      setPhase('reviewing');
    } catch (err) {
      setPhase('error');
      setErrorMessage(err.message);
    }
  }

  async function handleExtract() {
    setPhase('extracting');
    setErrorMessage(null);
    setFillReport(null);
    try {
      const tab = await getActiveTab();
      const hostname = new URL(tab.url).hostname;
      const detectedPlatform = pickPlatform(hostname);
      setPlatform(detectedPlatform);

      const [{ result: schema }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: EXTRACTORS[detectedPlatform],
      });

      if (!schema || schema.length === 0) {
        setPhase('idle');
        setErrorMessage('No fillable fields found on this page.');
        return;
      }

      setFormSchema(schema);
      await generateAnswers(schema);
    } catch (err) {
      setPhase('error');
      setErrorMessage(err.message);
    }
  }

  const handleRegenerate = useCallback(
    async (question, instruction) => {
      updateReview(question.id, { regenerating: true });
      try {
        const { answer } = await api.regenerateAnswer(
          {
            id: question.id,
            questionText: question.questionText,
            fieldType: question.fieldType,
            options: question.options,
            required: question.required,
          },
          instruction
        );
        updateReview(question.id, { answer: answer.answer, confidence: answer.confidence, regenerating: false });
      } catch (err) {
        updateReview(question.id, { regenerating: false });
        setErrorMessage(`Regenerate failed for "${question.questionText}": ${err.message}`);
      }
    },
    [updateReview]
  );

  async function handleFill() {
    setPhase('filling');
    setErrorMessage(null);
    try {
      const tab = await getActiveTab();
      const approved = formSchema.filter((q) => {
        const r = reviewState[q.id];
        return r && (r.status === 'accepted' || r.status === 'edited');
      });
      const approvedAnswers = approved.map((q) => ({
        id: q.id,
        selector: q.selector,
        fieldType: q.fieldType,
        value: reviewState[q.id].answer,
      }));

      const [{ result: report }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: FILLERS[platform],
        args: [approvedAnswers],
      });

      setFillReport(report);
      setPhase('reviewing');

      const historyEntries = approved.map((q) => ({
        question: q.questionText,
        answer: Array.isArray(reviewState[q.id].answer)
          ? reviewState[q.id].answer.join(', ')
          : String(reviewState[q.id].answer ?? ''),
        context: tab.url,
        date: new Date().toISOString(),
      }));
      await Promise.allSettled(historyEntries.map((entry) => api.appendQaHistory(entry)));
    } catch (err) {
      setPhase('reviewing');
      setErrorMessage(err.message);
    }
  }

  function handleAcceptAll() {
    setReviewState((prev) => {
      const next = { ...prev };
      for (const q of formSchema) {
        const r = next[q.id];
        if (r && r.status === 'pending' && (r.confidence === 'high' || r.confidence === 'medium')) {
          next[q.id] = { ...r, status: 'accepted' };
        }
      }
      return next;
    });
  }

  const approvedCount = useMemo(
    () => Object.values(reviewState).filter((r) => r.status === 'accepted' || r.status === 'edited').length,
    [reviewState]
  );
  const actionableCount = useMemo(
    () => formSchema.filter((q) => q.fieldType !== 'upload').length,
    [formSchema]
  );
  const acceptAllCount = useMemo(
    () =>
      Object.values(reviewState).filter(
        (r) => r.status === 'pending' && (r.confidence === 'high' || r.confidence === 'medium')
      ).length,
    [reviewState]
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[500px] space-y-3 p-3 sm:p-4">
      {phase === 'idle' && <WelcomeHero />}

      {(phase === 'idle' || phase === 'error') && (
        <button
          onClick={handleExtract}
          className="w-full rounded-btn bg-brand px-3 py-2 text-body font-medium text-jungle shadow-soft-sm transition-colors duration-150 hover:bg-brand-hover"
        >
          {phase === 'error' ? 'Try again' : 'Extract form from this page'}
        </button>
      )}

      {phase === 'extracting' && <StatusLine label="Extracting…" />}
      {phase === 'generating' && <StatusLine label="Generating answers…" />}

      {errorMessage && (
        <div className="rounded-card border border-red-900/50 bg-red-950/30 p-2.5 text-body text-red-300 break-words">
          {errorMessage}
        </div>
      )}

      {(phase === 'reviewing' || phase === 'filling') && (
        <>
          <div className="min-w-0 space-y-2 rounded-card border border-surface-border bg-surface-card p-3 shadow-soft-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-body text-ink-secondary">
                <span className="font-medium text-ink-primary">{approvedCount}</span> of {actionableCount} approved
              </span>
              <button
                onClick={resetFlow}
                className="shrink-0 rounded-btn border border-surface-border px-2.5 py-1 text-caption text-ink-secondary transition-colors duration-150 hover:bg-surface-card-hover hover:text-ink-primary"
              >
                Start over
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleAcceptAll}
                disabled={acceptAllCount === 0 || phase === 'filling'}
                className="min-w-[9rem] flex-1 rounded-btn border border-lime/30 bg-lime/10 px-2.5 py-1.5 text-caption font-medium text-lime transition-colors duration-150 hover:bg-lime/20 disabled:opacity-40"
              >
                Accept high/mid ({acceptAllCount})
              </button>
              <button
                onClick={handleFill}
                disabled={approvedCount === 0 || phase === 'filling'}
                className="min-w-[9rem] flex-1 rounded-btn bg-brand px-2.5 py-1.5 text-caption font-medium text-jungle transition-colors duration-150 hover:bg-brand-hover disabled:opacity-40"
              >
                {phase === 'filling' ? 'Filling…' : 'Fill approved'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {formSchema.map((q) => (
              <ReviewCard
                key={q.id}
                question={q}
                review={reviewState[q.id]}
                fillResult={fillReport?.find((r) => r.id === q.id)}
                onAccept={handleAccept}
                onEdit={handleEditAnswer}
                onSkip={handleSkip}
                onRegenerate={handleRegenerate}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusLine({ label }) {
  return (
    <div className="flex items-center gap-2 text-body text-ink-secondary">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
      {label}
    </div>
  );
}

function WelcomeHero() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-surface-border bg-surface-card p-4 text-center shadow-soft-sm">
      <img src="./icons/HeroExtentionImg.png" alt="Impleo mascot chameleon" className="h-20 w-20 shrink-0" />
      <h2 className="text-title text-ink-primary">Hey, I'm Impleo 🦎</h2>
      <p className="text-card text-ink-secondary">Your tiny AI assistant for boring forms.</p>
      <p className="text-body text-ink-secondary">
        I'll find forms on this page, suggest answers from your saved profile, and only fill what you approve.
      </p>
      <p className="text-caption italic text-ink-muted">Humans shouldn't type the same thing twice.</p>
    </div>
  );
}
