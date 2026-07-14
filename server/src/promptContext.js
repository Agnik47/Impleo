// Relevance-based context selection — the second big token lever.
//
// The old prompt pasted the ENTIRE profile (including full resumeText and
// writingSampleText) plus the last 10 qa_history entries verbatim into every
// call, whether the form needed them or not. A form that's all "email / phone /
// yes-no" was paying thousands of tokens for a resume it never used.
//
// Strategy (deliberately rule-based, not embeddings — see AGENTS.md "avoid
// vector DBs / embeddings"): decide what a call needs from the fields that
// actually reach the model.
//   - The small, structured basics (name, skills, interests, goals, education)
//     are cheap and broadly useful, so they're always included.
//   - The EXPENSIVE parts (resumeText, writingSampleText, projects,
//     achievements) and qa_history are included ONLY when at least one
//     generative field is prose-style (a textarea, or a "tell us about / why /
//     describe / experience..." question) — the only case where deep grounding
//     and voice-matching actually change the answer.
//
// This keeps answer quality identical for the questions that need depth while
// dropping the heavy context entirely for the ones that don't.

const PROSE_KEYWORDS = [
  'about yourself',
  'about you',
  'tell us',
  'tell me',
  'describe',
  'why do you',
  'why are you',
  'why should',
  'why join',
  'why attend',
  'motivat',
  'experience',
  'background',
  'project',
  'achievement',
  'strength',
  'yourself',
  'introduce',
  'passion',
  'interest you',
  'contribute',
  'goal',
  'what makes you',
  'expect',
];

function isProseField(field) {
  if (!field) return false;
  if (field.fieldType === 'textarea') return true;
  const q = String(field.questionText || '').toLowerCase();
  return PROSE_KEYWORDS.some((k) => q.includes(k));
}

function tokenizeWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3); // skip stopword-ish short tokens cheaply
}

// The always-included, cheap structured basics.
function formatBasics(profile) {
  const lines = [
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
  ];
  return lines.join('\n');
}

// The expensive, prose-only sections.
function formatHeavy(profile) {
  const projectLines = (profile.projects || [])
    .map((p) => `- ${p.name}: ${p.description} (tech: ${p.techStack}; impact: ${p.impact})`)
    .join('\n');
  return [
    'Projects:',
    projectLines || '(none provided)',
    `Achievements: ${(profile.achievements || []).join('; ') || '(none provided)'}`,
    'Resume text:',
    profile.resumeText || '(none provided)',
    'Writing sample (match this voice/tone/style):',
    profile.writingSampleText || '(none provided)',
  ].join('\n');
}

// Compress qa_history for grounding: relevance-rank against the current
// generative questions, keep the top few, and truncate each answer. Drops the
// context-URL and date entirely (unused for tone/grounding). Only called when
// the form needs prose, so identity/short forms pay 0 history tokens.
function compressHistory(qaHistory, generativeFields, { max = 3, maxLen = 220 } = {}) {
  if (!Array.isArray(qaHistory) || qaHistory.length === 0) return [];
  const terms = new Set();
  for (const f of generativeFields) for (const w of tokenizeWords(f.questionText)) terms.add(w);

  // Stable relevance sort: keyword overlap desc, original order (already
  // newest-first) as the tiebreaker so recent entries win ties.
  const scored = qaHistory.map((h, i) => {
    let score = 0;
    for (const w of tokenizeWords(h.question)) if (terms.has(w)) score += 1;
    return { h, i, score };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));

  return scored.slice(0, max).map(({ h }) => ({
    question: h.question,
    answer: h.answer && h.answer.length > maxLen ? `${h.answer.slice(0, maxLen)}…` : h.answer,
  }));
}

// Returns the trimmed context for a call: the profile text to embed in the
// system prompt, the compressed history for the user turn, and flags the
// caller uses for logging / deciding whether to include the classification
// block.
export function selectContext(profile, generativeFields, qaHistory) {
  const needsProse = generativeFields.some(isProseField);
  const profileText = needsProse
    ? `${formatBasics(profile)}\n${formatHeavy(profile)}`
    : formatBasics(profile);
  const history = needsProse ? compressHistory(qaHistory, generativeFields) : [];
  const includedSections = needsProse
    ? ['basics', 'projects', 'achievements', 'resume', 'writingSample', 'history']
    : ['basics'];
  return { profileText, history, needsProse, includedSections };
}
