import { Router } from 'express';
import { PROVIDER_IDS, testProviderKey } from '../providers.js';

const router = Router();

// Called with the provider + key currently typed into the onboarding form (not
// yet saved), so the user can verify before committing it.
router.post('/', async (req, res) => {
  const { provider, apiKey, model } = req.body;
  if (!provider || !PROVIDER_IDS.includes(provider)) {
    return res.status(400).json({ ok: false, error: 'A valid provider is required' });
  }
  if (!apiKey) {
    return res.status(400).json({ ok: false, error: 'No API key provided' });
  }

  try {
    await testProviderKey(provider, apiKey, model);
    return res.json({ ok: true });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

export default router;
