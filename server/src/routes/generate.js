import { Router } from 'express';
import { db } from '../db.js';
import { PROVIDERS, KEY_COLUMN, MODEL_COLUMN, DEFAULT_MODELS } from '../providers.js';

const router = Router();
const MAX_HISTORY = 10;
const MAX_TOKENS = 4096;

// Resolves the active provider, its saved key, and its saved (or default)
// model from settings, or null if the user hasn't finished configuring one.
// The prompt/parse logic below is provider-neutral — only this lookup and the
// chat() call know which vendor/model is in play.
function getActiveProvider() {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const providerId = row?.provider;
  if (!providerId) return null;
  const provider = PROVIDERS[providerId];
  const apiKey = row[KEY_COLUMN[providerId]];
  if (!provider || !apiKey) return null;
  const model = row[MODEL_COLUMN[providerId]] || DEFAULT_MODELS[providerId];
  return { provider, apiKey, model };
}

function getProfile() {
  const row = db.prepare('SELECT data FROM profile WHERE id = 1').get();
  return row ? JSON.parse(row.data) : null;
}

function getRecentQaHistory() {
  return db
    .prepare('SELECT question, answer, context, date FROM qa_history ORDER BY id DESC LIMIT ?')
    .all(MAX_HISTORY);
}

function formatProfile(profile) {
  const projectLines = (profile.projects || [])
    .map((p) => `- ${p.name}: ${p.description} (tech: ${p.techStack}; impact: ${p.impact})`)
    .join('\n');

  return [
    `Name: ${profile.personal?.name || ''}`,
    `Email: ${profile.personal?.email || ''}`,
    `Phone: ${profile.personal?.phone || ''}`,
    `Location: ${profile.personal?.location || ''}`,
    `LinkedIn: ${profile.links?.linkedin || ''}`,
    `GitHub: ${profile.links?.github || ''}`,
    `Portfolio: ${profile.links?.portfolio || ''}`,
    `Education: ${profile.education || ''}`,
    `Skills: ${(profile.skills || []).join(', ')}`,
    `Interests: ${(profile.interests || []).join(', ')}`,
    `Goals: ${profile.goals || ''}`,
    'Projects:',
    projectLines || '(none provided)',
    `Achievements: ${(profile.achievements || []).join('; ') || '(none provided)'}`,
    'Resume text:',
    profile.resumeText || '(none provided)',
    'Writing sample (match this voice/tone/style):',
    profile.writingSampleText || '(none provided)',
  ].join('\n');
}

// The no-fabrication instruction is the single highest-stakes line in this
// file (AGENTS.md rule 7) — every other instruction here is negotiable,
// this one isn't.
function buildSystemPrompt(profile) {
  return `You are helping ${profile.personal?.name || 'the applicant'} fill out an application form by drafting answers in their own voice.

CRITICAL RULE — DO NOT FABRICATE: Only use facts that are literally present in the PROFILE below. Never invent company names, metrics, dates, awards, job titles, or experience that isn't stated. If the profile doesn't have enough material to answer specifically, write a genuine but more general answer rather than making up specifics. This rule is more important than sounding impressive.

PROFILE:
${formatProfile(profile)}

For each question you're given:
- fieldType "text", "textarea": write a personalized answer in the person's voice (match the writing sample's tone if provided).
- fieldType "upload": the answer must be null — these can't be filled automatically.
- fieldType "radio", "checkbox_single", "dropdown": the answer must be exactly one string copied verbatim from that question's "options" array — never paraphrase an option. If nothing fits well, pick the closest option rather than leaving it blank.
- fieldType "checkbox" (multi-select): the answer must be an array of one or more strings, each copied verbatim from "options".
- Static personal-info questions (name, email, phone, location) should be copied verbatim from the profile, not paraphrased.
- Set "confidence" to "high" only when the profile has solid, specific grounding for that answer; "medium" for a reasonable but more general answer; "low" when the profile has little relevant material and the answer is necessarily generic.
- If the input includes an "instruction" field, apply it to how you write the answer (tone, length, emphasis) without violating the no-fabrication rule above.

Respond with ONLY a raw JSON array, no markdown code fences, no commentary: [{"id": "...", "answer": ..., "confidence": "high"|"medium"|"low"}, ...] — one entry per question given, in the same order, using the exact "id" values provided.`;
}

function stripCodeFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/, '')
    .trim();
}

function parseAnswerArray(text) {
  const parsed = JSON.parse(stripCodeFences(text));
  if (!Array.isArray(parsed)) {
    throw new Error('The AI did not return a JSON array');
  }
  return parsed;
}

function requireProviderAndProfile(res) {
  const active = getActiveProvider();
  if (!active) {
    res.status(400).json({
      ok: false,
      error: 'No AI provider configured. Add an API key and pick a provider in Settings.',
    });
    return null;
  }
  const profile = getProfile();
  if (!profile) {
    res.status(400).json({ ok: false, error: 'No profile saved. Complete onboarding first.' });
    return null;
  }
  return { active, profile };
}

router.post('/generate-answers', async (req, res) => {
  const { formSchema } = req.body;
  if (!Array.isArray(formSchema) || formSchema.length === 0) {
    return res.status(400).json({ ok: false, error: 'formSchema must be a non-empty array' });
  }

  const ready = requireProviderAndProfile(res);
  if (!ready) return;
  const { active, profile } = ready;

  const systemPrompt = buildSystemPrompt(profile);
  const userContent = JSON.stringify({ formSchema, recentQaHistory: getRecentQaHistory() });

  try {
    const text = await active.provider.chat({
      apiKey: active.apiKey,
      model: active.model,
      systemPrompt,
      userContent,
      maxTokens: MAX_TOKENS,
    });
    const answers = parseAnswerArray(text);
    res.json({ ok: true, answers });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(502).json({ ok: false, error: `The AI's response wasn't valid JSON: ${err.message}` });
    }
    res.status(err.status === 401 || err.status === 403 ? 401 : 502).json({ ok: false, error: err.message });
  }
});

router.post('/regenerate-answer', async (req, res) => {
  const { question, instruction } = req.body;
  if (!question || typeof question !== 'object' || !question.id) {
    return res.status(400).json({ ok: false, error: 'question is required' });
  }

  const ready = requireProviderAndProfile(res);
  if (!ready) return;
  const { active, profile } = ready;

  const systemPrompt = buildSystemPrompt(profile);
  const userContent = JSON.stringify({
    formSchema: [question],
    recentQaHistory: getRecentQaHistory(),
    ...(instruction ? { instruction } : {}),
  });

  try {
    const text = await active.provider.chat({
      apiKey: active.apiKey,
      model: active.model,
      systemPrompt,
      userContent,
      maxTokens: MAX_TOKENS,
    });
    const answers = parseAnswerArray(text);
    if (answers.length === 0) {
      return res.status(502).json({ ok: false, error: 'The AI did not return an answer' });
    }
    res.json({ ok: true, answer: answers[0] });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(502).json({ ok: false, error: `The AI's response wasn't valid JSON: ${err.message}` });
    }
    res.status(err.status === 401 || err.status === 403 ? 401 : 502).json({ ok: false, error: err.message });
  }
});

export default router;
