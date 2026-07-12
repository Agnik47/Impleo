# OUTCOME.md — Build Log

This file is a running, append-only log of what was actually built and
verified, in the order it happened. Every task in `TASKS.md` ends with an
entry here — this is what turns "the agent said it's done" into something
you can actually audit later, including months from now when something
breaks and you need to remember why a decision was made.

Never edit or delete a past entry to make it look cleaner — if something
had to be redone, add a new entry noting the correction, don't rewrite
history.

## Entry template (copy this for each task)

```
### [Phase.Task] — <short title> — <date>

**What was built:**
<1-3 sentences, concrete>

**Verified against:**
<real URL/page/data used, or "N/A — no real-page verification applicable">

**Acceptance criterion met?** Yes / No / Partial — <explain if not a clean yes>

**Deviations from spec:**
<anything that differs from PRD/ARCHITECTURE/STRUCTURE, and why — or "None">

**Known issues / follow-ups:**
<anything left rough, or "None">
```

---

## Log

*(Entries go below, oldest first, as each task in TASKS.md completes.)*

---

### 0 — Phase 0: Clarification & Setup — <date>

**What was built:**
N/A — this phase is answering CLARIFICATION_QUESTIONS.md and collecting
real test URLs, not writing code.

**Verified against:**
N/A

**Acceptance criterion met?**

**Deviations from spec:**

**Known issues / follow-ups:**

---

*(Continue appending entries per TASKS.md as Phases 1-7 complete. The final
entry should be the Phase 7 retrospective, including a "Known Limitations"
section — see PROMPTS.md's Phase 7 prompt for what that entry needs to
cover: e.g. selector fragility risk, any platform quirks discovered during
real-page testing, anything intentionally deferred past v1.)*

---

### Architecture pivot — React + Tailwind + Express + SQLite — 2026-07-12

**What was built:**
The founder overturned the original zero-backend/no-build-step design
mid-Phase-1. Updated `PRD.md`, `AGENTS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`
to document the new architecture: MV3 extension (`extension/`) with a
Vite + React + Tailwind side panel, talking over `fetch()` to a local
Express + SQLite server (`server/`) that now owns the Anthropic API key and
all persistence (profile, qaHistory, settings). Content-script
extract/fill mechanics are unchanged — still plain, self-contained
functions, per the `chrome.scripting.executeScript` serialization
constraint, which is independent of this pivot.

**Verified against:**
N/A — this entry is the pivot decision + doc updates, not code.

**Acceptance criterion met?** N/A (not a TASKS.md item; a founder-directed
architecture change made mid-build).

**Deviations from spec:**
Reverses the original hard rules 2-4 in `AGENTS.md` (no backend, no build
step). Explicitly re-approved by the founder via direct instruction, not
inferred — see the three-question exchange that resolved: (1) React
requires a build step → approved Vite; (2) "Express" implied a backend →
confirmed as a full pivot, not dev tooling; (3) confirmed the extension
itself is kept (not replaced by a plain website), since form
extraction/fill is only possible via extension permissions.

**Known issues / follow-ups:**
None — this is the intended new baseline going forward.

---

### Phase 1 — Core Foundation (scaffold, storage, onboarding UI, key test) — 2026-07-12

**What was built:**
- `server/`: Express app (`src/index.js`), SQLite layer (`src/db.js`,
  tables: `profile`, `settings`, `qa_history`), and four routes —
  `GET/PUT /api/profile`, `GET/PUT /api/settings` (returns `hasApiKey`
  only, never the raw key), `GET/POST /api/qa-history` (capped at 50),
  `POST /api/test-key` (calls `api.anthropic.com` server-side with
  `claude-sonnet-4-6`, `max_tokens: 10`).
- `extension/`: MV3 `manifest.json` (permissions: `activeTab`, `scripting`,
  `sidePanel`; `host_permissions: <all_urls>`), a minimal `background.js`
  (only sets `openPanelOnActionClick`), Vite + `@vitejs/plugin-react` +
  Tailwind build producing `extension/dist/`, and a React side panel
  (`App.jsx` routing between loading/server-error/onboarding/main states,
  `Onboarding.jsx` with every PRD §5.1 profile field + API key field +
  "Test key" button, `lib/api.js` as the sole `fetch()` wrapper talking to
  `server/`).
- Added `server/src/routes/settings.js`, not explicitly named in the
  original `STRUCTURE.md` route list — a small, necessary addition since
  `apiKey` is a separate top-level concern from `profile` in the PRD's data
  model. `STRUCTURE.md` updated to include it.

**Verified against:**
Real local HTTP calls against the running server (not mocked): `PUT/GET
/api/profile` round-tripped a full profile object exactly, including nested
objects and arrays (`skills`, `projects`, `achievements` all preserved
their types). `PUT/GET /api/settings` correctly reported `hasApiKey`
true/false without ever returning the raw key. Appended 56 `qa_history`
entries (1 + 55) and confirmed the table capped at exactly 50, with the
newest entry first and the correct oldest entry retained (off-by-one
verified by hand). `POST /api/test-key` correctly distinguished a missing
key (400, `"No API key provided"`) from an invalid-but-present key (200,
`{ok:false, error:"invalid x-api-key"}` — the real error text from
Anthropic's API). `npm run build` in `extension/` completed cleanly and
produced `extension/dist/{index.html,manifest.json,background.js,assets/}`.

**Acceptance criterion met?** Partial. The server-side half of Phase 1's
exit criterion (profile/apiKey save-and-reload, working key test against
the real Anthropic API) is verified end-to-end via direct HTTP calls. The
extension-side half — loading the unpacked extension in
`chrome://extensions`, confirming onboarding shows on first run, and
confirming zero console errors in the side panel/service-worker — was
**not** verified, because this agent has no browser to drive. This needs a
manual pass: `cd server && npm run dev` (already running in the background
from this session), then in Chrome: Developer mode → Load unpacked →
select `extension/dist` → click the icon on any page → fill the onboarding
form → Save → confirm it switches to the main view → reload the extension
→ confirm it reopens straight to the main view (not onboarding).

**Deviations from spec:**
Test key was verified with a deliberately invalid key only — no real
Anthropic API key was available in this session, so the success path
(`{ok:true}` for a genuinely valid key) is unverified. `anthropic-
dangerous-direct-browser-access` header from the original `PROMPTS.md` 1.5
spec was dropped — it exists only to let Anthropic's API accept direct
calls from a browser context; since `server/` is a Node process, not a
browser, the header doesn't apply and including it would have been dead
code. No icon PNGs exist yet (`extension/icons/` is empty) — `manifest.json`
omits the `icons` key entirely rather than referencing missing files, which
would break Chrome's load. `npm audit` flags a moderate esbuild advisory in
Vite's dev server; irrelevant here since this project only ever runs `vite
build --watch`, never `vite dev`.

**Known issues / follow-ups:**
1. Manual Chrome verification (above) still owed before Phase 1 is
   genuinely done per `AGENTS.md`'s definition of done.
2. Real Anthropic API key needed to verify `test-key`'s success path.
3. Real icon PNGs (16/48/128) not yet added.
4. Seed Q&A onboarding field (PRD §5.1, "optional but strongly encouraged")
   was intentionally left out of `Onboarding.jsx` — not listed in
   `PROMPTS.md` task 1.3's field list, can be added later without touching
   the `profile` schema.
5. Phase 0's blocking clarifications (real Google Form URLs, real Luma URL)
   are still open — required before Phase 2 (extraction) can start per
   `AGENTS.md`'s "real page, not mocked fixture" rule.

---

### Phases 2-6 — Extraction, generation, review UI, fill engine, routing — 2026-07-12

**What was built:**
The founder asked for an end-to-end prototype in one pass rather than
gating on Phase 0's still-open real-page/API-key clarifications, so this
entry covers Phases 2-6 together rather than one OUTCOME.md entry per
phase:

- `server/src/routes/generate.js` — `POST /api/generate-answers` and
  `POST /api/regenerate-answer`. Server reads `profile`/`apiKey`/recent
  `qaHistory` from its own DB (client only sends the form schema) — a
  deliberate deviation from the original pre-pivot design where the client
  passed profile+history to `background.js`, since the server now owns
  that data directly and doesn't need to trust the client for it. System
  prompt embeds the full profile with an explicit no-fabrication
  instruction (AGENTS.md rule 7) as its first substantive line. Model
  corrected to `claude-sonnet-5` (the docs' original `claude-sonnet-4-6`
  placeholder was not a real model id).
- `extension/content-scripts/generic-extractor.js` +
  `generic-filler.js` — label resolution via `label[for]`/wrapping
  label/aria-label/aria-labelledby/preceding-text/placeholder fallback;
  groups radio/checkbox inputs sharing a `name`; native-setter +
  dispatchEvent for text fields; exact-then-substring option matching for
  choice fields; `{id, status: filled|no_match|not_found|error, reason}`
  report shape per `BACKEND_VERIFICATION.md`.
- `extension/content-scripts/google-forms.js` — extract + fill, matching
  on `[role="listitem"]`/`[role="radio"]`/`[role="checkbox"]`/`[role="listbox"]`
  per `ARCHITECTURE.md`'s documented (class-name-independent) strategy.
- `extension/content-scripts/luma.js` — extract + fill, combining native
  form-element handling with ARIA-role custom-component handling
  (`[role="radio"]`, `[role="checkbox"]`, `[role="combobox"]`/`[role="option"]`)
  and the native-setter React-input fix from `ARCHITECTURE.md`'s landmine #1.
- `extension/src/sidepanel/components/ReviewCard.jsx` — one card per
  question: confidence badge, Accept/Edit/Regenerate(+instruction)/Skip,
  upload fields rendered as a non-actionable reminder (per
  `CLARIFICATION_QUESTIONS.md` #7's recommendation).
- `extension/src/sidepanel/ReviewFlow.jsx` — the extract → generate →
  review → fill → history orchestration, hostname-based platform routing
  (`docs.google.com` / `lu.ma` / else generic), loading/error states,
  "N of M approved" counter gating the Fill button. Named `ReviewFlow.jsx`
  rather than the originally-planned `Main.jsx` — Windows' case-insensitive
  filesystem means `Main.jsx` and the existing `main.jsx` entry point are
  the same file; a plan-time naming collision, caught before it overwrote
  the entry point.
- Wired into `App.jsx`'s main-view branch (replacing the earlier placeholder).

**Verified against:**
Static/logical review only (read every new file end-to-end, traced the
call graph, checked exported/imported names and route-path strings match
exactly) — **no execution**, at the founder's explicit direction partway
through this work (they denied two verification Bash calls and asked me to
keep writing code and let them run build/server/browser checks
themselves rather than auto-verifying further this session). This is a
materially weaker verification bar than the rest of this log and should be
read as "compiles by inspection," not "proven to work." One real bug was
still caught this way: `ReviewFlow.jsx`'s render logic had no UI branch for
`phase === 'error'` (extraction/generation failures would show the error
text with no way to retry) — found and fixed during the read-through.

**Acceptance criterion met?** No — none of Phases 2-6's real exit criteria
(extraction against real Google Form/Luma URLs, fill verified visually on
a real page, a full timed run-through) have been met. This entry records
what was *built*, not what was *proven*. See "Known issues" below and the
"How to test manually" handoff for what's actually owed before any of
these phases can be marked done per `AGENTS.md`'s definition of done.

**Deviations from spec:**
- Server owns profile/qaHistory lookup for generation instead of the
  client passing it (see above) — a natural consequence of the earlier
  React/Express pivot, not a new decision.
- `checkbox_single` is treated identically to `radio` (single-select,
  always expected to resolve to one of its options) rather than as an
  optionally-blank boolean toggle — simplification decided during
  generate.js's prompt design; documented here since it's not explicit in
  PRD.md.
- Content-script selector strategies for Google Forms and Luma are
  best-effort per `ARCHITECTURE.md`'s documented approach, not verified
  against any real page (no real URLs were available this session) — this
  is the single biggest risk in this entry.

**Known issues / follow-ups:**
1. **Nothing in Phases 2-6 has been run.** No server restart/build was
   performed after `generate.js` was added (a `node --watch` process from
   the Phase 1 session may or may not have picked it up automatically).
2. Google Forms and Luma selectors are unverified against real pages —
   expect them to need adjustment; see the manual test steps below for how
   to check them and what to look at in DevTools if extraction returns an
   empty or wrong list.
3. No real Anthropic API key has been used against `generate-answers` —
   the no-fabrication instruction's actual effectiveness (BACKEND_VERIFICATION.md
   §3, the highest-value check in that whole document) is completely
   unverified.
4. `ReviewCard.jsx`'s edit mode for `checkbox`/`radio`/`dropdown` always
   renders as a list of native radio/checkbox inputs rather than a
   `<select>` for dropdowns — intentional (more usable in a narrow side
   panel), not a bug, but worth knowing if it looks different than expected.
5. Regenerate-with-instruction (PROMPTS.md 3.4/3.5) is implemented but its
   actual effect on output (does the instruction visibly change the
   answer?) is unverified without a real API key.

---

### Multi-provider LLM router (Anthropic / Gemini / OpenAI / xAI) — 2026-07-12

**What was built:**
Founder-directed change: the extension was hardcoded to Anthropic; it now
supports four providers with a **manual single-select** model (the user
picks one active provider in Settings — no automatic fallback chain was
requested, so none was built).
- New `server/src/providers.js` — flat map of four adapters (Anthropic
  Messages API, Google Gemini generateContent, OpenAI Chat Completions,
  xAI/Grok via the shared OpenAI-compatible helper), each normalized to
  `chat({ apiKey, systemPrompt, userContent, maxTokens }) → text`. Model
  ids and the settings-column mapping (`KEY_COLUMN`) are centralized here.
  `testProviderKey()` reuses `chat()` with a 10-token budget for key
  validation. Kept deliberately flat, not a plugin registry (AGENTS.md).
- `server/src/db.js` — migrated the `settings` table from `(id, api_key)`
  to add `provider` + per-provider key columns (`anthropic_key`,
  `gemini_key`, `openai_key`, `xai_key`) via guarded `ALTER TABLE`, and a
  one-time backfill copying the legacy `api_key` into `anthropic_key` with
  `provider='anthropic'` so existing installs keep working on upgrade.
- `settings.js` — `GET` now returns `{ provider, providers: [{id,label,
  model,hasKey}] }` (still never leaks raw keys); `PUT` saves a key for a
  provider and/or switches the active provider.
- `test-key.js` — now takes `{ provider, apiKey }` and dispatches through
  `testProviderKey`.
- `generate.js` — replaced `getApiKey`/`callClaude` with
  `getActiveProvider()` + `active.provider.chat(...)`. Prompt construction
  and JSON parsing are unchanged (they were always provider-neutral).
  Anthropic-specific error strings ("Claude…") generalized to "The AI…".
- Side panel: `api.js` (`saveSettings(provider, apiKey)`,
  `testApiKey(provider, apiKey)`), `App.jsx` ("configured" = active
  provider has a key), `Onboarding.jsx` (provider `<select>` with
  per-provider "✓ key saved" markers + key hints, replacing the single
  "Anthropic API key" field).

**Verified against:**
Static/logical review only — grepped for stale references to the old
single-key API (`saveApiKey`, `hasApiKey`, `callClaude`, etc.): none
remain. **Not executed** — no server restart, no `extension` rebuild, no
real key of any provider tested, per the founder's standing
"write first, I'll run it" preference this session.

**Acceptance criterion met?** No — code-complete by inspection only. Owed
before this is done: `cd server && npm run dev` (confirm the DB migration
runs without error on the existing `christopher.db`), `cd extension && npm
run build`, reload unpacked, then in Settings pick a provider, paste a key,
"Test key", Save, and run a real generate to confirm the chosen provider
actually answers.

**Deviations from spec:**
Reverses AGENTS.md rule 5's "single-API-key" wording and rule 2's
"Anthropic API key" phrasing — explicitly founder-directed (chose "manual
single pick" + all four providers when asked). The server still owns all
keys and all model calls; content scripts and the side panel still never
call any model API directly, so rules 2's *security* intent is intact.
Default models: `claude-sonnet-5`, `gemini-2.0-flash`, `gpt-4o-mini`,
`grok-2-latest` (all editable in one place at the top of `providers.js`).

**Known issues / follow-ups:**
1. DB migration is unrun against the real `christopher.db` — verify the
   `ALTER TABLE` + backfill on the actual file with its saved Anthropic key.
2. No provider was exercised end-to-end; Gemini's response shape
   (`candidates[0].content.parts[0].text`) in particular is unverified
   against a live call.
3. AGENTS.md rule 5 ("single-API-key") and rule 2 ("Anthropic API key")
   still read as originally written — update them to match this pivot the
   same way the React/Express pivot updated rules 2-4, so a future agent
   doesn't "correct" this back to Anthropic-only.

---

### Model IDs made user-editable + AGENTS.md updated for multi-provider — 2026-07-12

**What was built:**
Follow-up to the multi-provider pivot above, addressing both open items from
its "Known issues" #3 and a founder request that model versions not be
hardcoded (they want to pick any model on a free tier, which changes
independently of the code):
- `providers.js` — `MODELS` renamed to `DEFAULT_MODELS` and is now only a
  placeholder/suggestion. Every `chat()` fn takes `model` as a per-call
  argument (Gemini's URL path included) instead of closing over a constant.
  `testProviderKey()` takes an optional `model`, falling back to
  `DEFAULT_MODELS[providerId]` if none given.
- `db.js` — added `anthropic_model`/`gemini_model`/`openai_model`/`xai_model`
  columns (same guarded-`ALTER TABLE` migration pattern as the key columns).
- `settings.js` — `GET` now returns each provider's saved `model` plus
  `defaultModel` (suggestion only); `PUT` accepts an optional `model` and
  saves it to that provider's column via the new `MODEL_COLUMN` map.
- `test-key.js`, `generate.js` — thread the optional/resolved `model`
  through to `chat()`. `generate.js`'s `getActiveProvider()` now resolves
  `row[MODEL_COLUMN[id]] || DEFAULT_MODELS[id]`.
- `Onboarding.jsx` — added a plain-text "Model name" input under the
  provider dropdown, pre-filled from that provider's saved model or default
  suggestion, editable to anything; switching providers reloads the field
  from that provider's own saved/default model rather than carrying over the
  previous provider's string. Dropdown option labels no longer show a model
  name (since it's no longer a fixed fact about the provider).
- `AGENTS.md` — added a "Multi-provider pivot" section (mirroring how the
  earlier React/Express pivot documented itself), and rewrote rules 2, 5,
  and 7 plus the error-surfacing convention line to be provider-agnostic
  instead of Anthropic-specific. Project structure tree now lists
  `providers.js` and `settings.js`, which existed in code but weren't in the
  documented tree.

**Verified against:**
Static/logical review only — grepped for any remaining hardcoded model
string outside `DEFAULT_MODELS` (none found) and for stale references to
the pre-migration settings shape (none found). **Not executed.**

**Acceptance criterion met?** No — same as the multi-provider entry above,
this is code-complete by inspection only. Still owed: run the server so the
new `_model` columns actually get added to the real `christopher.db`, then
in Settings confirm a typed-in free-tier model (e.g. whatever Gemini's
current free-tier model id actually is — check ai.google.dev, don't trust
`DEFAULT_MODELS.gemini` blindly since it will drift) round-trips through
Test key / Save / a real generate call.

**Deviations from spec:**
None beyond what's already logged in the multi-provider entry above — this
is that same feature, made non-brittle to model-version churn per explicit
founder request, not a new architectural decision.

**Known issues / follow-ups:**
1. Still unexecuted — same manual verification steps as the previous entry,
   now also confirming the model field actually flows through to the
   outgoing request for at least one provider.
2. `DEFAULT_MODELS` values will go stale over time by design (that's the
   point — they're a starting suggestion, not a contract). Worth a periodic
   glance if onboarding's placeholder ever looks wrong for a new install.

---

### Bug fix — wrong "4th provider": xAI/Grok replaced with Groq — 2026-07-12

**What was built:**
The founder reported the extension key input "not working" and pointed at
`test/.env` + `test/groq_test.py`/`test_gemini.py`/`test_models.py`/
`test_bot.py`, which prove a **Groq** key (`GROQ_API_KEY`, `gsk_...` format,
Groq Cloud's `api.groq.com`) and a Gemini key both work fine outside the
extension. Root cause: the multi-provider work built the 4th provider as
**xAI's "Grok"** (`api.x.ai`) — a same-sounding but completely unrelated
service. Pasting a Groq key into that slot hit the wrong host and failed.
This was this agent's misreading of the founder's original "Gork Api Keys"
phrasing as xAI/Grok instead of Groq.
- `providers.js` — `DEFAULT_MODELS.xai`/the `xai` `PROVIDERS` entry replaced
  with `groq` (`https://api.groq.com/openai/v1/chat/completions`, same
  OpenAI-compatible wire format helper, default model
  `llama-3.3-70b-versatile` — confirmed working via `test/groq_test.py`'s
  actual output). **Also caught and fixed in the same pass:** `KEY_COLUMN`
  and `MODEL_COLUMN` still had leftover `xai: 'xai_key'`/`xai: 'xai_model'`
  entries after the `PROVIDERS` map itself was updated — these are keyed by
  provider id, so with `PROVIDER_IDS` now `[...,'groq']` instead of
  `[...,'xai']`, the old entries were simply dead and `KEY_COLUMN.groq`/
  `MODEL_COLUMN.groq` were `undefined`, which would have produced broken SQL
  (`UPDATE settings SET undefined = ?`) the moment anyone tried to save a
  Groq key. Caught by grep during this fix, not by execution.
- `db.js` — `settings` table's `xai_key`/`xai_model` columns replaced with
  `groq_key`/`groq_model` in both the `CREATE TABLE` and the guarded
  `ALTER TABLE` migration loop. Checked the real `server/data/christopher.db`
  directly: it already has `xai_key`/`xai_model` columns from the earlier
  (never-completed) server run, but the `settings` row itself doesn't exist
  yet (`SELECT * WHERE id=1` returned nothing) — so there was no saved xAI
  key to migrate. Old `xai_*` columns are left in place as harmless dead
  columns on any install that already ran the earlier migration; nothing in
  the app reads/writes them anymore.
- `Onboarding.jsx` — `KEY_HINTS.xai` replaced with `KEY_HINTS.groq: 'gsk_...'`.
- `AGENTS.md` — added a same-day correction note under the "Multi-provider
  pivot" section naming the Groq/Grok mixup explicitly, so a future agent
  that sees "Grok" in a request checks which service is actually meant.
  (Per this project's OUTCOME.md convention, the original multi-provider
  entry above was **not** edited to hide the mistake — this is a new entry.)

**Verified against:**
- Ran `test/groq_test.py` for real: confirmed the Groq key + `llama-3.3-70b-
  versatile` model works (`Response: Groq is working`) and confirmed via
  `Groq(api_key=...).base_url` that the SDK's real endpoint is
  `https://api.groq.com` — matches what `providers.js` now calls.
- Ran a one-off Gemini `models.list()` + `generate_content` check: confirmed
  `gemini-2.0-flash` (the extension's existing, unchanged Gemini default) is
  in the account's available-models list, and separately confirmed (via the
  founder's own `test_models.py`/`test_gemini.py` runs) that
  `gemini-2.5-flash`/`gemini-2.5-flash-lite` 404 for this account
  ("no longer available to new users") despite being listed — an
  account-side restriction, unrelated to this bug, not something to fix in
  code since the model field is already user-editable.
- Directly queried `server/data/christopher.db`'s real schema and row data
  (read-only) rather than assuming — this is what surfaced that the
  `settings` row doesn't exist yet, confirming no xAI-key data would be lost.
- Did **not** run the Node server or rebuild the extension — the Groq fix
  itself is still unexecuted end-to-end, consistent with this project's
  "write first, founder runs it" workflow.

**Acceptance criterion met?** Partial. The misconfigured-provider bug is
fixed and the code no longer has any path that sends a Groq key to
`api.x.ai`. Not yet verified: an actual `POST /api/test-key` call with the
founder's real Groq key through the running server + rebuilt extension.

**Deviations from spec:**
None — this restores the founder's original intent (Groq, not xAI/Grok),
which was always the goal; the prior entry's "xAI (Grok)" was the deviation,
introduced by mishearing, not a considered design choice.

**Known issues / follow-ups:**
1. Still owed: `cd server && npm run dev` (adds `groq_key`/`groq_model`
   columns to the real db), `cd extension && npm run build`, reload
   unpacked, Settings → Groq → paste the real `GROQ_API_KEY` → Test key →
   Save → run a real generate-answers call.
2. This bug (a provider silently pointed at the wrong host) had no
   test-key-time signal distinguishing "wrong host" from "bad key" beyond
   whatever error text the wrong host happened to return — worth keeping in
   mind if a future provider mixup happens again: the error message a user
   sees may not obviously say "you have the wrong service," just a generic
   auth/network failure.
