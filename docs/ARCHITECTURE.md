# ARCHITECTURE.md — Christopher

## Guiding principle

Boring architecture, on purpose. Every choice below optimizes for "an AI
coding agent can implement this correctly in a few hours" over "this scales
gracefully." Re-read `PRD.md` §3 (non-goals) before proposing any change here.

## Architecture pivot — 2026-07-12

The system below was originally zero-backend (`chrome.storage.local` only,
background.js calling Anthropic directly). The founder explicitly overturned
that: the side panel is now a React + Tailwind app (built with Vite), and a
local Express + SQLite server (`server/`) owns the Anthropic API key and all
persistence. The extraction/fill mechanics (content scripts injected
on-demand via `chrome.scripting.executeScript`) are unchanged — see "Why
extractor/filler functions must be self-contained" below, that constraint is
independent of this pivot.

## System diagram (textual)

```
┌──────────────────────────┐
│  Side Panel (React + Tailwind)│  extension/src/sidepanel/*
│  - onboarding form              │
│  - review cards                  │
└─────────┬─────────────────┬──────┘
          │                 │ fetch('http://localhost:<port>/api/...')
          │ chrome.scripting│
          │ .executeScript  ▼
          │        ┌──────────────────────────┐
          │        │  server/ (local Express)   │  - owns Anthropic API key (SQLite,
          │        │  + SQLite DB                 │    entered once via onboarding)
          │        │                               │  - owns profile + qaHistory persistence
          │        │                               │  - single structured-output call to Claude
          │        └─────────┬─────────────────────┘
          │                  │ fetch()
          │                  ▼
          │           api.anthropic.com/v1/messages
          ▼
┌──────────────────────────┐
│  Content script (injected   │  extension/content-scripts/*.js
│  on demand, not persistent) │  - extractGoogleForm / extractLumaForm / extractGenericForm
│  reads/writes page DOM      │  - fillGoogleForm / fillLumaForm / fillGenericForm
└──────────────────────────┘
```

All persistent state (profile, qaHistory, apiKey) lives in the local
server's SQLite database, accessed only through `server/src/db.js`. Nothing
is synced to a hosted service, nothing leaves the machine except the single
Claude API call from `server/`, which includes profile + form schema +
recent history as context. The extension itself holds no secrets — the side
panel is just a UI that calls its own local server.

## Why the side panel is React now, and why that doesn't touch content scripts

The review UI (per-question cards with Accept/Edit/Regenerate/Skip, running
approval counts, loading/error states) is exactly the kind of
state-heavy, list-of-interactive-cards UI React is good at, and the founder
opted to build it that way rather than hand-rolled DOM manipulation. This
only affects `extension/src/sidepanel/` — content scripts are still plain,
self-contained functions (see below), because they're serialized via
`toString()` and re-parsed inside the target page, which a compiled/JSX
component cannot survive.

## Why the server owns the API key and persistence now

Moving the key and profile/qaHistory data out of `chrome.storage.local` and
into a local Express + SQLite server was a deliberate founder decision, not
a technical necessity of adding React (React would have worked fine against
`chrome.storage.local` too). The tradeoff being accepted: an extra process to
run locally (`server/`), in exchange for a real relational store and a
normal HTTP API shape for the side panel to call. It stays local-only,
single-instance, single-user — see `AGENTS.md` rule 5 — so this is not a
hosted multi-tenant backend, just persistence + the API call moved one
process over.

## Why side panel triggers extraction (not a persistent content script)

A content script injected on every page load would need broad
`content_scripts` matches in the manifest and would run (uselessly) on every
tab the user has open. Instead, `sidepanel.js` calls
`chrome.scripting.executeScript` on-demand, only on the active tab, only when
the user clicks "Extract." Cheaper permissions story, simpler mental model,
zero background CPU cost.

## Why extractor/filler functions must be self-contained

`chrome.scripting.executeScript({ func, args })` works by serializing `func`
via `Function.prototype.toString()` and re-parsing it inside the target
page's isolated world. It does **not** carry over closures, imported
variables, or anything outside the function body. This is why every
extractor/filler is written as one self-contained exported function with any
helpers defined inside it — see `google-forms.js` for the pattern.

## Why one combined classify+generate call instead of two passes

A separate "classify this question" step adds latency and a second failure
surface for zero quality gain — the generation prompt already needs to know
the field type (to know whether to write a paragraph or pick from `options`),
so it might as well receive the raw extracted schema directly and return
both the reasoning and the answer in one structured JSON response.

## Why no scraping of LinkedIn/GitHub/portfolio

LinkedIn requires auth and aggressively blocks scraping; GitHub's public API
returns repo metadata, not narrative context, so it's low value; portfolio
sites have arbitrary structure. The URLs are stored as plain reference
strings (included in generated answers when relevant, e.g. "see my project at
X") — the actual substance comes from what the person types into onboarding
once. This trades "understands your GitHub automatically" for "takes 15
minutes to fill out once, then just works," which is the correct trade for a
2-day personal tool.

## Why PDF parsing is deferred (paste resume text instead)

Client-side PDF parsing (pdf.js) is a real time cost (bundling, worker setup,
extraction quality varies by PDF structure) for a feature that "paste your
resume as text" replaces at zero engineering cost. Add PDF upload only if,
after using the tool for a week, pasting text is actually the annoying part
— don't build it speculatively.

## The two technical landmines, solved up front

### 1. React-controlled inputs (Luma, and likely other modern sites)
Setting `element.value = x` doesn't update state on inputs controlled by
React, because React overrides the native `value` property with its own
getter/setter that its virtual DOM diffing relies on — a plain assignment
bypasses that and React's internal state never learns the value changed.
Fix: grab the native setter off the prototype and call it directly, then
dispatch synthetic `input`/`change` events so React's listeners fire:

```js
function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```
For Luma's custom-styled radio/dropdown components (not native `<select>`),
the filler should locate and `.click()` the visible option element rather
than trying to set a value programmatically.

### 2. CSP blocking direct API calls from content scripts
Google/Luma's Content-Security-Policy headers can block `fetch()` calls to
`api.anthropic.com` if made from a content script's execution context on
their page. Fix: content scripts never call any API — they only return
extracted data to the side panel, which calls `server/` (a local Express
process, unaffected by page CSPs since it's not running inside any page's
context at all), which in turn calls Anthropic.

## Google Forms specifics

Google Forms has no stable class names (`.freebirdFormviewerComponentsQuestionBaseTitle`-style
names change periodically) — the extractor must match on `[role="listitem"]`
and `[role="radio"]`/`[role="checkbox"]` ARIA roles plus visible label text,
not hardcoded class selectors. Verify selectors against 2-3 *real* forms the
person has actually applied through, not one synthetic example.

## Data flow for a single "extract → review → fill" cycle

1. User clicks Extract → the side panel calls
   `chrome.scripting.executeScript({ func: extractXForm })` on the active tab.
2. Result (form schema array) is held in the side panel's React state.
3. Side panel calls `POST /api/generate-answers` on `server/` with
   `{ formSchema, profile, qaHistory }` (profile/qaHistory are fetched from
   `server/` at side panel load, not held client-side as the source of truth).
4. `server/` calls Claude once, parses the structured JSON response,
   returns it.
5. Side panel renders one review card per question with the generated
   answer + confidence.
6. User accepts/edits/regenerates/skips each card. Approved answers accumulate
   in the side panel's React state.
7. User clicks "Fill" → side panel calls
   `chrome.scripting.executeScript({ func: fillXForm, args: [approvedAnswers] })`.
8. Filler returns a per-field report, rendered in the UI.
9. Side panel calls `POST /api/qa-history` on `server/` to append the
   approved Q&A pairs (server enforces the 50-entry cap).
