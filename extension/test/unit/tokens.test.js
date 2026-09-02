// The completion budget is where answer length is decided, so this is where
// "the essays come out too short" is either caused or fixed.
//
// The pre-2026-08-29 formula was `220 + 150 * fieldCount`, clamped [512, 4096].
// Three essay fields shared 670 tokens for the ENTIRE JSON array — roughly 135
// words each — and blowing that ceiling truncated the JSON mid-array, which the
// single JSON.parse turned into a total loss of the form. Both failures came
// from the same number. The tests below pin the properties that stop it
// recurring.

import { describe, it, expect } from 'vitest';
import { computeMaxTokens, estimateTokens } from '../../src/sidepanel/lib/tokens.js';

const prose = (over = {}) => ({ fieldType: 'textarea', ...over });
const short = (over = {}) => ({ fieldType: 'text', ...over });
const choice = (over = {}) => ({ fieldType: 'radio', options: ['Yes', 'No'], ...over });

describe('estimateTokens', () => {
  it('is zero for empty input', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(null)).toBe(0);
  });

  it('grows with length', () => {
    expect(estimateTokens('a'.repeat(360))).toBeGreaterThan(estimateTokens('a'.repeat(36)));
  });
});

describe('computeMaxTokens', () => {
  it('gives a single essay room for a real answer, not a paragraph', () => {
    // ~350 words of prose is about 500 tokens. Anything below that and a
    // "300 words about yourself" answer cannot physically fit.
    expect(computeMaxTokens([prose()])).toBeGreaterThanOrEqual(400);
  });

  it('scales with the number of essays instead of making them share', () => {
    const one = computeMaxTokens([prose()]);
    const three = computeMaxTokens([prose(), prose(), prose()]);
    expect(three).toBeGreaterThan(one * 2);
  });

  it('does not spend essay-sized budget on choice fields', () => {
    // A radio answer is one option string. Budgeting 400 tokens for it books
    // quota against Groq's per-minute limit for output that cannot be produced.
    const essays = computeMaxTokens([prose(), prose()]);
    const choices = computeMaxTokens([choice(), choice()]);
    expect(choices).toBeLessThan(essays);
  });

  it('honours a limit the form actually stated', () => {
    const stated = computeMaxTokens([prose({ description: 'Max 500 words.' })]);
    const unstated = computeMaxTokens([prose()]);
    expect(stated).toBeGreaterThan(unstated);
  });

  it('never returns zero or a negative budget', () => {
    // A zero budget silently produces an empty completion, which reads as "the
    // AI gave up" rather than "we asked for nothing".
    expect(computeMaxTokens([])).toBeGreaterThan(0);
    expect(computeMaxTokens([short()])).toBeGreaterThan(0);
  });

  it('accepts a bare count for backwards compatibility', () => {
    // Older call sites passed generativeFields.length. Keep them working
    // rather than leaving a half-migrated call site to fail at runtime.
    expect(computeMaxTokens(3)).toBeGreaterThan(0);
  });

  it('stays within a provider ceiling when one is given', () => {
    // Groq pre-flight-checks (prompt_tokens + max_tokens) against the TPM
    // budget BEFORE generating, so an oversized ask is rejected outright
    // rather than merely costing more.
    const many = Array.from({ length: 20 }, () => prose());
    const groq = computeMaxTokens(many, { provider: 'groq' });
    const anthropic = computeMaxTokens(many, { provider: 'anthropic' });
    expect(groq).toBeLessThanOrEqual(anthropic);
  });
});
