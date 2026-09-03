// Lightweight, dependency-free token accounting for Impleo's LLM calls.
//
// We deliberately use a character-heuristic estimate instead of a real
// tokenizer: no single tokenizer is correct across Anthropic/Gemini/OpenAI/
// Groq, and adding one (tiktoken etc.) is a dependency AGENTS.md tells us to
// avoid. ~3.6 chars/token is a well-worn rule of thumb for English JSON-ish
// payloads. These numbers only drive logging and max_tokens sizing, so being
// within ~15% is more than enough.

const CHARS_PER_TOKEN = 3.6;

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / CHARS_PER_TOKEN);
}

// Adaptive completion budget. Only GENERATIVE fields ever reach the model
// (the rest are resolved deterministically), so we size against those fields,
// not the whole form.
//
// WHY THE BUDGET MATTERS IN BOTH DIRECTIONS:
//
// Too high, and Groq's (and OpenAI's) rate limiter bites: it pre-flight-checks
// (prompt_tokens + max_tokens) against your per-minute budget BEFORE generating
// anything, so a flat max_tokens=4096 books 4096 tokens against quota on every
// call even when the real answer is 80 tokens. A handful of trivial forms can
// exhaust a free tier without the model ever producing much.
//
// Too low, and answers are simply truncated. The original formula here was
// `220 + 150 * fieldCount`: three essay fields shared 670 tokens for the ENTIRE
// JSON array — about 135 words each — which is well under what a "300 words
// about yourself" question asks for. Worse, overrunning it cuts the JSON off
// mid-array, and the single JSON.parse in generate.js turns that into a total
// loss of every answer on the form, not just the long one. Both the "answers
// are too short" and "generation randomly fails" symptoms came from this
// number.
//
// So the budget is now sized per FIELD TYPE rather than per field count. A
// radio answer is one option string and needs ~20 tokens; an essay needs
// hundreds. Averaging them at 150 was simultaneously too much for the first
// and far too little for the second.
import { extractLengthHint } from './lengthHints.js';

// What each field type can actually produce. Prose is the only expensive one.
const PROSE_ALLOWANCE = 500; // ~350 words, covers a typical unstated-limit essay
const ALLOWANCE = {
  textarea: PROSE_ALLOWANCE,
  text: 60,
  radio: 20,
  dropdown: 20,
  checkbox_single: 20,
  checkbox: 40,
  upload: 0, // always answered null
};
const DEFAULT_ALLOWANCE = 120; // unknown type: assume a short free-text answer
const BUFFER = 250; // JSON scaffolding, ids, confidence/canonicalKey per entry
const FLOOR = 512;

// Per-provider ceilings. Groq's free tier has the tightest TPM budget and
// pre-flight-checks against it, so an oversized ask there is rejected outright
// rather than merely costing more — it must stay conservative. The others bill
// for what they actually generate, so a high ceiling costs nothing when the
// answer is short and prevents truncation when it isn't.
const PROVIDER_CEIL = {
  groq: 4096,
  openai: 8192,
  gemini: 8192,
  anthropic: 16384,
};
const DEFAULT_CEIL = 8192;

function allowanceFor(field) {
  if (!field || typeof field !== 'object') return DEFAULT_ALLOWANCE;
  const base = Object.prototype.hasOwnProperty.call(ALLOWANCE, field.fieldType)
    ? ALLOWANCE[field.fieldType]
    : DEFAULT_ALLOWANCE;

  // A limit the form stated itself beats our guess in both directions: it
  // stops us truncating a 600-word essay, and stops us reserving 500 tokens
  // for a field that asked for two sentences.
  const hint = extractLengthHint(field.description);
  if (hint) {
    const needed = Math.ceil(hint.tokens * 1.2); // headroom so the cap isn't the truncation
    return field.fieldType === 'textarea' ? Math.max(base, needed) : needed;
  }
  return base;
}

/**
 * @param {Array|number} fields the generative fields, or (legacy) their count
 * @param {{provider?: string}} [opts] active provider id, for its ceiling
 */
export function computeMaxTokens(fields, { provider } = {}) {
  // Legacy call sites passed generativeFields.length. Honour it rather than
  // leaving a half-migrated caller to fail at runtime, but treat each unknown
  // field as a short free-text answer, since that's all the count tells us.
  const list = typeof fields === 'number'
    ? Array.from({ length: Math.max(0, fields) }, () => null)
    : Array.isArray(fields)
      ? fields
      : [];

  const ceil = PROVIDER_CEIL[provider] ?? DEFAULT_CEIL;
  const budget = BUFFER + list.reduce((sum, f) => sum + allowanceFor(f), 0);
  return Math.max(Math.min(FLOOR, ceil), Math.min(ceil, budget));
}

// Emits the per-call token/routing breakdown to the console in the exact
// shape asked for in the optimization brief. Estimates only (see above);
// prefixed so it's greppable in DevTools.
export function logTokenMetrics({
  extracted,
  direct,
  rule,
  generated,
  skipped,
  promptTokens,
  completionTokens,
}) {
  const total = (promptTokens || 0) + (completionTokens || 0);
  const lines = [
    `[Impleo tokens] Fields extracted: ${extracted}`,
    `  Direct lookup:    ${direct}`,
    `  Rule-based:       ${rule}`,
    `  LLM generated:    ${generated}`,
  ];
  if (skipped) lines.push(`  Skipped (upload): ${skipped}`);
  lines.push(
    `  Prompt tokens:    ${promptTokens} (est.)`,
    `  Completion tokens: ${completionTokens} (est.)`,
    `  Estimated total:  ${total}`
  );
  console.log(lines.join('\n'));
}
