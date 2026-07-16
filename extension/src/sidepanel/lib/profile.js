// Profile CRUD, replacing server/src/routes/profile.js + the `profile` table.
// Ported logic-for-logic: the server's JSON.stringify/JSON.parse round-trip
// through a SQLite TEXT column becomes a plain object read/write against
// chrome.storage.local, which already stores structured objects natively —
// so the serialize/deserialize step simply isn't needed here.
import { readKey, writeKey, ensureStorageVersion, STORAGE_KEYS } from './storage.js';

// Bare profile object, or null if onboarding hasn't been completed yet —
// matches the server route's shape exactly (App.jsx checks `profileResult`
// truthiness directly against this).
export async function getProfile() {
  await ensureStorageVersion();
  return readKey(STORAGE_KEYS.PROFILE, null);
}

// Throws on a non-object body — matching the server route's 400, which
// api.js's request() wrapper turned into a thrown Error for every caller.
export async function saveProfile(profile) {
  if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) {
    throw new Error('Profile body must be a JSON object');
  }
  await ensureStorageVersion();
  await writeKey(STORAGE_KEYS.PROFILE, profile);
  return { ok: true };
}
