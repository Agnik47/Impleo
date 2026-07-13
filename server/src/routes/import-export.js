// Profile backup (Import/Export). This file must never read or write the `settings`
// table — API keys never flow through import/export, structurally: the only imports
// below are Router, db, and the profileSchema validators.
import { Router } from 'express';
import { db } from '../db.js';
import { MAX_ENTRIES } from './qa-history.js';
import {
  CURRENT_SCHEMA_VERSION,
  validateEnvelope,
  validateProfile,
  validateQaHistoryEntries,
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

  // Run the saved data back through the same validators used on import, so every file
  // Impleo exports is guaranteed importable by Impleo.
  const profile = validateProfile(JSON.parse(row.data));
  const qaHistory = validateQaHistoryEntries(qaRows);

  res.json({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'impleo',
    profile,
    qaHistory,
  });
});

router.post('/import', (req, res) => {
  let profile;
  let qaHistory;
  try {
    ({ profile, qaHistory } = validateEnvelope(req.body));
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  if (req.body?.dryRun) {
    return res.json({
      ok: true,
      summary: { name: profile.personal.name || null, qaHistoryCount: qaHistory.length },
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
  });
  commit();

  res.json({ ok: true, imported: { qaHistoryCount: qaHistory.length } });
});

export default router;
