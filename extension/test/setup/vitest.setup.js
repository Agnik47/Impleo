// Vitest-only wiring around the plain chrome stub.
//
// Each test starts from an empty store. Without this, a profile seeded by one
// test silently grounds another test's answers — exactly the kind of invisible
// cross-contamination that makes an eval score meaningless.
import { beforeEach } from 'vitest';
import { resetStorage } from './chromeStub.js';

// jsdom ships no CSS.escape, which the content-script extractors use to build a
// `label[for="..."]` selector. Chrome has had it since 2016, so its absence is a
// gap in the test environment rather than something the shipped code should
// defend against — polyfilled here instead of littering the extractors with
// guards for a browser that doesn't exist. Only installed under a DOM
// environment; the node-environment tests never touch it.
if (typeof globalThis.document !== 'undefined' && typeof globalThis.CSS?.escape !== 'function') {
  const escapeIdent = (value) =>
    String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  globalThis.CSS = { ...(globalThis.CSS || {}), escape: escapeIdent };
}

beforeEach(() => {
  resetStorage();
});
