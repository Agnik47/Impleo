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

import { classifyLocally, labelFor, isValidKey } from './fieldRegistry.js';

const CHOICE_TYPES = new Set(['radio', 'checkbox_single', 'dropdown', 'checkbox']);

function hasOwn(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key);
}

// Same normalization shape as fieldRegistry's private normalize(). Duplicated
// (small) rather than exported-and-shared to keep fieldRegistry's surface
// focused; both must stay in sync if the rule ever changes.
function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

// Classify one extracted field. Returns one of:
//   { route: 'direct'|'rule', canonicalKey, value, source, fromMemory }
//   { route: 'skip' }
//   { route: 'generative', localMatch }   // localMatch reused by generate.js
export function routeField(field, profile, identityMemory) {
  if (field.fieldType === 'upload') return { route: 'skip' };

  const local = classifyLocally(field.questionText);
  let cand = null;

  // 1) Exact identity classification with a stored value -> reuse verbatim.
  // 2) ...or a value derivable from the freeform profile (name/email/phone).
  if (local && local.confidence === 'high' && isValidKey(local.canonicalKey)) {
    if (hasOwn(identityMemory, local.canonicalKey)) {
      cand = { key: local.canonicalKey, value: identityMemory[local.canonicalKey], source: 'memory', fromMemory: true };
    } else {
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
