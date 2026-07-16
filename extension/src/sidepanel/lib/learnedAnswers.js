// Learned-answer store, replacing BOTH server/src/routes/learned-answers.js
// (transport + the forgiving "unlearnable is a no-op, not an error"
// orchestration) AND server/src/learnedMemory.js (the write policy) — there's
// no separate Express-route layer anymore, so what used to be two files
// collapses into one.
//
// See the `learned_answers` schema comment that used to live in db.js for how
// this relates to identityMemory.js (short version: identityMemory.js owns
// values for a closed set of canonical keys; this owns answers keyed by the
// question's own text, for the long tail identityMemory structurally can't
// hold).
import { readKey, writeKey, ensureStorageVersion, STORAGE_KEYS } from './storage.js';
import { normalizeText, labelFor } from './fieldRegistry.js';

// Field types worth remembering verbatim. `textarea` is the meaningful
// omission: those are the essays ("Why do you want to join?"), and replaying
// a hackathon motivation letter verbatim into a different hackathon's form is
// a worse failure than spending the tokens to write a fresh one. Prose reuse
// already has a home — qaHistory feeds past answers to the model as
// tone/context (promptContext.js). This store is for short factual values:
// "5", "0", "Hybrid".
const LEARNABLE_FIELD_TYPES = new Set(['text', 'radio', 'checkbox_single', 'dropdown', 'checkbox']);

// A second, type-independent guard on the same principle: a long answer in a
// `text` input is prose that got past the type check, not a fact.
export const MAX_LEARNABLE_ANSWER_LENGTH = 120;

const SOURCES = new Set(['user_edit', 'user_accept', 'import']);

export function isLearnable({ fieldType, answer }) {
  if (!LEARNABLE_FIELD_TYPES.has(fieldType)) return false;
  if (typeof answer !== 'string') return false;
  const trimmed = answer.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LEARNABLE_ANSWER_LENGTH;
}

async function readAll() {
  await ensureStorageVersion();
  return readKey(STORAGE_KEYS.LEARNED_ANSWERS, {});
}

// Flat { questionNorm: { answer, canonicalKey, questionText, source } } map
// for fieldRouter.js's routeField() to read directly — mirrors the server's
// getLearnedAnswers() used internally by generate.js.
export async function getLearnedAnswersMap() {
  const all = await readAll();
  const out = {};
  for (const [questionNorm, entry] of Object.entries(all)) {
    out[questionNorm] = {
      answer: entry.answer,
      canonicalKey: entry.canonicalKey,
      questionText: entry.questionText,
      source: entry.source,
    };
  }
  return out;
}

// Everything learned, newest first — the management UI's list. Matches the
// server route's GET shape exactly.
export async function getLearnedAnswers() {
  const all = await readAll();
  return Object.entries(all)
    .sort(([, a], [, b]) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .map(([questionNorm, entry]) => ({
      questionNorm,
      questionText: entry.questionText,
      canonicalKey: entry.canonicalKey,
      canonicalLabel: entry.canonicalKey ? labelFor(entry.canonicalKey) : null,
      answer: entry.answer,
      source: entry.source,
      updatedAt: entry.updatedAt,
    }));
}

// Upsert one learned answer at the storage layer. Returns the normalized key,
// or null if the question normalized to nothing (e.g. a label that was pure
// punctuation).
//
// The guard below is the load-bearing part: it implements "AI never
// overwrites a user-confirmed value" in the storage layer rather than
// trusting every caller to remember it. A 'user_edit' row is only replaceable
// by another 'user_edit'; anything else bounces off it.
//
// SQLite enforced this with `ON CONFLICT(question_norm) DO UPDATE ... WHERE
// learned_answers.source != 'user_edit' OR excluded.source = 'user_edit'` —
// there is no equivalent conditional upsert in chrome.storage.local, so the
// exact same rule is reimplemented explicitly here as a plain if-check before
// the write, rather than trusted to the storage layer to enforce.
async function upsertLearnedAnswer({ questionText, answer, canonicalKey, source }) {
  const questionNorm = normalizeText(questionText);
  if (!questionNorm) return null;

  const all = await readAll();
  const existing = all[questionNorm];
  const incomingSource = SOURCES.has(source) ? source : 'user_accept';

  // The exact rule the SQL WHERE clause enforced: skip the write entirely if
  // an existing row is a user_edit and the incoming write is not.
  if (!(existing?.source === 'user_edit' && incomingSource !== 'user_edit')) {
    const now = new Date().toISOString();
    all[questionNorm] = {
      questionText: String(questionText),
      canonicalKey: canonicalKey ?? null,
      answer: answer.trim(),
      source: incomingSource,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await writeKey(STORAGE_KEYS.LEARNED_ANSWERS, all);
  }
  return questionNorm;
}

// Public entry point. Upsert one learned answer. Deliberately forgiving about
// being asked to learn things it won't: an unlearnable field (an essay, an
// empty answer) resolves { learned: false }, not a thrown error — the caller
// is a fire-and-forget side effect of clicking Accept (see ReviewFlow.jsx's
// learnAnswer), so failing it loudly would put an error in front of a user
// whose click otherwise worked fine. A missing questionText still throws,
// matching the server route's 400 for that one genuine caller mistake.
export async function saveLearnedAnswer({ questionText, answer, canonicalKey, fieldType, source }) {
  if (typeof questionText !== 'string' || questionText.trim() === '') {
    throw new Error('questionText must be a non-empty string');
  }
  if (!isLearnable({ fieldType, answer })) {
    return { ok: true, learned: false, reason: 'not-learnable' };
  }
  const questionNorm = await upsertLearnedAnswer({ questionText, answer, canonicalKey, source });
  if (!questionNorm) {
    return { ok: true, learned: false, reason: 'question-normalized-to-empty' };
  }
  return { ok: true, learned: true, questionNorm };
}

export async function deleteLearnedAnswer(questionNorm) {
  const all = await readAll();
  delete all[questionNorm];
  await writeKey(STORAGE_KEYS.LEARNED_ANSWERS, all);
  return { ok: true };
}

// Full replacement, used only by import (lib/importExport.js) — replaces the
// server's DELETE + INSERT OR REPLACE transaction. Deliberately BYPASSES the
// user_edit precedence guard that saveLearnedAnswer()/upsertLearnedAnswer()
// enforce above: import is a full-table replace, not an individual upsert —
// there's no existing row to protect against, since the whole store is being
// overwritten, exactly matching the original SQL's DELETE-then-bulk-insert
// semantics. question_norm is re-derived (never trusted from the import
// file) so two entries whose questions differ only in punctuation/case
// collapse onto one key — last one in the array wins, mirroring
// INSERT OR REPLACE.
export async function replaceLearnedAnswers(entries) {
  const now = new Date().toISOString();
  const next = {};
  for (const entry of entries) {
    const questionNorm = normalizeText(entry.questionText);
    if (!questionNorm) continue;
    next[questionNorm] = {
      questionText: entry.questionText,
      canonicalKey: entry.canonicalKey ?? null,
      answer: entry.answer,
      source: 'import',
      createdAt: now,
      updatedAt: now,
    };
  }
  await writeKey(STORAGE_KEYS.LEARNED_ANSWERS, next);
}
