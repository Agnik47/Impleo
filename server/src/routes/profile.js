import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const row = db.prepare('SELECT data FROM profile WHERE id = 1').get();
  res.json(row ? JSON.parse(row.data) : null);
});

router.put('/', (req, res) => {
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, error: 'Profile body must be a JSON object' });
  }
  const data = JSON.stringify(req.body);
  db.prepare(
    `INSERT INTO profile (id, data) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`
  ).run(data);
  res.json({ ok: true });
});

export default router;
