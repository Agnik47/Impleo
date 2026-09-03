// Cheap, deterministic "does this look like a real application form" signal
// for the generic extractor only (Google Forms/Luma are already confirmed
// real forms by hostname in ReviewFlow.jsx's pickPlatform, so this never runs
// there). No AI call — it's a scoring heuristic over what was already
// extracted, used to show a dismissible warning, never to block extraction.
// The extension's existing mandatory human-review step is the real safety
// net; this just points attention at pages worth double-checking.
//
// The keyword list and RELEVANT_THRESHOLD are tunable — validated against a
// couple of real pages during implementation, not a precision instrument.
const APPLICATION_KEYWORDS = [
  'apply', 'application', 'applicant', 'cover letter', 'resume', 'cv',
  'experience', 'why do you want', 'why are you', 'tell us about',
  'motivation', 'qualify', 'eligib', 'submission', 'candidate',
  'fellowship', 'scholarship', 'hackathon', 'internship', 'registration', 'register',
];

const RELEVANT_THRESHOLD = 2;

export function scoreFormRelevance(schema, pageTitle) {
  const fields = Array.isArray(schema) ? schema : [];
  const actionable = fields.filter((f) => f.fieldType !== 'upload');
  // Nothing to judge (e.g. an upload-only page) — don't warn about a
  // question that was never asked.
  if (actionable.length === 0) return { relevant: true };

  let score = 0;
  if (actionable.length >= 4) score += 1;
  if (fields.some((f) => f.fieldType === 'textarea')) score += 2;
  if (fields.some((f) => f.fieldType === 'upload')) score += 2;
  if (fields.some((f) => f.required)) score += 1;

  const haystack = [pageTitle, ...fields.map((f) => f.questionText)].join(' ').toLowerCase();
  if (APPLICATION_KEYWORDS.some((k) => haystack.includes(k))) score += 2;

  return { relevant: score >= RELEVANT_THRESHOLD };
}
