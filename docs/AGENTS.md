# AGENTS.md — Instructions for AI coding agents working on Impleo

This file is read automatically by Claude Code and similar agents. Follow it
literally. When in doubt, prefer the simpler option — this is a 2-day personal
tool, not a product being handed to a team.

## What this project is

A Chrome Extension (Manifest V3) that helps one person (and a small group of
~10-50 people using their own copies) auto-fill event/hackathon/fellowship
application forms using AI-generated, personalized answers, with a mandatory
human review step before anything touches the page. Read `PRD.md` and
`ARCHITECTURE.md` before writing any code — they define scope boundaries this
file assumes you already know.

## Architecture pivot — 2026-07-12

The original v1 spec below (rules 2-4 as first written) specified a
zero-backend, zero-build-step, `chrome.storage.local`-only design. That was
deliberately overturned by the founder: the project now ships as an MV3
extension **plus** a local Express + SQLite backend, with a Vite + React +
Tailwind side panel. Content-script mechanics (self-contained
extract/fill functions, injected via `chrome.scripting.executeScript`) are
**unchanged** — that constraint is a real MV3 serialization limit, not a
style choice, and survives the pivot. Rules 2-4 below reflect the new,
current architecture. Do not revert to the old chrome.storage.local/no-build
design without the founder explicitly asking again.

## Multi-provider pivot — 2026-07-12

Originally Anthropic-only. The founder asked for a provider-agnostic
"multi-model LLM router": the user picks **one active provider** (Anthropic,
Google Gemini, OpenAI, or Groq) in Settings — no auto-fallback chain across
providers was requested, so there isn't one. All four are normalized behind
`server/src/providers.js`'s `chat()` shape; `server/src/routes/generate.js`
and `test-key.js` dispatch to whichever provider is active by reading it from
`settings`, never hardcoded. Rule 2 and rule 5's wording below is updated to
match — "the Anthropic API key" now means "whichever provider's key the user
has configured," and every mention of Claude/Anthropic elsewhere in this
file (system prompt construction, error surfacing) applies identically to
Gemini/OpenAI/Groq. Model IDs are **not** hardcoded either — each provider
has a suggested-default model shown as a placeholder, but the user can type
any model string their account/free-tier has access to; it's saved
per-provider in `settings` and read at call time, not baked into code.
Do not re-narrow this back to Anthropic-only or to a single fixed model per
provider without the founder explicitly asking again.

**Correction — 2026-07-12 (same day):** the fourth provider was first built
as **xAI's "Grok"** (`api.x.ai`), a mistake — the founder's actual test files
(`test/.env`, `test/groq_test.py`) use a **Groq** (`api.groq.com`) key,
Groq Cloud's fast inference of open models (Llama, etc.). Groq and Grok are
unrelated services despite the similar name; the "xAI" provider was replaced
with "Groq" everywhere (`providers.js`, `settings` columns, Onboarding UI).
If a future request mentions "Grok"/xAI specifically, confirm which service
is actually meant before implementing — this exact confusion has happened
once already.

## Hard rules — do not violate these even if it seems like an improvement

1. **Never auto-submit a form.** No code path may click a submit button, call
   `form.submit()`, or programmatically navigate past a review step. If a task
   seems to require this, stop and ask instead of implementing it.
2. **Never call any LLM provider's API from a content script or directly
   from the side panel.** All model calls go through `server/` (the local
   Express backend), which owns every provider's API key
   (`server/src/providers.js` + the per-provider columns in `settings`). The
   side panel calls the server over HTTP (`localhost`); content scripts only
   extract/fill DOM, they never fetch external URLs. Page-CSP restrictions on
   content scripts still apply — that part of the original reasoning is
   unchanged. This rule is provider-agnostic: it applies to Anthropic,
   Gemini, OpenAI, and Groq identically, not just whichever one is currently
   active.
3. **Persistence lives in the local Express server's SQLite database**
   (`server/`), not `chrome.storage.local`. The server is the only thing
   that touches the database. Do not introduce a hosted service (Firebase,
   Supabase, hosted Postgres, etc.) — the server runs on `localhost`, one
   instance per person, same "your own copy, your own key" model as before,
   just with a real local DB instead of extension storage.
4. **Build step is scoped, not open-ended.** Vite + React + Tailwind is
   approved for the extension's side panel (`extension/src/sidepanel/`) and
   plain Node/Express for `server/` — no bundler needed there. Content
   scripts (`extension/content-scripts/*.js`) stay plain, self-contained ES
   module exports with no JSX/framework, because
   `chrome.scripting.executeScript({ func })` serializes them via
   `toString()` and re-parses them in the page's isolated world — a compiled
   framework component cannot survive that. Don't add a bundler to `server/`
   or introduce TypeScript anywhere without asking first.
5. **Do not add multi-user, auth, billing, or team features.** Each install
   is single-profile, single local server, no shared/hosted backend. Since
   the multi-provider pivot, "single-API-key" means single **active**
   provider+key at a time (the user can have keys saved for more than one
   provider, but only one is in use for any given call) — not a return to
   exactly one key ever. Do not build account systems even as "scaffolding
   for later," and do not build an automatic cross-provider fallback/retry
   chain unless the founder explicitly asks for one.
6. **Do not remove or weaken support for radios, checkboxes, dropdowns, or
   Luma** to save time. These are mandatory per the PRD. If time is short,
   cut generic HTML form support first (see PRD §6), not these.
7. **Do not fabricate profile data.** Prompts sent to the active model
   (whichever provider is configured) must instruct it to only use facts
   present in the stored profile — no inventing companies, metrics, or
   achievements. This is a prompt-engineering requirement, verify it's
   actually in `server/`'s system prompt construction, don't just assume it.
   `buildSystemPrompt()` in `generate.js` is provider-neutral by design — it
   must stay that way regardless of which provider is active.

## Project structure (do not reorganize without a reason)

```
extension/
  manifest.json           MV3 manifest
  background.js           Service worker — minimal (side panel open behavior only;
                           no longer owns the API key, see pivot note above)
  content-scripts/
    google-forms.js         export extractGoogleForm(), fillGoogleForm(answers)
    luma.js                 export extractLumaForm(), fillLumaForm(answers)
    generic-extractor.js    export extractGenericForm()
    generic-filler.js       export fillGenericForm(approvedAnswers)
  src/sidepanel/
    index.html               Vite entry HTML
    main.jsx                 React root mount
    App.jsx                  View routing (onboarding vs main/review)
    components/               Onboarding, ReviewCard, etc.
    index.css                 Tailwind entry
  icons/
  vite.config.js
  package.json
server/
  src/
    index.js                 Express app entry
    db.js                     SQLite connection + schema init
    providers.js               Provider adapters (Anthropic/Gemini/OpenAI/Groq),
                                normalized chat() shape, no hardcoded models
    routes/
      profile.js               GET/PUT profile
      qa-history.js             GET/POST qaHistory (capped at 50)
      settings.js               GET/PUT settings (active provider, per-provider
                                 key + model; never returns raw keys)
      generate.js               POST generate-answers, POST regenerate-answer
      test-key.js               POST test-api-key (provider-aware)
  package.json
docs/                    PRD.md, ARCHITECTURE.md, this folder
```

Content-script functions are imported into the sidepanel React code and
invoked via `chrome.scripting.executeScript({ func, args })` — NOT
registered as persistent content scripts in the manifest, and NOT
self-invoking files. Every extractor/filler function must be fully
self-contained (no closures over outer variables) because MV3 serializes the
function body via `toString()` to run it in the page's isolated world. If
you add a helper function that an extractor needs, define it *inside* the
exported function, not as a separate top-level function. This constraint
applies regardless of the React pivot — it's about `chrome.scripting`
serialization, not about the framework used elsewhere.

## Coding conventions

- Side panel: React + JSX, functional components + hooks, Tailwind for
  styling (no CSS-in-JS, no styled-components). Server: plain Node/Express,
  no TypeScript.
- Content scripts (`extension/content-scripts/*.js`): vanilla JS, ES module
  exports, no JSX, no framework — see serialization constraint above.
- Prefer `async/await` over `.then()` chains, both sides.
- The side panel talks to the server via `fetch()` against
  `http://localhost:<port>` — never via `chrome.runtime.sendMessage` for
  API/data calls now that there's no privileged background owner of the key.
  `chrome.runtime.sendMessage` is still fine for internal extension
  messaging (e.g. side panel ↔ content script orchestration), just not for
  reaching the server.
- Errors from the server, the active LLM provider's API (Anthropic, Gemini,
  OpenAI, or Groq), or DOM extraction must surface to the user in the side
  panel UI as visible text, never just `console.error` and silence.
- Don't add abstraction layers "for future flexibility" — e.g. no plugin
  system for extractors, no generic `FormAdapter` interface. Three
  if/else-style extractor modules, chosen by `location.hostname`, is correct
  for this scope. If you're tempted to add a factory pattern or strategy
  interface, don't.
- Comments should explain *why*, not restate the code, especially around the
  React-controlled-input fix (still needed for filling Luma's page DOM,
  unrelated to the side panel's own use of React) — a future reader could
  otherwise confuse "React fix for filling a page" with "the side panel is
  built in React."

## Definition of done for any task

A task in `TASKS.md` is not done until:
1. It works against a **real** page (a real Google Form URL, a real Luma
   event, not a locally mocked HTML fixture) — selectors on real sites drift
   and mocked fixtures hide that.
2. Loading the unpacked extension in `chrome://extensions` with "Developer
   mode" shows no console errors in the service worker or side panel context,
   with the local `server/` running.
3. The review-before-fill step cannot be bypassed.
4. If the task touches the server's prompt construction, the output was
   actually inspected for hallucinated facts, not just "the JSON parsed."

## How to test manually (no automated test suite for v1 — not worth it at this scope)

1. Start the local server: `cd server && npm run dev`.
2. Build/watch the extension: `cd extension && npm run dev` (or `npm run build`
   for a one-off build), then `chrome://extensions` → enable Developer mode →
   Load unpacked → select `extension/dist`.
3. Click the extension icon on a real form page to open the side panel.
4. Check both the side panel's DevTools console (right-click panel → Inspect),
   the service worker's console (`chrome://extensions` → "service worker"
   link), and the `server/` terminal output for errors.

## What "ask before doing" means here

If a task description is ambiguous, or you're about to add a dependency, a
build step, a new top-level abstraction, or touch the "never auto-submit"
rule in any way — stop and ask rather than guessing. Everything else in
`BUILD_PLAN.md` is specified precisely enough to just implement.
