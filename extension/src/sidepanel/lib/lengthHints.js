// Parses a stated length limit out of a field's help text.
//
// Forms state limits in prose ("Max 150 words", "in 500 characters or less",
// "2-3 sentences") far more often than they enforce them with a maxlength
// attribute. Two separate things need this number and must agree on it:
// tokens.js, to size the completion budget so the answer isn't truncated
// mid-sentence, and the eval assertions, to check the answer respected it.
// One parser, so a limit the budget honours is the same limit the eval grades.
//
// Returns null when no limit is stated. Null means "no stated limit", NOT
// "zero" — callers must fall back to their own default rather than treating a
// missing hint as a tiny budget.

// ~1.4 tokens per English word is a reasonable working figure; tokens.js's own
// 3.6-chars-per-token heuristic implies roughly the same thing for prose. Only
// used for budget sizing, so being within ~15% is fine.
const TOKENS_PER_WORD = 1.4;
const WORDS_PER_SENTENCE = 20;
const CHARS_PER_WORD = 5.5;

const WORD_PATTERNS = [
  // "max 150 words", "maximum of 150 words", "no more than 150 words"
  /(?:max(?:imum)?(?:\s+of)?|no\s+more\s+than|under|within|up\s+to|limit(?:ed)?\s+to)\s*(\d{2,4})\s*words?/i,
  // "150 words max", "150 words or less", "150-word limit"
  /(\d{2,4})[\s-]*words?\s*(?:or\s+(?:less|fewer)|max(?:imum)?|limit)/i,
  // "in 150 words"
  /\bin\s+(\d{2,4})\s*words?\b/i,
  // bare "150 words" — last, so the more specific patterns win first
  /\b(\d{2,4})\s*words?\b/i,
];

const CHAR_PATTERNS = [
  /(?:max(?:imum)?(?:\s+of)?|no\s+more\s+than|under|within|up\s+to|limit(?:ed)?\s+to)\s*(\d{2,5})\s*characters?/i,
  /(\d{2,5})\s*characters?\s*(?:or\s+(?:less|fewer)|max(?:imum)?|limit)/i,
  /\b(\d{2,5})\s*characters?\b/i,
];

// "2-3 sentences", "in two or three sentences", "3 sentences max"
const SENTENCE_RANGE = /\b(\d{1,2})\s*(?:-|–|to|or)\s*(\d{1,2})\s*sentences?\b/i;
const SENTENCE_SINGLE = /\b(\d{1,2})\s*sentences?\b/i;

function firstMatch(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * @returns {null | { unit: 'words'|'characters'|'sentences', limit: number, words: number, tokens: number }}
 *   `words` is the limit normalized to a word count (so callers have one
 *   comparable number), `tokens` is the completion budget it implies.
 */
export function extractLengthHint(description) {
  const text = String(description || '');
  if (!text.trim()) return null;

  const words = firstMatch(text, WORD_PATTERNS);
  if (words != null) {
    return { unit: 'words', limit: words, words, tokens: Math.ceil(words * TOKENS_PER_WORD) };
  }

  const characters = firstMatch(text, CHAR_PATTERNS);
  if (characters != null) {
    const asWords = Math.ceil(characters / CHARS_PER_WORD);
    return {
      unit: 'characters',
      limit: characters,
      words: asWords,
      tokens: Math.ceil(asWords * TOKENS_PER_WORD),
    };
  }

  // Take the upper bound of a range — "2-3 sentences" means 3 is allowed, and
  // budgeting for 2 would truncate a legitimate answer.
  const range = text.match(SENTENCE_RANGE);
  const single = range ? null : text.match(SENTENCE_SINGLE);
  const sentences = range ? Number(range[2]) : single ? Number(single[1]) : null;
  if (sentences != null && Number.isFinite(sentences) && sentences > 0) {
    const asWords = sentences * WORDS_PER_SENTENCE;
    return {
      unit: 'sentences',
      limit: sentences,
      words: asWords,
      tokens: Math.ceil(asWords * TOKENS_PER_WORD),
    };
  }

  return null;
}

// Word count used by both the budget and the eval's limit check, so an answer
// can't pass one and fail the other on a tokenization disagreement.
export function countWords(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

// A stated limit is itself a strong, language-independent signal that a field
// wants prose — a form does not say "max 150 words" about a dropdown. Used by
// promptContext.js so prose detection doesn't depend only on English keywords.
export function hasLengthHint(description) {
  return extractLengthHint(description) != null;
}
