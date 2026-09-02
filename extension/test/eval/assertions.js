// Deterministic quality checks over a generated answer set.
//
// Shared by the CI test (against a mocked provider) and by run-live.mjs
// (against a real one), so a rule enforced in CI is the same rule the live
// scores report. No API key, no network, no model judgement — everything here
// is mechanically checkable.
//
// These are the FLOOR, not the definition of a good answer. They catch answers
// that are provably wrong (an option that isn't on the form, a limit blown, an
// invented number). Whether an answer actually sounds like the applicant is
// what the LLM-judge rubric in run-live.mjs is for.

import { findVoiceViolations } from '../../src/sidepanel/lib/voiceRules.js';
import { extractLengthHint, countWords } from '../../src/sidepanel/lib/lengthHints.js';

const CHOICE_TYPES = new Set(['radio', 'dropdown', 'checkbox_single']);

function asText(answer) {
  if (answer == null) return '';
  return Array.isArray(answer) ? answer.join(' ') : String(answer);
}

/**
 * A choice answer must be a string copied verbatim from that field's options.
 * This is the single most consequential mechanical failure in the product: an
 * option the page doesn't have cannot be injected, so the field silently stays
 * blank on a form the user believed was filled.
 */
export function checkVerbatimOptions(field, answer) {
  if (CHOICE_TYPES.has(field.fieldType)) {
    if (answer == null) return null; // absence is checked by checkRequiredAnswered
    if (typeof answer !== 'string') {
      return `expected a single string for ${field.fieldType}, got ${Array.isArray(answer) ? 'an array' : typeof answer}`;
    }
    if (!(field.options || []).includes(answer)) {
      return `answer ${JSON.stringify(answer)} is not one of the field's options`;
    }
    return null;
  }
  if (field.fieldType === 'checkbox') {
    if (answer == null) return null;
    if (!Array.isArray(answer)) return 'expected an array for a multi-select checkbox';
    const stray = answer.find((v) => !(field.options || []).includes(v));
    if (stray !== undefined) return `selected ${JSON.stringify(stray)}, which is not one of the options`;
  }
  return null;
}

/**
 * Respect a limit the form actually stated. Allows 10% over: word counting
 * differs between a form's own counter and ours (hyphenation, punctuation),
 * and failing an answer for one word would make the signal noise.
 */
export function checkLengthLimit(field, answer) {
  const hint = extractLengthHint(field.description);
  if (!hint) return null;
  const words = countWords(asText(answer));
  if (words === 0) return null;
  const ceiling = Math.ceil(hint.words * 1.1);
  if (words > ceiling) {
    return `${words} words against a stated limit of ${hint.limit} ${hint.unit}`;
  }
  return null;
}

/**
 * A required field must end up with something in it. Note what is NOT a
 * failure here: an honest "I don't have experience with that" IS a pass.
 * PRODUCTION_CHECKLIST.md records exactly that refusal as the proof that the
 * no-fabrication rule survived the client-only port. Penalising it would train
 * the prompt toward confident invention, which is the worst outcome this
 * product can produce.
 *
 * Upload fields are exempt: generate.js is required to answer them null.
 */
export function checkRequiredAnswered(field, answer) {
  if (!field.required || field.fieldType === 'upload') return null;
  if (asText(answer).trim() === '') return 'required field has no answer';
  return null;
}

/** No LLM tells. The list lives in lib/voiceRules.js, shared with the prompt. */
export function checkVoice(field, answer) {
  const hits = findVoiceViolations(asText(answer));
  if (hits.length === 0) return null;
  return `contains ${hits.map((h) => JSON.stringify(h.phrase)).join(', ')}`;
}

/**
 * Approximate fabrication detector: flags a number in the answer that appears
 * nowhere in the profile.
 *
 * Deliberately narrow. Invented *numbers* ("led a team of 12", "improved
 * performance by 40%") are the highest-stakes hallucination on an application
 * and are cheap to check. Proper nouns are not checked — too many legitimate
 * ones come from the question or the organisation being applied to, and the
 * false-positive rate would drown the signal.
 *
 * Years and small ordinals are ignored: they show up constantly in ordinary
 * phrasing ("the last 2 years") without being a factual claim about the person.
 */
export function checkInventedNumbers(field, answer, { profileText, questionText }) {
  const text = asText(answer);
  if (!text) return null;
  const haystack = `${profileText} ${questionText || ''}`.replace(/,/g, '');
  const invented = [];
  for (const raw of text.match(/\b\d[\d,]*(?:\.\d+)?%?\b/g) || []) {
    const bare = raw.replace(/[,%]/g, '');
    const n = Number(bare);
    if (!Number.isFinite(n)) continue;
    if (n <= 10) continue; // ordinals, "3 years", counts too small to be a claim
    if (n >= 1900 && n <= 2100) continue; // years
    if (haystack.includes(bare)) continue;
    invented.push(raw);
  }
  if (invented.length) return `mentions ${invented.join(', ')}, which appears nowhere in the profile`;
  return null;
}

/**
 * Prose answers should name something real. An answer that names no particular
 * from the profile is the mechanical signature of the exact complaint that
 * started this work — "professional, but anyone could have written it".
 *
 * Reported as a WARNING, not a failure: a genuinely under-grounded question
 * ("what are you looking forward to?") can legitimately have nothing specific
 * to cite, and the no-fabrication rule explicitly prefers a general answer to
 * an invented one. Counted and trended rather than enforced.
 */
export function checkSpecificity(field, answer, { particulars }) {
  if (field.fieldType !== 'textarea') return null;
  const text = asText(answer);
  if (countWords(text) < 25) return null;
  const lower = text.toLowerCase();
  const hit = particulars.some((p) => lower.includes(String(p).toLowerCase()));
  return hit ? null : 'names no specific project, employer, place or figure from the profile';
}

const FAILURES = [
  ['verbatim-option', checkVerbatimOptions],
  ['length-limit', checkLengthLimit],
  ['required-answered', checkRequiredAnswered],
  ['voice', checkVoice],
  ['invented-number', checkInventedNumbers],
];

/**
 * Runs every check over one generated answer set.
 *
 * @param {Array}  schema    the fixture's field list
 * @param {Array}  answers   what generateAnswers() returned
 * @param {object} ctx       { profileText, particulars }
 * @returns {{ failures: Array, warnings: Array, checked: number }}
 */
export function evaluateAnswers(schema, answers, ctx) {
  const byId = new Map(answers.map((a) => [a.id, a]));
  const failures = [];
  const warnings = [];

  for (const field of schema) {
    const entry = byId.get(field.id);
    if (!entry) {
      failures.push({ id: field.id, rule: 'missing-answer', detail: 'no answer returned for this field' });
      continue;
    }
    const answer = entry.answer;
    for (const [rule, check] of FAILURES) {
      const detail = check(field, answer, { ...ctx, questionText: field.questionText });
      if (detail) failures.push({ id: field.id, rule, detail, questionText: field.questionText });
    }
    const spec = checkSpecificity(field, answer, ctx);
    if (spec) warnings.push({ id: field.id, rule: 'specificity', detail: spec, questionText: field.questionText });
  }

  return { failures, warnings, checked: schema.length };
}

export function formatReport({ failures, warnings, checked }) {
  const lines = [`${checked} fields checked — ${failures.length} failures, ${warnings.length} warnings`];
  for (const f of failures) lines.push(`  FAIL  [${f.rule}] ${f.id}: ${f.detail}`);
  for (const w of warnings) lines.push(`  warn  [${w.rule}] ${w.id}: ${w.detail}`);
  return lines.join('\n');
}
