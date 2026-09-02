// A stand-in for a real LLM, installed by stubbing global fetch.
//
// Stubbing fetch rather than mocking lib/providers.js is deliberate: it keeps
// the real provider adapter in the code path, so the request shape, the header
// set, and the response parsing are all genuinely exercised. A module mock
// would skip exactly the layer most likely to break when a vendor changes
// their wire format.
//
// The default responder answers every field plausibly and within the rules.
// That matters: when a CI assertion fails against the default responder, the
// bug is in generate.js's routing/merging or in the assertion itself, never in
// a hand-maintained canned reply that drifted out of sync with the fixture.
// The non-default responders exist to prove the failure paths actually fail.

import { vi } from 'vitest';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Reads back what generate.js actually asked for, so a responder can answer
// the real request instead of a hardcoded list that silently goes stale.
function parseRequest(init) {
  const body = JSON.parse(init.body);
  const systemPrompt = body.messages?.find((m) => m.role === 'system')?.content ?? body.system ?? '';
  const userTurn = body.messages?.find((m) => m.role === 'user')?.content ?? '';
  let parsedUser = {};
  try {
    parsedUser = JSON.parse(userTurn);
  } catch {
    parsedUser = {};
  }
  return {
    model: body.model,
    maxTokens: body.max_tokens ?? body.maxOutputTokens,
    temperature: body.temperature,
    systemPrompt,
    fields: parsedUser.formSchema ?? [],
    instruction: parsedUser.instruction ?? null,
  };
}

// A grounded, in-voice answer for each field type — written to pass the
// deterministic assertions, using particulars from test/fixtures/profile.js.
export function goodResponder({ fields }) {
  return fields.map((f) => {
    if (f.fieldType === 'upload') return { id: f.id, canonicalKey: null, answer: null, confidence: 'low' };
    if (f.fieldType === 'checkbox') {
      return { id: f.id, canonicalKey: null, answer: [(f.options || [])[0]].filter(Boolean), confidence: 'medium' };
    }
    if (['radio', 'dropdown', 'checkbox_single'].includes(f.fieldType)) {
      return { id: f.id, canonicalKey: null, answer: (f.options || [])[0] ?? null, confidence: 'medium' };
    }
    if (f.fieldType === 'textarea') {
      return {
        id: f.id,
        canonicalKey: null,
        answer:
          "I built PMPML Live after the official Pune bus app stopped reporting arrival times. " +
          'The interesting problem turned out to be stale GPS: a bus under a flyover looks identical ' +
          'to a parked one, so I guess forward from last known speed. About 4,200 people use it a month now. ' +
          "I'd use this time to do the same thing for something bigger than my own commute.",
        confidence: 'high',
      };
    }
    return { id: f.id, canonicalKey: null, answer: 'Riya Menon', confidence: 'medium' };
  });
}

// Wraps a code fence around the array. Real models do this constantly, and
// stripCodeFences is supposed to handle it.
export function fencedResponder(req) {
  return { __raw: '```json\n' + JSON.stringify(goodResponder(req)) + '\n```' };
}

// Cuts the JSON off mid-array, the way hitting max_tokens does. This is the
// failure the current single JSON.parse turns into a total loss of the form.
export function truncatedResponder(req) {
  const full = JSON.stringify(goodResponder(req));
  return { __raw: full.slice(0, Math.floor(full.length * 0.6)) };
}

// Omits the last field entirely — the model answering fewer questions than it
// was asked, which today degrades to a silent blank card.
export function missingFieldResponder(req) {
  return goodResponder(req).slice(0, -1);
}

// Answers in fluent application-ese. Every one of these should trip the voice
// assertion; if it doesn't, the banned-phrase list isn't doing its job.
export function genericAiResponder({ fields }) {
  return fields.map((f) => {
    if (f.fieldType === 'upload') return { id: f.id, canonicalKey: null, answer: null, confidence: 'low' };
    if (['radio', 'dropdown', 'checkbox_single'].includes(f.fieldType)) {
      return { id: f.id, canonicalKey: null, answer: (f.options || [])[0] ?? null, confidence: 'medium' };
    }
    if (f.fieldType === 'textarea') {
      return {
        id: f.id,
        canonicalKey: null,
        answer:
          'As a passionate and highly motivated engineer, I am deeply passionate about leveraging my ' +
          'unique blend of skills to delve into challenging problems. This opportunity perfectly aligns ' +
          'with my long-term goals, and I am excited by the opportunity to contribute to your ' +
          'cutting-edge mission in this ever-evolving landscape.',
        confidence: 'high',
      };
    }
    return { id: f.id, canonicalKey: null, answer: 'Riya Menon', confidence: 'medium' };
  });
}

/**
 * Installs the fetch stub. Returns a handle exposing what was actually sent,
 * so tests can assert on the prompt and the budget, not just the answers.
 *
 * @param {Function} responder receives the parsed request, returns either an
 *   array of answer objects, or `{ __raw: string }` to control the raw text.
 */
export function installFakeProvider(responder = goodResponder) {
  const calls = [];

  const stub = vi.fn(async (url, init) => {
    const req = parseRequest(init);
    calls.push({ url, ...req });

    const produced = responder(req);
    const content =
      produced && typeof produced === 'object' && '__raw' in produced
        ? produced.__raw
        : JSON.stringify(produced);

    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content } }] };
      },
    };
  });

  globalThis.fetch = stub;
  return {
    calls,
    get lastCall() {
      return calls[calls.length - 1];
    },
    stub,
  };
}

/** Installs a provider that fails with a given HTTP status (e.g. 429). */
export function installFailingProvider(status, message = 'rate limit exceeded') {
  const stub = vi.fn(async () => ({
    ok: false,
    status,
    async json() {
      return { error: { message } };
    },
  }));
  globalThis.fetch = stub;
  return { stub };
}

// Settings the fake provider expects: Groq, because its OpenAI-compatible
// response shape is the one installFakeProvider returns.
export const FAKE_SETTINGS = {
  provider: 'groq',
  groq_key: 'test-key-not-real',
  groq_model: 'openai/gpt-oss-120b',
};

export { GROQ_URL };
