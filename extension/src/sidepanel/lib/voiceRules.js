// The phrases that make a generated answer read as machine-written, in one
// place so the PROMPT that forbids them and the EVAL that checks for them can
// never drift apart. If they lived in two files, a phrase added to the prompt
// would silently stop being measured.
//
// This is not a style-police list. Every entry is here because it is a
// *tell* — a construction that appears far more often in LLM output than in
// how a person actually writes about their own work, and whose presence makes
// a reader doubt the answer was written by the applicant. That's the failure
// this list exists to catch: not "bad writing", but "reads as generated".
//
// The test is: would this phrase survive if the writer had to name a specific
// thing instead? "I'm passionate about civic technology" survives anywhere.
// "I built a bus tracker because I kept missing the 8:05" does not generalize
// — and that's the point.

// Matched case-insensitively as substrings against generated answers.
export const BANNED_PHRASES = [
  // Enthusiasm with no referent
  'passionate about',
  'deeply passionate',
  'i am excited by the opportunity',
  'excited about the opportunity',
  'thrilled at the prospect',
  'eager to contribute',
  // Corporate abstraction
  'leverage my',
  'leveraging my',
  'synergy',
  'in today’s fast-paced',
  "in today's fast-paced",
  'ever-evolving landscape',
  'rapidly evolving world',
  'cutting-edge',
  'game-changer',
  // LLM register
  'delve into',
  'it is worth noting that',
  'i believe that my unique blend',
  'unique blend of skills',
  'a testament to',
  'perfectly aligns with',
  'aligns perfectly with',
  'resonates deeply with',
  'resonates with me',
  // Empty closings
  'i look forward to the opportunity to contribute',
  'i would welcome the chance to discuss',
  'thank you for considering my application',
];

// Openers that signal a template rather than an answer. Checked only against
// the START of an answer, because several are perfectly fine mid-sentence.
export const BANNED_OPENERS = [
  'as a passionate',
  'as an aspiring',
  'i am writing to',
  'i am a highly motivated',
  'throughout my journey',
  'in my journey as',
  'ever since i was young',
  'from a young age',
];

// Returns every rule the text trips, as { kind, phrase }. Empty array = clean.
// Shared by the eval assertions and available to any UI that wants to warn.
export function findVoiceViolations(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const lower = text.toLowerCase();
  const trimmed = lower.trimStart();
  const hits = [];
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) hits.push({ kind: 'phrase', phrase });
  }
  for (const opener of BANNED_OPENERS) {
    if (trimmed.startsWith(opener)) hits.push({ kind: 'opener', phrase: opener });
  }
  return hits;
}

// Rendered into the system prompt. Kept short deliberately: a long list of
// forbidden strings makes a model write stiffly around them, which reads just
// as artificial as the phrases themselves. Naming the underlying habit does
// more work than enumerating every instance, so the prompt gets the principle
// plus the worst offenders, while findVoiceViolations() above checks the
// full list after the fact.
export function bannedPhraseInstruction() {
  const worst = [
    'passionate about',
    'leverage / leveraging',
    'delve into',
    'unique blend of skills',
    'perfectly aligns with',
    'in today’s fast-paced world',
    'a testament to',
    'I am excited by the opportunity to',
  ];
  return [
    'VOICE — write like a person, not like an application:',
    `- Never use these: ${worst.join('; ')}. They are the phrases that make an answer read as machine-written.`,
    '- Do not open with "As a passionate...", "From a young age...", "I am writing to..." or a restatement of the question.',
    '- Prefer a concrete particular over a general claim. "I built X because Y kept happening" beats "I am deeply interested in X".',
    '- Vary sentence length. Do not write three parallel clauses in a row; that cadence is a tell.',
    '- Do not close with a thank-you or an offer to discuss further unless the question asks for one.',
    '- Contractions are fine. Slight informality reads as human; stiff formality reads as generated.',
  ].join('\n');
}
