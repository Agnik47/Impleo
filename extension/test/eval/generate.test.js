// End-to-end over the real generation path — routing, context selection,
// prompt construction, provider adapter, answer merging — with only the
// network faked. This is the CI floor for answer quality.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { seedStorage } from '../setup/chromeStub.js';
import { TEST_PROFILE, PROFILE_PARTICULARS } from '../fixtures/profile.js';
import { evaluateAnswers, formatReport } from './assertions.js';
import {
  installFakeProvider,
  goodResponder,
  fencedResponder,
  genericAiResponder,
  missingFieldResponder,
  FAKE_SETTINGS,
} from './fakeProvider.js';

import { generateAnswers } from '../../src/sidepanel/lib/generate.js';

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, '..', 'fixtures', 'schemas');

const fixtures = readdirSync(schemaDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(schemaDir, f), 'utf8')));

const profileText = JSON.stringify(TEST_PROFILE);
const ctx = { profileText, particulars: PROFILE_PARTICULARS };

// generateAnswers only ever sees these keys (ReviewFlow.jsx whitelists them
// before calling). Mirroring that here means the test can't accidentally pass
// by feeding the model context the real caller never sends.
function asSentSchema(schema) {
  return schema.map(({ id, questionText, fieldType, options, required, description, labelConfidence }) => ({
    id,
    questionText,
    fieldType,
    options,
    required,
    ...(description ? { description } : {}),
    ...(labelConfidence ? { labelConfidence } : {}),
  }));
}

beforeEach(() => {
  seedStorage({ settings: FAKE_SETTINGS, profile: TEST_PROFILE });
});

describe('generateAnswers over golden fixtures', () => {
  for (const fixture of fixtures) {
    it(`${fixture.name}: every field gets a usable answer`, async () => {
      installFakeProvider(goodResponder);

      const { answers } = await generateAnswers(asSentSchema(fixture.schema));

      expect(answers).toHaveLength(fixture.schema.length);
      // Every field must be accounted for, in the original form order — the
      // fill engine matches answers back to the page by id.
      expect(answers.map((a) => a.id)).toEqual(fixture.schema.map((f) => f.id));

      const result = evaluateAnswers(fixture.schema, answers, ctx);
      expect(result.failures, `\n${formatReport(result)}\n`).toEqual([]);
    });
  }

  it('answers upload fields with null — they cannot be filled from text', async () => {
    installFakeProvider(goodResponder);
    const fixture = fixtures.find((f) => f.schema.some((q) => q.fieldType === 'upload'));
    const { answers } = await generateAnswers(asSentSchema(fixture.schema));

    const uploadIds = fixture.schema.filter((q) => q.fieldType === 'upload').map((q) => q.id);
    for (const id of uploadIds) {
      expect(answers.find((a) => a.id === id).answer).toBeNull();
    }
  });

  it('routes identity fields deterministically instead of paying for them', async () => {
    const provider = installFakeProvider(goodResponder);
    const fixture = fixtures.find((f) => f.name === 'hackathon-shortform');

    const { answers } = await generateAnswers(asSentSchema(fixture.schema));

    // Email and phone are in the profile — they must be answered from it, not
    // invented by the model. This is the token-saving path AND the accuracy
    // path: a model echoing an email is a chance to get it subtly wrong.
    const email = answers.find((a) => a.id === 'h-3');
    expect(email.answer).toBe(TEST_PROFILE.personal.email);

    // Whatever did reach the model, it must be strictly fewer fields than the
    // form has — otherwise deterministic routing has stopped working.
    const sentToModel = provider.lastCall.fields.length;
    expect(sentToModel).toBeLessThan(fixture.schema.length);
  });

  it('strips code fences before parsing — real models emit them constantly', async () => {
    installFakeProvider(fencedResponder);
    const fixture = fixtures[0];
    const { answers } = await generateAnswers(asSentSchema(fixture.schema));
    expect(answers.some((a) => typeof a.answer === 'string' && a.answer.length > 0)).toBe(true);
  });
});

describe('the assertions actually catch bad answers', () => {
  // A harness that passes everything is worse than no harness: it produces
  // false confidence. These prove each rule fires.

  it('flags application-ese as a voice failure', async () => {
    installFakeProvider(genericAiResponder);
    const fixture = fixtures.find((f) => f.name === 'fellowship-generic');

    const { answers } = await generateAnswers(asSentSchema(fixture.schema));
    const result = evaluateAnswers(fixture.schema, answers, ctx);

    expect(result.failures.some((f) => f.rule === 'voice')).toBe(true);
  });

  it('flags a field the model silently skipped', async () => {
    installFakeProvider(missingFieldResponder);
    const fixture = fixtures.find((f) => f.name === 'fellowship-generic');

    const { answers } = await generateAnswers(asSentSchema(fixture.schema));
    const result = evaluateAnswers(fixture.schema, answers, ctx);

    // Currently this surfaces as an unanswered required field rather than an
    // explicit "the model skipped this" — Phase 3 makes that distinction
    // visible. Either way it must not pass silently.
    expect(result.failures.length).toBeGreaterThan(0);
  });
});
