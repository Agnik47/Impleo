import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './lib/api.js';
import ReviewCard from './components/ReviewCard.jsx';
import { extractGoogleForm, fillGoogleForm } from '../../content-scripts/google-forms.js';
import { extractLumaForm, fillLumaForm } from '../../content-scripts/luma.js';
import { extractGenericForm } from '../../content-scripts/generic-extractor.js';
import { fillGenericForm } from '../../content-scripts/generic-filler.js';
import { detectUploadFields } from '../../content-scripts/upload-detector.js';
import { injectDocumentIntoField } from '../../content-scripts/file-injector.js';
import ReviewUploadCard from './components/ReviewUploadCard.jsx';
import { uploadFile } from './lib/documents.js';
import HeroCard from './components/extension-ui/HeroCard/HeroCard.jsx';
import WaitingState from './components/extension-ui/WaitingState/WaitingState.jsx';
import ExtractButton from './components/extension-ui/ExtractButton/ExtractButton.jsx';
import CompletionState from './components/extension-ui/CompletionState/CompletionState.jsx';
import { StaggerContainer, StaggerItem } from './components/extension-ui/ReviewAnimations/StaggerList.jsx';

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
  // Upload fields are tracked separately from formSchema rather than as another
  // fieldType inside it. They don't share the text path's shape (no answer, no
  // confidence, no regenerate), they don't share its lifecycle (never touched by
  // "Fill approved" — each file is approved on its own card), and they carry data
  // formSchema has no room for (accept filter, injection strategy, reachability).
  const [uploadFields, setUploadFields] = useState([]);
  const [uploadReview, setUploadReview] = useState({});
  const [documents, setDocuments] = useState([]);

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
          const hasStoredWork =
            stored &&
            ((Array.isArray(stored.formSchema) && stored.formSchema.length > 0) ||
              (Array.isArray(stored.uploadFields) && stored.uploadFields.length > 0));
          if (!cancelled && hasStoredWork) {
            // Coerce a persisted transient/filling phase back to a reviewable one.
            setPhase(stored.phase === 'filling' ? 'reviewing' : stored.phase || 'reviewing');
            setPlatform(stored.platform ?? null);
            setFormSchema(stored.formSchema ?? []);
            setReviewState(stored.reviewState ?? {});
            setFillReport(stored.fillReport ?? null);
            setErrorMessage(stored.errorMessage ?? null);
            setUploadFields(stored.uploadFields ?? []);
            // A persisted 'uploading' is a lie by the time we read it — the panel
            // closed mid-injection, so the executeScript result was never observed.
            // Restore it as 'pending' rather than a spinner that will never resolve,
            // which would also strand the card with no way to approve it. Same
            // reasoning as the 'filling' -> 'reviewing' coercion above.
            const restoredUploads = stored.uploadReview ?? {};
            for (const [id, entry] of Object.entries(restoredUploads)) {
              if (entry?.status === 'uploading') {
                restoredUploads[id] = { ...entry, status: 'pending' };
              }
            }
            setUploadReview(restoredUploads);
            // Metadata only, and re-fetched rather than restored: a document could
            // have been renamed or deleted from Settings while this panel was closed.
            api
              .getDocuments()
              .then(({ documents: list }) => {
                if (!cancelled) setDocuments(list);
              })
              .catch(() => {});
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
    if (phase === 'idle' && formSchema.length === 0 && uploadFields.length === 0) {
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
      // uploadFields/uploadReview only — never `documents`. Persisting document
      // metadata would let a stale, deleted, or renamed document render from session
      // storage; it's cheap to re-fetch and the server is the only source of truth.
      // File BYTES are never held in component state at all: they're fetched at the
      // moment of approval and handed straight to the injector.
      uploadFields,
      uploadReview,
    };
    chrome.storage.session.set({ [tabKeyRef.current]: snapshot }).catch(() => {});
  }, [phase, platform, formSchema, reviewState, fillReport, errorMessage, uploadFields, uploadReview]);

  function resetFlow() {
    setPhase('idle');
    setErrorMessage(null);
    setPlatform(null);
    setFormSchema([]);
    setReviewState({});
    setFillReport(null);
    setUploadFields([]);
    setUploadReview({});
    setDocuments([]);
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
  const uploadFieldsRef = useRef(uploadFields);
  const uploadReviewRef = useRef(uploadReview);
  useEffect(() => {
    formSchemaRef.current = formSchema;
  }, [formSchema]);
  useEffect(() => {
    reviewStateRef.current = reviewState;
  }, [reviewState]);
  useEffect(() => {
    uploadFieldsRef.current = uploadFields;
  }, [uploadFields]);
  useEffect(() => {
    uploadReviewRef.current = uploadReview;
  }, [uploadReview]);

  const updateUploadReview = useCallback((id, patch) => {
    setUploadReview((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

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

  // Loads the stored documents and ranks them per detected upload field.
  //
  // Best-effort throughout: a failed ranking must never block the review. The card
  // still renders with the full file list and no suggestion — the user can always
  // pick for themselves, which is the point of the feature. A recommendation is a
  // convenience on top of a manual choice, not a prerequisite for one.
  async function loadUploadContext(fields, tab) {
    if (fields.length === 0) return;

    let docs = [];
    try {
      ({ documents: docs } = await api.getDocuments());
      setDocuments(docs);
    } catch (err) {
      setErrorMessage(`Couldn't load your identity documents: ${err.message}`);
      return;
    }

    // The already-extracted question text is the cheapest strong signal available
    // for what kind of application this is — the words "hackathon" or "research"
    // usually appear in a question, not in the upload field's own label.
    const formText = formSchemaRef.current.map((q) => q.questionText).join(' ');

    const recommendations = await Promise.all(
      fields.map((field) =>
        api
          .recommendDocument({
            fieldLabel: `${field.label} ${field.kindLabel}`,
            pageTitle: tab.title || '',
            pageUrl: tab.url || '',
            formText,
          })
          .catch(() => null)
      )
    );

    const next = {};
    fields.forEach((field, i) => {
      const recommendation = recommendations[i];
      next[field.id] = {
        // Always 'pending'. There is no branch that starts a card in any other
        // state — a suggestion preselects a radio and nothing more.
        status: 'pending',
        selectedFileId: recommendation?.suggestedFileId ?? docs[0]?.fileId ?? null,
        recommendation,
        error: null,
        note: null,
      };
    });
    setUploadReview(next);
  }

  async function handleExtract() {
    setPhase('extracting');
    setErrorMessage(null);
    setFillReport(null);
    setUploadFields([]);
    setUploadReview({});
    try {
      const tab = await getActiveTab();
      const hostname = new URL(tab.url).hostname;
      const detectedPlatform = pickPlatform(hostname);
      setPlatform(detectedPlatform);

      const [{ result: schema }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: EXTRACTORS[detectedPlatform],
      });

      // Its own pass over every platform, rather than three extractors each growing
      // upload logic. Cheap (pure DOM, no network) and it finds custom uploaders the
      // generic extractor structurally cannot see — on most ATS pages the resume
      // field isn't a visible input[type=file] at all.
      const [{ result: detectedUploads }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: detectUploadFields,
      });
      const uploads = detectedUploads || [];

      const textFields = (schema || []).filter((q) => q.fieldType !== 'upload');
      if (textFields.length === 0 && uploads.length === 0) {
        setPhase('idle');
        setErrorMessage('No fillable fields found on this page.');
        return;
      }

      setFormSchema(schema || []);
      setUploadFields(uploads);
      // Kept current so loadUploadContext can read the questions for form context —
      // the state set above won't have flushed yet.
      formSchemaRef.current = schema || [];

      // A page with only an upload field is a complete, reviewable form now; before
      // this feature it was a dead end. Skip the (paid) generate call in that case
      // rather than asking a model to answer nothing.
      if (textFields.length === 0) {
        setReviewState({});
        setPhase('reviewing');
        await loadUploadContext(uploads, tab);
        return;
      }

      await generateAnswers(schema);
      await loadUploadContext(uploads, tab);
    } catch (err) {
      setPhase('error');
      setErrorMessage(err.message);
    }
  }

  const handleSelectDocument = useCallback(
    (fieldId, fileId) => {
      // Doubles as "undo skip": re-selecting returns the card to the approval gate
      // rather than to any auto-action.
      updateUploadReview(fieldId, { selectedFileId: fileId, status: 'pending', error: null });
    },
    [updateUploadReview]
  );

  const handleSkipUpload = useCallback(
    (fieldId) => updateUploadReview(fieldId, { status: 'skipped', error: null }),
    [updateUploadReview]
  );

  // Adds a document mid-review and selects it for this field. Does NOT approve it —
  // uploading a new file expresses "I want this available here", not "send it".
  const handleAddDocument = useCallback(
    async (fieldId, file) => {
      try {
        // Not named `document` — that shadows the global in a file that also runs
        // DOM-adjacent code, and the next reader shouldn't have to check which one
        // a bare `document` means.
        const saved = await uploadFile(file);
        const { documents: list } = await api.getDocuments();
        setDocuments(list);
        updateUploadReview(fieldId, { selectedFileId: saved.fileId, error: null });
      } catch (err) {
        updateUploadReview(fieldId, { error: err.message });
      }
    },
    [updateUploadReview]
  );

  // THE approval gate. This is the only function in the codebase that can put a file
  // on a page, it runs only from a click on "Approve upload", and it injects exactly
  // the one document selected on exactly the one field approved. It never loops over
  // fields, and nothing schedules it.
  const handleApproveUpload = useCallback(
    async (fieldId) => {
      const field = uploadFieldsRef.current.find((f) => f.id === fieldId);
      const fileId = uploadReviewRef.current[fieldId]?.selectedFileId;
      if (!field || !fileId) return;

      updateUploadReview(fieldId, { status: 'uploading', error: null, note: null });
      try {
        const tab = await getActiveTab();
        // Bytes are fetched here — at the moment of approval — and not held in state.
        // A document deleted from Settings since this panel opened 404s right here,
        // which is the intended handling of a dead reference: an honest error rather
        // than a stale blob.
        const content = await api.getDocumentContent(fileId);

        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectDocumentIntoField,
          args: [
            field.selector,
            {
              contentBase64: content.contentBase64,
              mimeType: content.mimeType,
              fileName: content.originalName,
              strategy: field.strategy,
            },
          ],
        });

        if (!result || (result.status !== 'filled' && result.status !== 'dispatched')) {
          updateUploadReview(fieldId, {
            status: 'failed',
            error: result?.reason || 'Impleo could not attach that file.',
          });
          return;
        }

        updateUploadReview(fieldId, {
          status: 'uploaded',
          error: null,
          // Carries the drop-strategy caveat when there is one; 'filled' was verified
          // by reading the input back, so it has nothing to add.
          note: result.status === 'dispatched' ? result.reason : null,
        });

        // Recorded only now, on the approved-and-injected path: "last used" means
        // "you actually sent this somewhere", and this site's remembered preference
        // reflects a choice the user saw through. Best-effort — a failed bookkeeping
        // write must not present a successful attach as a failure.
        try {
          const domain = new URL(tab.url).hostname;
          await api.markDocumentUsed(fileId, domain);
          const { documents: list } = await api.getDocuments();
          setDocuments(list);
        } catch {
          // The file is on the page; that's what the user asked for.
        }
      } catch (err) {
        updateUploadReview(fieldId, { status: 'failed', error: err.message });
      }
    },
    [updateUploadReview]
  );

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
  // Only fields Impleo can actually attach to count toward "N of M attached" — a
  // Google Drive picker would otherwise leave the counter permanently short of its
  // total, reading as a failure when it's a documented limitation.
  const injectableUploadCount = useMemo(
    () => uploadFields.filter((f) => f.injectable).length,
    [uploadFields]
  );
  const uploadedCount = useMemo(
    () => Object.values(uploadReview).filter((r) => r.status === 'uploaded').length,
    [uploadReview]
  );
  // A requested document that's still sitting at its approval gate means the
  // application isn't done, however well the text fields went.
  const uploadsResolved = useMemo(
    () =>
      uploadFields
        .filter((f) => f.injectable)
        .every((f) => ['uploaded', 'skipped'].includes(uploadReview[f.id]?.status)),
    [uploadFields, uploadReview]
  );

  // Purely a read of data handleFill already produces — not a new state path.
  // Gates CompletionState: a celebration only when nothing in the fill
  // actually failed, not on "a fill was attempted."
  const allFilledSuccessfully = useMemo(
    () =>
      Boolean(fillReport && fillReport.length > 0 && fillReport.every((r) => r.status === 'filled')) &&
      uploadsResolved,
    [fillReport, uploadsResolved]
  );

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[500px] space-y-3 p-3 sm:p-4">
      {(phase === 'idle' || phase === 'extracting' || phase === 'generating' || phase === 'error') && (
        <>
          <HeroCard />
          <WaitingState />
          <ExtractButton phase={phase} onClick={handleExtract} />
        </>
      )}

      {errorMessage && (
        <div className="rounded-card border border-red-500/25 bg-red-950/30 p-2.5 text-body text-red-300 backdrop-blur-md break-words">
          {errorMessage}
        </div>
      )}

      {(phase === 'reviewing' || phase === 'filling') && (
        <>
          {allFilledSuccessfully && <CompletionState />}

          <div className="glass-surface min-w-0 space-y-2 rounded-card p-3 shadow-soft-sm">
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
                className="min-w-[9rem] flex-1 rounded-btn bg-brand px-2.5 py-1.5 text-caption font-medium text-jungle transition-colors duration-150 hover:bg-brand-hover hover:shadow-glow disabled:opacity-40 disabled:shadow-none"
              >
                {phase === 'filling' ? 'Filling…' : 'Fill approved'}
              </button>
            </div>
          </div>

          <StaggerContainer className="space-y-2">
            {/* Upload fields are excluded here and rendered as their own cards below:
                ReviewCard's 'upload' branch is the old dead end ("Files can't be
                filled automatically"), which this feature replaces. That branch stays
                in place as a fallback for anything the detector misses. */}
            {formSchema
              .filter((q) => q.fieldType !== 'upload')
              .map((q) => (
                <StaggerItem key={q.id}>
                  <ReviewCard
                    question={q}
                    review={reviewState[q.id]}
                    fillResult={fillReport?.find((r) => r.id === q.id)}
                    onAccept={handleAccept}
                    onEdit={handleEditAnswer}
                    onSkip={handleSkip}
                    onRegenerate={handleRegenerate}
                    onToggleRemember={handleToggleRemember}
                  />
                </StaggerItem>
              ))}
          </StaggerContainer>

          {uploadFields.length > 0 && (
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-card text-ink-primary">
                  Document{uploadFields.length === 1 ? '' : 's'} requested
                </h2>
                <span className="text-caption text-ink-muted">
                  {uploadedCount} of {injectableUploadCount} attached
                </span>
              </div>
              {/* Stated on the review surface, not just in Settings — this is the
                  moment the user is deciding whether to trust it. */}
              <p className="text-caption text-ink-muted">
                Stored locally on your device. Impleo attaches a file only when you approve it.
              </p>
              <StaggerContainer className="space-y-2">
                {uploadFields.map((field) => (
                  <StaggerItem key={field.id}>
                    <ReviewUploadCard
                      field={field}
                      review={uploadReview[field.id]}
                      documents={documents}
                      onSelect={handleSelectDocument}
                      onApprove={handleApproveUpload}
                      onSkip={handleSkipUpload}
                      onAddDocument={handleAddDocument}
                    />
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
