// The router decides what never reaches the model. Two things ride on it:
// cost (a field routed deterministically costs nothing) and correctness (a
// field routed WRONG puts the wrong value on a real application).
//
// The bias encoded here is "unknown is safer than wrong": when the router is
// unsure it must fall through to `generative`, where the model plus the human
// review step get a say. Several tests below exist specifically to prove it
// gives up rather than guessing.

import { describe, it, expect } from 'vitest';
import { routeField, buildResolvedAnswer, splitName } from '../../src/sidepanel/lib/fieldRouter.js';
import { TEST_PROFILE } from '../fixtures/profile.js';

const field = (over) => ({ id: 'x', fieldType: 'text', options: [], required: false, ...over });

describe('splitName', () => {
  it('splits on the first whitespace run', () => {
    expect(splitName('Riya Menon')).toEqual({ firstName: 'Riya', lastName: 'Menon' });
  });

  it('keeps every remaining part as the last name', () => {
    expect(splitName('Riya Anand Menon')).toEqual({ firstName: 'Riya', lastName: 'Anand Menon' });
  });

  it('leaves the last name empty for a single-word name rather than duplicating', () => {
    // The bug this guards: both First and Last Name fields receiving the full
    // name, which then poisoned identity memory under one canonical key.
    expect(splitName('Prince')).toEqual({ firstName: 'Prince', lastName: '' });
  });

  it('handles empty input without throwing', () => {
    expect(splitName('')).toEqual({ firstName: '', lastName: '' });
    expect(splitName(undefined)).toEqual({ firstName: '', lastName: '' });
  });
});

describe('routeField — free answers', () => {
  it('skips upload fields, which can never be auto-filled', () => {
    expect(routeField(field({ fieldType: 'upload' }), TEST_PROFILE, {})).toEqual({ route: 'skip' });
  });

  it('answers email straight from the profile, without the model', () => {
    const r = routeField(field({ questionText: 'Email address' }), TEST_PROFILE, {});
    expect(r.route).toBe('direct');
    expect(r.value).toBe(TEST_PROFILE.personal.email);
  });

  it('gives First Name and Last Name genuinely different values', () => {
    const first = routeField(field({ questionText: 'First Name' }), TEST_PROFILE, {});
    const last = routeField(field({ questionText: 'Last Name' }), TEST_PROFILE, {});
    expect(first.value).toBe('Riya');
    expect(last.value).toBe('Menon');
    expect(first.value).not.toBe(last.value);
  });

  it('answers a link field from the profile', () => {
    const r = routeField(field({ questionText: 'GitHub Profile' }), TEST_PROFILE, {});
    expect(r.route).toBe('direct');
    expect(r.value).toBe(TEST_PROFILE.links.github);
  });

  it('falls through to the model when the profile has no value for it', () => {
    const empty = { ...TEST_PROFILE, links: { linkedin: '', github: '', portfolio: '' } };
    const r = routeField(field({ questionText: 'GitHub Profile' }), empty, {});
    expect(r.route).toBe('generative');
  });
});

describe('routeField — choice fields', () => {
  it('rule-answers a dropdown when the held value matches a real option', () => {
    const r = routeField(
      field({ questionText: 'Which city are you based in?', fieldType: 'dropdown', options: ['Mumbai', 'Pune', 'Delhi'] }),
      TEST_PROFILE,
      {}
    );
    expect(r.route).toBe('rule');
    expect(r.value).toBe('Pune');
  });

  it('refuses to invent an option that is not on the page', () => {
    // The load-bearing guarantee: an option the page doesn't have cannot be
    // injected, so the field would silently stay blank on a submitted form.
    const r = routeField(
      field({ questionText: 'Which city are you based in?', fieldType: 'dropdown', options: ['Mumbai', 'Delhi'] }),
      TEST_PROFILE,
      {}
    );
    expect(r.route).toBe('generative');
  });

  it('wraps a multi-select answer in an array', () => {
    const r = routeField(
      field({ questionText: 'Location', fieldType: 'checkbox', options: ['Pune', 'Nashik'] }),
      TEST_PROFILE,
      {}
    );
    expect(r.value).toEqual(['Pune']);
  });
});

describe('routeField — learned answers outrank everything', () => {
  it('replays a previously confirmed answer for the same question', () => {
    const learned = {
      'how many hackathons have you participated in': {
        answer: '7',
        canonicalKey: null,
        questionText: 'How many hackathons have you participated in?',
        source: 'user_edit',
      },
    };
    const r = routeField(
      field({ questionText: 'How many hackathons have you participated in?' }),
      TEST_PROFILE,
      {},
      learned
    );
    expect(r.route).toBe('direct');
    expect(r.value).toBe('7');
  });

  it('defers to identity memory for the value when the learned row names a canonical key', () => {
    // One canonical value, one home. Otherwise editing it in Backup could be
    // silently undone by a stale copy in the learned store.
    const learned = {
      'your email': { answer: 'stale@example.com', canonicalKey: 'email', questionText: 'Your email', source: 'user_edit' },
    };
    const r = routeField(field({ questionText: 'Your email' }), TEST_PROFILE, { email: 'current@example.com' }, learned);
    expect(r.value).toBe('current@example.com');
  });

  it('does not resolve a field named after an Object prototype member', () => {
    // A form field labelled "Constructor" or "toString" would otherwise hit
    // Object.prototype and route a function as the answer.
    for (const label of ['constructor', 'toString', 'valueOf']) {
      const r = routeField(field({ questionText: label }), TEST_PROFILE, {}, {});
      expect(r.route).toBe('generative');
    }
  });
});

describe('routeField — essays always reach the model', () => {
  it('never tries to answer a motivation question from the profile', () => {
    const r = routeField(
      field({ questionText: 'Why do you want to join this fellowship?', fieldType: 'textarea' }),
      TEST_PROFILE,
      {}
    );
    expect(r.route).toBe('generative');
  });
});

describe('buildResolvedAnswer', () => {
  it('shapes a skipped upload like every other answer, so the UI needs no special case', () => {
    const a = buildResolvedAnswer('u-1', { route: 'skip' }, {});
    expect(a).toMatchObject({ id: 'u-1', answer: null, confidence: 'low', fromMemory: false });
  });

  it('reports a deterministically-resolved field at high confidence', () => {
    const routed = { route: 'direct', canonicalKey: 'email', value: 'a@b.com', source: 'profile', fromMemory: false };
    const a = buildResolvedAnswer('e-1', routed, {});
    expect(a.confidence).toBe('high');
    expect(a.classificationSource).toBe('direct');
    expect(a.answer).toBe('a@b.com');
  });

  it('marks a memory-sourced value so the UI can show where it came from', () => {
    const routed = { route: 'direct', canonicalKey: 'email', value: 'a@b.com', source: 'memory', fromMemory: true };
    const a = buildResolvedAnswer('e-1', routed, { email: 'a@b.com' });
    expect(a.classificationSource).toBe('memory');
    expect(a.fromMemory).toBe(true);
    expect(a.existingMemoryValue).toBe('a@b.com');
  });
});
