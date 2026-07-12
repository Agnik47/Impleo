# STRUCTURE.md — File & Folder Structure Spec

This is the binding spec for the repo layout. **Pivoted 2026-07-12** (see
`AGENTS.md`'s "Architecture pivot" note): the project is now a two-part repo
— an `extension/` (MV3, React + Tailwind side panel via Vite) and a
`server/` (local Express + SQLite backend that owns the Anthropic key and
all persistence). Claude Code should not create files outside this
structure, rename top-level folders, or introduce further top-level folders
without it being called out as a deviation in `OUTCOME.md` and a reason
given.

## Full tree

```
impleo/
├── extension/
│   ├── manifest.json               MV3 manifest — permissions, entry points
│   ├── background.js               Minimal service worker (side panel open
│   │                                behavior only — no API key, no fetch)
│   ├── content-scripts/
│   │   ├── google-forms.js          export extractGoogleForm(), fillGoogleForm(answers)
│   │   ├── luma.js                  export extractLumaForm(), fillLumaForm(answers)
│   │   ├── generic-extractor.js     export extractGenericForm()
│   │   └── generic-filler.js        export fillGenericForm(approvedAnswers)
│   ├── src/sidepanel/
│   │   ├── index.html                Vite entry HTML
│   │   ├── main.jsx                  React root mount
│   │   ├── App.jsx                   View routing (onboarding vs main/review)
│   │   ├── components/                Onboarding.jsx, ReviewCard.jsx, etc.
│   │   ├── lib/api.js                 fetch() wrapper for calling server/
│   │   └── index.css                  Tailwind entry (@tailwind directives)
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── index.js                  Express app entry, CORS + JSON middleware
│   │   ├── db.js                     SQLite connection + schema init/migration
│   │   └── routes/
│   │       ├── profile.js             GET/PUT profile
│   │       ├── settings.js            GET (hasApiKey only, never the raw key)/PUT apiKey
│   │       ├── qa-history.js          GET/POST qaHistory (capped at 50)
│   │       ├── generate.js            POST generate-answers, POST regenerate-answer
│   │       └── test-key.js            POST test-api-key
│   ├── data/                         SQLite .db file lives here (gitignored)
│   └── package.json
│
└── docs/
    ├── PRD.md                       Product spec — what & why
    ├── AGENTS.md                    Rules the coding agent must follow, every session
    ├── ARCHITECTURE.md              Technical design rationale
    ├── STRUCTURE.md                 This file
    ├── ROADMAP.md                   Phases, milestones, dependencies
    ├── TASKS.md                     Granular checklist per phase
    ├── PROMPTS.md                   Copy-paste-ready prompts per task
    ├── BACKEND_VERIFICATION.md      Verification checklist for server/ / API layer
    ├── CLARIFICATION_QUESTIONS.md   Open questions that need a human answer before/during build
    └── OUTCOME.md                   Running log — what was actually built & verified, per phase
```

No other top-level files or folders unless explicitly called out as a
deviation in `OUTCOME.md` with a reason given.

## Module boundary rules

- `server/src/db.js` is the **only** module allowed to touch the SQLite
  database directly. Every route reads/writes profile, qaHistory, or the API
  key through its exported functions.
- `server/` is the **only** thing allowed to `fetch()` `api.anthropic.com` or
  hold the Anthropic API key. The extension (side panel, content scripts)
  never sees the raw key — the side panel calls `server/`'s own routes, and
  `server/` calls Anthropic.
- Content-script files (`extension/content-scripts/*.js`) never `import`
  from `extension/src/sidepanel/` — they are injected in isolation via
  `chrome.scripting.executeScript` and must be self-contained (see
  `AGENTS.md`'s serialization rule). Sidepanel React code imports *from*
  them, never the reverse.
- `extension/src/sidepanel/App.jsx` (plus whatever hooks it delegates to) is
  the only place that orchestrates the end-to-end flow (extract → generate →
  review → fill → save history). No other file should contain flow-control
  logic that spans more than one of those steps.

## Naming conventions

- Extension file names: kebab-case (`generic-extractor.js`) for
  content-scripts; component files PascalCase (`ReviewCard.jsx`) under
  `src/sidepanel/components/`, matching the exported component name.
- Server file names: kebab-case (`qa-history.js`).
- Exported function names: camelCase, verb-first (`extractGoogleForm`,
  `fillLumaForm`, `saveProfile`).
- REST routes: kebab-case paths matching the file name (`POST
  /api/generate-answers`, `POST /api/test-key`) — matched exactly between
  `server/src/routes/*.js` and `extension/src/sidepanel/lib/api.js`, so a
  typo doesn't silently 404.
- Field schema `fieldType` values: lowercase with underscores where needed
  (`text`, `textarea`, `radio`, `checkbox`, `checkbox_single`, `dropdown`,
  `upload`) — these are load-bearing string constants compared across
  extractor → server prompt → filler, so they must match exactly everywhere
  they appear. Grep for `fieldType` before changing any of these strings.

## What does NOT belong in this repo

- No hardcoded API key anywhere in `extension/` or committed to `server/`
  source — the key is stored in the server's SQLite DB (entered once via the
  onboarding UI) or a local `.env` the server reads at startup; either way,
  `server/.env` and `server/data/*.db` are gitignored.
- No hosted/cloud database — SQLite file, local only, per `AGENTS.md` rule 3.
- No test framework scaffolding (Jest, Playwright, etc.) for v1 — manual
  verification against real pages per `BACKEND_VERIFICATION.md` and the
  per-phase `OUTCOME.md` entries is the deliberate choice for this scope.
