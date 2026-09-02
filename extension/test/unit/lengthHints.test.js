// The token budget and the eval's limit check both read this parser. If it
// under-reads a limit the budget truncates a legitimate answer; if it
// over-reads, the eval fails answers that were actually fine. Both directions
// matter, so both are tested.

import { describe, it, expect } from 'vitest';
import { extractLengthHint, countWords, hasLengthHint } from '../../src/sidepanel/lib/lengthHints.js';

describe('extractLengthHint — word limits', () => {
  const cases = [
    ['Max 150 words.', 150],
    ['Maximum of 300 words', 300],
    ['No more than 250 words please', 250],
    ['Please answer in 200 words', 200],
    ['500 words max', 500],
    ['150 words or less', 150],
    ['Up to 400 words.', 400],
    ['Answer within 100 words', 100],
    ['Tell us about yourself (250 words)', 250],
  ];

  for (const [text, expected] of cases) {
    it(`reads ${JSON.stringify(text)} as ${expected} words`, () => {
      const hint = extractLengthHint(text);
      expect(hint).not.toBeNull();
      expect(hint.unit).toBe('words');
      expect(hint.limit).toBe(expected);
      expect(hint.tokens).toBeGreaterThan(expected); // prose needs >1 token/word
    });
  }
});

describe('extractLengthHint — character limits', () => {
  it('reads a character cap and normalizes it to a word count', () => {
    const hint = extractLengthHint('Max 500 characters');
    expect(hint.unit).toBe('characters');
    expect(hint.limit).toBe(500);
    // 500 chars is roughly 90 words — the budget must not treat it as 500.
    expect(hint.words).toBeLessThan(120);
    expect(hint.words).toBeGreaterThan(60);
  });

  it('handles "or fewer" phrasing', () => {
    expect(extractLengthHint('280 characters or fewer').limit).toBe(280);
  });
});

describe('extractLengthHint — sentence limits', () => {
  it('takes the upper bound of a range, so the answer is not truncated', () => {
    // Budgeting for 2 when 3 are allowed cuts off a legitimate answer.
    const hint = extractLengthHint('Two or three sentences — write 2-3 sentences.');
    expect(hint.unit).toBe('sentences');
    expect(hint.limit).toBe(3);
  });

  it('reads a single sentence count', () => {
    expect(extractLengthHint('Answer in 5 sentences.').limit).toBe(5);
  });
});

describe('extractLengthHint — no limit stated', () => {
  it('returns null for help text with no limit', () => {
    expect(extractLengthHint('Tell us what you would use the time for.')).toBeNull();
  });

  it('returns null for empty or missing input', () => {
    expect(extractLengthHint('')).toBeNull();
    expect(extractLengthHint(undefined)).toBeNull();
    expect(extractLengthHint(null)).toBeNull();
  });

  it('does not mistake an unrelated number for a limit', () => {
    // Critical: a false positive here would cap a budget at nothing and
    // truncate the answer. Silence is the safe failure.
    expect(extractLengthHint('This is question 3 of 8.')).toBeNull();
    expect(extractLengthHint('Describe your 2025 internship.')).toBeNull();
  });
});

describe('countWords', () => {
  it('counts words separated by any whitespace', () => {
    expect(countWords('one two  three\nfour')).toBe(4);
  });

  it('treats empty and whitespace-only as zero', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n ')).toBe(0);
    expect(countWords(null)).toBe(0);
  });
});

describe('hasLengthHint', () => {
  it('is true when a limit is stated — a language-independent prose signal', () => {
    // A form does not say "max 150 words" about a dropdown, so this doubles as
    // evidence the field wants prose, without depending on English keywords.
    expect(hasLengthHint('Max 150 words')).toBe(true);
  });

  it('is false otherwise', () => {
    expect(hasLengthHint('Your full legal name')).toBe(false);
  });
});
