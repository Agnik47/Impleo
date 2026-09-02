// Tests for the eval's own rules. A quality harness whose checks are wrong is
// worse than none — it reports a number nobody can trust. Each rule is proven
// to fire on a real violation and to stay quiet on a legitimate answer.

import { describe, it, expect } from 'vitest';
import {
  checkVerbatimOptions,
  checkLengthLimit,
  checkRequiredAnswered,
  checkVoice,
  checkInventedNumbers,
  checkSpecificity,
} from '../eval/assertions.js';
import { PROFILE_PARTICULARS, TEST_PROFILE } from '../fixtures/profile.js';

const profileText = JSON.stringify(TEST_PROFILE);

describe('checkVerbatimOptions', () => {
  const radio = { fieldType: 'radio', options: ['Yes', 'No', 'Partially'] };

  it('accepts an exact option', () => {
    expect(checkVerbatimOptions(radio, 'Partially')).toBeNull();
  });

  it('rejects a paraphrase — the fill engine cannot click an option that is not there', () => {
    expect(checkVerbatimOptions(radio, 'Yes, partially')).toMatch(/not one of/);
  });

  it('rejects a case variation, because option matching is exact', () => {
    expect(checkVerbatimOptions(radio, 'yes')).toMatch(/not one of/);
  });

  it('rejects an array for a single-select field', () => {
    expect(checkVerbatimOptions(radio, ['Yes'])).toMatch(/expected a single string/);
  });

  it('accepts a multi-select array of real options', () => {
    const cb = { fieldType: 'checkbox', options: ['A', 'B', 'C'] };
    expect(checkVerbatimOptions(cb, ['A', 'C'])).toBeNull();
  });

  it('rejects a multi-select containing an invented option', () => {
    const cb = { fieldType: 'checkbox', options: ['A', 'B'] };
    expect(checkVerbatimOptions(cb, ['A', 'Z'])).toMatch(/not one of/);
  });

  it('ignores free-text fields entirely', () => {
    expect(checkVerbatimOptions({ fieldType: 'textarea', options: [] }, 'anything at all')).toBeNull();
  });
});

describe('checkLengthLimit', () => {
  const field = { fieldType: 'textarea', description: 'Max 20 words.' };

  it('passes an answer inside the stated limit', () => {
    expect(checkLengthLimit(field, 'Five words is well under.')).toBeNull();
  });

  it('fails an answer well over the stated limit', () => {
    expect(checkLengthLimit(field, 'word '.repeat(60))).toMatch(/against a stated limit/);
  });

  it('tolerates a small overshoot rather than failing on a counting disagreement', () => {
    expect(checkLengthLimit(field, 'word '.repeat(21))).toBeNull();
  });

  it('says nothing when the form stated no limit', () => {
    expect(checkLengthLimit({ fieldType: 'textarea' }, 'word '.repeat(500))).toBeNull();
  });
});

describe('checkRequiredAnswered', () => {
  it('fails an empty required field', () => {
    expect(checkRequiredAnswered({ required: true, fieldType: 'text' }, '')).toMatch(/no answer/);
  });

  it('fails a null required field', () => {
    expect(checkRequiredAnswered({ required: true, fieldType: 'text' }, null)).toMatch(/no answer/);
  });

  it('PASSES an honest refusal — this is the no-fabrication rule working', () => {
    // PRODUCTION_CHECKLIST.md records this exact behaviour as the proof the
    // no-fabrication rule survived the client-only port. Failing it here would
    // push the prompt toward confident invention, the worst possible outcome.
    const answer = "I don't have any experience with Django to describe.";
    expect(checkRequiredAnswered({ required: true, fieldType: 'textarea' }, answer)).toBeNull();
  });

  it('exempts upload fields, which are required to be null', () => {
    expect(checkRequiredAnswered({ required: true, fieldType: 'upload' }, null)).toBeNull();
  });
});

describe('checkVoice', () => {
  it('flags the classic tells', () => {
    const answer = 'As a passionate engineer, I am excited by the opportunity to leverage my unique blend of skills.';
    expect(checkVoice({}, answer)).toMatch(/contains/);
  });

  it('leaves a plainly-written answer alone', () => {
    const answer =
      "I built a bus tracker because the official app stopped showing arrival times and I kept missing the 8:05.";
    expect(checkVoice({}, answer)).toBeNull();
  });
});

describe('checkInventedNumbers', () => {
  const ctx = { profileText, questionText: '' };

  it('flags a metric that appears nowhere in the profile', () => {
    expect(checkInventedNumbers({}, 'I led a team of 45 engineers.', ctx)).toMatch(/appears nowhere/);
  });

  it('accepts a figure that is genuinely in the profile', () => {
    expect(checkInventedNumbers({}, 'About 4200 people use it monthly.', ctx)).toBeNull();
  });

  it('ignores years, which are ordinary phrasing rather than a claim', () => {
    expect(checkInventedNumbers({}, 'I have been building things since 2019.', ctx)).toBeNull();
  });

  it('ignores small numbers, which are usually counts rather than metrics', () => {
    expect(checkInventedNumbers({}, 'There were three of us on the team.', ctx)).toBeNull();
  });

  it('does not flag a number that came from the question itself', () => {
    const withQuestion = { profileText, questionText: 'Describe your work over the last 18 months.' };
    expect(checkInventedNumbers({}, 'Over the last 18 months I focused on transit data.', withQuestion)).toBeNull();
  });
});

describe('checkSpecificity', () => {
  const field = { fieldType: 'textarea' };
  const ctx = { particulars: PROFILE_PARTICULARS };

  it('warns when a long prose answer names nothing real', () => {
    const vague =
      'I have always been interested in building software that helps people. I enjoy working on ' +
      'challenging problems and learning new technologies along the way, and I care a great deal ' +
      'about the impact my work has on the people who use it every day.';
    expect(checkSpecificity(field, vague, ctx)).toMatch(/names no specific/);
  });

  it('stays quiet when the answer cites something concrete', () => {
    const grounded =
      'I built PMPML Live after the official Pune bus app stopped reporting arrival times, and the ' +
      'hard part turned out to be stale GPS pings rather than anything to do with maps at all.';
    expect(checkSpecificity(field, grounded, ctx)).toBeNull();
  });

  it('does not judge short answers, which have no room to be specific', () => {
    expect(checkSpecificity(field, 'Developer Tools.', ctx)).toBeNull();
  });
});
