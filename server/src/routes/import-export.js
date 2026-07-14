// Profile backup (Import/Export). This file must never read or write the `settings`
// table — API keys never flow through import/export, structurally: the only imports
// below are Router, db, and the profileSchema validators.
import { Router } from 'express';
import { db } from '../db.js';
import { MAX_ENTRIES } from './qa-history.js';
import { normalizeText } from '../fieldRegistry.js';
import {
  CURRENT_SCHEMA_VERSION,
  validateEnvelope,
  validateProfile,
  validateQaHistoryEntries,
  validateIdentityMemory,
  validateLearnedAnswers,
} from '../profileSchema.js';

const router = Router();

router.get('/export', (req, res) => {
  const row = db.prepare('SELECT data FROM profile WHERE id = 1').get();
  if (!row) {
    return res.status(404).json({ ok: false, error: 'No profile saved yet.' });
  }

  const qaRows = db
    .prepare('SELECT question, answer, context, date FROM qa_history ORDER BY id DESC LIMIT ?')
    .all(MAX_ENTRIES);

  const identityRows = db.prepare('SELECT canonical_key, value FROM identity_memory').all();
  const identityMemoryObj = {};
  for (const r of identityRows) identityMemoryObj[r.canonical_key] = r.value;

  // question_norm is deliberately not exported: it's derived (normalizeText of
  // question_text), so re-deriving it on import keeps a file written against an
  // older normalization rule from importing keys the current router would never
  // look up.
  const learnedRows = db
    .prepare('SELECT question_text, answer, canonical_key FROM learned_answers ORDER BY updated_at DESC')
    .all();

  // Run the saved data back through the same validators used on import, so every file
  // Impleo exports is guaranteed importable by Impleo.
  const profile = validateProfile(JSON.parse(row.data));
  const qaHistory = validateQaHistoryEntries(qaRows);
  const identityMemory = validateIdentityMemory(identityMemoryObj);
  const learnedAnswers = validateLearnedAnswers(
    learnedRows.map((r) => ({
      questionText: r.question_text,
      answer: r.answer,
      canonicalKey: r.canonical_key,
    }))
  );

  res.json({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'impleo',
    profile,
    qaHistory,
    identityMemory,
    learnedAnswers,
  });
});

router.post('/import', (req, res) => {
  let profile;
  let qaHistory;
  let identityMemory;
  let learnedAnswers;
  try {
    ({ profile, qaHistory, identityMemory, learnedAnswers } = validateEnvelope(req.body));
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  const identityKeys = Object.keys(identityMemory);

  if (req.body?.dryRun) {
    return res.json({
      ok: true,
      summary: {
        name: profile.personal.name || null,
        qaHistoryCount: qaHistory.length,
        identityMemoryCount: identityKeys.length,
        learnedAnswerCount: learnedAnswers.length,
      },
    });
  }

  const commit = db.transaction(() => {
    db.prepare(
      `INSERT INTO profile (id, data) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    ).run(JSON.stringify(profile));

    db.prepare('DELETE FROM qa_history').run();
    const insert = db.prepare(
      'INSERT INTO qa_history (question, answer, context, date) VALUES (?, ?, ?, ?)'
    );
    // Insert oldest-first so the fresh autoincrement ids preserve the original
    // chronological order against qa-history.js's `ORDER BY id DESC` read — the
    // exported array is newest-first (same order the GET endpoint reads it in).
    for (const entry of [...qaHistory].reverse()) {
      insert.run(entry.question, entry.answer, entry.context, entry.date);
    }

    // Full-replace identity memory, consistent with the profile/qa_history overwrite
    // semantics above. source='import' so the management UI can distinguish it.
    db.prepare('DELETE FROM identity_memory').run();
    const now = new Date().toISOString();
    const insertIdentity = db.prepare(
      `INSERT INTO identity_memory (canonical_key, value, source, created_at, updated_at)
       VALUES (?, ?, 'import', ?, ?)`
    );
    for (const key of identityKeys) {
      insertIdentity.run(key, identityMemory[key], now, now);
    }

    // Full-replace, same semantics as the three stores above.
    db.prepare('DELETE FROM learned_answers').run();
    // OR REPLACE, not a plain INSERT: question_norm is re-derived here, so two rows
    // whose questions differ only in punctuation/case ("Expected CTC?" and "expected
    // ctc") collapse onto one primary key. Last one wins — the alternative is the
    // whole import throwing on a constraint the user can't see or fix.
    const insertLearned = db.prepare(
      `INSERT OR REPLACE INTO learned_answers
         (question_norm, question_text, canonical_key, answer, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'import', ?, ?)`
    );
    for (const entry of learnedAnswers) {
      const questionNorm = normalizeText(entry.questionText);
      if (!questionNorm) continue;
      insertLearned.run(questionNorm, entry.questionText, entry.canonicalKey, entry.answer, now, now);
    }
  });
  commit();

  res.json({
    ok: true,
    imported: {
      qaHistoryCount: qaHistory.length,
      identityMemoryCount: identityKeys.length,
      learnedAnswerCount: learnedAnswers.length,
    },
  });
});

export default router;
