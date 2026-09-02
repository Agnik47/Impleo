// An in-memory stand-in for chrome.storage.local.
//
// This works because of a real architectural property, not a trick:
// lib/storage.js is the ONLY module in the codebase permitted to touch
// chrome.storage (AGENTS.md rule 3). Every domain module — settings, profile,
// qaHistory, identityMemory, learnedAnswers — goes through its readKey/writeKey.
// So stubbing this one API makes the whole lib/ layer runnable in Node with
// zero changes to production code.
//
// Deliberately NOT a full chrome.storage emulation: no quota accounting, no
// change events, no sync area. Tests that need those should say so explicitly
// rather than quietly relying on a stub that lies about them. Quota behaviour
// in particular is listed in PRODUCTION_CHECKLIST.md as needing a REAL browser
// — a fake store with no limit cannot verify it, and pretending otherwise
// would be worse than not testing it.
//
// Kept free of any vitest import so run-live.mjs can use it as a plain Node
// module; the vitest-specific per-test reset lives in vitest.setup.js.

let store = {};

export function seedStorage(entries) {
  Object.assign(store, structuredClone(entries));
}

export function readStorage() {
  return structuredClone(store);
}

export function resetStorage() {
  store = {};
}

const local = {
  async get(key) {
    if (key == null) return structuredClone(store);
    const keys = Array.isArray(key) ? key : [key];
    const out = {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(store, k)) out[k] = structuredClone(store[k]);
    }
    return out;
  },
  async set(entries) {
    for (const [k, v] of Object.entries(entries)) store[k] = structuredClone(v);
  },
  async remove(key) {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) delete store[k];
  },
  async clear() {
    store = {};
  },
};

export function installChromeStub() {
  globalThis.chrome = { storage: { local } };
}

installChromeStub();
