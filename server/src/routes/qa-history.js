import { Router } from 'express';
import { db } from '../db.js';

const router = Router();
export const MAX_ENTRIES = 50;

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT question, answer, context, date FROM qa_history ORDER BY id DESC LIMIT ?')
    .all(MAX_ENTRIES);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { question, answer, context, date } = req.body;
  if (typeof question !== 'string' || typeof answer !== 'string' || !question || !answer) {
    return res.status(400).json({ ok: false, error: 'question and answer must be non-empty strings' });
  }

  db.prepare(
    'INSERT INTO qa_history (question, answer, context, date) VALUES (?, ?, ?, ?)'
  ).run(question, answer, context ?? null, date ?? new Date().toISOString());

  // Single statement: keep only the MAX_ENTRIES newest rows.
  db.prepare(
    `DELETE FROM qa_history WHERE id NOT IN (
       SELECT id FROM qa_history ORDER BY id DESC LIMIT ?
     )`
  ).run(MAX_ENTRIES);

  res.json({ ok: true });
});

export default router;
