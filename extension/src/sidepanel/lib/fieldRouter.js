// Deterministic field router — the token layer's biggest structural win.
//
// Before any field is sent to the LLM, we try to answer it for free:
//   A) DIRECT   — a value we already hold (identity memory, or a plain profile
//                 field like name/email/phone/LinkedIn) copied verbatim. 0 AI
//                 tokens; the field is NOT included in the LLM prompt at all.
//   B) RULE     — a choice field (radio/dropdown/checkbox) whose correct option
//                 is uniquely determined by a value we already hold (e.g. a
//                 "Country" dropdown when we know the country). Deterministic
//                 option-match, again 0 AI tokens.
//   C) GENERATIVE — everything left (essays, motivations, anything needing the
//                 model to actually write). These are the ONLY fields that
//                 reach the LLM.
//   -  SKIP     — uploads, which can never be auto-filled.
//
// Safety: direct/rule routing only ever fires on an EXACT (high-confidence)
// local classification or an explicit profile-field keyword hit, and a choice
// field is only rule-answered when the held value actually matches one of the
// page's own options verbatim. We never invent an option and never guess an
// identity value — a fuzzy/uncertain field falls through to the LLM, exactly
// as before. This preserves the risk-cluster protections in generate.js
// (father_name/mother_name/sensitive IDs are still resolved there, with
// local+AI agreement, for anything not an exact match).

import { classifyLocally, labelFor, isValidKey, isRiskClusterKey, normalizeText } from './fieldRegistry.js';

const CHOICE_TYPES = new Set(['radio', 'checkbox_single', 'dropdown', 'checkbox']);

function hasOwn(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key);
}

// Was a local copy of fieldRegistry's private normalize(), kept in sync by hand.
// It's now imported: the learned-answer store keys rows by this exact function's
// output, so a divergence would orphan saved rows rather than just skew a match.
const normalize = normalizeText;

function containsPhrase(haystack, phrase) {
  if (!phrase) return false;
  return (
    haystack === phrase ||
    haystack.includes(` ${phrase} `) ||
    haystack.startsWith(`${phrase} `) ||
    haystack.endsWith(` ${phrase}`) ||
    haystack.includes(phrase)
  );
}

// Canonical registry keys whose value we can pull straight from the freeform
// profile object. Every OTHER canonical key (father_name, aadhaar, ...) only
// ever comes from identity_memory — never fabricated from the profile.
function profileValueForCanonical(key, profile) {
  switch (key) {
    case 'full_name':
      return profile?.personal?.name || '';
    case 'email':
      return profile?.personal?.email || '';
    case 'phone':
      return profile?.personal?.phone || '';
    default:
      return '';
  }
}

// Pure-lookup profile fields that are NOT in the identity registry (so
// classifyLocally can't see them): social/portfolio links and location.
// `name`/`email`/`phone` are intentionally NOT here — they're canonical
// registry keys handled by the exact-match path above, which carries the
// risk-cluster guard and the 'name'-is-too-broad exclusion. First hit wins.
const PROFILE_DIRECT = [
  { id: 'linkedin', phrases: ['linkedin'], get: (p) => p?.links?.linkedin },
  { id: 'github', phrases: ['github'], get: (p) => p?.links?.github },
  {
    id: 'portfolio',
    phrases: ['portfolio', 'personal website', 'personal site', 'website', 'web site'],
    get: (p) => p?.links?.portfolio,
  },
  {
    id: 'location',
    phrases: ['current location', 'your location', 'location', 'current city', 'based in', 'where are you based'],
    get: (p) => p?.personal?.location,
  },
];

function matchProfileDirect(questionText, profile) {
  const q = normalize(questionText);
  if (!q) return null;
  for (const entry of PROFILE_DIRECT) {
    if (entry.phrases.some((ph) => containsPhrase(q, normalize(ph)))) {
      const value = entry.get(profile);
      if (value && String(value).trim()) return { id: entry.id, value: String(value) };
    }
  }
  return null;
}

// Verbatim-first, then case-insensitive contains, option matcher. Returns the
// matched option string, or null (never invents one).
function matchOption(options, value) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const target = String(value ?? '').trim();
  if (!target) return null;
  const exact = options.find((o) => String(o).trim() === target);
  if (exact) return exact;
  const lower = target.toLowerCase();
  const loose = options.find((o) => {
    const l = String(o).trim().toLowerCase();
    return l.length > 0 && (l.includes(lower) || lower.includes(l));
  });
  return loose || null;
}

// Turns a resolved candidate value into the correct route for the field's type.
// For a choice field the value must map to a real option (else null -> caller
// falls through to the LLM). For text/textarea it's a direct copy.
function finalizeDirect(field, cand) {
  if (CHOICE_TYPES.has(field.fieldType)) {
    const matched = matchOption(field.options, cand.value);
    if (!matched) return null;
    return {
      route: 'rule',
      canonicalKey: cand.key ?? null,
      value: field.fieldType === 'checkbox' ? [matched] : matched,
      source: cand.source,
      fromMemory: Boolean(cand.fromMemory),
    };
  }
  return {
    route: 'direct',
    canonicalKey: cand.key ?? null,
    value: cand.value,
    source: cand.source,
    fromMemory: Boolean(cand.fromMemory),
  };
}

// Whether a local classification is trustworthy enough to answer a field from
// identity_memory without the model's second opinion.
//
// An EXACT alias hit is trusted for any key (unchanged). A FUZZY hit is now also
// trusted — but only off the risk cluster (names + government/financial IDs),
// which keeps the local+AI-agreement requirement that exists there because of a
// real misclassification incident.
//
// This is a pure token saving, not a behavior change: generate.js's mergeAnswer()
// ALREADY overwrites a fuzzy-matched field's answer with the remembered value at
// HIGH confidence (see its `fromMemory` branch), and resolveCanonicalKey already
// trusts a fuzzy match outright off the risk cluster. So these fields were always
// going to end up with the remembered value — we were paying the model to hand it
// back to us. "Current Fixed CTC (in Lakhs)" only fuzzy-matches (no exact alias
// covers every parenthetical a form might add), and it is exactly the field the
// bug report says must resolve with no API call.
function canTrustLocally(local) {
  if (!local || !isValidKey(local.canonicalKey)) return false;
  return local.confidence === 'high' || !isRiskClusterKey(local.canonicalKey);
}

// Classify one extracted field. Returns one of:
//   { route: 'direct'|'rule', canonicalKey, value, source, fromMemory }
//   { route: 'skip' }
//   { route: 'generative', localMatch }   // localMatch reused by generate.js
//
// Tier order is the product contract (docs/Issus.md): user override, then profile,
// then rules, then — only if all three miss — the model.
export function routeField(field, profile, identityMemory, learnedAnswers = {}) {
  if (field.fieldType === 'upload') return { route: 'skip' };

  const local = classifyLocally(field.questionText);
  let cand = null;

  // 0) User override: this exact question has been answered and confirmed before.
  // Outranks everything, including a canonical classification of the same field —
  // the user's own words about this specific question beat any inference about it.
  //
  // No misclassification risk to guard against here: the row is keyed by the
  // question's own text, so there is no fuzzy step that could have pointed it at
  // the wrong key. That's why this tier is safe to trust unconditionally while
  // tier 1 below still gates on canTrustLocally().
  // hasOwn, not a bare lookup: a field labelled "Constructor" or "toString" would
  // otherwise resolve against Object.prototype and route a function as the answer.
  const learnedKey = normalize(field.questionText);
  const learned = hasOwn(learnedAnswers, learnedKey) ? learnedAnswers[learnedKey] : null;
  if (learned) {
    // A learned row that names a canonical key defers to identity_memory for the
    // VALUE, so a canonical value keeps exactly one home and editing it in Backup
    // can't be undone by a stale copy here. The row still earns its keep: it's what
    // recognized this phrasing for free.
    const key = isValidKey(learned.canonicalKey) ? learned.canonicalKey : null;
    const value = key && hasOwn(identityMemory, key) ? identityMemory[key] : learned.answer;
    cand = { key, value, source: 'memory', fromMemory: true };
  }

  // 1) Identity classification with a stored value -> reuse verbatim.
  // 2) ...or a value derivable from the freeform profile (name/email/phone).
  if (!cand && canTrustLocally(local)) {
    if (hasOwn(identityMemory, local.canonicalKey)) {
      cand = { key: local.canonicalKey, value: identityMemory[local.canonicalKey], source: 'memory', fromMemory: true };
    } else if (local.confidence === 'high') {
      // Profile-derived values stay exact-match-only. mergeAnswer() never injects
      // from the profile the way it does from identity_memory, so unlike the branch
      // above, relaxing this one WOULD change answers ("Guardian's Contact Number"
      // fuzzy-matching `phone` and filling the user's own) rather than just save
      // tokens. Different trade, so it doesn't ride along on the same relaxation.
      const pv = profileValueForCanonical(local.canonicalKey, profile);
      if (pv) cand = { key: local.canonicalKey, value: pv, source: 'profile', fromMemory: false };
    }
  }

  // 3) Non-registry profile-direct fields (links, location).
  if (!cand) {
    const pd = matchProfileDirect(field.questionText, profile);
    if (pd) cand = { key: null, value: pd.value, source: 'profile', fromMemory: false };
  }

  if (cand) {
    const finalized = finalizeDirect(field, cand);
    if (finalized) return finalized;
  }

  return { route: 'generative', localMatch: local || null };
}

// Builds the client-facing answer object for a deterministically-resolved
// field, matching the exact shape generate.js's mergeAnswer() produces for
// LLM fields so ReviewFlow/ReviewCard need no special-casing.
export function buildResolvedAnswer(id, routed, identityMemory) {
  if (routed.route === 'skip') {
    return {
      id,
      canonicalKey: null,
      canonicalLabel: null,
      classificationSource: null,
      answer: null,
      confidence: 'low',
      fromMemory: false,
      existingMemoryValue: null,
    };
  }
  const key = routed.canonicalKey ?? null;
  return {
    id,
    canonicalKey: key,
    canonicalLabel: key ? labelFor(key) : null,
    // 'memory' mirrors the LLM path; 'direct' marks a fresh profile/rule value.
    classificationSource: routed.source === 'memory' ? 'memory' : 'direct',
    answer: routed.value,
    confidence: 'high',
    fromMemory: Boolean(routed.fromMemory),
    existingMemoryValue: key && hasOwn(identityMemory, key) ? identityMemory[key] : null,
  };
}
