import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function answerToText(answer) {
  return Array.isArray(answer) ? answer.join(', ') : String(answer ?? '');
}

// Mirrors the server's isLearnable (server/src/learnedMemory.js) so that accepting
// an essay doesn't fire a round-trip the server would only reject. The server owns
// the real policy and re-checks every write — this is an optimization, not the rule.
const LEARNABLE_FIELD_TYPES = new Set(['text', 'radio', 'checkbox_single', 'dropdown', 'checkbox']);
const MAX_LEARNABLE_ANSWER_LENGTH = 120;

function isLearnable(question, answer) {
  if (!question || !LEARNABLE_FIELD_TYPES.has(question.fieldType)) return false;
  const text = answerToText(answer).trim();
  return text.length > 0 && text.length <= MAX_LEARNABLE_ANSWER_LENGTH;
}

export default function ReviewFlow() {
  const [phase, setPhase] = useState('idle'); // idle | extracting | generating | reviewing | filling | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [formSchema, setFormSchema] = useState([]);
  const [reviewState, setReviewState] = useState({});
  const [fillReport, setFillReport] = useState(null);

  // chrome.storage.session persistence, keyed per tab. Reopening the side panel
  // (or bouncing to Settings and back, which remounts this component) must
  // restore an in-progress review rather than dropping to idle and forcing the
  // user to click "Extract" again — a re-extract re-runs the whole (paid)
  // generate call for fields that were already answered. Session storage is
  // cleared when the browser closes, which is the right lifetime for this.
  const tabKeyRef = useRef(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tab = await getActiveTab();
        tabKeyRef.current = `impleo_review_${tab.id}`;
        if (chrome?.storage?.session) {
          const stored = (await chrome.storage.session.get(tabKeyRef.current))[tabKeyRef.current];
          if (!cancelled && stored && Array.isArray(stored.formSchema) && stored.formSchema.length > 0) {
            // Coerce a persisted transient/filling phase back to a reviewable one.
            setPhase(stored.phase === 'filling' ? 'reviewing' : stored.phase || 'reviewing');
            setPlatform(stored.platform ?? null);
            setFormSchema(stored.formSchema);
            setReviewState(stored.reviewState ?? {});
            setFillReport(stored.fillReport ?? null);
            setErrorMessage(stored.errorMessage ?? null);
          }
        }
      } catch {
        // No tab / no storage access — start fresh; persistence is best-effort.
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Guarded so it never runs before hydration (which would clobber a restore
    // with initial defaults) or on transient phases (which would restore to a
    // dead spinner).
    if (!hydratedRef.current || !tabKeyRef.current || !chrome?.storage?.session) return;
    if (phase === 'extracting' || phase === 'generating') return;
    if (phase === 'idle' && formSchema.length === 0) {
      chrome.storage.session.remove(tabKeyRef.current).catch(() => {});
      return;
    }
    const snapshot = {
      phase: phase === 'filling' ? 'reviewing' : phase,
      platform,
      formSchema,
      reviewState,
      fillReport,
      errorMessage,
    };
    chrome.storage.session.set({ [tabKeyRef.current]: snapshot }).catch(() => {});
  }, [phase, platform, formSchema, reviewState, fillReport, errorMessage]);

  function resetFlow() {
    setPhase('idle');
    setErrorMessage(null);
    setPlatform(null);
    setFormSchema([]);
    setReviewState({});
    setFillReport(null);
    if (tabKeyRef.current && chrome?.storage?.session) {
      chrome.storage.session.remove(tabKeyRef.current).catch(() => {});
    }
  }

  // Stable identity (functional setState, no closed-over state) so it's safe
  // as a useCallback dependency and doesn't itself force re-renders.
  const updateReview = useCallback((id, patch) => {
    setReviewState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  // Lets the stable callbacks below read current formSchema/reviewState without
  // closing over them — which would rebuild the callbacks on every keystroke and
  // defeat ReviewCard's memoization (see the note on handleAccept).
  const formSchemaRef = useRef(formSchema);
  const reviewStateRef = useRef(reviewState);
  useEffect(() => {
    formSchemaRef.current = formSchema;
  }, [formSchema]);
  useEffect(() => {
    reviewStateRef.current = reviewState;
  }, [reviewState]);

  // The learning loop's capture half (docs/Issus.md's saveUserCorrection): a
  // confirmed answer is recorded the moment it's confirmed, so the same question
  // resolves from memory — for free, at HIGH confidence — on every later form.
  //
  // Fire-and-forget on purpose. Learning is a side benefit of clicking Accept, not
  // the point of it, so a failed write must never block the click or stall the
  // review; it only surfaces as text (AGENTS.md: never console.error and silence).
  const learnAnswer = useCallback(async (id, answer, source) => {
    const question = formSchemaRef.current.find((q) => q.id === id);
    if (!isLearnable(question, answer)) return;
    try {
      await api.saveLearnedAnswer({
        questionText: question.questionText,
        answer: answerToText(answer),
        // The classification, when there is one, so the router can defer to
        // identity_memory for the value instead of keeping a second copy here.
        canonicalKey: reviewStateRef.current[id]?.canonicalKey ?? null,
        fieldType: question.fieldType,
        source,
      });
    } catch (err) {
      setErrorMessage(`Couldn't remember the answer to "${question.questionText}": ${err.message}`);
    }
  }, []);

  // Kept as stable per-id-taking callbacks (rather than inline arrows built
  // per card on every ReviewFlow render) so React.memo on ReviewCard can
  // actually skip re-rendering cards whose own props didn't change.
  //
  // Accept and Edit are BOTH terminal confirmations here (each marks a field
  // approved for fill), so both teach — but they're recorded under different
  // sources: a hand-typed answer outranks a rubber-stamped AI one, and only the
  // former is protected from being overwritten later (see learnedMemory.js).
  const handleAccept = useCallback(
    (id) => {
      updateReview(id, { status: 'accepted' });
      learnAnswer(id, reviewStateRef.current[id]?.answer, 'user_accept');
    },
    [updateReview, learnAnswer]
  );
  const handleEditAnswer = useCallback(
    (id, value) => {
      updateReview(id, { status: 'edited', answer: value });
      learnAnswer(id, value, 'user_edit');
    },
    [updateReview, learnAnswer]
  );
  const handleSkip = useCallback((id) => updateReview(id, { status: 'skipped' }), [updateReview]);
  const handleToggleRemember = useCallback(
    (id, remember) => updateReview(id, { remember }),
    [updateReview]
  );

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
        const canonicalKey = generated?.canonicalKey ?? null;
        const fromMemory = Boolean(generated?.fromMemory);
        nextReviewState[q.id] = {
          answer: generated ? generated.answer : null,
          confidence: generated ? generated.confidence : 'low',
          canonicalKey,
          canonicalLabel: generated?.canonicalLabel ?? null,
          // How canonicalKey was decided -- 'local-exact' | 'local-fuzzy' |
          // 'local-fuzzy-agreed' | 'ai' | 'unresolved' | null. See generate.js's
          // resolveCanonicalKey. canonicalKey is already null for 'unresolved', which
          // is what keeps the Remember checkbox from ever appearing on an ambiguous
          // classification -- no separate gating needed here.
          classificationSource: generated?.classificationSource ?? null,
          // Snapshot of what's currently stored under this key (independent of any
          // later edits to `answer`), so the UI can show what an edit would replace.
          existingMemoryValue: generated?.existingMemoryValue ?? null,
          fromMemory,
          // Default the "remember" toggle on for a newly-classified value the user is
          // supplying, so capture is one click.
          //
          // Gated on existingMemoryValue rather than !fromMemory because "remember"
          // means precisely "write this to identity_memory", and those two differ in
          // one case that matters: an answer replayed from the learned store reports
          // fromMemory, but its canonical key may still be absent from identity_memory
          // (accepted on an earlier form that was never filled). Keying off fromMemory
          // there would leave the value stranded under one exact phrasing forever,
          // never promoted to the canonical key that lets other wordings find it.
          remember: Boolean(canonicalKey) && generated?.existingMemoryValue == null,
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
        const canonicalKey = answer.canonicalKey ?? null;
        const fromMemory = Boolean(answer.fromMemory);
        updateReview(question.id, {
          answer: answer.answer,
          confidence: answer.confidence,
          canonicalKey,
          canonicalLabel: answer.canonicalLabel ?? null,
          classificationSource: answer.classificationSource ?? null,
          existingMemoryValue: answer.existingMemoryValue ?? null,
          fromMemory,
          // Same reasoning as generateAnswers above.
          remember: Boolean(canonicalKey) && answer.existingMemoryValue == null,
          regenerating: false,
        });
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
        // Carried so the fillers can re-locate a field by its visible label
        // if the page re-rendered and the stamped selector went stale.
        questionText: q.questionText,
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

      // Persist any approved identity fields the user chose to remember. Choice-field
      // answers can be arrays; identity values are single strings, so join defensively.
      const rememberCandidates = approved
        .map((q) => ({ q, r: reviewState[q.id] }))
        .filter(({ r }) => r.canonicalKey && r.remember && r.answer != null && r.answer !== '')
        .map(({ q, r }) => ({
          q,
          canonicalKey: r.canonicalKey,
          canonicalLabel: r.canonicalLabel,
          value: Array.isArray(r.answer) ? r.answer.join(', ') : String(r.answer),
        }));

      // Same-batch collision guard: if more than one field on THIS form maps to the
      // same canonicalKey with DIFFERING values, none of them are safe to write —
      // this is exactly the pattern that previously poisoned identity memory (three
      // differently-labeled fields on one form all misclassifying to full_name, each
      // silently overwriting the last). Refuse to guess which is correct; surface it.
      const byKey = new Map();
      for (const c of rememberCandidates) {
        if (!byKey.has(c.canonicalKey)) byKey.set(c.canonicalKey, []);
        byKey.get(c.canonicalKey).push(c);
      }
      const collisions = [];
      const safeCandidates = [];
      for (const candidates of byKey.values()) {
        const distinctValues = new Set(candidates.map((c) => c.value));
        if (distinctValues.size > 1) {
          collisions.push(candidates);
        } else {
          safeCandidates.push(...candidates);
        }
      }

      const identityWrites = safeCandidates.map((c) => api.saveIdentityMemory(c.canonicalKey, c.value, 'user'));
      await Promise.allSettled(identityWrites);

      if (collisions.length > 0) {
        const detail = collisions
          .map((candidates) => {
            const label = candidates[0].canonicalLabel || candidates[0].canonicalKey;
            const fields = candidates.map((c) => `"${c.q.questionText}"`).join(', ');
            return `${label} (${fields})`;
          })
          .join('; ');
        setErrorMessage(
          `Some fields matched the same remembered value with different answers, so none were saved to memory: ${detail}. Check the classification, or add the correct one manually via Backup.`
        );
      }
    } catch (err) {
      setPhase('reviewing');
      setErrorMessage(err.message);
    }
  }

  function handleAcceptAll() {
    // Resolved up front rather than inside the updater: learning is a side effect,
    // and a state updater must stay pure (React may invoke it twice).
    const accepted = formSchema.filter((q) => {
      const r = reviewState[q.id];
      return r && r.status === 'pending' && (r.confidence === 'high' || r.confidence === 'medium');
    });

    setReviewState((prev) => {
      const next = { ...prev };
      for (const q of accepted) {
        const r = next[q.id];
        if (r) next[q.id] = { ...r, status: 'accepted' };
      }
      return next;
    });

    // Bulk accept teaches too — it's the same confirmation as clicking Accept on
    // each card, and skipping it here would mean the fastest path through a review
    // is also the only one Impleo learns nothing from. Low-confidence answers are
    // excluded by the filter above, and essays by isLearnable, so what this can
    // absorb in bulk is short answers Impleo was already confident about.
    for (const q of accepted) {
      learnAnswer(q.id, reviewState[q.id].answer, 'user_accept');
    }
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
                onToggleRemember={handleToggleRemember}
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
