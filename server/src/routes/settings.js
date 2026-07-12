import { Router } from 'express';
import { db } from '../db.js';
import { PROVIDERS, PROVIDER_IDS, KEY_COLUMN, MODEL_COLUMN, DEFAULT_MODELS } from '../providers.js';

const router = Router();

// Never returns raw keys to the client — only which providers have a key
// saved, each provider's saved (or suggested default) model, and which
// provider is currently active. Keys are only ever read server-side, in
// test-key.js/generate.js.
router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() || {};
  const providers = PROVIDER_IDS.map((id) => ({
    id,
    label: PROVIDERS[id].label,
    hasKey: Boolean(row[KEY_COLUMN[id]]),
    model: row[MODEL_COLUMN[id]] || '',
    defaultModel: DEFAULT_MODELS[id],
  }));
  res.json({ provider: row.provider || null, providers });
});

// Saves a key and/or model for `provider` and makes it the active one.
// Passing just `provider` (no key/model) switches the active provider to one
// that's already configured.
router.put('/', (req, res) => {
  const { provider, apiKey, model } = req.body;
  if (!provider || !PROVIDER_IDS.includes(provider)) {
    return res.status(400).json({ ok: false, error: 'A valid provider is required' });
  }
  // Ensure the single settings row exists before we UPDATE it.
  db.prepare('INSERT INTO settings (id) VALUES (1) ON CONFLICT(id) DO NOTHING').run();
  if (typeof apiKey === 'string' && apiKey) {
    // KEY_COLUMN/MODEL_COLUMN are keyed by the whitelisted provider id, so
    // this is not user-controlled SQL despite the interpolation.
    db.prepare(`UPDATE settings SET ${KEY_COLUMN[provider]} = ? WHERE id = 1`).run(apiKey);
  }
  if (typeof model === 'string' && model) {
    db.prepare(`UPDATE settings SET ${MODEL_COLUMN[provider]} = ? WHERE id = 1`).run(model);
  }
  db.prepare('UPDATE settings SET provider = ? WHERE id = 1').run(provider);
  res.json({ ok: true });
});

export default router;
