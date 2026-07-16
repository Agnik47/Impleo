// Provider/key/model settings, replacing server/src/routes/settings.js +
// the `settings` table it read/wrote. Ported logic-for-logic; only the
// db.prepare() calls become readKey/writeKey against a single `settings`
// object in chrome.storage.local (see storage.js's STORAGE_KEYS.SETTINGS).
import { readKey, writeKey, ensureStorageVersion, STORAGE_KEYS } from './storage.js';
import { PROVIDERS, PROVIDER_IDS, KEY_COLUMN, MODEL_COLUMN, DEFAULT_MODELS, testProviderKey } from './providers.js';

// Mirrors the SQLite `settings` table's columns 1:1 as object fields — the
// server-era migration that upgraded a legacy single-key install into this
// per-provider shape has no equivalent here, since every client-only install
// starts fresh with this shape already.
const EMPTY_SETTINGS = Object.freeze({
  provider: null,
  anthropic_key: null,
  gemini_key: null,
  openai_key: null,
  groq_key: null,
  anthropic_model: null,
  gemini_model: null,
  openai_model: null,
  groq_model: null,
});

async function readSettingsRow() {
  await ensureStorageVersion();
  const stored = await readKey(STORAGE_KEYS.SETTINGS, null);
  return stored ? { ...EMPTY_SETTINGS, ...stored } : { ...EMPTY_SETTINGS };
}

// Never returns raw keys to the caller — only which providers have a key
// saved, each provider's saved (or suggested default) model, and which
// provider is currently active. Keys are only ever read inside
// getActiveProviderConfig() and testApiKey() below, mirroring the server
// route's own privacy contract exactly.
export async function getSettings() {
  const row = await readSettingsRow();
  const providers = PROVIDER_IDS.map((id) => ({
    id,
    label: PROVIDERS[id].label,
    hasKey: Boolean(row[KEY_COLUMN[id]]),
    model: row[MODEL_COLUMN[id]] || '',
    defaultModel: DEFAULT_MODELS[id],
  }));
  return { provider: row.provider || null, providers };
}

// Saves a key and/or model for `provider` and makes it the active one.
// Passing just `provider` (no key/model) switches the active provider to one
// that's already configured. Throws on an invalid provider — matching the
// server route's 400, which api.js's request() wrapper turned into a thrown
// Error for every existing caller.
export async function saveSettings(provider, apiKey, model) {
  if (!provider || !PROVIDER_IDS.includes(provider)) {
    throw new Error('A valid provider is required');
  }
  const row = await readSettingsRow();
  if (typeof apiKey === 'string' && apiKey) {
    row[KEY_COLUMN[provider]] = apiKey;
  }
  if (typeof model === 'string' && model) {
    row[MODEL_COLUMN[provider]] = model;
  }
  row.provider = provider;
  await writeKey(STORAGE_KEYS.SETTINGS, row);
  return { ok: true };
}

// Returns the active provider's resolved config (provider adapter, apiKey,
// model) for generate.js and documents.js's recommendation tie-break call —
// or null if nothing is configured yet. Lives here rather than duplicated in
// each caller (server-side this was exported from generate.js only, since
// that's where DB access happened to already be wired up; settings.js is the
// more natural home for "who is active right now" once settings and DB access
// are no longer coupled to one file, so callers now import it from here).
export async function getActiveProviderConfig() {
  const row = await readSettingsRow();
  const providerId = row.provider;
  if (!providerId) return null;
  const provider = PROVIDERS[providerId];
  const apiKey = row[KEY_COLUMN[providerId]];
  if (!provider || !apiKey) return null;
  const model = row[MODEL_COLUMN[providerId]] || DEFAULT_MODELS[providerId];
  return { provider, apiKey, model };
}

// Called with the provider + key currently typed into onboarding (not yet
// saved), so the user can verify before committing it. Mirrors test-key.js's
// contract exactly: a bad/missing provider or key THROWS (matching the
// original route's 400, which every other caller expects as a real Error);
// a key that fails to authenticate does NOT throw — it resolves
// { ok: false, error }, because Onboarding.jsx's handleTestKey reads
// result.ok/result.error off the body for this one specific case, with a
// separate try/catch around the whole call for anything that does throw.
export async function testApiKey(provider, apiKey, model) {
  if (!provider || !PROVIDER_IDS.includes(provider)) {
    throw new Error('A valid provider is required');
  }
  if (!apiKey) {
    throw new Error('No API key provided');
  }
  try {
    await testProviderKey(provider, apiKey, model);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
