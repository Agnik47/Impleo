// THROWAWAY — Phase 0 spike. Delete this file and revert main.jsx before Phase 1.
//
// Purpose: answer one question before we rewrite the persistence layer —
// can the side panel call each provider's API DIRECTLY, with no server/ in between?
//
// The whole client-only architecture rests on "yes". docs/PRODUCTION.md argued the
// side panel is safe because it isn't subject to the *page's* CSP (true — it's an
// extension page with its own origin, chrome-extension://<id>). But that reasoning
// never addressed the other half: whether the PROVIDER accepts a browser-origin
// request at all. Anthropic does not, by default — it blocks browser callers to stop
// people shipping their API key in a web app. The documented opt-in is:
//
//     anthropic-dangerous-direct-browser-access: true
//
// "dangerous" refers to key exposure in a *public web app*. Impleo's model is
// bring-your-own-key stored on your own machine, in extension storage a web page
// cannot read — which is the exact case the header exists for.
//
// The Anthropic test below deliberately runs TWICE — with and without the header —
// so we learn whether the header is load-bearing rather than cargo-culting it.
//
// Request shapes here are copied verbatim from server/src/providers.js so we're
// testing the real wire format we intend to ship, not a toy.

import { useState } from 'react';

const ANTHROPIC_BROWSER_HEADER = 'anthropic-dangerous-direct-browser-access';

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-5', host: 'api.anthropic.com' },
  { id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.0-flash', host: 'generativelanguage.googleapis.com' },
  { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini', host: 'api.openai.com' },
  { id: 'groq', label: 'Groq', defaultModel: 'llama-3.3-70b-versatile', host: 'api.groq.com' },
];

// --- Adapters: same wire shapes as server/src/providers.js ---

async function callAnthropic({ apiKey, model, withHeader }) {
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (withHeader) headers[ANTHROPIC_BROWSER_HEADER] = 'true';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 10,
      system: 'You are a connectivity test.',
      messages: [{ role: 'user', content: 'Say OK.' }],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Anthropic returned ${res.status}`);
  }
  const body = await res.json();
  return body?.content?.[0]?.text ?? '(no text)';
}

async function callGemini({ apiKey, model }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are a connectivity test.' }] },
        contents: [{ role: 'user', parts: [{ text: 'Say OK.' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Gemini returned ${res.status}`);
  }
  const body = await res.json();
  return body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no text)';
}

function makeOpenAICompatible({ name, url }) {
  return async function call({ apiKey, model }) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [
          { role: 'system', content: 'You are a connectivity test.' },
          { role: 'user', content: 'Say OK.' },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `${name} returned ${res.status}`);
    }
    const body = await res.json();
    return body?.choices?.[0]?.message?.content ?? '(no text)';
  };
}

const callOpenAI = makeOpenAICompatible({ name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions' });
const callGroq = makeOpenAICompatible({ name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions' });

// A network-layer CORS rejection surfaces to fetch() as an opaque "Failed to fetch"
// TypeError with no status — distinguishing that from an ordinary API error (bad key,
// bad model) is the entire point of this spike, so label it explicitly.
function describe(err) {
  const msg = String(err?.message || err);
  if (err instanceof TypeError && /fetch/i.test(msg)) {
    return `${msg}  ← BLOCKED AT NETWORK LAYER (CORS / no response). This is the failure mode we are testing for.`;
  }
  return msg;
}

export default function CorsSpike() {
  const [providerId, setProviderId] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const provider = PROVIDERS.find((p) => p.id === providerId);
  const activeModel = model.trim() || provider.defaultModel;

  function push(entry) {
    setResults((prev) => [{ ...entry, at: new Date().toLocaleTimeString() }, ...prev]);
  }

  async function run(label, fn) {
    try {
      const text = await fn();
      push({ label, ok: true, detail: `Replied: ${String(text).trim().slice(0, 60)}` });
    } catch (err) {
      push({ label, ok: false, detail: describe(err) });
    }
  }

  async function handleTest() {
    if (!apiKey.trim()) {
      push({ label: 'Setup', ok: false, detail: 'Paste an API key first.' });
      return;
    }
    setBusy(true);
    try {
      if (providerId === 'anthropic') {
        // The load-bearing experiment: same request, one variable.
        await run(`Anthropic WITHOUT ${ANTHROPIC_BROWSER_HEADER}`, () =>
          callAnthropic({ apiKey: apiKey.trim(), model: activeModel, withHeader: false })
        );
        await run(`Anthropic WITH ${ANTHROPIC_BROWSER_HEADER}: true`, () =>
          callAnthropic({ apiKey: apiKey.trim(), model: activeModel, withHeader: true })
        );
      } else {
        const fn = { gemini: callGemini, openai: callOpenAI, groq: callGroq }[providerId];
        await run(`${provider.label} direct from side panel`, () =>
          fn({ apiKey: apiKey.trim(), model: activeModel })
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[500px] space-y-3 p-4 text-body text-ink-primary">
      <div className="rounded-card border border-amber-500/30 bg-amber-950/20 p-3">
        <p className="font-medium text-amber-200">Phase 0 spike — throwaway</p>
        <p className="mt-1 text-caption text-ink-secondary">
          Proves the side panel can reach each provider directly, with no{' '}
          <code className="text-ink-primary">server/</code> running. Stop{' '}
          <code className="text-ink-primary">server/</code> before testing so nothing can pass by accident.
        </p>
        <p className="mt-2 text-caption text-ink-secondary">
          Open DevTools → Network and confirm the key is sent{' '}
          <span className="text-ink-primary">only</span> to{' '}
          <code className="text-ink-primary">{provider.host}</code>.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-caption text-ink-secondary">Provider</span>
        <select
          className="w-full rounded-btn border border-surface-border bg-surface-card px-2 py-1.5 text-body text-ink-primary"
          value={providerId}
          onChange={(e) => {
            setProviderId(e.target.value);
            setModel('');
          }}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-caption text-ink-secondary">API key (not stored — lives in React state only)</span>
        <input
          type="password"
          className="w-full rounded-btn border border-surface-border bg-surface-card px-2 py-1.5 text-body text-ink-primary"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="paste a real key"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-caption text-ink-secondary">Model</span>
        <input
          type="text"
          className="w-full rounded-btn border border-surface-border bg-surface-card px-2 py-1.5 text-body text-ink-primary"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={provider.defaultModel}
        />
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={handleTest}
        className="w-full rounded-btn bg-brand px-3 py-2 text-body font-medium text-black disabled:opacity-50"
      >
        {busy ? 'Testing…' : `Test ${provider.label} directly`}
      </button>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`min-w-0 break-words rounded-card border p-2 text-caption ${
                r.ok
                  ? 'border-green-500/30 bg-green-950/20 text-green-200'
                  : 'border-red-500/30 bg-red-950/20 text-red-200'
              }`}
            >
              <p className="font-medium">
                {r.ok ? 'PASS' : 'FAIL'} — {r.label}{' '}
                <span className="text-ink-muted">({r.at})</span>
              </p>
              <p className="mt-1 text-ink-secondary">{r.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-card border border-surface-border bg-surface-card p-3 text-caption text-ink-secondary">
        <p className="font-medium text-ink-primary">How to read the Anthropic result</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>
            WITHOUT fails + WITH passes → expected. The header is required; ship it in{' '}
            <code>providers.js</code>.
          </li>
          <li>Both pass → the header is unnecessary here. Ship without it; note it in OUTCOME.md.</li>
          <li>
            Both fail at the network layer → the client-only architecture does not work for Anthropic.
            Stop and report before writing any storage code.
          </li>
        </ul>
      </div>
    </div>
  );
}
