// The model now gets told what the user is applying to. Two things have to
// hold: the context must actually reach the prompt (or the feature does
// nothing), and it must arrive with the guard that stops it becoming a new
// fabrication vector (or the feature is worse than nothing).

import { describe, it, expect, beforeEach } from 'vitest';
import { seedStorage } from '../setup/chromeStub.js';
import { TEST_PROFILE } from '../fixtures/profile.js';
import { installFakeProvider, goodResponder, FAKE_SETTINGS } from './fakeProvider.js';
import { generateAnswers } from '../../src/sidepanel/lib/generate.js';

const ESSAY = [
  {
    id: 'q-1',
    questionText: 'Why do you want to join this fellowship?',
    fieldType: 'textarea',
    options: [],
    required: true,
  },
];

const OPPORTUNITY = {
  title: 'Apply — Tandem Fellowship 2026',
  url: 'https://tandemfellowship.example.org/apply',
  orgName: 'Tandem',
  headline: 'A 12-week fellowship for engineers working on public infrastructure',
  aboutText: 'Tandem funds twelve engineers a year to spend three months on civic infrastructure projects.',
};

beforeEach(() => {
  seedStorage({ settings: FAKE_SETTINGS, profile: TEST_PROFILE });
});

describe('opportunity context', () => {
  it('reaches the system prompt', async () => {
    const provider = installFakeProvider(goodResponder);
    await generateAnswers(ESSAY, OPPORTUNITY);

    const { systemPrompt } = provider.lastCall;
    expect(systemPrompt).toContain('Tandem');
    expect(systemPrompt).toContain('12-week fellowship');
    expect(systemPrompt).toContain('civic infrastructure');
  });

  it('carries the do-not-invent guard whenever context is present', async () => {
    // Without this the model will happily infer a mission statement for an
    // organisation it knows only the name of. Rule 9 bans inventing facts
    // about the applicant; this extends the same bound to the organisation.
    const provider = installFakeProvider(goodResponder);
    await generateAnswers(ESSAY, OPPORTUNITY);

    expect(provider.lastCall.systemPrompt).toMatch(/invent facts about the organisation/i);
  });

  it('is simply absent when no context was captured', async () => {
    // A page that yields nothing readable must still produce answers — the old
    // behaviour — rather than failing the extraction.
    const provider = installFakeProvider(goodResponder);
    const { answers } = await generateAnswers(ESSAY, null);

    expect(answers).toHaveLength(1);
    expect(provider.lastCall.systemPrompt).not.toContain('WHAT THEY ARE APPLYING TO');
  });

  it('omits the block when every field came back empty', async () => {
    const provider = installFakeProvider(goodResponder);
    await generateAnswers(ESSAY, { title: '', url: '', orgName: '', headline: '', aboutText: '' });

    expect(provider.lastCall.systemPrompt).not.toContain('WHAT THEY ARE APPLYING TO');
  });
});

describe('voice rules', () => {
  it('are in the prompt, so the model is told the same rules the eval grades on', async () => {
    const provider = installFakeProvider(goodResponder);
    await generateAnswers(ESSAY, null);

    const { systemPrompt } = provider.lastCall;
    expect(systemPrompt).toContain('passionate about');
    expect(systemPrompt).toMatch(/write like a person/i);
  });
});

describe('sampling and budget', () => {
  it('sends a temperature instead of inheriting the provider default', async () => {
    const provider = installFakeProvider(goodResponder);
    await generateAnswers(ESSAY, null);

    expect(typeof provider.lastCall.temperature).toBe('number');
    expect(provider.lastCall.temperature).toBeLessThan(1);
  });

  it('budgets an essay enough room to actually be an essay', async () => {
    // The old formula gave three essays 670 tokens between them. One essay
    // must now clear that on its own.
    const provider = installFakeProvider(goodResponder);
    await generateAnswers(ESSAY, null);

    expect(provider.lastCall.maxTokens).toBeGreaterThan(670);
  });
});
