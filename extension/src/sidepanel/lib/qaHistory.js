// Q&A history, replacing server/src/routes/qa-history.js + the `qa_history`
// table. Ported logic-for-logic: the SQLite `ORDER BY id DESC LIMIT ?` /
// `DELETE ... WHERE id NOT IN (...)` pair (newest-first read, oldest-trimmed
// write) becomes a plain array kept oldest-first internally (append = push),
// reversed only on read.
import { readKey, writeKey, ensureStorageVersion, STORAGE_KEYS } from './storage.js';

export const MAX_ENTRIES = 50;

async function readAll() {
  await ensureStorageVersion();
  return readKey(STORAGE_KEYS.QA_HISTORY, []);
}

// Newest-first, capped at MAX_ENTRIES — matches the server route's
// `ORDER BY id DESC LIMIT ?` exactly.
export async function getQaHistory() {
  const all = await readAll();
  return [...all].reverse().slice(0, MAX_ENTRIES);
}

// Throws on a missing question/answer — matching the server route's 400,
// which api.js's request() wrapper turned into a thrown Error for every caller.
export async function appendQaHistory({ question, answer, context, date }) {
  if (typeof question !== 'string' || typeof answer !== 'string' || !question || !answer) {
    throw new Error('question and answer must be non-empty strings');
  }
  const all = await readAll();
  all.push({ question, answer, context: context ?? null, date: date ?? new Date().toISOString() });
  // Keep only the newest MAX_ENTRIES — the array-slice equivalent of the
  // server's `DELETE FROM qa_history WHERE id NOT IN (SELECT id ... LIMIT ?)`.
  const trimmed = all.slice(-MAX_ENTRIES);
  await writeKey(STORAGE_KEYS.QA_HISTORY, trimmed);
  return { ok: true };
}
