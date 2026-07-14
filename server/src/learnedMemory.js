// The learned-answer store: Impleo's memory for questions that have no canonical
// registry key. See the `learned_answers` schema comment in db.js for how this
// relates to identity_memory (short version: identity_memory owns values for a
// closed set of canonical keys; this owns answers keyed by the question's own text).
//
// Every rule about WHAT may be learned lives in this file. The side panel
// pre-filters so it doesn't fire pointless HTTP calls, but it is not trusted to
// get it right — isLearnable() is re-checked on write.
import { db } from './db.js';
import { normalizeText } from './fieldRegistry.js';

// Field types worth remembering verbatim. `textarea` is the meaningful omission:
// those are the essays ("Why do you want to join?"), and replaying a hackathon
// motivation letter verbatim into a different hackathon's form is a worse failure
// than spending the tokens to write a fresh one. Prose reuse already has a home —
// qa_history feeds past answers to the model as tone/context (promptContext.js).
// This store is for short factual values: "5", "0", "Hybrid".
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

// { question_norm: { answer, canonicalKey, questionText, source } } for the router.
export function getLearnedAnswers() {
  const rows = db
    .prepare('SELECT question_norm, question_text, canonical_key, answer, source FROM learned_answers')
    .all();
  const out = {};
  for (const r of rows) {
    out[r.question_norm] = {
      answer: r.answer,
      canonicalKey: r.canonical_key,
      questionText: r.question_text,
      source: r.source,
    };
  }
  return out;
}

// Upsert one learned answer. Returns the normalized key, or null if the question
// normalized to nothing (e.g. a label that was pure punctuation).
//
// The WHERE clause is the load-bearing part: it implements "AI never overwrites a
// user-confirmed value" (Issus.md rule 4) in the storage layer rather than trusting
// every caller to remember it. A 'user_edit' row is only replaceable by another
// 'user_edit'; anything else bounces off it.
export function saveLearnedAnswer({ questionText, answer, canonicalKey, source }) {
  const questionNorm = normalizeText(questionText);
  if (!questionNorm) return null;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO learned_answers
       (question_norm, question_text, canonical_key, answer, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(question_norm) DO UPDATE SET
       question_text = excluded.question_text,
       canonical_key = excluded.canonical_key,
       answer = excluded.answer,
       source = excluded.source,
       updated_at = excluded.updated_at
     WHERE learned_answers.source != 'user_edit' OR excluded.source = 'user_edit'`
  ).run(
    questionNorm,
    String(questionText),
    canonicalKey ?? null,
    answer.trim(),
    SOURCES.has(source) ? source : 'user_accept',
    now,
    now
  );
  return questionNorm;
}

export function deleteLearnedAnswer(questionNorm) {
  db.prepare('DELETE FROM learned_answers WHERE question_norm = ?').run(questionNorm);
}
