// LLM provider adapters. The extension is single-provider at a time (the user
// picks one active provider in Settings — no auto-fallback chain); this module
// just normalizes each vendor's chat API to one shape so generate.js and
// settings.js (testApiKey) don't care which one is active.
//
// Deliberately a flat map of the four providers we support, NOT a plugin
// registry — per AGENTS.md, don't turn this into a generic extensible system.
// To add a provider, add an entry to PROVIDERS + KEY_COLUMN + MODEL_COLUMN.
//
// Model IDs are NOT hardcoded per vendor's release cycle — they change too
// often (and what's on a free tier changes too) to bake into code. Each
// provider has a DEFAULT_MODELS suggestion only; the user can type any model
// string for their chosen provider in Settings, and that's what's actually
// sent on every call.
//
// CLIENT-ONLY PRODUCTION PIVOT: these fetch() calls now run directly from the
// side panel, not from a local Express server. Anthropic's API rejects
// browser-origin requests by default (an anti-abuse measure aimed at people
// shipping keys inside public web apps) unless the caller opts in with
// `anthropic-dangerous-direct-browser-access: true` — a real, published
// Anthropic header built for exactly this bring-your-own-key browser case,
// not a workaround. The Phase 0 spike (see docs/OUTCOME.md) confirmed the
// underlying mechanism — a side panel making a direct cross-origin fetch()
// with no server in between — works, using Groq (no browser restriction).
// Anthropic itself still needs a real-key confirmation before merge, per the
// deferred verification item recorded there; this header is what that test
// will exercise.

// Suggested starting point per provider, shown as a placeholder in Settings —
// not enforced. Pick whatever your account/free-tier actually has access to.
export const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
};

function apiError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// --- Anthropic (Messages API) ---
async function anthropicChat({ apiKey, model, systemPrompt, userContent, maxTokens }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Required for a direct browser-origin call — see the module comment
      // above. Without this, Anthropic rejects the request before it ever
      // reaches model inference, regardless of how valid the key is.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw apiError(res.status, body?.error?.message || `Anthropic API returned ${res.status}`);
  }
  const body = await res.json();
  const text = body?.content?.[0]?.text;
  if (typeof text !== 'string') throw apiError(502, 'Anthropic response had no text content');
  return text;
}

// --- OpenAI-compatible (OpenAI and Groq share the same wire format — Groq is
// NOT the same service as xAI's "Grok"; api.groq.com is Groq Cloud's fast
// inference of open models like Llama) ---
// The system prompt goes in as a leading system message rather than a separate
// field, which is the one shape difference from Anthropic above.
function makeOpenAICompatible({ name, url }) {
  return async function chat({ apiKey, model, systemPrompt, userContent, maxTokens }) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw apiError(res.status, body?.error?.message || `${name} API returned ${res.status}`);
    }
    const body = await res.json();
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw apiError(502, `${name} response had no text content`);
    return text;
  };
}

// --- Google Gemini (generateContent) ---
// Different shape again: system prompt is `systemInstruction`, the user turn is
// `contents`, the model rides in the URL path, and the key rides in a header
// rather than Authorization: Bearer.
async function geminiChat({ apiKey, model, systemPrompt, userContent, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw apiError(res.status, body?.error?.message || `Gemini API returned ${res.status}`);
  }
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') throw apiError(502, 'Gemini response had no text content');
  return text;
}

export const PROVIDERS = {
  anthropic: { id: 'anthropic', label: 'Anthropic (Claude)', chat: anthropicChat },
  gemini: { id: 'gemini', label: 'Google Gemini', chat: geminiChat },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    chat: makeOpenAICompatible({ name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions' }),
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    chat: makeOpenAICompatible({ name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions' }),
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

// Which field of the `settings` object (lib/settings.js) holds each
// provider's key/model. Used by settings.js and generate.js; kept here so the
// provider list has a single source of truth. (Was "which SQLite column"
// server-side — same field names now double as the object keys inside the
// chrome.storage.local `settings` blob, so nothing here needed to change.)
export const KEY_COLUMN = {
  anthropic: 'anthropic_key',
  gemini: 'gemini_key',
  openai: 'openai_key',
  groq: 'groq_key',
};

export const MODEL_COLUMN = {
  anthropic: 'anthropic_model',
  gemini: 'gemini_model',
  openai: 'openai_model',
  groq: 'groq_model',
};

// A minimal call to verify a key + model work before saving. Reuses chat()
// with a tiny token budget so we exercise the exact code path real calls use.
export async function testProviderKey(providerId, apiKey, model) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw apiError(400, `Unknown provider: ${providerId}`);
  await provider.chat({
    apiKey,
    model: model || DEFAULT_MODELS[providerId],
    systemPrompt: 'You are a connectivity test.',
    userContent: 'Say OK.',
    maxTokens: 10,
  });
  return true;
}
