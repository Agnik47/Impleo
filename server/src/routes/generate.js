import { Router } from 'express';
import { db } from '../db.js';
import { PROVIDERS, KEY_COLUMN, MODEL_COLUMN, DEFAULT_MODELS } from '../providers.js';
import {
  isValidKey,
  isRiskClusterKey,
  labelFor,
  registryPromptList,
} from '../fieldRegistry.js';
import { routeField, buildResolvedAnswer } from '../fieldRouter.js';
import { selectContext } from '../promptContext.js';
import { estimateTokens, computeMaxTokens, logTokenMetrics } from '../tokens.js';

const router = Router();
// Pool size for the qa_history relevance filter. Only a compressed subset (see
// promptContext.compressHistory) ever reaches the prompt — this just bounds the
// DB read we rank over.
const MAX_HISTORY = 10;

// Resolves the active provider, its saved key, and its saved (or default)
// model from settings, or null if the user hasn't finished configuring one.
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

// Remembered identity values as { canonical_key: value } — the semantic memory the
// user has built up. Reused verbatim across forms (see fieldRegistry.js).
function getIdentityMemory() {
  const rows = db.prepare('SELECT canonical_key, value FROM identity_memory').all();
  const memory = {};
  for (const r of rows) memory[r.canonical_key] = r.value;
  return memory;
}

// The no-fabrication instruction is the single highest-stakes line in this
// file (AGENTS.md rule 7) — every other instruction here is negotiable,
// this one isn't.
//
// `contextText` is the RELEVANCE-SELECTED profile (see promptContext.js): the
// cheap basics always, the expensive resume/writing-sample/projects only when
// a generative field actually needs them. `includeClassification` gates the
// registry/canonical-key block — omitted for forms whose generative fields
// are all clearly prose/choice (nothing identity-like to classify), saving
// those calls the registry's tokens.
function buildSystemPrompt(profile, identityMemory, contextText, includeClassification) {
  const memoryEntries = Object.entries(identityMemory || {});
  const memoryBlock = memoryEntries.length
    ? memoryEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n')
    : '(none remembered yet)';

  const classificationBlock = includeClassification
    ? `

Each question you're given may include a "canonicalKey" hint that was matched locally. Your job also includes SEMANTIC FIELD CLASSIFICATION: for every question, set a "canonicalKey" identifying what the field *means*, chosen from EXACTLY this list of valid keys (or null if none genuinely apply):
${registryPromptList()}

Classification rules:
- Match on meaning, not wording or language. "Father's Name", "Guardian Name", "Name of Father", and "पिता का नाम" all map to father_name. This works for Hindi and any other language — translate the meaning, don't require an English label.
- If a question does not clearly correspond to one of the valid keys above, set "canonicalKey" to null. Never invent a key that isn't in the list.
- If a "canonicalKey" hint is already provided on the question and it is correct, keep it.`
    : `

For every question, set "canonicalKey" to null (no identity classification is needed for this form).`;

  return `You are helping ${profile.personal?.name || 'the applicant'} fill out an application form by drafting answers in their own voice.

CRITICAL RULE — DO NOT FABRICATE: Only use facts that are literally present in the PROFILE or REMEMBERED IDENTITY below. Never invent company names, metrics, dates, awards, job titles, or experience that isn't stated. If there isn't enough material to answer specifically, write a genuine but more general answer rather than making up specifics. This rule is more important than sounding impressive.

PROFILE:
${contextText}

REMEMBERED IDENTITY (the user entered these once; reuse them verbatim when a field means the same thing):
${memoryBlock}${classificationBlock}

Answering rules:
- fieldType "text", "textarea": write a personalized answer in the person's voice (match the writing sample's tone if provided).
- fieldType "upload": the answer must be null — these can't be filled automatically.
- fieldType "radio", "checkbox_single", "dropdown": the answer must be exactly one string copied verbatim from that question's "options" array — never paraphrase an option. If nothing fits well, pick the closest option rather than leaving it blank.
- fieldType "checkbox" (multi-select): the answer must be an array of one or more strings, each copied verbatim from "options".
- Static personal-info questions (name, email, phone, location) should be copied verbatim from the profile, not paraphrased.
- Set "confidence" to "high" only when the profile/remembered identity has solid, specific grounding for that answer; "medium" for a reasonable but more general answer; "low" when there is little relevant material and the answer is necessarily generic.
- If the input includes an "instruction" field, apply it to how you write the answer (tone, length, emphasis) without violating the no-fabrication rule above.

Respond with ONLY a raw JSON array, no markdown code fences, no commentary: [{"id": "...", "canonicalKey": "..."|null, "answer": ..., "confidence": "high"|"medium"|"low"}, ...] — one entry per question given, in the same order, using the exact "id" values provided.`;
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

// Decides the final canonicalKey and a `classificationSource` for a GENERATIVE
// field (deterministically-routed fields never get here). Philosophy: "unknown
// is safer than wrong" for identity fields — a local EXACT match is trusted
// unconditionally; a local FUZZY match on a risk-cluster key requires the AI's
// independently-returned key to agree, else we resolve to unclassified.
function resolveCanonicalKey(aiAnswer, localMatch) {
  const aiKey = isValidKey(aiAnswer?.canonicalKey) ? aiAnswer.canonicalKey : null;

  if (!localMatch) {
    return { canonicalKey: aiKey, classificationSource: aiKey ? 'ai' : null };
  }
  if (localMatch.confidence === 'high') {
    return { canonicalKey: localMatch.canonicalKey, classificationSource: 'local-exact' };
  }
  if (!isRiskClusterKey(localMatch.canonicalKey)) {
    return { canonicalKey: localMatch.canonicalKey, classificationSource: 'local-fuzzy' };
  }
  if (aiKey === localMatch.canonicalKey) {
    return { canonicalKey: localMatch.canonicalKey, classificationSource: 'local-fuzzy-agreed' };
  }
  return { canonicalKey: null, classificationSource: 'unresolved' };
}

// Reconciles the AI's per-field output with the local match + remembered
// identity store, for GENERATIVE fields only. A remembered value for the final
// key is injected verbatim so reuse never depends on the model echoing it.
function mergeAnswer(aiAnswer, localMatch, identityMemory) {
  const { canonicalKey, classificationSource } = resolveCanonicalKey(aiAnswer, localMatch);

  const base = {
    id: aiAnswer?.id,
    canonicalKey: canonicalKey ?? null,
    canonicalLabel: canonicalKey ? labelFor(canonicalKey) : null,
    classificationSource,
    answer: aiAnswer?.answer ?? null,
    confidence: aiAnswer?.confidence ?? 'low',
    fromMemory: false,
    existingMemoryValue: null,
  };

  if (canonicalKey && Object.prototype.hasOwnProperty.call(identityMemory, canonicalKey)) {
    return {
      ...base,
      answer: identityMemory[canonicalKey],
      confidence: 'high',
      fromMemory: true,
      existingMemoryValue: identityMemory[canonicalKey],
    };
  }
  return base;
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

// A generative field is worth including the identity-classification block for
// if it's a short text field (identity fields are always short text) or if the
// local matcher already recognized it. Pure essay/choice forms skip the block.
function shouldClassify(generativeFields, localByIndex) {
  return generativeFields.some(
    (f, i) => f.fieldType === 'text' || Boolean(localByIndex[i])
  );
}

router.post('/generate-answers', async (req, res) => {
  const { formSchema } = req.body;
  if (!Array.isArray(formSchema) || formSchema.length === 0) {
    return res.status(400).json({ ok: false, error: 'formSchema must be a non-empty array' });
  }

  const ready = requireProviderAndProfile(res);
  if (!ready) return;
  const { active, profile } = ready;

  const identityMemory = getIdentityMemory();

  // --- Deterministic routing pass: answer everything we can for free. ---
  const routes = formSchema.map((q) => routeField(q, profile, identityMemory));
  const resolvedById = new Map();
  const generative = []; // { q, localMatch }
  let directCount = 0;
  let ruleCount = 0;
  let skipCount = 0;
  formSchema.forEach((q, i) => {
    const r = routes[i];
    if (r.route === 'generative') {
      generative.push({ q, localMatch: r.localMatch });
    } else {
      resolvedById.set(q.id, buildResolvedAnswer(q.id, r, identityMemory));
      if (r.route === 'direct') directCount += 1;
      else if (r.route === 'rule') ruleCount += 1;
      else skipCount += 1;
    }
  });

  // --- Fast path: nothing needs the model. Zero API tokens spent. ---
  if (generative.length === 0) {
    const answers = formSchema.map((q) => resolvedById.get(q.id));
    logTokenMetrics({
      extracted: formSchema.length,
      direct: directCount,
      rule: ruleCount,
      generated: 0,
      skipped: skipCount,
      promptTokens: 0,
      completionTokens: 0,
    });
    return res.json({ ok: true, answers });
  }

  // --- Only generative fields reach the LLM, with relevance-selected context. ---
  const generativeFields = generative.map((g) => g.q);
  const localByIndex = generative.map((g) => g.localMatch);
  const { profileText, history } = selectContext(profile, generativeFields, getRecentQaHistory());
  const includeClassification = shouldClassify(generativeFields, localByIndex);

  // Attach a local canonicalKey hint where we're confident, EXCEPT for a
  // risk-cluster key matched only fuzzily (withhold so the AI's answer is a
  // genuine second opinion, not "keep the hint I was just given").
  const annotatedSchema = generativeFields.map((q, i) => {
    const m = localByIndex[i];
    if (!m) return q;
    const withholdHint = m.confidence === 'medium' && isRiskClusterKey(m.canonicalKey);
    return withholdHint ? q : { ...q, canonicalKey: m.canonicalKey };
  });

  const systemPrompt = buildSystemPrompt(profile, identityMemory, profileText, includeClassification);
  const userContent = JSON.stringify({ formSchema: annotatedSchema, recentQaHistory: history });
  const maxTokens = computeMaxTokens(generativeFields.length);

  try {
    const text = await active.provider.chat({
      apiKey: active.apiKey,
      model: active.model,
      systemPrompt,
      userContent,
      maxTokens,
    });
    const raw = parseAnswerArray(text);
    const byId = new Map(raw.map((a) => [a.id, a]));

    // Reassemble in original order: deterministic answers where we have them,
    // reconciled LLM answers for the generative fields.
    const genAnswerById = new Map();
    generative.forEach(({ q, localMatch }) => {
      genAnswerById.set(
        q.id,
        mergeAnswer(byId.get(q.id) || { id: q.id, answer: null, confidence: 'low' }, localMatch, identityMemory)
      );
    });
    const answers = formSchema.map((q) => resolvedById.get(q.id) || genAnswerById.get(q.id));

    logTokenMetrics({
      extracted: formSchema.length,
      direct: directCount,
      rule: ruleCount,
      generated: generativeFields.length,
      skipped: skipCount,
      promptTokens: estimateTokens(systemPrompt) + estimateTokens(userContent),
      completionTokens: estimateTokens(text),
    });

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

  const identityMemory = getIdentityMemory();

  // Regenerate is user-initiated ("give me another answer", possibly with an
  // instruction), so it always goes to the model — but with the same
  // relevance-selected context and adaptive (single-field) token budget.
  const routed = routeField(question, profile, identityMemory);
  const localMatch = routed.route === 'generative' ? routed.localMatch : null;
  const generativeFields = [question];
  const { profileText, history } = selectContext(profile, generativeFields, getRecentQaHistory());
  const includeClassification = shouldClassify(generativeFields, [localMatch]);

  const withholdHint =
    localMatch && localMatch.confidence === 'medium' && isRiskClusterKey(localMatch.canonicalKey);
  const annotatedQuestion =
    localMatch && !withholdHint ? { ...question, canonicalKey: localMatch.canonicalKey } : question;

  const systemPrompt = buildSystemPrompt(profile, identityMemory, profileText, includeClassification);
  const userContent = JSON.stringify({
    formSchema: [annotatedQuestion],
    recentQaHistory: history,
    ...(instruction ? { instruction } : {}),
  });
  const maxTokens = computeMaxTokens(1);

  try {
    const text = await active.provider.chat({
      apiKey: active.apiKey,
      model: active.model,
      systemPrompt,
      userContent,
      maxTokens,
    });
    const answers = parseAnswerArray(text);
    if (answers.length === 0) {
      return res.status(502).json({ ok: false, error: 'The AI did not return an answer' });
    }

    logTokenMetrics({
      extracted: 1,
      direct: 0,
      rule: 0,
      generated: 1,
      skipped: 0,
      promptTokens: estimateTokens(systemPrompt) + estimateTokens(userContent),
      completionTokens: estimateTokens(text),
    });

    res.json({ ok: true, answer: mergeAnswer(answers[0], localMatch, identityMemory) });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(502).json({ ok: false, error: `The AI's response wasn't valid JSON: ${err.message}` });
    }
    res.status(err.status === 401 || err.status === 403 ? 401 : 502).json({ ok: false, error: err.message });
  }
});

export default router;
