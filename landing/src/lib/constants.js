// Site-wide content + config constants. Copy is lifted from the Copy Bank in
// docs/LANDING_PAGE.md §10 and the story beats in docs/UPDATED_DESIGN_MD.md, so
// there's one place to update marketing language.

export const GITHUB_URL = 'https://github.com/Agnik47/Impleo';
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`;
export const GITHUB_FORK_URL = `${GITHUB_URL}/fork`;
export const INSTALL_GUIDE_URL = `${GITHUB_URL}/blob/main/INSTALLATION.md`;
export const CONTRIBUTING_URL = `${GITHUB_URL}#contributing`;

export const TRUST_TRIAD = 'Bring your own key · Runs locally · Never auto-submits';

// The nine story sections (UPDATED_DESIGN_MD.md §Required Sections), plus the
// Q&A and the open-source coda. `id` is the scroll anchor + the key the
// persistent mascot journey keys its state off.
//
// This array is the single source of truth for the nav, the chapter rail, and
// the mascot — and NOTHING here verifies the ids exist. An entry whose section
// isn't rendered in App.jsx still draws a link that silently scrolls nowhere,
// so add the section first.
//
// 'faq' and 'contribute' sit outside the brief's nine-beat spine: the CTA still
// closes the narrative, Q&A clears objections just before it, and contribute is
// a coda for the reader who is still here after deciding.
//
// `mascot` must be a value listed in MASCOT_STATES (providers/MascotProvider).
export const SECTIONS = [
  { id: 'hero', label: 'Home', mascot: 'sleeping' },
  { id: 'pain', label: 'The problem', mascot: 'sleeping' },
  { id: 'discovery', label: 'Discovery', mascot: 'discovering' },
  { id: 'extraction', label: 'How it works', mascot: 'filling' },
  { id: 'review', label: 'Review', mascot: 'approving' },
  { id: 'privacy', label: 'Privacy', mascot: 'protecting' },
  { id: 'providers', label: 'Models', mascot: 'filling' },
  { id: 'success', label: 'Success', mascot: 'celebrating' },
  { id: 'faq', label: 'Q&A', mascot: 'questioning' },
  { id: 'cta', label: 'Get Impleo', mascot: 'celebrating' },
  { id: 'contribute', label: 'Contribute', mascot: 'planting' },
];

// Nav shows a curated subset (not every story beat).
export const NAV_LINKS = [
  { href: '#extraction', label: 'How it works' },
  { href: '#review', label: 'Review' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#faq', label: 'Q&A' },
  { href: '#contribute', label: 'Contribute' },
];

export const PROVIDERS = ['Anthropic', 'Google Gemini', 'OpenAI', 'Groq'];

// The 5-step extraction pipeline (horizontal-scroll section).
export const PIPELINE_STEPS = [
  { n: '01', title: 'Detect', body: 'Open the side panel on any form page.' },
  { n: '02', title: 'Extract', body: 'Impleo reads every question and field type.' },
  { n: '03', title: 'Generate', body: 'Personalized answers in your voice — one AI call.' },
  { n: '04', title: 'Review', body: 'Accept · Edit · Regenerate · Skip — every answer.' },
  { n: '05', title: 'Fill', body: 'Only approved answers are written. Submit is never touched.' },
];

export const PRIVACY_PLEDGES = [
  'Runs on your machine — a local server, not our cloud.',
  'Your profile and keys live in a local database, single-user.',
  'Your data is only ever sent to the model provider you chose.',
];

/*
 * Availability, told as growth rather than a "Coming Soon!" badge.
 *
 * The store listing genuinely isn't live yet, and the honest version of that is
 * also the more interesting one: the extension is finished and free NOW, it just
 * arrives by clone instead of by one click. `here: true` marks the stage a
 * reader can act on today — the middle of the rail, not the end.
 */
export const GROWTH_STAGES = [
  {
    stage: 'Seed',
    body: 'Built, working, and open source under MIT.',
    done: true,
  },
  {
    stage: 'Sprout',
    body: 'Clone it and run it locally — the whole extension, free.',
    done: true,
    here: true,
  },
  {
    stage: 'Canopy',
    body: 'One-click install from the Chrome Web Store.',
    done: false,
  },
];

// Verbatim from INSTALLATION.md's quick start. `npm start` blocks, so it has to
// be the last line of its own command — don't chain anything after it.
export const QUICK_START_LINES = [
  'git clone https://github.com/Agnik47/Impleo.git && cd Impleo',
  'cd server && npm install && cd ../extension && npm install && npm run build',
  'cd ../server && npm start',
];

export const QUICK_START_COMMAND = QUICK_START_LINES.join('\n');

// The prompt a reader can paste into their own coding agent. INSTALLATION.md is
// written as an agent-executable runbook, so this is a real instruction, not a
// marketing flourish.
export const AGENT_PROMPT = 'Read INSTALLATION.md in the repo root and set up Impleo locally.';

/*
 * Contribution paths, ordered cheapest-effort first so nobody bounces off a
 * wall of "submit a PR". Each maps to something genuinely unclaimed in the
 * README roadmap — no invented asks.
 */
export const CONTRIBUTE_WAYS = [
  {
    icon: 'star',
    title: 'Drop a seed',
    body: 'Star the repo. It costs you one click and puts Impleo in front of the next person hand-copying their résumé at 2am.',
    cta: 'Star on GitHub',
    href: GITHUB_URL,
  },
  {
    icon: 'issue',
    title: 'Flag a broken vine',
    body: 'Form platforms rewrite their DOM without warning. If an extractor stops biting on a page, open an issue with the URL — that report is the fix.',
    cta: 'Open an issue',
    href: GITHUB_ISSUES_URL,
  },
  {
    icon: 'fork',
    title: 'Grow a new branch',
    body: 'Greenhouse, Lever, Workday and Typeform extractors are all still unclaimed on the roadmap. Pick one and it is yours.',
    cta: 'Fork the repo',
    href: GITHUB_FORK_URL,
  },
  {
    icon: 'book',
    title: 'Clear the path',
    body: 'Setup notes, a sharper error message, a docs fix — anything that saves the next person the hour you just spent.',
    cta: 'Read the guide',
    href: INSTALL_GUIDE_URL,
  },
];

// The three hard constraints from the README's contributing section. Stated up
// front because they are the reasons a PR gets turned down, and finding that out
// after the work is done is the worst way to learn them.
export const JUNGLE_RULES = [
  {
    title: 'Never auto-submit',
    body: 'There is no code path that clicks a submit button, and there never will be. Human-in-the-loop is structural, not a setting.',
  },
  {
    title: 'Privacy is a hard constraint',
    body: 'No telemetry, no hosted storage, no call to an endpoint the user did not configure themselves.',
  },
  {
    title: 'Keep it scoped',
    body: 'A small, reviewable diff with a clear rationale beats a large speculative one. Read docs/ before reshaping architecture.',
  },
];

export const FAQ = [
  [
    'Does Impleo submit forms for me?',
    'No. Never. You always press submit yourself — it is a hard product rule, with no code path that clicks a submit button.',
  ],
  [
    'Is it on the Chrome Web Store yet?',
    'Not yet — that listing is on its way. Until it lands you can clone the repo and run it locally in about five minutes. It is the same finished extension, not a preview or a trial.',
  ],
  [
    'Is it free?',
    'Yes. Impleo is MIT-licensed and free, whether you run it locally today or install it from the store later. Your only cost is whatever your chosen model provider charges for the calls you make.',
  ],
  [
    'Do I need my own API key?',
    'Yes — bring a key from any supported provider (Anthropic, Gemini, OpenAI, or Groq). You only pay that provider’s usage.',
  ],
  [
    'Where is my data stored?',
    'Locally, on your machine, in a single-user database owned by a local server. Nothing is hosted or shared.',
  ],
  [
    'Which forms are supported?',
    'Google Forms and Luma natively, plus generic HTML forms — including radios, checkboxes, and dropdowns.',
  ],
];
