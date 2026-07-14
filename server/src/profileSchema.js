// Shared by both directions of profile Import/Export (server/src/routes/import-export.js):
// export normalizes through the same validators before serializing, and import validates
// an uploaded file through them before writing. One source of truth for the envelope shape
// and CURRENT_SCHEMA_VERSION avoids the two ever drifting apart.
import { MAX_ENTRIES } from './routes/qa-history.js';
import { isValidKey } from './fieldRegistry.js';

export const CURRENT_SCHEMA_VERSION = 1;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') throw new Error('Expected a string field, got something else.');
  return value;
}

function strArray(value, fieldName) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`"${fieldName}" must be a list, not a single value — refusing to guess how to split it.`);
  }
  return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
}

function validatePersonalOrLinks(value, fieldName, keys) {
  if (value === undefined || value === null) {
    return Object.fromEntries(keys.map((k) => [k, '']));
  }
  if (!isPlainObject(value)) {
    throw new Error(`"${fieldName}" must be an object.`);
  }
  return Object.fromEntries(keys.map((k) => [k, str(value[k])]));
}

function validateProjects(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error('"projects" must be a list of project objects.');
  }
  return value.map((item) => {
    if (!isPlainObject(item)) {
      throw new Error('Each project must be an object with name/description/techStack/impact.');
    }
    return {
      name: str(item.name),
      description: str(item.description),
      techStack: str(item.techStack),
      impact: str(item.impact),
    };
  });
}

export function validateProfile(profile) {
  if (!isPlainObject(profile)) {
    throw new Error('"profile" must be an object.');
  }
  return {
    personal: validatePersonalOrLinks(profile.personal, 'personal', ['name', 'email', 'phone', 'location']),
    links: validatePersonalOrLinks(profile.links, 'links', ['linkedin', 'github', 'portfolio']),
    education: str(profile.education),
    skills: strArray(profile.skills, 'skills'),
    interests: strArray(profile.interests, 'interests'),
    goals: str(profile.goals),
    projects: validateProjects(profile.projects),
    achievements: strArray(profile.achievements, 'achievements'),
    resumeText: str(profile.resumeText),
    writingSampleText: str(profile.writingSampleText),
  };
}

// Individually-invalid entries are dropped rather than failing the whole import: qaHistory
// is regenerable AI-answer cache data, not hand-authored profile content, so losing one bad
// row is low-cost — unlike the profile object, which is never lenient about structure.
export function validateQaHistoryEntries(entries) {
  if (entries === undefined || entries === null) return [];
  if (!Array.isArray(entries)) {
    throw new Error('"qaHistory" must be a list of entries.');
  }
  const valid = entries
    .filter(isPlainObject)
    .filter((e) => typeof e.question === 'string' && e.question && typeof e.answer === 'string' && e.answer)
    .map((e) => ({
      question: e.question,
      answer: e.answer,
      context: typeof e.context === 'string' ? e.context : null,
      date: typeof e.date === 'string' && e.date ? e.date : new Date().toISOString(),
    }));
  return valid.slice(0, MAX_ENTRIES);
}

// Identity memory travels as a flat { canonicalKey: value } object. Lenient like
// qaHistory: drop unknown keys (not in the registry) and non-string values rather
// than failing the whole import — a hand-edited or partial file still imports what's
// valid.
export function validateIdentityMemory(memory) {
  if (memory === undefined || memory === null) return {};
  if (!isPlainObject(memory)) {
    throw new Error('"identityMemory" must be an object of key/value pairs.');
  }
  const out = {};
  for (const [key, value] of Object.entries(memory)) {
    if (isValidKey(key) && typeof value === 'string' && value.trim() !== '') {
      out[key] = value;
    }
  }
  return out;
}

// Learned answers travel as a list of {questionText, answer, canonicalKey}. Lenient
// like qaHistory: drop malformed rows rather than failing the whole import. A row's
// canonicalKey is dropped (not the row) when it isn't a registry key, so a file
// written by a newer Impleo — one that knows a key this build doesn't — still imports
// its answers, just without the classification.
export function validateLearnedAnswers(entries) {
  if (entries === undefined || entries === null) return [];
  if (!Array.isArray(entries)) {
    throw new Error('"learnedAnswers" must be a list of entries.');
  }
  return entries
    .filter(isPlainObject)
    .filter(
      (e) =>
        typeof e.questionText === 'string' &&
        e.questionText.trim() !== '' &&
        typeof e.answer === 'string' &&
        e.answer.trim() !== ''
    )
    .map((e) => ({
      questionText: e.questionText,
      answer: e.answer,
      canonicalKey: isValidKey(e.canonicalKey) ? e.canonicalKey : null,
    }));
}

// Recognized top-level profile fields — used to detect a "bare" profile object (no
// envelope wrapper) below. Keep in sync with validateProfile's own field list.
const PROFILE_FIELD_KEYS = [
  'personal', 'links', 'education', 'skills', 'interests',
  'goals', 'projects', 'achievements', 'resumeText', 'writingSampleText',
];

function looksLikeBareProfile(body) {
  return PROFILE_FIELD_KEYS.some((k) => Object.prototype.hasOwnProperty.call(body, k));
}

// v1 is the only schema version that has ever existed, so there is nothing to migrate from —
// building a migrations[fromVersion] runner now would be speculative infrastructure for a
// case that doesn't exist. When a v2 ships, add a MIGRATIONS map here (keyed by fromVersion,
// each entry a pure profile -> profile function) and loop-apply it below instead of the
// current strict equality check.
export function validateEnvelope(body) {
  if (!isPlainObject(body)) {
    throw new Error('File must contain a JSON object.');
  }

  // A file dragged in from an external AI assistant (see the Import Profile modal's
  // "Copy Prompt") is asked to produce the full envelope, but general-purpose models
  // don't always follow wrapper instructions exactly. If there's no "profile" key but
  // the body itself looks like a profile object (has at least one recognized profile
  // field), treat the whole body as the profile and synthesize the envelope — this is
  // deliberately more lenient than the strict wrapper check below, scoped narrowly to
  // this one shape rather than weakening the real envelope validation.
  const hasProfileKey = Object.prototype.hasOwnProperty.call(body, 'profile');
  if (!hasProfileKey && looksLikeBareProfile(body)) {
    const profile = validateProfile(body);
    const qaHistory = validateQaHistoryEntries(body.qaHistory);
    const identityMemory = validateIdentityMemory(body.identityMemory);
    const learnedAnswers = validateLearnedAnswers(body.learnedAnswers);
    return { profile, qaHistory, identityMemory, learnedAnswers };
  }

  if (body.app !== 'impleo') {
    throw new Error("This doesn't look like an Impleo export file.");
  }
  if (typeof body.schemaVersion !== 'number') {
    throw new Error("This doesn't look like an Impleo export file.");
  }
  if (body.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error('This file was exported by a newer version of Impleo — update before importing.');
  }
  if (body.schemaVersion < CURRENT_SCHEMA_VERSION) {
    throw new Error('This file was exported by an unsupported older version of Impleo.');
  }

  const profile = validateProfile(body.profile);
  const qaHistory = validateQaHistoryEntries(body.qaHistory);
  const identityMemory = validateIdentityMemory(body.identityMemory);
  const learnedAnswers = validateLearnedAnswers(body.learnedAnswers);
  return { profile, qaHistory, identityMemory, learnedAnswers };
}
