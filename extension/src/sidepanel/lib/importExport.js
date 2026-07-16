// Profile backup (Import/Export), replacing server/src/routes/import-export.js.
// This file must never read or write settings — API keys never flow through
// import/export, structurally: it only touches profile/qaHistory/
// identityMemory/learnedAnswers.
import {
  CURRENT_SCHEMA_VERSION,
  validateEnvelope,
  validateProfile,
  validateQaHistoryEntries,
  validateIdentityMemory,
  validateLearnedAnswers,
} from './profileSchema.js';
import { getProfile, saveProfile } from './profile.js';
import { getQaHistory, replaceQaHistory } from './qaHistory.js';
import { getIdentityMemoryMap, replaceIdentityMemory } from './identityMemory.js';
import { getLearnedAnswers, replaceLearnedAnswers } from './learnedAnswers.js';

// Throws if there's nothing to export — matching the server route's 404,
// which api.js's request() wrapper turned into a thrown Error for every
// caller (Onboarding.jsx's handleExport).
export async function exportProfile() {
  const rawProfile = await getProfile();
  if (!rawProfile) {
    throw new Error('No profile saved yet.');
  }

  const qaRows = await getQaHistory();
  const identityMemoryObj = await getIdentityMemoryMap();
  // question_norm is deliberately not exported: it's derived (normalizeText
  // of questionText), so re-deriving it on import keeps a file written
  // against an older normalization rule from importing keys the current
  // router would never look up.
  const learnedRows = (await getLearnedAnswers()).map((r) => ({
    questionText: r.questionText,
    answer: r.answer,
    canonicalKey: r.canonicalKey,
  }));

  // Run the saved data back through the same validators used on import, so
  // every file Impleo exports is guaranteed importable by Impleo.
  const profile = validateProfile(rawProfile);
  const qaHistory = validateQaHistoryEntries(qaRows);
  const identityMemory = validateIdentityMemory(identityMemoryObj);
  const learnedAnswers = validateLearnedAnswers(learnedRows);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'impleo',
    profile,
    qaHistory,
    identityMemory,
    learnedAnswers,
  };
}

// Validates and (unless dryRun) commits an envelope. Throws on an invalid
// envelope — matching the server route's 400, which every caller
// (ImportProfileModal.jsx) expects as a real Error.
//
// Unlike the server, which wrapped all four writes in one db.transaction()
// for atomicity, these are sequential chrome.storage.local writes — there is
// no cross-key transaction primitive to use instead. A failure partway
// through could in principle leave a partial import (e.g. profile written,
// qaHistory not yet). This is a disclosed, accepted trade-off (see
// docs/PRODUCTION.md's storage design note on chrome.storage.local not being
// transactional across keys), not an oversight: import is a rare,
// user-initiated action a single side panel performs, not a
// multi-writer scenario, and the user can simply retry.
export async function importProfile(envelope, { dryRun } = {}) {
  const { profile, qaHistory, identityMemory, learnedAnswers } = validateEnvelope(envelope);
  const identityKeys = Object.keys(identityMemory);

  if (dryRun) {
    return {
      summary: {
        name: profile.personal.name || null,
        qaHistoryCount: qaHistory.length,
        identityMemoryCount: identityKeys.length,
        learnedAnswerCount: learnedAnswers.length,
      },
    };
  }

  await saveProfile(profile);
  // qaHistory is newest-first (the same order the export envelope and
  // getQaHistory() both use) — replaceQaHistory reverses it back to the
  // oldest-first order qaHistory.js stores internally.
  await replaceQaHistory(qaHistory);
  await replaceIdentityMemory(identityMemory);
  await replaceLearnedAnswers(learnedAnswers);

  return {
    imported: {
      qaHistoryCount: qaHistory.length,
      identityMemoryCount: identityKeys.length,
      learnedAnswerCount: learnedAnswers.length,
    },
  };
}
