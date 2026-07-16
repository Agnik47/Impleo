// Semantic identity memory CRUD, replacing server/src/routes/identity-memory.js
// + the `identity_memory` table. Values are keyed by a canonical key from
// fieldRegistry.js. This file must never read or write settings/profile data —
// identity memory is unrelated to API keys or the freeform profile.
import { readKey, writeKey, ensureStorageVersion, STORAGE_KEYS } from './storage.js';
import { isValidKey, labelFor } from './fieldRegistry.js';

async function readAll() {
  await ensureStorageVersion();
  return readKey(STORAGE_KEYS.IDENTITY_MEMORY, {});
}

// Returns every remembered value with its human label, for the management UI —
// same shape as the server route's GET, sorted the same way (by canonical key).
export async function getIdentityMemory() {
  const all = await readAll();
  return Object.entries(all)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([canonicalKey, entry]) => ({
      canonicalKey,
      value: entry.value,
      label: labelFor(canonicalKey) || canonicalKey,
      source: entry.source,
      updatedAt: entry.updatedAt,
    }));
}

// Flat { canonicalKey: value } map for internal prompt-building use
// (generate.js, Phase 6). Mirrors the private getIdentityMemory() helper that
// lived inside server/src/routes/generate.js reading the DB directly — now
// properly exported from the one module that owns this data, instead of
// generate.js reaching into storage on its own.
export async function getIdentityMemoryMap() {
  const all = await readAll();
  const map = {};
  for (const [key, entry] of Object.entries(all)) map[key] = entry.value;
  return map;
}

// Upsert one remembered value. Throws on an unknown key or an empty value —
// matching the server route's 400s, which every caller expects as a real Error.
export async function saveIdentityMemoryEntry(canonicalKey, value, source) {
  if (!isValidKey(canonicalKey)) {
    throw new Error(`Unknown identity field: ${canonicalKey}`);
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('value must be a non-empty string');
  }
  const all = await readAll();
  const existing = all[canonicalKey];
  const now = new Date().toISOString();
  all[canonicalKey] = {
    value: value.trim(),
    source: source === 'import' ? 'import' : 'user',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await writeKey(STORAGE_KEYS.IDENTITY_MEMORY, all);
  return { ok: true };
}

export async function deleteIdentityMemoryEntry(canonicalKey) {
  const all = await readAll();
  delete all[canonicalKey];
  await writeKey(STORAGE_KEYS.IDENTITY_MEMORY, all);
  return { ok: true };
}

// Full replacement, used only by import (lib/importExport.js) — replaces the
// server's DELETE + bulk-insert transaction. Every entry gets source='import'
// and a fresh createdAt/updatedAt, matching the original SQL exactly (the
// table was always wiped first, so there was never a prior createdAt to
// preserve for an imported row).
export async function replaceIdentityMemory(map) {
  const now = new Date().toISOString();
  const next = {};
  for (const [key, value] of Object.entries(map)) {
    next[key] = { value, source: 'import', createdAt: now, updatedAt: now };
  }
  await writeKey(STORAGE_KEYS.IDENTITY_MEMORY, next);
}
