import { useState } from 'react';
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

  function updateReview(id, patch) {
    setReviewState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

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

  async function handleRegenerate(question, instruction) {
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
  }

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

  const approvedCount = Object.values(reviewState).filter(
    (r) => r.status === 'accepted' || r.status === 'edited'
  ).length;
  const actionableCount = formSchema.filter((q) => q.fieldType !== 'upload').length;

  return (
    <div className="space-y-4 p-4 text-sm">
      {(phase === 'idle' || phase === 'error') && (
        <button
          onClick={handleExtract}
          className="w-full rounded bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-800"
        >
          {phase === 'error' ? 'Try again' : 'Extract form from this page'}
        </button>
      )}

      {phase === 'extracting' && <p className="text-slate-500">Extracting…</p>}
      {phase === 'generating' && <p className="text-slate-500">Generating answers…</p>}

      {errorMessage && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</div>
      )}

      {(phase === 'reviewing' || phase === 'filling') && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">
              {approvedCount} of {actionableCount} approved
            </span>
            <div className="flex gap-2">
              <button onClick={resetFlow} className="rounded bg-slate-200 px-2 py-1 text-xs hover:bg-slate-300">
                Start over
              </button>
              <button
                onClick={handleFill}
                disabled={approvedCount === 0 || phase === 'filling'}
                className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {phase === 'filling' ? 'Filling…' : 'Fill approved fields'}
              </button>
            </div>
          </div>

          {formSchema.map((q) => (
            <ReviewCard
              key={q.id}
              question={q}
              review={reviewState[q.id]}
              fillResult={fillReport?.find((r) => r.id === q.id)}
              onAccept={() => updateReview(q.id, { status: 'accepted' })}
              onEdit={(value) => updateReview(q.id, { status: 'edited', answer: value })}
              onSkip={() => updateReview(q.id, { status: 'skipped' })}
              onRegenerate={(instruction) => handleRegenerate(q, instruction)}
            />
          ))}
        </>
      )}
    </div>
  );
}
