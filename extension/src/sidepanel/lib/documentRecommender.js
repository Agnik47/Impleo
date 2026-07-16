// Ranks stored identity documents against a detected upload field.
//
// Heuristic first, model only on a genuine tie (the founder's call). Ranking three
// documents is a keyword-overlap problem, not a reasoning problem: matching
// "Hackathon_Portfolio.pdf" to a devfolio.co form is something a scorer does
// instantly, for free, offline, and — critically — explainably, because the score
// itself names the evidence. A model call per detected field would add latency and
// cost to answer a question the strings already answer.
//
// The model is consulted ONLY when the top two scores are within TIE_EPSILON and
// both are non-zero, i.e. when the heuristic genuinely has no opinion. Even then
// its answer is a suggestion into the same approval gate as every other path — the
// model can reorder a list, never upload anything.

// Themes a document can carry and a form can ask for. Each theme is a cluster of
// surface forms that mean the same thing to a ranker.
//
// Weighted, not flat: 'hackathon' appearing in both a document label and a page is
// far stronger evidence than 'resume' appearing in both (nearly every document is
// a resume in some sense, so it barely discriminates between three résumé-ish
// files — which is exactly the case this scorer exists to resolve).
const THEMES = [
  { key: 'hackathon', weight: 3, terms: ['hackathon', 'hack', 'devfolio', 'devpost', 'mlh', 'jam'] },
  { key: 'research', weight: 3, terms: ['research', 'academic', 'phd', 'fellowship', 'publication', 'thesis', 'scholar', 'lab'] },
  { key: 'portfolio', weight: 3, terms: ['portfolio', 'showcase', 'work sample', 'projects'] },
  { key: 'startup', weight: 3, terms: ['startup', 'accelerator', 'founder', 'incubator', 'yc', 'venture', 'pitch'] },
  { key: 'cover_letter', weight: 3, terms: ['cover letter', 'coverletter', 'motivation', 'statement of purpose', 'sop'] },
  { key: 'engineering', weight: 2, terms: ['software', 'engineer', 'developer', 'backend', 'frontend', 'fullstack', 'sde', 'programming'] },
  { key: 'cv', weight: 1, terms: ['cv', 'curriculum vitae'] },
  { key: 'resume', weight: 1, terms: ['resume', 'résumé'] },
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    // Filenames carry their structure in separators — "Research_CV.pdf" only
    // yields the tokens "research" and "cv" once _ - . are spaces.
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Word-boundary match, so 'cv' does not fire on "cvs" and 'hack' does not fire on
// "hackneyed". Multi-word terms ("cover letter") are matched as phrases.
function mentions(haystack, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
}

function themesIn(text) {
  const normalized = normalize(text);
  const found = new Map();
  for (const theme of THEMES) {
    const hit = theme.terms.find((term) => mentions(normalized, term));
    if (hit) found.set(theme.key, { weight: theme.weight, term: hit });
  }
  return found;
}

/**
 * Builds the searchable context for a form: what the field is called, plus where
 * it lives. The page's title/host matter as much as the field label — a Greenhouse
 * field is just called "Resume", and the fact that it's a hackathon application is
 * only visible in the title.
 */
function contextText({ fieldLabel, pageTitle, pageUrl, formText }) {
  let host = '';
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    // A malformed/absent URL is not worth failing a recommendation over.
  }
  return [fieldLabel, pageTitle, host, formText].filter(Boolean).join(' ');
}

// Below this, two candidates are treated as indistinguishable and the model breaks
// the tie. 0.5 is deliberately tight: with integer theme weights of 1-3, any real
// difference in evidence produces a gap of >= 1.
const TIE_EPSILON = 0.5;

// A document's own themes come from its label and its filename together, because
// users express intent in either — a file called `final_v3.pdf` labelled "Research
// CV" is as clear as `Research_CV.pdf` labelled "My doc".
function scoreDocument(doc, context) {
  const docThemes = themesIn(`${doc.userDefinedLabel} ${doc.originalName}`);
  const contextThemes = themesIn(context);

  let score = 0;
  const matched = [];
  for (const [key, { weight, term }] of docThemes) {
    if (contextThemes.has(key)) {
      score += weight;
      matched.push({ key, weight, term: contextThemes.get(key).term, docTerm: term });
    }
  }

  // Recency as a sub-point nudge only. It orders documents the themes couldn't
  // separate (most recently used wins) without ever outweighing a real theme match
  // — the last document you used is weak evidence next to a form that literally
  // says "hackathon".
  const lastUsed = doc.lastUsedTimestamp ? Date.parse(doc.lastUsedTimestamp) : NaN;
  const recencyBonus = Number.isNaN(lastUsed) ? 0 : 0.1;

  return { doc, score: score + recencyBonus, matched, lastUsed: Number.isNaN(lastUsed) ? 0 : lastUsed };
}

// Turns matched themes into the sentence shown under "Reason". Names the actual
// evidence ("this form mentions 'hackathon'") rather than asserting a conclusion,
// so the user can judge whether the match is sound instead of trusting it.
function explain(candidate, { preferredForDomain, domain }) {
  const { matched, doc } = candidate;

  if (preferredForDomain) {
    return `You chose ${doc.userDefinedLabel} the last time you applied on ${domain}.`;
  }
  if (matched.length > 0) {
    const evidence = [...new Set(matched.map((m) => `"${m.term}"`))].slice(0, 2).join(' and ');
    return `This application mentions ${evidence}, which matches ${doc.userDefinedLabel}.`;
  }
  if (candidate.lastUsed > 0) {
    return `Nothing on this page points to a specific document, so this is the one you used most recently.`;
  }
  return `Nothing on this page points to a specific document, so this is your first stored document.`;
}

/**
 * Ranks documents for one upload field.
 *
 * @returns {{ ranked: Array, suggestedFileId: string|null, reason: string, needsTieBreak: boolean, source: string }}
 *   `needsTieBreak` tells the caller the heuristic is genuinely undecided and an
 *   LLM pass would add information. The caller decides whether to spend that call.
 */
export function rankDocuments(documents, { fieldLabel, pageTitle, pageUrl, formText, preferredFileId }) {
  if (documents.length === 0) {
    return { ranked: [], suggestedFileId: null, reason: '', needsTieBreak: false, source: 'empty' };
  }

  const context = contextText({ fieldLabel, pageTitle, pageUrl, formText });
  let domain = '';
  try {
    domain = new URL(pageUrl).hostname;
  } catch {
    // See contextText.
  }

  const scored = documents.map((doc) => scoreDocument(doc, context));

  // A remembered domain choice outranks keyword evidence: the user's own prior
  // decision on this exact site is stronger information than any string match.
  // It still only reorders the list — approval is unaffected.
  const preferred = preferredFileId ? scored.find((s) => s.doc.fileId === preferredFileId) : null;
  if (preferred) preferred.score += 10;

  scored.sort((a, b) => b.score - a.score || b.lastUsed - a.lastUsed);

  const top = scored[0];
  const runnerUp = scored[1];
  // A tie only matters when both candidates actually have evidence. Three documents
  // that all score zero aren't "tied" in any way a model could resolve — there is
  // nothing on the page to reason from, so asking one would be theatre.
  const needsTieBreak = Boolean(
    runnerUp && top.score > 0 && runnerUp.score > 0 && Math.abs(top.score - runnerUp.score) < TIE_EPSILON
  );

  return {
    ranked: scored.map((s) => ({
      fileId: s.doc.fileId,
      score: Number(s.score.toFixed(2)),
      matchedThemes: s.matched.map((m) => m.key),
    })),
    suggestedFileId: top.doc.fileId,
    reason: explain(top, { preferredForDomain: Boolean(preferred) && preferred === top, domain }),
    needsTieBreak,
    source: preferred && preferred === top ? 'domain-preference' : top.matched.length > 0 ? 'heuristic' : 'fallback',
  };
}

/**
 * Prompt for the tie-break call. Constrained to *choosing among* the supplied
 * documents — it is given labels and filenames only, never file contents, so a
 * tie-break cannot leak a document's text to a provider (see the brief's privacy
 * rule: contents reach a model only under an explicit document-understanding
 * opt-in, which this is not).
 */
export function buildTieBreakPrompt(documents, { fieldLabel, pageTitle, pageUrl }) {
  const system =
    'You help choose which of a user\'s stored documents best fits an application form field. ' +
    'You are given only document labels and filenames — never their contents. ' +
    'Reply with strict JSON: {"fileId": "<one of the given ids>", "reason": "<one short sentence>"}. ' +
    'The reason must cite only what is visible in the given labels and page context. ' +
    'Do not invent anything about the documents\' contents. ' +
    'If nothing distinguishes them, pick the most general-purpose one and say so.';

  const user = JSON.stringify({
    field: fieldLabel,
    page: { title: pageTitle, url: pageUrl },
    documents: documents.map((d) => ({
      fileId: d.fileId,
      label: d.userDefinedLabel,
      fileName: d.originalName,
    })),
  });

  return { system, user };
}
