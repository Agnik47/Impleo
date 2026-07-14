// Site-wide content + config constants. Copy is lifted from the Copy Bank in
// docs/LANDING_PAGE.md §10 and the story beats in docs/UPDATED_DESIGN_MD.md, so
// there's one place to update marketing language.

// TODO before launch (LANDING_PAGE.md §11): replace with the real Chrome Web
// Store listing + repo URLs. Kept as '#' placeholders until then.
export const CHROME_STORE_URL = '#';
export const GITHUB_URL = '#';

export const TRUST_TRIAD = 'Bring your own key · Runs locally · Never auto-submits';

// The nine story sections (UPDATED_DESIGN_MD.md §Required Sections). `id` is the
// scroll anchor + the key the persistent mascot journey keys its state off.
export const SECTIONS = [
  { id: 'hero', label: 'Home', mascot: 'sleeping' },
  { id: 'pain', label: 'The problem', mascot: 'sleeping' },
  { id: 'discovery', label: 'Discovery', mascot: 'discovering' },
  { id: 'extraction', label: 'How it works', mascot: 'filling' },
  { id: 'review', label: 'Review', mascot: 'approving' },
  { id: 'privacy', label: 'Privacy', mascot: 'protecting' },
  { id: 'providers', label: 'Models', mascot: 'filling' },
  { id: 'success', label: 'Success', mascot: 'celebrating' },
  { id: 'cta', label: 'Get Impleo', mascot: 'celebrating' },
];

// Nav shows a curated subset (not every story beat).
export const NAV_LINKS = [
  { href: '#extraction', label: 'How it works' },
  { href: '#review', label: 'Review' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#providers', label: 'Models' },
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

export const FAQ = [
  [
    'Does Impleo submit forms for me?',
    'No. Never. You always press submit yourself — it is a hard product rule, with no code path that clicks a submit button.',
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
  [
    'Is it free?',
    'The extension is free. Your only cost is whatever your chosen model provider charges for the calls you make.',
  ],
];
