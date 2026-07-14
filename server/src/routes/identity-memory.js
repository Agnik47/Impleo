// Semantic identity memory CRUD. Values live in the `identity_memory` table, keyed
// by a canonical key from server/src/fieldRegistry.js. This file must never read or
// write the `settings` table — identity memory is unrelated to API keys.
import { Router } from 'express';
import { db } from '../db.js';
import { isValidKey, labelFor } from '../fieldRegistry.js';

const router = Router();

// Returns every remembered value with its human label, for the management UI.
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT canonical_key, value, source, updated_at FROM identity_memory ORDER BY canonical_key')
    .all();
  res.json(
    rows.map((r) => ({
      canonicalKey: r.canonical_key,
      value: r.value,
      label: labelFor(r.canonical_key) || r.canonical_key,
      source: r.source,
      updatedAt: r.updated_at,
    }))
  );
});

// Upsert one remembered value. Rejects unknown keys so nothing outside the registry
// can enter the table.
router.put('/', (req, res) => {
  const { canonicalKey, value, source } = req.body || {};
  if (!isValidKey(canonicalKey)) {
    return res.status(400).json({ ok: false, error: `Unknown identity field: ${canonicalKey}` });
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return res.status(400).json({ ok: false, error: 'value must be a non-empty string' });
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO identity_memory (canonical_key, value, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(canonical_key) DO UPDATE SET
       value = excluded.value,
       source = excluded.source,
       updated_at = excluded.updated_at`
  ).run(canonicalKey, value.trim(), source === 'import' ? 'import' : 'user', now, now);

  res.json({ ok: true });
});

router.delete('/:key', (req, res) => {
  db.prepare('DELETE FROM identity_memory WHERE canonical_key = ?').run(req.params.key);
  res.json({ ok: true });
});

export default router;
