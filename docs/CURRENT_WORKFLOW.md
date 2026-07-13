# CURRENT_WORKFLOW.md — How Impleo Actually Works Today

This document describes the system **as implemented in this repository right
now** — no planned features, no aspirational architecture. Every claim below
is traceable to a specific file. If a future change makes any of this wrong,
update this file in the same commit.

---

# Project Overview

## What problem Impleo solves

Filling out application forms (hackathons, fellowships, accelerators,
scholarships, conferences) has two kinds of fields:

- **Mechanical fields** — name, email, phone, location. Trivial, but still
  manual typing every time.
- **Contextual essay fields** — "why do you want to attend," "tell us about
  yourself," "describe your project." These require pulling facts from a
  resume, GitHub, past answers, and personal context, then writing a
  paragraph that sounds like the applicant, not a template.

Today, that second category means: open a resume in one tab, open the form
in another, maybe paste into ChatGPT for a draft, then hand-copy the result
into the form field, repeated per question, repeated per application. Per
`docs/PRD.md`, this takes 30–45 minutes per application, several times a
month, for someone applying regularly.

Impleo's actual job, as built: extract the questions on the current page,
generate a personalized answer for each one from a profile the user filled
in once, let the user review every answer, and fill only what they approve
into the live page. It never submits anything.

## Why existing autofill tools are insufficient

Standard browser/password-manager autofill (Chrome's built-in autofill,
LastPass, etc.) only handles fields it can pattern-match against a fixed
schema: name, email, phone, address, card number. It has no answer for
"describe a project you're proud of" — there is no fixed field type for
free-text, personalized, context-dependent writing. Generic AI browser
extensions that *do* attempt open-ended text generation typically either:

- have no structured, reusable profile (you re-explain yourself every time
  in a prompt box), or
- write directly into the page without a review step.

Impleo's actual differentiators, as built, are the structured profile (one
persistent JSON object in the local database — personal info, links,
education, skills, goals, projects, achievements, resume text, a writing
sample used to anchor voice/tone) and a mandatory human review step
(`ReviewFlow.jsx` / `ReviewCard.jsx`) between generation and fill — nothing
touches the DOM until the user clicks Accept.

---

# User Flow

Step-by-step, matching what the code actually does:

1. **User installs the extension.** `extension/manifest.json` is a Manifest
   V3 Chrome extension (`permissions: ["activeTab", "scripting",
   "sidePanel"]`, `host_permissions: ["<all_urls>"]`). Loaded unpacked from
   `extension/dist/` (built via `npm run build`/`vite build`). Clicking the
   toolbar icon opens the side panel — `background.js` is a 4-line service
   worker whose only job is `chrome.sidePanel.setPanelBehavior({
   openPanelOnActionClick: true })`.

2. **User opens settings.** On first load, `App.jsx` calls
   `api.getProfile()` and `api.getSettings()` in parallel. If there's no
   saved profile, or the active provider has no key saved, it renders
   `Onboarding.jsx` instead of the main review view. The gear/"Settings"
   button in the main view routes back to the same `Onboarding` component
   at any time.

3. **User enters an API key.** Onboarding's "AI provider" section is a
   dropdown of exactly four providers (Anthropic, Google Gemini, OpenAI,
   Groq — defined in `server/src/providers.js`'s `PROVIDERS` map), a
   password-type key input, and a plain-text model-name input pre-filled
   from that provider's saved model or a suggested default
   (`DEFAULT_MODELS`). "Test key" calls `POST /api/test-key`, which makes a
   real 10-token completion call to the chosen provider server-side and
   reports success/failure before the user commits to saving it.

4. **User stores profile information.** The rest of the onboarding form —
   personal info, links, education, skills, interests, goals, projects
   (`name | description | tech stack | impact` per line), achievements,
   pasted resume text, and a pasted writing sample — is local React state
   (`Onboarding.jsx`'s `form` state) until "Save profile" is clicked, which
   calls `api.saveProfile()` and `api.saveSettings()` together via
   `Promise.allSettled`.

5. **Data storage mechanism.** Nothing is stored in `chrome.storage.local`.
   Every save is an HTTP `PUT` from the side panel to a **local Express
   server** (`server/src/index.js`, listening on `127.0.0.1:3001` only —
   not exposed to the network). The server persists to a **SQLite database**
   (`better-sqlite3`, file at `server/data/impleo.db`) via `server/src/db.js`,
   with three tables: `profile` (one JSON blob row), `settings` (one row:
   active provider + one key column and one model column per provider), and
   `qa_history` (append-only, capped at 50 rows).

6. **Form extraction process.** Back in the main view, clicking "Extract
   form from this page" (`ReviewFlow.jsx`'s `handleExtract`) reads the
   active tab's URL via `chrome.tabs.query`, picks a platform by hostname
   (`docs.google.com` → Google Forms, `lu.ma` → Luma, anything else →
   generic), then runs the matching extractor function with
   `chrome.scripting.executeScript({ target: { tabId }, func:
   EXTRACTORS[platform] })` — injecting and running the function directly
   inside the page's own DOM context.

7. **How questions are detected.** Each extractor (`generic-extractor.js`,
   `google-forms.js`, `luma.js`) walks the page's DOM for form controls
   (native `input`/`textarea`/`select` for generic/Luma; `[role="listitem"]`
   containers with ARIA roles for Google Forms) and resolves a human-readable
   label per field using a fallback chain: `label[for]` → wrapping `<label>`
   → `aria-label` → `aria-labelledby` → nearest preceding text node →
   `placeholder`/`name` attribute. Radio/checkbox inputs sharing a `name`
   (or an ARIA `radiogroup`/parent container, for Luma's custom widgets) are
   grouped into one question with an `options` array. Each detected field or
   group is stamped with a unique `data-impleo-id="..."` attribute and
   returned as `{ id, questionText, fieldType, options, required, selector }`
   — `fieldType` is one of `text`, `textarea`, `radio`, `checkbox_single`,
   `checkbox`, `dropdown`, `upload`.

8. **How extracted fields are sent to the AI.** The side panel never talks
   to any LLM provider directly (enforced by `AGENTS.md` rule 2 — the
   server owns every provider's API key). `ReviewFlow.jsx`'s
   `generateAnswers()` strips each extracted field down to
   `{ id, questionText, fieldType, options, required }` (dropping the DOM
   `selector`, which the AI never needs) and calls
   `api.generateAnswers(schema)`, a `POST` to `/api/generate-answers` on the
   local server.

9. **How profile data is combined with extracted questions.** The server
   never trusts the client to send profile data — `generate.js`'s
   `getActiveProvider()` and `getProfile()` read the active provider/key/
   model and the full saved profile directly from its own SQLite database.
   `buildSystemPrompt(profile)` formats the entire profile (personal info,
   links, education, skills, interests, goals, every project, achievements,
   resume text, writing sample) into one system-prompt string, with a
   CRITICAL RULE section stating the model must only use facts literally
   present in that profile — this is the no-fabrication instruction
   (`AGENTS.md` rule 7). The last 10 `qa_history` entries are also attached
   as extra context in the same request payload, so the model has visibility
   into recently-given answers.

10. **Answer generation flow.** The formatted system prompt plus a
    `userContent` JSON payload (`{ formSchema, recentQaHistory }`) is sent to
    whichever provider is active via that provider's `chat()` adapter in
    `providers.js` (Anthropic Messages API, Gemini `generateContent`,
    OpenAI-compatible chat completions shared by OpenAI and Groq — each
    normalized to the same `chat({apiKey, model, systemPrompt, userContent,
    maxTokens}) → text` shape). The system prompt instructs the model to
    respond with **only** a raw JSON array — one `{id, answer, confidence}`
    object per question, `confidence` being `"high"`/`"medium"`/`"low"` based
    on how well-grounded the answer is in the profile. `generate.js` strips
    any markdown code fences and `JSON.parse`s the result; a `SyntaxError`
    here is caught and surfaced as a 502 with a readable message rather than
    crashing.

11. **Review process.** The returned answers populate `reviewState` in
    `ReviewFlow.jsx`, one entry per question:
    `{ answer, confidence, status, regenerating }`, with `status` starting
    at `"pending"` (or `"unactionable"` for `upload` fields, which can never
    be filled automatically and are rendered as a manual-action reminder
    instead of a review card). Each field renders as a `ReviewCard` showing
    the question, a colored confidence badge, and the generated answer
    (long answers are `line-clamp`ed with a "Show more" toggle).

12. **Accept/Edit/Skip workflow.** Per card: **Accept** sets
    `status: "accepted"` as-is. **Edit** opens an inline textarea (or a
    radio/checkbox option list for choice fields) and **Save** sets
    `status: "edited"` with the user's own value. **Skip** sets
    `status: "skipped"` — that field is excluded from fill. **Regenerate**
    (behind a collapsible "more actions" toggle, alongside a free-text
    instruction input like "make it shorter") calls
    `POST /api/regenerate-answer` with the single question plus the typed
    instruction, replacing that field's answer/confidence in place. A
    top-of-list **"Accept high/mid"** button bulk-accepts every field still
    `pending` with `confidence` of `high` or `medium` in one click, leaving
    low-confidence and already-touched fields for individual review.

13. **Fill approved fields process.** Clicking **"Fill approved"**
    (`handleFill`) filters `formSchema` down to fields whose status is
    `accepted` or `edited`, maps each to `{ id, selector, fieldType, value }`,
    and injects the matching filler function
    (`fillGoogleForm`/`fillLumaForm`/`fillGenericForm`) via
    `chrome.scripting.executeScript` with that array as an argument. Inside
    the page, the filler `document.querySelector`s each field's stored
    `selector` (the `[data-impleo-id="..."]` attribute set during
    extraction), sets text values through the native property setter +
    `dispatchEvent` (needed because React-controlled inputs on the target
    page silently ignore a plain `el.value = x` assignment — React overrides
    the native setter for its own virtual-DOM diffing), and `.click()`s the
    matching option for radio/checkbox/dropdown fields (matched by exact
    label first, then case-insensitive substring). Each field's fill result
    (`filled`/`no_match`/`not_found`/`error`, with a reason) is returned as a
    report and shown inline on its `ReviewCard`. **No code path in any
    filler ever references a submit button, `form.submit()`, or navigation**
    — this is a hard rule (`AGENTS.md` rule 1), not an oversight. After a
    fill, each approved Q&A pair is appended to `qa_history` via
    `POST /api/qa-history` for future-request context.

---

# Technical Flow

```
User clicks "Extract form from this page"
  -> ReviewFlow.jsx (handleExtract)
       reads active tab via chrome.tabs.query
  -> chrome.scripting.executeScript
       injects extension/content-scripts/{google-forms,luma,generic-extractor}.js
       (runs inside the target page's own isolated DOM world)
  -> formSchema returned to ReviewFlow.jsx, stored in React state
  -> ReviewFlow.jsx (generateAnswers) calls api.js -> POST /api/generate-answers
  -> server/src/routes/generate.js
       reads profile + active provider/key/model + recent qa_history
       from server/src/db.js (SQLite)
       builds system prompt (no-fabrication rule + full profile)
  -> server/src/providers.js (provider.chat())
       -> api.anthropic.com  |  generativelanguage.googleapis.com
          |  api.openai.com  |  api.groq.com   (whichever is active)
  -> JSON answers parsed, returned to ReviewFlow.jsx
  -> ReviewCard.jsx renders each answer for review
  -> User: Accept / Edit / Skip / Regenerate / "Accept high/mid"
  -> User clicks "Fill approved"
  -> ReviewFlow.jsx (handleFill) -> chrome.scripting.executeScript
       injects extension/content-scripts/{google-forms,luma,generic-filler}.js
       with the approved {id, selector, fieldType, value} list
  -> filler locates each field via its stored [data-impleo-id] selector,
     sets values (native-setter trick for React-controlled pages),
     clicks matching options — NEVER touches a submit control
  -> fill report returned, shown per-card
  -> approved Q&A appended to qa_history via POST /api/qa-history
```

**Where each step happens, and why that file exists:**

| File | Role | Why it exists as a separate file |
|---|---|---|
| `extension/background.js` | MV3 service worker | Minimal by design — since the architecture pivot, it no longer owns any API key or makes network calls; its only job is opening the side panel on icon click. |
| `extension/src/sidepanel/App.jsx` | View router | Decides loading / server-unreachable / onboarding / main based on whether a profile and a configured provider exist. |
| `extension/src/sidepanel/components/Onboarding.jsx` | Profile + provider setup UI | Isolated from the review flow because it's a completely different interaction (long form vs. review cards) and is reachable both on first run and later via Settings. |
| `extension/src/sidepanel/ReviewFlow.jsx` | Extraction → generation → review → fill orchestration | The single owner of `reviewState`; centralizing it here (rather than in each `ReviewCard`) is what lets "Accept high/mid" and the approved-count header work across all fields at once. |
| `extension/src/sidepanel/components/ReviewCard.jsx` | One question's review UI | Kept generic across all three platforms — it only knows about `fieldType`/`options`/`status`/`confidence`, never about Google Forms/Luma/generic DOM specifics. |
| `extension/src/sidepanel/lib/api.js` | Sole `fetch()` wrapper to the server | One place that knows the server's base URL and response-shape handling, so every route call goes through the same error-normalization logic. |
| `extension/content-scripts/*.js` | DOM extraction/fill, one pair per platform | Must be self-contained, closure-free exported functions (no imports, no outer-scope references) because `chrome.scripting.executeScript({ func })` serializes the function via `toString()` and re-parses it inside the target page's isolated world — anything relying on module scope would silently break. |
| `server/src/index.js` | Express app entry | Binds to `127.0.0.1` only (loopback) and applies a CORS policy allowing only `chrome-extension://` origins — the one place that decides what's allowed to talk to this server at all. |
| `server/src/db.js` | SQLite connection + schema | Owns table creation and the one in-place migration (legacy single-key `settings` row → per-provider key/model columns) so every route can assume the schema already matches. |
| `server/src/routes/*.js` | One file per resource (`profile`, `settings`, `qa-history`, `test-key`, `generate`) | Each route file only touches its own table(s); `generate.js` is the only one that also reads `profile` and `settings`, since it needs both to build a prompt. |
| `server/src/providers.js` | Provider adapter map | Normalizes four different vendor wire formats (Anthropic's `system`+`messages`, Gemini's `systemInstruction`+`contents`+model-in-URL, OpenAI/Groq's shared `messages` array with a leading system role) to one `chat()` shape, so `generate.js` and `test-key.js` never branch on which provider is active. |

---

# Architecture Diagram

```
┌───────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                              │
│                                                               │
│  ┌─────────────────────────────┐   ┌──────────────────────┐ │
│  │ Side Panel (Vite+React+Tailwind)│  │ background.js         │ │
│  │ extension/src/sidepanel/*        │  │ (opens side panel on │ │
│  │  - App.jsx (routing)              │  │  icon click, only)   │ │
│  │  - Onboarding.jsx                 │  └──────────────────────┘ │
│  │  - ReviewFlow.jsx                 │                            │
│  │  - ReviewCard.jsx                 │                            │
│  └───────────┬───────────────┬───────┘                            │
│              │               │ chrome.scripting.executeScript      │
│              │ fetch()       ▼                                     │
│              │        ┌────────────────────────────┐               │
│              │        │ Content scripts (injected,   │               │
│              │        │ not persistent)                │               │
│              │        │ extension/content-scripts/*.js │               │
│              │        │  - extractGoogleForm/Luma/Generic│             │
│              │        │  - fillGoogleForm/Luma/Generic   │             │
│              │        │  reads & writes the target page's│             │
│              │        │  own DOM directly                 │               │
│              │        └────────────────────────────┘               │
└──────────────┼──────────────────────────────────────────────────────┘
               │ HTTP (localhost only)
               ▼
┌───────────────────────────────────────────────────────────┐
│  Local Express Server — server/                              │
│  bound to 127.0.0.1:3001, CORS restricted to                 │
│  chrome-extension:// origins only                             │
│                                                               │
│  routes: /api/profile  /api/settings  /api/qa-history         │
│          /api/test-key  /api/generate-answers                 │
│          /api/regenerate-answer                                │
│                                                               │
│  server/src/providers.js — dispatches to whichever provider   │
│  is active (Anthropic / Gemini / OpenAI / Groq)                │
└───────────┬───────────────────────────────────────────────┘
            │ fetch() — server-side only, never from the extension
            ▼
┌───────────────────────────────────────────────────────────┐
│  External LLM API (exactly one active at a time)              │
│  api.anthropic.com  /  generativelanguage.googleapis.com      │
│  api.openai.com  /  api.groq.com                               │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│  server/data/impleo.db  (SQLite, better-sqlite3, WAL mode)     │
│  tables: profile · settings · qa_history                      │
│  the ONLY place any persistent state lives — nothing syncs    │
│  to a hosted service, nothing leaves the machine except the   │
│  single outbound call to whichever LLM provider is active     │
└───────────────────────────────────────────────────────────┘
```

---

# Data Flow Diagram

```
[Onboarding save]
  Onboarding.jsx --PUT /api/profile--> profile.js --> profile table
  Onboarding.jsx --PUT /api/settings--> settings.js --> settings table
                                                          (key/model per provider)

[Extraction]
  Target page DOM --(extractor function, injected)--> formSchema[]
  formSchema[] --> ReviewFlow.jsx (React state)

[Generation]
  ReviewFlow.jsx --POST /api/generate-answers { formSchema }--> generate.js
  generate.js --SELECT--> profile table, settings table, qa_history table (last 10)
  generate.js --chat()--> providers.js --HTTPS--> active LLM provider API
  active LLM provider API --JSON text--> generate.js --parsed--> { answers[] }
  { answers[] } --response--> ReviewFlow.jsx --> reviewState (React state)

[Review + edit — entirely client-side, no network calls]
  ReviewCard.jsx <--> reviewState (accept/edit/skip/regenerate-instruction typing)
  Regenerate --POST /api/regenerate-answer { question, instruction }--> generate.js
    --(same profile+provider lookup + chat() call)--> single updated answer

[Fill]
  ReviewFlow.jsx --approved answers--> chrome.scripting.executeScript
    --(filler function, injected)--> target page DOM (values set, options clicked)
  fill report --returned--> ReviewFlow.jsx --> shown per ReviewCard
  ReviewFlow.jsx --POST /api/qa-history (per approved answer)--> qa-history.js
    --INSERT + trim to 50--> qa_history table
```

---

# State Management

- **React state (client-side, in-memory, lost on side panel close):**
  `App.jsx` holds `status`/`profile`/`settings`. `ReviewFlow.jsx` holds
  `phase`, `formSchema`, `reviewState` (the per-question status/answer/
  confidence map — the single most important piece of client state in the
  app), and `fillReport`. `ReviewCard.jsx` holds only its own transient
  `editing`/`draft`/`instruction`/`showMore`/`expanded` UI state. None of
  this is persisted anywhere client-side — closing the side panel and
  reopening it always starts back at the main "Extract form" screen, not a
  resumed review session.
- **`chrome.storage.local`: not used at all**, despite being a declared
  permission-adjacent API on the extension platform and despite `PRD.md`'s
  original (pre-pivot) text still describing it. Every persistent read/write
  goes through the local Express server's SQLite database instead — this is
  the post-2026-07-12-pivot architecture; `chrome.storage.local` is a
  leftover reference in the original PRD text, not something the current
  code touches (`extension/src/sidepanel/lib/api.js` is the only data-access
  layer, and it only does `fetch()` to `localhost:3001`).
- **Side panel ↔ content script communication:** not via
  `chrome.runtime.sendMessage` — extraction/fill results come back as the
  **return value** of `chrome.scripting.executeScript()` itself (the
  injected function's `return` becomes `result` in the resolved promise).
  `chrome.runtime.sendMessage` isn't used anywhere in this codebase's actual
  data path.
- **Side panel ↔ server communication:** plain `fetch()` over HTTP to
  `http://localhost:3001`, wrapped by `api.js`. Every response is expected
  to be JSON; a non-2xx response's `error` field is thrown as a JS `Error`
  and surfaced as visible text in the UI (never silently swallowed to
  `console.error`, per `AGENTS.md`'s error-surfacing convention).
- **Server-side persistent state:** the SQLite database is the only source
  of truth across sessions/browser restarts. `settings` is a single row
  (`id = 1`) holding the active provider name plus one key column and one
  model column per provider (`anthropic_key`/`anthropic_model`,
  `gemini_key`/`gemini_model`, etc.) — a wide-row design chosen because
  there are only ever exactly 4 providers and no plugin system is planned.
  `profile` is a single row holding one JSON blob (not normalized into
  columns — the shape is nested and UI-driven, so JSON-in-a-column avoids a
  schema migration every time a profile field is added). `qa_history` is the
  one genuinely multi-row table, capped at 50 rows by a delete-oldest query
  run after every insert.

---

# AI Pipeline

**Context gathering:** `generate.js`'s `requireProviderAndProfile()` reads
two things directly from the database before any prompt is built: the
active provider (with its key and resolved model — saved model if present,
else `DEFAULT_MODELS[providerId]`) and the full saved profile. If either is
missing, the request fails fast with a 400 and a specific, actionable error
message rather than attempting a call that would fail deeper in the stack.

**Prompt construction:** `buildSystemPrompt(profile)` produces a single
system-prompt string with, in order: (1) a framing line naming the
applicant, (2) the CRITICAL RULE — DO NOT FABRICATE instruction, stated as
taking priority over sounding impressive, (3) the entire profile formatted
as labeled plain text (`formatProfile()`), (4) per-`fieldType` formatting
rules (verbatim option-copying for choice fields, null for uploads, matched
tone for free text via the writing sample), (5) the confidence-labeling
instruction, (6) the required raw-JSON-array response format. The
**user** message is a JSON blob of `{ formSchema, recentQaHistory }` (or,
for regeneration, `{ formSchema: [question], recentQaHistory, instruction }`)
— structured data, not natural language, since the model's real job here is
closer to structured extraction+generation than open-ended chat.

**Generation process:** exactly one outbound call per
generate/regenerate action, routed through whichever provider adapter in
`providers.js` matches the active provider — no fan-out to multiple
providers, no retry chain, no fallback if the active provider's call fails
(a deliberate scope decision, not a gap — `AGENTS.md` rule 5 explicitly
rules out automatic cross-provider fallback). `maxTokens` is fixed at 4096
for both generation and regeneration. The raw response text is stripped of
markdown code fences (models sometimes wrap JSON in ` ```json ` blocks
despite instructions not to) and parsed as JSON; a shape check confirms it's
an array before use.

**Approval workflow:** covered in detail in "User Flow" steps 11–12 above —
every generated answer lands in `status: "pending"` and only reaches the
DOM after an explicit per-field Accept/Edit, or the bulk "Accept high/mid"
action (which itself only ever touches fields already at `high`/`medium`
confidence, never `low`). There is no code path that fills an answer the
user hasn't explicitly approved.

---

# Security Model

- **API key storage:** every provider's key lives only in the server's
  SQLite database (`settings` table, one column per provider), written only
  by `PUT /api/settings`, read only server-side by `generate.js` and
  `test-key.js`. `GET /api/settings` returns a `hasKey: boolean` per
  provider — **the raw key value is never sent back to the client**, not
  even to populate the onboarding form on reload (the key input always
  starts blank; re-entering a key is required to change it).
- **Profile storage:** the full profile (including resume text, which can
  contain personal identifying information) is stored as a single JSON blob
  in the local SQLite database, never encrypted at rest, never synced
  anywhere. This is an accepted tradeoff for a local, single-user, one-
  install-per-person tool (see `PRD.md` §3's non-goals — no hosted backend,
  no multi-tenancy), not an oversight.
- **Browser permissions:** `manifest.json` requests `activeTab`, `scripting`,
  and `sidePanel`, plus `host_permissions: ["<all_urls>"]` (required because
  the extension needs to inject extraction/fill scripts into whatever
  arbitrary form page the user has open — there's no way to know the set of
  hosts in advance). It does **not** request `storage` (unused, since
  `chrome.storage.local` isn't used) or any background/network-wide
  permission beyond what content-script injection requires.
- **Network exposure:** the Express server binds to `127.0.0.1` explicitly
  (not `0.0.0.0`), so it is unreachable from other devices on the same
  network — a deliberate choice noted in `index.js`'s own comment, since an
  unbound `listen()` would expose it more widely than `chrome.storage.local`
  ever was. CORS is restricted to origins starting with `chrome-extension://`
  (or no-origin requests); any ordinary `http(s)://` page's fetch to
  `localhost:3001` is rejected with a 403 — this specifically blocks a
  malicious web page from reading the profile or triggering generation calls
  via the browser's normal same-machine `localhost` reachability.
- **Privacy decisions:** no analytics, no telemetry, no third-party
  services beyond whichever single LLM provider the user has configured and
  explicitly given a key to. The only outbound network call besides that
  provider is none — the server makes no other external requests. Profile
  data is only ever included in the outbound prompt to that one configured
  provider, never logged to a third party.

---

# Current Limitations

- **Hallucinations:** the no-fabrication system-prompt instruction reduces
  but cannot fully eliminate the risk of a model inventing specifics (dates,
  numbers, names) not present in the profile — this is a prompt-engineering
  mitigation, not a hard guarantee, and per `docs/OUTCOME.md` its real-world
  effectiveness has not been extensively validated across many live
  generations and multiple providers.
- **Context issues:** the entire profile is flattened into one system
  prompt on every single call, with no retrieval/ranking step to surface
  only the most relevant profile sections for a given question — for a
  short question, the model receives the full resume text, all projects,
  and the full writing sample regardless of relevance, which can dilute
  focus on longer profiles.
- **Generic answers:** when the profile has little material relevant to a
  specific question, the system prompt instructs the model to write "a
  genuine but more general answer" and mark it `confidence: "low"` — this is
  handled honestly (surfaced to the user via the confidence badge, and
  specifically excluded from the bulk "Accept high/mid" action) rather than
  hidden, but it means some fraction of answers on niche questions will
  read as generic by design, not by bug.
- **Profile ambiguity:** the profile is one flat, unstructured-per-field
  text blob per section (e.g., `resumeText` is pasted free text, not parsed
  into structured work history) — there's no disambiguation if, say, two
  different projects could both plausibly answer "describe a project," the
  model picks based on its own judgment of the question text, with no
  explicit signal from the user about which context applies to which kind
  of question.
- **Lack of personas:** there is exactly one profile per install, used
  identically for every form regardless of the application's context (a
  hackathon vs. a fellowship vs. a scholarship might warrant different
  emphasis) — there's no concept of multiple profiles, profile "modes," or
  per-application-type tone adjustment beyond the single free-text
  instruction field on regenerate.
- **Extraction/fill selector fragility:** the Google Forms and Luma
  extractors match on ARIA roles and DOM structure that are, per their own
  in-file comments, **not verified against a large sample of real live
  pages** — Google's and Luma's markup can and does drift, and a selector
  strategy that works today may need adjustment later. The generic extractor
  is the most robust of the three (native HTML form semantics only) but
  still depends on reasonably well-labeled markup.
- **No automated tests:** per `AGENTS.md`, there is no automated test suite
  for v1 — verification has so far been a mix of direct HTTP calls, static
  read-throughs, and manual browser checks logged in `docs/OUTCOME.md`, not
  CI-enforced regression tests. A change to `providers.js` or the content
  scripts could silently break a working path with nothing catching it
  automatically.
- **Single active provider, no fallback:** if the configured provider's API
  is down, rate-limited, or the key becomes invalid mid-session, generation
  simply fails with a surfaced error — there's no automatic retry against a
  second configured provider, by design (see `AGENTS.md` rule 5).

---

# Future Roadmap

Only the major, realistic next items — not a full backlog:

1. **Verify Google Forms/Luma extraction against a real, varied sample of
   live pages** and harden selectors accordingly — the single biggest
   correctness risk currently unaddressed.
2. **Structured resume parsing** (rather than pasted free text) to reduce
   profile ambiguity and let the model reason over discrete work/education
   entries instead of one prose blob.
3. **Multiple profiles / profile modes** so answer tone and emphasis can
   shift per application type (hackathon vs. fellowship vs. scholarship)
   without hand-typing a regenerate instruction every time.
4. **Automated test coverage** for the content-script extractors/fillers and
   the server's prompt-construction/parsing logic, so provider or selector
   regressions are caught before manual testing.
5. **Retrieval/ranking over profile sections** so only the most relevant
   parts of a large profile are included per question, instead of the full
   profile on every call.
6. **Optional cross-provider fallback** (explicitly opt-in, per `AGENTS.md`
   rule 5) for when the active provider's API is unavailable mid-session.
7. **PDF resume import** instead of requiring the user to paste resume text
   manually.
8. **Confidence-aware regenerate suggestions** — proactively surface a
   "this answer is low-confidence, want to add more profile detail?" nudge
   rather than requiring the user to notice and act on the badge themselves.
