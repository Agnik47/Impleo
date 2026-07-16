// The one place that owns the chrome.storage.local connection -- the client-only
// build's replacement for server/src/db.js. Deliberately thin: this file knows
// nothing about what a profile, a setting, or a learned answer looks like, the
// same way db.js never built response objects -- each domain module
// (settings.js, profile.js, qaHistory.js, identityMemory.js, learnedAnswers.js,
// importExport.js) owns its own shape and defaults, and calls readKey/writeKey
// here. IndexedDB (for document bytes) is a separate concern, owned by
// documents.js -- this file is storage.local only.
//
// Uses the promise-native chrome.storage API (no callback passed) rather than
// wrapping chrome.runtime.lastError callbacks by hand -- available since
// Chrome 88, which every MV3-capable Chrome already is, and it already rejects
// with a real Error on failure (e.g. QUOTA_BYTES_PER_ITEM exceeded), which is
// exactly the "throw real Errors, not { ok: false }" contract every caller in
// this codebase depends on (see docs/OUTCOME.md's note on api.js's callers all
// doing `catch (err) { setError(err.message) }`).

export const STORAGE_KEYS = Object.freeze({
  STORAGE_VERSION: 'storageVersion',
  SETTINGS: 'settings',
  PROFILE: 'profile',
  QA_HISTORY: 'qaHistory',
  IDENTITY_MEMORY: 'identityMemory',
  LEARNED_ANSWERS: 'learnedAnswers',
  DOCUMENT_PREFERENCES: 'documentPreferences',
});

// Bump when a stored shape changes in a way old data can't just default into.
// v1 is the only version that has ever existed for the client-only build --
// nothing to migrate from yet. Mirrors profileSchema.js's CURRENT_SCHEMA_VERSION
// reasoning: build a migrations[fromVersion] map when a v2 actually ships, not
// speculatively now. This replaces db.js's `ALTER TABLE ... ADD COLUMN` block,
// which existed for the exact same reason (upgrading an install created before
// a shape change) but had a real prior case (the multi-provider settings
// migration) to handle; this one doesn't, yet.
export const CURRENT_STORAGE_VERSION = 1;

// Reads one key. Returns `fallback` when the key has never been written --
// chrome.storage.local.get on a missing key resolves with `{}`, not an error or
// `undefined` on the key itself, so "never set" and "explicitly cleared" would
// otherwise be indistinguishable. Every domain module's "not configured yet"
// check (e.g. `profile === null` meaning "onboarding not done") depends on this
// fallback being caller-supplied rather than a hardcoded `undefined`.
export async function readKey(key, fallback) {
  const result = await chrome.storage.local.get(key);
  return Object.prototype.hasOwnProperty.call(result, key) ? result[key] : fallback;
}

export async function writeKey(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function removeKey(key) {
  await chrome.storage.local.remove(key);
}

// Checked once per side-panel session (each domain module's first read calls
// this). No-op today since there is nothing to migrate from -- see
// CURRENT_STORAGE_VERSION above -- but gives a future schema change exactly one
// place to hook into, the same role db.js's migration block served for the
// server-era multi-provider settings upgrade.
let versionChecked = false;
export async function ensureStorageVersion() {
  if (versionChecked) return;
  const stored = await readKey(STORAGE_KEYS.STORAGE_VERSION, null);
  if (stored == null) {
    await writeKey(STORAGE_KEYS.STORAGE_VERSION, CURRENT_STORAGE_VERSION);
  } else if (stored > CURRENT_STORAGE_VERSION) {
    throw new Error(
      'Your Impleo data was saved by a newer version of the extension. Update the extension before continuing.'
    );
  }
  // stored < CURRENT_STORAGE_VERSION: no migrations exist yet (see comment above).
  versionChecked = true;
}
