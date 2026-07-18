// Answer generation, replacing server/src/routes/generate.js. Every piece of
// business logic here (deterministic routing, prompt construction, answer
// merging, the no-fabrication rule) is unchanged — only the data-access layer
// changes, and every db.prepare() read becomes a call into the Phase 3/4
// modules that now own that data. This is the phase where every earlier
// phase's work actually gets used together for the first time.
import { isValidKey, isRiskClusterKey, labelFor, registryPromptList } from './fieldRegistry.js';
import { routeField, buildResolvedAnswer } from './fieldRouter.js';
import { selectContext } from './promptContext.js';
import { estimateTokens, computeMaxTokens, logTokenMetrics } from './tokens.js';
import { getActiveProviderConfig } from './settings.js';
import { getProfile } from './profile.js';
import { getQaHistory } from './qaHistory.js';
import { getIdentityMemoryMap } from './identityMemory.js';
import { getLearnedAnswersMap } from './learnedAnswers.js';

// Pool size for the qa-history relevance filter. Only a compressed subset
// (see promptContext.compressHistory) ever reaches the prompt — this just
// bounds how much of the stored history we rank over. Distinct from
// qaHistory.js's own MAX_ENTRIES (50, the storage cap): getQaHistory() already
// returns newest-first, so this just takes the top slice of that.
const MAX_HISTORY = 10;

async function getRecentQaHistory() {
  return (await getQaHistory()).slice(0, MAX_HISTORY);
}

// The no-fabrication instruction is the single highest-stakes line in this
// file (AGENTS.md rule 7) for AUTO-GENERATION — every other instruction there
// is negotiable, this one isn't. Text is unchanged from the server version.
//
// `editing` flips the prompt into editor mode for USER-INSTRUCTED regeneration
// only (AGENTS.md rule 7's documented exception): when the user is looking at an
// answer and gives an explicit instruction, their instruction outranks the
// profile — including a deliberate factual override — because the user has
// decided it and owns the accuracy. This never fires on auto-generation
// (generateAnswers passes it false), so the no-fabrication guarantee for the
// unattended path is untouched. The bound: overriding on command is allowed;
// padding with *unrequested* invented specifics is still forbidden even here.
//
// `contextText` is the RELEVANCE-SELECTED profile (see promptContext.js): the
// cheap basics always, the expensive resume/writing-sample/projects only when
// a generative field actually needs them. `includeClassification` gates the
// registry/canonical-key block — omitted for forms whose generative fields
// are all clearly prose/choice (nothing identity-like to classify), saving
// those calls the registry's tokens.
function buildSystemPrompt(profile, identityMemory, contextText, includeClassification, editing = false) {
  const memoryEntries = Object.entries(identityMemory || {});
  const memoryBlock = memoryEntries.length
    ? memoryEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n')
    : '(none remembered yet)';

  // Auto-generation: the profile is the ceiling, never to be exceeded by
  // invention. Editor mode: the user's instruction is the ceiling, the profile
  // demoted to a source of detail the instruction may override outright.
  const integrityRule = editing
    ? `EDITOR MODE — FOLLOW THE USER'S INSTRUCTION FIRST: You are revising an existing answer the user is looking at. Apply their instruction in this strict priority order:
  1. The user's INSTRUCTION. It overrides everything below, including the PROFILE. If it tells you to assert, change, or contradict a fact the profile doesn't support, do it anyway — the user has decided this on purpose and is responsible for it. Never refuse an instruction because the profile disagrees.
  2. The CURRENT ANSWER. Preserve whatever the instruction doesn't touch — this is an edit, not a fresh draft.
  3. The PROFILE / REMEMBERED IDENTITY below — use it only to fill in details the instruction and current answer leave open.
The one limit: do not volunteer NEW invented specifics (company names, metrics, dates, awards) the instruction didn't ask for. Carrying out the instruction is not fabrication; padding it with unrequested inventions is.`
    : `CRITICAL RULE — DO NOT FABRICATE: Only use facts that are literally present in the PROFILE or REMEMBERED IDENTITY below. Never invent company names, metrics, dates, awards, job titles, or experience that isn't stated. If there isn't enough material to answer specifically, write a genuine but more general answer rather than making up specifics. This rule is more important than sounding impressive.`;

  const instructionBullet = editing
    ? `- The "instruction" field is the user's explicit command for this revision — apply it fully per EDITOR MODE above, including any factual change it directs. The "currentAnswer" field is the text you are revising.`
    : `- If the input includes an "instruction" field, apply it to how you write the answer (tone, length, emphasis) without violating the no-fabrication rule above.`;

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

${integrityRule}

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
${instructionBullet}

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
//
// `skipMemoryOverride` is set only by user-instructed regeneration: the whole
// point there is to change the answer, so silently replacing the model's revised
// text with the old remembered value would defeat the instruction (this is the
// second, JS-side override the diagnosis flagged). The canonicalKey is still
// resolved — the Remember checkbox and existingMemoryValue still work — only the
// answer-clobbering branch is bypassed.
function mergeAnswer(aiAnswer, localMatch, identityMemory, { skipMemoryOverride = false } = {}) {
  const { canonicalKey, classificationSource } = resolveCanonicalKey(aiAnswer, localMatch);
  const hasMemory = canonicalKey && Object.prototype.hasOwnProperty.call(identityMemory, canonicalKey);

  const base = {
    id: aiAnswer?.id,
    canonicalKey: canonicalKey ?? null,
    canonicalLabel: canonicalKey ? labelFor(canonicalKey) : null,
    classificationSource,
    answer: aiAnswer?.answer ?? null,
    confidence: aiAnswer?.confidence ?? 'low',
    fromMemory: false,
    // Still surfaced when skipping the override, so the card can offer "update
    // the remembered value to this" rather than hiding that a key exists.
    existingMemoryValue: hasMemory ? identityMemory[canonicalKey] : null,
  };

  if (hasMemory && !skipMemoryOverride) {
    return {
      ...base,
      answer: identityMemory[canonicalKey],
      confidence: 'high',
      fromMemory: true,
    };
  }
  return base;
}

// Throws — matching the server route's 400s, which every caller (ReviewFlow.js's
// generateAnswers/handleRegenerate) already expects as a real Error.
async function requireProviderAndProfile() {
  const active = await getActiveProviderConfig();
  if (!active) {
    throw new Error('No AI provider configured. Add an API key and pick a provider in Settings.');
  }
  const profile = await getProfile();
  if (!profile) {
    throw new Error('No profile saved. Complete onboarding first.');
  }
  return { active, profile };
}

// A generative field is worth including the identity-classification block for
// if it's a short text field (identity fields are always short text) or if the
// local matcher already recognized it. Pure essay/choice forms skip the block.
function shouldClassify(generativeFields, localByIndex) {
  return generativeFields.some((f, i) => f.fieldType === 'text' || Boolean(localByIndex[i]));
}

// Wraps a provider-call failure the same way the server route's catch block
// did: a JSON-parse failure gets a clearer message; anything the provider
// adapter tagged 401/403 stays auth-flavored; everything else keeps its own
// message. Always throws — there's no separate HTTP status for a caller to
// branch on anymore, only err.message.
function rethrowGenerationError(err) {
  if (err instanceof SyntaxError) {
    throw new Error(`The AI's response wasn't valid JSON: ${err.message}`);
  }
  throw err;
}

export async function generateAnswers(formSchema) {
  if (!Array.isArray(formSchema) || formSchema.length === 0) {
    throw new Error('formSchema must be a non-empty array');
  }

  const { active, profile } = await requireProviderAndProfile();
  const identityMemory = await getIdentityMemoryMap();
  const learnedAnswers = await getLearnedAnswersMap();

  // --- Deterministic routing pass: answer everything we can for free. ---
  const routes = formSchema.map((q) => routeField(q, profile, identityMemory, learnedAnswers));
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
    return { answers };
  }

  // --- Only generative fields reach the LLM, with relevance-selected context. ---
  const generativeFields = generative.map((g) => g.q);
  const localByIndex = generative.map((g) => g.localMatch);
  const { profileText, history } = selectContext(profile, generativeFields, await getRecentQaHistory());
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

    return { answers };
  } catch (err) {
    rethrowGenerationError(err);
  }
}

export async function regenerateAnswer(question, instruction, currentAnswer = null) {
  if (!question || typeof question !== 'object' || !question.id) {
    throw new Error('question is required');
  }

  const { active, profile } = await requireProviderAndProfile();
  const identityMemory = await getIdentityMemoryMap();

  // An explicit instruction turns regenerate into an EDIT: the model gets the
  // text on screen as "currentAnswer" (so "change it" has a referent) and the
  // prompt switches to editor mode where the instruction outranks the profile.
  // A bare regenerate (no instruction) stays a cold re-roll — the user just
  // wants a different answer, not an edit of this one — so currentAnswer is
  // withheld to avoid the model simply echoing it back.
  const hasInstruction = Boolean(instruction && String(instruction).trim());
  const currentAnswerText =
    hasInstruction && currentAnswer != null
      ? Array.isArray(currentAnswer)
        ? currentAnswer.join(', ')
        : String(currentAnswer)
      : null;

  // Regenerate is user-initiated ("give me another answer", possibly with an
  // instruction), so it always goes to the model — but with the same
  // relevance-selected context and adaptive (single-field) token budget.
  //
  // Learned answers are deliberately NOT passed here: the user is looking at
  // a remembered answer and asking for a different one, so replaying it from
  // memory would ignore the request. routeField is called only to recover the
  // localMatch hint; the model runs either way.
  const routed = routeField(question, profile, identityMemory);
  const localMatch = routed.route === 'generative' ? routed.localMatch : null;
  const generativeFields = [question];
  const { profileText, history } = selectContext(profile, generativeFields, await getRecentQaHistory());
  const includeClassification = shouldClassify(generativeFields, [localMatch]);

  const withholdHint =
    localMatch && localMatch.confidence === 'medium' && isRiskClusterKey(localMatch.canonicalKey);
  const annotatedQuestion = {
    ...(localMatch && !withholdHint ? { ...question, canonicalKey: localMatch.canonicalKey } : question),
    // Bound to the question itself, not left a loose sibling of formSchema, so
    // the model can't mistake which field the current answer belongs to.
    ...(currentAnswerText != null ? { currentAnswer: currentAnswerText } : {}),
  };

  const systemPrompt = buildSystemPrompt(profile, identityMemory, profileText, includeClassification, hasInstruction);
  const userContent = JSON.stringify({
    formSchema: [annotatedQuestion],
    recentQaHistory: history,
    ...(hasInstruction ? { instruction } : {}),
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
      throw new Error('The AI did not return an answer');
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

    return {
      answer: mergeAnswer(answers[0], localMatch, identityMemory, { skipMemoryOverride: hasInstruction }),
    };
  } catch (err) {
    rethrowGenerationError(err);
  }
}
