// Learned-answer CRUD. Like identity-memory.js, this file must never read or write
// the `settings` table — learned answers are unrelated to API keys.
//
// The write policy (which field types and answer lengths may be learned, and which
// source can overwrite which) lives in learnedMemory.js, not here. This route is
// transport only.
import { Router } from 'express';
import { db } from '../db.js';
import { labelFor } from '../fieldRegistry.js';
import { isLearnable, saveLearnedAnswer, deleteLearnedAnswer } from '../learnedMemory.js';

const router = Router();

// Everything learned, newest first — the management UI's list.
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT question_norm, question_text, canonical_key, answer, source, updated_at
       FROM learned_answers ORDER BY updated_at DESC`
    )
    .all();
  res.json(
    rows.map((r) => ({
      questionNorm: r.question_norm,
      questionText: r.question_text,
      canonicalKey: r.canonical_key,
      canonicalLabel: r.canonical_key ? labelFor(r.canonical_key) : null,
      answer: r.answer,
      source: r.source,
      updatedAt: r.updated_at,
    }))
  );
});

// Upsert one learned answer. The side panel calls this the moment a user accepts or
// edits an answer, so it is deliberately forgiving about being asked to learn things
// it won't: an unlearnable field (an essay, an empty answer) is a no-op success, not
// a 400. The caller is a fire-and-forget side effect of clicking Accept — failing it
// loudly would put an error in front of a user whose click otherwise worked fine.
router.put('/', (req, res) => {
  const { questionText, answer, canonicalKey, fieldType, source } = req.body || {};

  if (typeof questionText !== 'string' || questionText.trim() === '') {
    return res.status(400).json({ ok: false, error: 'questionText must be a non-empty string' });
  }
  if (!isLearnable({ fieldType, answer })) {
    return res.json({ ok: true, learned: false, reason: 'not-learnable' });
  }

  const questionNorm = saveLearnedAnswer({ questionText, answer, canonicalKey, source });
  if (!questionNorm) {
    return res.json({ ok: true, learned: false, reason: 'question-normalized-to-empty' });
  }
  res.json({ ok: true, learned: true, questionNorm });
});

router.delete('/:questionNorm', (req, res) => {
  deleteLearnedAnswer(req.params.questionNorm);
  res.json({ ok: true });
});

export default router;
