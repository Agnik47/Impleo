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

---

### "Accept all high/mid" bulk-approve button — 2026-07-13

**What was built:**
Founder reported having to accept every field one-by-one is tedious.
Added a one-click bulk-approve to `extension/src/sidepanel/ReviewFlow.jsx`:
a `handleAcceptAll()` function that walks `formSchema` and flips any field
still in `status: 'pending'` with `confidence: 'high'` or `'medium'`
(the existing per-field confidence badge already computed in
`generateAnswers`/`ReviewCard.jsx`) to `status: 'accepted'`, leaving
already-edited/skipped fields and low-confidence fields untouched so they
still require individual review. Wired to a new button, "Accept all
high/mid (N)", placed next to "Start over" in the reviewing-phase header
bar; N is a live count (`acceptAllCount`) of eligible pending fields, and
the button disables at N=0 or while `phase === 'filling'`. No new
component, no change to `ReviewCard.jsx`, no server/API changes — purely
client-side state logic reusing the existing `updateReview`-style pattern
(implemented inline via `setReviewState` instead of calling `updateReview`
in a loop, to batch all updates into a single state transition).

**Verified against:**
Static/logical review only — no build/browser run this session, per the
founder's standing "write first, I'll run it" preference
([[feedback_verification_handoff]]). Not yet confirmed against a running
extension.

**Acceptance criterion met?** No — code-complete by inspection only. Owed:
`cd extension && npm run build`, reload unpacked, run a real
extract-and-generate pass on a form with a mix of confidence levels, click
"Accept all high/mid", and confirm only high/medium-confidence pending
fields flip to accepted (green border) while low-confidence and
already-touched fields are unaffected.

**Deviations from spec:**
None — additive UI feature, doesn't touch any hard rule (still requires
the review step before fill; "accept all" only marks fields as approved,
it does not fill or submit anything itself).

**Known issues / follow-ups:**
1. Unexecuted — same manual verification gap as recent entries above.
2. "High/mid" threshold is hardcoded to the two confidence labels; if the
   confidence taxonomy ever changes (e.g. a numeric score instead of
   high/medium/low strings) this logic needs updating alongside
   `ReviewCard.jsx`'s `confidenceStyles` map, which is the other place that
   assumes exactly these three string values.

---

### Impleo rebrand — dark theme redesign + extension icon — 2026-07-13

**What was built:**
Founder pointed at `docs/Impleo_Brand_Guide.md` (new file, not previously
referenced in AGENTS.md/PRD.md) and `extension/icons/iconImg.png` (a
1024x1024 RGBA source image, not previously wired into the build) and asked
for a full redesign plus icon/name change. Followed the `frontend-design`
skill's Step 0 (extend existing system) since the brand guide already fully
specifies tokens — no new design language was invented.
- `extension/icons/`: generated `icon-16.png`, `icon-32.png`, `icon-48.png`,
  `icon-128.png` from `iconImg.png` via Python PIL (Lanczos resample) — no
  new npm dependency added for this (no `sharp`/image lib in `package.json`).
- `manifest.json`: `name` changed `"Christopher"` → `"Impleo"`, added
  `icons` and `action.default_icon`/`default_title` (previously `action: {}`
  had no icon at all — Chrome was showing a generic puzzle-piece icon).
- `vite.config.js`: added the four icon files to the existing
  `vite-plugin-static-copy` targets (`dest: 'icons'`) — they weren't copied
  to `dist/` before this change.
- `index.html`: title → "Impleo", added a favicon `<link>` for the side
  panel's own tab/DevTools context.
- `tailwind.config.js`: replaced the empty `theme.extend` with the brand
  guide's tokens verbatim — `brand`/`brand-hover` (primary/secondary green),
  `jungle`, `lime`, `signature`, `cream`, a `surface.*` dark-theme palette
  (bg/sidebar/card/card-hover/border) and `ink.*` text colors (all exact
  hex values from the guide), `fontSize` scale matching the guide's
  18/14/13/12/11px named sizes (`title`/`card`/`body`/`meta`/`caption`),
  `borderRadius.card|btn|input` (12/10/10px), `boxShadow.soft`/`soft-sm`,
  and a `fontFamily.sans` stack starting `Geist, Inter, ...system fallbacks`
  — Geist/Inter aren't bundled as font files (would've meant adding a new
  dependency, which `AGENTS.md` says to ask about first), so on a machine
  without those fonts installed the stack silently falls through to the
  system-ui fallbacks; visually close but not pixel-identical to real Geist.
  `darkMode: 'class'` added but unused — the guide doesn't describe a light
  theme or a toggle, so the whole side panel is unconditionally dark rather
  than switchable.
- `index.css`: dark app shell (`bg-surface-bg`, `font-sans`, `text-body`),
  fixed `width: 380px` (a reasonable Chrome side-panel width, not specified
  by the guide), custom scrollbar styling.
- `App.jsx`, `ReviewFlow.jsx`, `components/ReviewCard.jsx`,
  `components/Onboarding.jsx`: full visual pass onto the new tokens —
  card/border/radius/shadow system, brand-green primary buttons with dark
  (`text-jungle`) text for contrast against the bright green, confidence
  badges recolored (high=brand green, medium=signature yellow, low=red —
  red isn't in the guide's palette, kept as the only sensible semantic
  danger color since the guide doesn't define one), status border colors
  (accepted=brand green, edited=lime, per the guide's stated usage for
  those two colors), header now shows the `icon-32.png` mascot next to the
  "Impleo" title. All logic (accept/edit/skip/regenerate/accept-all/fill,
  provider settings, profile fields) is unchanged — this was styling only.

**Verified against:**
`cd extension && npm run build` — ran for real this time (not skipped per
the usual "write first, founder runs it" preference, since a build-only
check doesn't touch app behavior/data): completed cleanly, 39 modules
transformed, and confirmed by listing `dist/` that all 4 icon sizes,
`manifest.json`, and `background.js` land in the right place
(`dist/icons/icon-{16,32,48,128}.png` alongside `index.html`). Grepped the
whole `extension/` tree for the string "Christopher" post-rename: no hits
left. **Not verified**: loading the unpacked extension in
`chrome://extensions` to visually confirm colors/contrast/icon rendering,
or that Geist/Inter's fallback stack actually looks acceptable on the
founder's machine.

**Acceptance criterion met?** Partial. Build-verified (compiles, files land
correctly), not visually verified in a real browser.

**Deviations from spec:**
- Whole-app dark theme instead of a light/dark toggle — the guide only
  specifies one "Dark Theme" section and no light-mode tokens, so this
  reads as the intended single theme, not a partial implementation.
- Package name in `extension/package.json` (`"christopher-extension"`) was
  left unchanged — that's an internal npm package identifier, not
  user-visible branding (Chrome shows `manifest.json`'s `name`, which was
  changed), so renaming it seemed out of scope for a branding request.
- Geist font not actually bundled (see above) — approximated via fallback
  stack rather than adding a font-loading dependency without asking first.

**Known issues / follow-ups:**
1. Owed: `chrome://extensions` → reload unpacked from `extension/dist` →
   visually confirm the icon renders correctly at toolbar size, the side
   panel's dark theme has no unreadable text/contrast issues, and the
   native `<select>` dropdown's option-list styling (which CSS can't fully
   theme cross-platform) doesn't look jarring against the dark surrounding
   UI.
2. If the founder wants pixel-accurate Geist rendering, bundling the actual
   font files (or a `@fontsource/geist` dependency) is a follow-up ask, not
   done here.
3. `iconImg.png` (the original 1024x1024 source, ~1MB) is left in
   `extension/icons/` alongside the four generated sizes — harmless (not
   referenced by the manifest or shipped-relevant paths outside `dist/`,
   which vite only copies the 4 named sizes from), but worth deleting if
   repo size becomes a concern.

---

### Responsiveness pass — fluid layout for 320-500px panel widths — 2026-07-13

**What was built:**
Founder filed a 9-point responsiveness spec (horizontal overflow, fixed
widths, action-button overflow, long-text handling, card layout at
320-500px, toolbar crowding, target width 400-440px, mobile-first
philosophy, performance). Addressed each:
- `index.css`: dropped the hardcoded `width: 380px` on `body` — replaced
  with `width: 100%; min-width: 320px; max-width: 500px;` plus
  `overflow-wrap: break-word` and `#root { min-width: 0 }` (needed because
  a flex/grid descendant chain without `min-width: 0` at each level ignores
  `max-width` on an ancestor and overflows instead of wrapping).
- `App.jsx`, `ReviewFlow.jsx`, `Onboarding.jsx`: each top-level view now
  wraps its content in `mx-auto w-full max-w-[500px]`, so the layout is
  fluid at any panel width up to 500px rather than assuming full desktop
  width. `Header` wraps (`flex-wrap`) and truncates the title instead of
  overflowing if "Settings" + "Impleo" can't fit on one line.
- `components/Onboarding.jsx`: the 2-column personal-info grid now starts
  at `grid-cols-1` and only switches to `grid-cols-2` at
  `min-[380px]:` (an arbitrary-value Tailwind media variant, confirmed in
  the compiled CSS to emit a real `@media (min-width:380px)` rule — no new
  dependency, no custom `tailwind.config.js` breakpoint needed for a single
  one-off use). Added `min-w-0`/`break-words` to section labels, hints, the
  "Test key" status message, and the save-error banner, all of which could
  previously force horizontal overflow with a long enough string (e.g. a
  verbose provider error message).
- `components/ReviewCard.jsx` — the most crowded surface, rewritten:
  - Action row (`Accept | Edit | Regenerate | Skip`) split into a primary
    row (`Accept`, `Edit`/`Save`, `Skip`) with small inline-SVG icons (no
    icon library dependency) plus short labels, and a secondary row
    (`Regenerate` + the instruction input) collapsed behind a "more actions"
    toggle button (kebab icon) — this is an always-collapsed-by-default
    disclosure rather than a JS/`ResizeObserver`-driven "only collapse when
    actually constrained" version; simpler, no measurement code, and stays
    compact at every width in the 320-500px range rather than only below a
    guessed breakpoint. Both rows use `flex-wrap`.
  - Long AI-generated answers: `line-clamp-4` (Tailwind's built-in
    utility, confirmed compiled without needing the `@tailwindcss/
    line-clamp` plugin — v3.4's core already includes it) plus a
    "Show more"/"Show less" toggle, gated on answer length
    (`ANSWER_CLAMP_THRESHOLD = 220` chars) rather than always clamping.
  - `min-w-0`/`break-words`/`whitespace-pre-wrap` added throughout
    (question text, answer text, choice-option labels, fill-result text) so
    a single long unbroken token (URL, etc.) wraps instead of forcing the
    card wider than its container.
  - Wrapped the component in `React.memo`.
- `ReviewFlow.jsx` — for `React.memo` on `ReviewCard` to actually skip
  re-renders (previously every card got a freshly-allocated
  `() => updateReview(...)` arrow function as a prop on every
  `ReviewFlow` render, which defeats memoization regardless of the child
  being memoized), refactored `onAccept`/`onEdit`/`onSkip`/`onRegenerate`
  from per-card inline closures into stable `useCallback`-wrapped
  functions taking an explicit `id` (or `question`) argument, passed
  directly as props instead of wrapped again per-card. `updateReview`
  itself is a `useCallback` using the functional `setState` form so it
  never changes identity. `approvedCount`/`actionableCount`/
  `acceptAllCount` moved into `useMemo`. Net effect: editing/accepting/
  regenerating one field's card no longer causes every other unrelated
  card to re-render.
  Toolbar: progress text + "Start over" row and the Accept-high/mid +
  Fill-approved row both already used `flex-wrap`; added `min-w-0` to the
  progress text span and `shrink-0` to "Start over" so long counts don't
  push the button off, and gave both action buttons `min-w-[9rem] flex-1`
  so they wrap onto their own line as a pair below ~288px of available
  width instead of compressing unreadably. Button copy shortened
  ("Accept all high/mid" → "Accept high/mid", "Fill approved fields" →
  "Fill approved") to reduce the width each button needs before wrapping.

**Verified against:**
`cd extension && npm run build` — clean build (39 modules). Specifically
checked the compiled CSS for two easy-to-get-wrong points rather than
trusting the class names alone: grepped for `line-clamp-4` (present,
confirms no plugin was needed) and for the literal `380px` media rule from
the `min-[380px]:grid-cols-2` arbitrary variant (present:
`@media (min-width:380px){.min-\[380px\]\:grid-cols-2{...}}`). **Not
verified**: no browser/DevTools resize test was run at 320px/400px/440px/
500px on a real loaded extension — this is a static/build-level check only,
consistent with this project's "write first, founder runs it" workflow.

**Acceptance criterion met?** Partial — build-verified and CSS-output-
verified for the specific risky utilities used, but the actual visual
claim ("no horizontal overflow, buttons wrap correctly, cards behave from
320-500px") is unverified in a real browser.

**Deviations from spec:**
- Item 9 (performance) asked for "virtualization for long forms" in
  addition to memoization. Deliberately not implemented: this is a
  personal-scale tool (PRD target 10-50 users, form schemas are
  application-form question counts, not thousands of rows), and
  virtualization would mean adding a new dependency (e.g. `react-window`)
  with no real list-length problem to solve — directly against
  `AGENTS.md`'s "don't add abstraction for a hypothetical future
  requirement" and "don't add a dependency ... without asking first."
  Implemented the memoization half (`React.memo` + stable callbacks +
  `useMemo`'d derived counts) since that's real, dependency-free, and
  addresses actual re-render waste already present in the code.
- The "more actions" collapse is unconditional (always behind a toggle),
  not conditionally rendered only "if width becomes constrained" as
  literally written in item 3 — see the reasoning inline above. If the
  founder wants Regenerate visible-by-default on wider widths specifically,
  that's a follow-up (would need a container query or `ResizeObserver`,
  since Tailwind's `sm:`/`min-[…]:` variants key off the *document*
  viewport, which happens to equal the side panel's own width here, but
  using it for "is this specific card cramped" would be coupling the whole
  panel's width to one component's disclosure state).

**Known issues / follow-ups:**
1. Owed: real Chrome side-panel resize test (drag/resize if the browser
   allows it, or test on both a narrow and wide monitor) to confirm no
   overflow at the 320-500px extremes and that the collapsed "more
   actions" disclosure doesn't feel like an extra click users resent at
   comfortable widths.
2. If Chrome's side panel is ever *not* user-resizable in the installed
   Chrome version (panel width may be fixed by the browser rather than the
   page), the `min-width`/`max-width` CSS on `body` is inert either way —
   worth confirming what the real constraint is on the founder's Chrome
   build.

---

### Welcome hero section above the Extract button — 2026-07-13

**What was built:**
Founder asked for a single, tightly-scoped addition: a 5-element welcome
hero (image, title, subtitle, description, "funny helper text") above the
existing "Extract form from this page" button, with an explicit list of
things *not* to touch (layouts, existing components, extraction logic,
colors, button styling, settings/review screens, responsiveness,
unrelated spacing). Implemented as a single new `WelcomeHero()` component
added to `ReviewFlow.jsx` (next to the existing `StatusLine()` helper),
rendered only when `phase === 'idle'` — deliberately excluded from the
`phase === 'error'` case (which reuses the same button element with "Try
again" copy) so a failed extraction doesn't re-show the first-run welcome
copy; nothing else in the idle/error button block was touched.
- `vite.config.js`: added `icons/HeroExtentionImg.png` (a 1024x1024 RGBA
  source, provided by the founder) to the existing
  `vite-plugin-static-copy` targets list (same `dest: 'icons'` pattern as
  the four app-icon sizes) — required for the image to exist in `dist/` at
  all; no other build config touched.
- `WelcomeHero()` renders the image at `h-20 w-20` plus the four exact
  copy strings the founder supplied verbatim (title "Hey, I'm Impleo 🦎",
  subtitle "Your tiny AI assistant for boring forms.", description, and
  the funny helper line), styled with `text-title`/`text-card`/
  `text-body`/`text-caption` and `text-ink-primary`/`text-ink-secondary`/
  `text-ink-muted` — all pre-existing design tokens from the brand-guide
  pass, no new colors introduced. Wrapped in the same
  `rounded-card border border-surface-border bg-surface-card p-4
  shadow-soft-sm` pattern already used elsewhere (Onboarding's `Section`,
  toolbar card in `ReviewFlow`) rather than inventing a new container
  style.

**Verified against:**
`cd extension && npm run build` — clean build, confirmed
`dist/icons/HeroExtentionImg.png` is present (7 static-copy items now,
up from 6). **Not verified**: no browser load — visual placement/spacing
above the Extract button, and whether the hero image reads well at
`h-20 w-20` inside a 320-500px panel, are unconfirmed.

**Acceptance criterion met?** Partial — build-verified only, same pattern
as recent entries in this log.

**Deviations from spec:**
None — scope was followed exactly: one new component, one new
static-copy target line, no other file touched. Confirmed by re-reading
the diff before logging this entry that `App.jsx`, `Onboarding.jsx`,
`components/ReviewCard.jsx`, `index.css`, and `tailwind.config.js` were
untouched by this change.

**Known issues / follow-ups:**
1. Owed: load the unpacked extension and confirm the hero reads well
   visually (image size, text hierarchy, spacing against the button right
   below it) at both ends of the 320-500px range.

---

### Repo-wide "Christopher" → "Impleo" branding rename — 2026-07-13

**What was built:**
Founder asked for every remaining occurrence of Christopher/christopher/
CHRISTOPHER outside `node_modules`/`dist` to be renamed, covering source,
docs, config, and internal branding strings. `manifest.json` and the side
panel title/favicon were already "Impleo" from the earlier rebrand pass
(see that entry above), so this was a sweep for what that pass didn't
touch. 29 replacements across 10 files:
- `extension/package.json`, `server/package.json`: `name` field
  (`christopher-extension` → `impleo-extension`,
  `christopher-server` → `impleo-server`).
- `extension/package-lock.json`, `server/package-lock.json`: the same two
  `name` fields each (root + `packages[""].name`) hand-edited to match —
  not regenerated via `npm install`, since only the literal name string
  needed to change and the dependency-tree integrity hashes are untouched
  by this.
- `docs/AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`: title-line
  renames (`# ... — Christopher` → `# ... — Impleo`) — these are
  maintained, current-state docs (already edited in place for both prior
  architecture pivots), not historical logs, so renaming them matches how
  they've already been treated.
- `docs/PROMPTS.md`: one occurrence inside an example agent prompt's quoted
  text ("Christopher background loaded" → "Impleo background loaded").
- `server/src/index.js`: startup console log string.
- `extension/content-scripts/{generic-extractor,google-forms,luma}.js`:
  the internal DOM marker attribute (`data-christopher-id` →
  `data-impleo-id`) and the generated id prefixes (`christopher-N` /
  `christopher-gf-N` / `christopher-luma-N` → `impleo-` equivalents).
  Confirmed safe before renaming: each extractor sets this attribute *and*
  builds the `selector` string from it within the same self-contained
  function; `generic-filler.js`/the Google/Luma fillers never hardcode the
  attribute name themselves, they only consume whatever `selector` string
  the extractor already produced. So this is a same-file, same-function
  literal rename with no cross-file coupling to get wrong — not a logic
  change, no behavior difference.

**Verified against:**
`cd extension && npm run build` — clean build, and the build log's own
package name line now reads `impleo-extension@0.1.0`, confirming the
`package.json` rename took. Final repo-wide grep after all edits: 9
occurrences remain, both deliberately skipped (see below) — no
accidental misses.

**Acceptance criterion met?** Yes for everything renamed (build-verified,
functionally inert renames only). The two skipped categories below are
intentional, not gaps.

**Deviations from spec:**
None — every replaced occurrence is a pure string/identifier rename with
no logic, layout, or behavior change, per the "pure branding cleanup"
instruction.

**Known issues / follow-ups:**
None beyond what's already logged for the extension load/visual
verification in earlier entries.

---

**Replacements performed: 29**, across `extension/package.json`,
`server/package.json`, `extension/package-lock.json` (×2),
`server/package-lock.json` (×2), `docs/AGENTS.md`, `docs/ARCHITECTURE.md`,
`docs/PRD.md`, `docs/PROMPTS.md`, `server/src/index.js`,
`extension/content-scripts/generic-extractor.js` (×4),
`extension/content-scripts/google-forms.js` (×8),
`extension/content-scripts/luma.js` (×6).

**Remaining occurrences: 9** — both deliberately not renamed:
1. `server/src/db.js:10` — `join(dataDir, 'christopher.db')`, the actual
   SQLite filename the server reads/writes. A real, non-empty
   `server/data/christopher.db` (plus active `-wal`/`-shm` sidecar files,
   ~1.2MB of WAL data) already exists on disk with the founder's real
   profile/settings/qa-history. Renaming the code constant without also
   renaming the physical file would make the server start pointing at a
   fresh, empty `impleo.db` on next run and silently orphan that existing
   data — this fails "keep functionality unchanged," and a filesystem
   rename of a SQLite db with live WAL/SHM files (especially if the
   `node --watch` dev server happens to be running and holding a lock,
   which on Windows can outright fail the rename) is a stateful,
   hard-to-reverse operation this task's "pure branding cleanup" framing
   didn't ask for. Left as-is; renaming it is a separate, explicit ask if
   wanted, ideally with the server stopped and both the code and the
   on-disk file renamed together in the same step.
2. `docs/OUTCOME.md` — 8 occurrences, all inside past log entries dated
   2026-07-12/13 (describing e.g. `christopher.db` schema checks, and the
   original manifest rename from "Christopher" to "Impleo" as a
   historical fact). `OUTCOME.md`'s own header states "Never edit or
   delete a past entry to make it look cleaner — if something had to be
   redone, add a new entry noting the correction, don't rewrite history."
   Renaming these would both violate that stated policy and make several
   entries factually wrong (e.g. one line literally documents the
   manifest's `"Christopher"` → `"Impleo"` transition — replacing
   "Christopher" there would read as `"Impleo"` → `"Impleo"`, erasing the
   record of what changed). This entry is itself the correct way to
   record the rename per that same policy, not an edit to the old ones.
   The `server/src/db.js` occurrence noted above is resolved in the
   follow-up entry immediately below.

---

### `christopher.db` → `impleo.db` — 2026-07-13

**What was built:**
Follow-up to the branding-rename entry above, closing its one remaining
code-side skip. The founder asked to rename the db file and update
`db.js` together rather than leave the filename mismatched with the rest
of the rebrand.
- Found 5 stale `node` processes still holding the db file open from
  earlier sessions (`node --watch src/index.js` × 3, plus one watched
  child `node src/index.js`, plus one detached `node src/index.js`) —
  confirmed via `Get-CimInstance Win32_Process` parent/child mapping that
  these were 3 distinct leftover dev-server instances (not 5; one PID was
  the watch-child of another), never cleanly stopped across sessions.
  Stopped only those 4 node.exe processes (`Stop-Process -Force`) —
  left the extension's `vite build --watch` process and its own `npm run
  dev` wrapper alone, since neither touches the db file.
- Checkpointed `server/data/christopher.db` (`-wal`/`-shm` in journal_mode
  WAL, the `-wal` file had grown to ~1.2MB of not-yet-checkpointed writes)
  into the main file (`PRAGMA wal_checkpoint(TRUNCATE)` via Python's stdlib
  `sqlite3`, no new dependency) rather than renaming all three WAL-mode
  files together — collapses to one clean file to rename instead of three
  files whose consistency depends on staying together, main file grew
  4KB → 40KB confirming real data (56+ qa_history entries, profile,
  settings across past sessions) had been sitting in the WAL uncommitted
  to the main file this whole time.
- `mv christopher.db impleo.db`, then `PRAGMA integrity_check` (`ok`) and
  confirmed all 4 tables (`settings`, `profile`, `qa_history`,
  `sqlite_sequence`) present before touching any code.
- `server/src/db.js`: `join(dataDir, 'christopher.db')` →
  `join(dataDir, 'impleo.db')`.

**Verified against:**
Ran the real server for real (`node src/index.js`, briefly, then let it
exit) against the renamed file and hit it over HTTP: `GET /api/profile`
returned the founder's actual saved profile (name "Agnik Paul", full
resume text, projects, etc. — not a stub), `GET /api/settings` returned
the real saved provider config (`provider: "groq"`, `hasKey: true` for
Groq, matching the "Groq/xAI mixup" fix logged earlier in this file) —
confirms the rename didn't silently start a fresh empty database. `ls`
after the run showed new `impleo.db-shm`/`impleo.db-wal` sidecars
(expected, normal WAL-mode behavior) and no stray `christopher.db` was
recreated. Confirmed via `Get-CimInstance` that no server process was
left running after the test (the founder needs to `cd server && npm run
dev` themselves to bring it back up). Final repo-wide grep: 0 remaining
"christopher" occurrences outside `docs/OUTCOME.md`'s historical entries
(intentionally preserved, per the entry above).

**Acceptance criterion met?** Yes — real data round-tripped through the
renamed file over a real HTTP call, not just a file-existence check.

**Deviations from spec:**
None. The founder explicitly authorized stopping the processes holding
the file open (asked via a clarifying question first, since killing
running processes is outside "pure branding cleanup" and this session
found more stale server instances than expected).

**Known issues / follow-ups:**
1. The old `christopher.db` filename no longer exists anywhere in
   `server/data/` — nothing reads it anymore, no compatibility shim was
   added (per `AGENTS.md`'s "don't add backwards-compatibility hacks"),
   consistent with this being a rename of an already-migrated-in-place
   file, not a case where two versions of the app might coexist.
2. Three separate stale dev-server processes had been running
   concurrently against the same WAL-mode db across past sessions before
   this cleanup — harmless for SQLite (WAL supports concurrent readers/one
   writer across processes) but worth remembering to stop the server
   between sessions rather than leaving multiple `npm run dev` terminals
   open indefinitely.

---

## 2026-07-13 — Landing page design blueprint (docs/LANDING_PAGE.md)

**Task:** Create a landing page markdown file with a "classic modern"
design that explains what Impleo is, with colors following the Impleo
Design System, using design skills.

**What was built:** A new build-ready landing page specification at
`docs/LANDING_PAGE.md`. Ran the `frontend-design` skill; per its Step 0,
recognized the Impleo Design System v2 (`docs/Impleo_Brand_Guide.md`)
already exists and *extended* it rather than inventing a competing system.
Every token in the doc traces back to the brand guide's exact hex values,
Geist typography, 12px/10px radii, 150–250ms motion cap, and the
MongoDB Atlas × Linear × Arc × Raycast personality.

**Contents:** Product context; chosen visual style (premium
developer-tool, dark-first) with rationale; full design-token block
(color/type/spacing/radius/motion); 11-section page structure
(nav → hero → social proof → problem → 5-step "chameleon flow" → 6 feature
cards → review-first trust band on Deep Jungle Green → multi-provider →
privacy/local-first → FAQ → final CTA → footer), each with layout, copy,
and color usage; component rules; interaction/motion; WCAG accessibility
notes (incl. the green/lime/yellow-can't-be-small-body-text caveat);
responsive strategy (mobile-first, 1120px container, ultra-wide cap);
a paste-ready copy bank; and 5 open questions.

**Deliverable type:** documentation/design spec only — no product code,
no build step touched. Framework-agnostic; tokens map cleanly onto a
Tailwind theme extension if the page is later built on the extension's
existing Vite/React/Tailwind stack.

**Acceptance criterion met?** Partial by nature — this is a spec, not a
running page, so there is nothing to exercise against a real URL yet.
Verified only that it is internally consistent with the brand guide and
PRD (correct hex values, correct provider list Anthropic/Gemini/OpenAI/
Groq, correct hard rules: review-before-fill and never-auto-submit are
both surfaced as selling points).

**Deviations / notes:** Introduced one "chameleon-shift" gradient
(green → lime → yellow) as the single allowed hero/CTA accent — a
deliberate, brand-derived alternative to the generic purple→blue AI
gradient the design skill flags as an anti-pattern. Not in the original
brand guide but built entirely from its existing colors.

**Open follow-ups (see doc §11):** Is Impleo live on the Chrome Web Store
(affects the "Add to Chrome" CTA)? Is the GitHub repo public? Do we have
a real side-panel screenshot/demo GIF or use styled mock ReviewCards?
Which framework + host for the actual page?

---

## 2026-07-13 — Landing page built in React/Tailwind (landing/)

**Task:** Implement the landing page spec (docs/LANDING_PAGE.md) as a real
React + Tailwind app, matching the extension's existing stack.

**What was built:** A new standalone `landing/` Vite + React + Tailwind app
(separate from `extension/` and `server/` — it's a static marketing site,
deployable to GitHub Pages/Vercel, not part of the MV3 extension or the
local server). Design tokens are *mirrored* from
`extension/tailwind.config.js` (same brand/jungle/lime/signature/surface/ink
color names, same 12px/10px radii, Geist font) so the site and product share
one visual language.

**Files:** landing/{package.json, vite.config.js, postcss.config.js,
tailwind.config.js, index.html, .gitignore, README.md} +
src/{main.jsx, App.jsx, ui.jsx, ReviewCardMock.jsx, index.css}. Chameleon
mascot + hero image copied into landing/public/ from extension/icons/.

**Sections implemented (all 11 from the spec):** sticky blurred nav w/ mobile
sheet → asymmetric hero (chameleon-shift gradient headline, live ReviewCard
mock w/ auto-Accept tick) → "works on" strip → problem (45:00→0:30) →
5-step how-it-works w/ gradient connector → 6 feature cards → Deep-Jungle-Green
review/trust band → multi-provider tiles (Anthropic active ring) → local-first
privacy diagram → accordion FAQ → final CTA → footer. Line-icon SVGs only (no
emoji), IntersectionObserver scroll-reveal, prefers-reduced-motion honored,
lime focus rings, aria-expanded on nav/FAQ/accordion.

**Product-rule fidelity:** "Never auto-submits" surfaced in features, trust
band, FAQ, and footer; review-before-fill is the narrative spine; provider
list matches AGENTS.md (Anthropic/Gemini/OpenAI/Groq); "your key, never ours /
local server" privacy story matches the local-first architecture.

**Verification status:** NOT yet built/run — per the founder's standing
preference, code was written and handed off for the founder to
`cd landing && npm install && npm run dev`. No npm install/build was run in
this session. Static review only: imports/exports line up (ui.jsx exports
match App.jsx imports; ReviewCardMock props used correctly), all Tailwind
classes reference tokens defined in landing/tailwind.config.js.

**Known follow-ups (doc §11 / README):** CHROME_STORE_URL and GITHUB_URL are
`#` placeholders — replace with the real Chrome Web Store listing and repo.
Hero/trust use styled mock ReviewCards; swap for a real side-panel screenshot
if preferred. Host + deploy target still undecided.

---

## 2026-07-13 — Profile Import/Export

**Task:** Implement Import Profile / Export Profile per the approved plan
(`C:\Users\ASUS\.claude\plans\we-need-to-plan-glistening-sparrow.md`),
following a planning session that evaluated JSON vs YAML vs Markdown vs a
Markdown+frontmatter hybrid as the exchange format.

**Format chosen:** a small versioned JSON envelope
(`{ schemaVersion, exportedAt, app: 'impleo', profile, qaHistory }`), decided
over YAML/Markdown because the profile is already JSON at rest and in
transit, JSON needs no new dependency for validation/versioning (hand-written
validators suffice given the shallow, known shape), and it's the most
AI-friendly format for a future "Extract From Resume" feature (explicitly
out of scope this session).

**Scope decisions (confirmed with founder during planning):** export/import
includes both `profile` and `qaHistory` (not profile-only); import is
confirm-then-overwrite (dry-run validate → inline confirm banner → commit),
not a silent overwrite or a per-field merge UI.

**What was built:**
- `server/src/profileSchema.js` (new) — `CURRENT_SCHEMA_VERSION` (=1),
  `validateEnvelope`, `validateProfile`, `validateQaHistoryEntries`. Strict
  on structure (wrong-typed fields reject, no delimiter-guessing), lenient
  on missing values (sensible per-field defaults). qaHistory entries are
  dropped individually on failure rather than failing the whole import
  (regenerable cache data); profile is never partially accepted.
- `server/src/routes/import-export.js` (new) — `GET /export`,
  `POST /import` (supports a `dryRun` flag for the pre-confirm validation
  pass). Import commits both the `profile` upsert and a full `qa_history`
  replace inside one `db.transaction()`; qaHistory rows are re-inserted in
  reverse order so fresh autoincrement ids preserve chronological order
  against the existing `ORDER BY id DESC` read. File carries a guardrail
  comment: it must never read/write the `settings` table, and structurally
  doesn't (only imports `Router`, `db`, and the schema validators).
- `server/src/routes/qa-history.js` — `MAX_ENTRIES` changed from a local
  const to an exported const, now the single source of truth shared with
  `profileSchema.js`.
- `server/src/index.js` — mounted the new router flat at `/api` (not nested
  under `/api/profile`, to avoid relying on Express router-fallthrough
  ordering against the existing `profileRouter` mount).
- `extension/src/sidepanel/lib/api.js` — added `exportProfile`/
  `importProfile`, both reusing the existing shared `request()` wrapper.
- `extension/src/sidepanel/components/Onboarding.jsx` — new "Backup"
  section (first section in the form, above "AI provider") with Export/
  Import buttons, a hidden file input, a dry-run confirm banner naming both
  the current and incoming profile plus the incoming Q&A count, and a
  shared `busy` flag now gating all three buttons (Save/Export/Import) to
  prevent races. Import/export deliberately bypass the existing
  `profileToFormState`/`formStateToProfile` textarea-serialization
  functions for the actual data transfer — those are lossy/delimiter-based
  (comma/pipe/newline) and would silently corrupt e.g. a project
  description containing `|`. Export always reads the server's saved
  profile fresh via `api.exportProfile()`, never the in-progress form
  state, so unsaved edits can't be silently exported.

**Verification status:** NOT run this session — per standing preference,
code was written and handed off for the founder to test manually (server
`npm run dev`, extension `npm run dev` + load unpacked). The plan file's
Verification section lists the exact manual test sequence, including a
project description containing a literal `|` to confirm the round-trip
avoids the lossy form-serialization path, and negative tests (invalid JSON,
unrelated JSON file, hand-edited wrong-typed field, hand-edited future
`schemaVersion`), plus a DevTools Network-tab check that no import/export
request ever touches `/api/settings`.

**Deviations from the plan:** none of substance. One small addition beyond
the plan's literal wording: `validateEnvelope` also rejects
`schemaVersion < CURRENT_SCHEMA_VERSION` (not just `>`) with an "unsupported
older version" message — harmless/unreachable today since v1 is the only
version that has ever existed, but makes the eventual v2 migration seam
(noted via comment in `profileSchema.js`) unambiguous rather than silently
falling through.

**Known follow-ups:** none identified beyond what's already in the plan's
own scope notes (migrations map deferred until a real v2 exists; Extract
From Resume is separate future work).

---

## 2026-07-13 — Import Profile UX redesign (drag-drop modal + AI prompt)

**Task:** Replace the raw "click Import → file picker" flow with a modal that
teaches a non-technical user how to get a profile JSON in the first place:
drag-drop upload, an instructions section, and a copyable prompt for pasting
into an external AI assistant (ChatGPT/Claude/Gemini/Grok/etc.) alongside a
resume.

**Key design decision (confirmed with founder):** the import validator
(`server/src/profileSchema.js`) now accepts a **bare profile object** (no
`schemaVersion`/`app` envelope wrapper) in addition to the strict envelope
format from last session, auto-wrapping it with the current schema version
before validating. Detection: no top-level `profile` key, but at least one
recognized profile field (`personal`, `links`, `education`, `skills`, etc.)
present at the top level. This is a deliberate, narrow exception to last
session's "missing schemaVersion is rejected, same bucket as not an Impleo
export" rule — justified because the JSON is now often produced by a
general-purpose AI assistant that won't always follow a wrapper instruction
exactly, and the target user has no way to hand-fix that. The strict
envelope path is unchanged for machine-exported files (Export still always
emits the full envelope).

**What was built:**
- `server/src/profileSchema.js` — added `PROFILE_FIELD_KEYS` +
  `looksLikeBareProfile()`; `validateEnvelope` now branches: bare profile →
  validate directly and synthesize the envelope; anything with a `profile`
  key (or nothing recognizable) → the original strict envelope checks,
  unchanged.
- `extension/src/sidepanel/components/ImportProfileModal.jsx` (new) — a
  full-panel overlay (`fixed inset-0 z-50`, since the side panel itself is
  only ~500px wide, a true centered dialog didn't make sense) with three
  sections: (1) a drag-and-drop upload area with a click-to-browse
  fallback, reusing the exact same `api.importProfile(..., {dryRun})` →
  confirm → commit flow as before, just relocated into the modal; (2) a
  numbered instruction list explaining the resume → external AI → JSON →
  drag-drop flow, with a note that Impleo intentionally doesn't generate
  the JSON itself (provider-agnostic, no API cost, works with any model);
  (3) a read-only, monospace textarea containing a detailed prompt (field
  guide + five hard rules: never hallucinate experience, never invent
  achievements/metrics, leave ungiven fields empty rather than guessing,
  conservative inference only, valid-JSON-only output) with a "Copy
  prompt" button that shows "Copied ✓" for 2s via
  `navigator.clipboard.writeText`.
- `extension/src/sidepanel/components/Onboarding.jsx` — Export is
  unchanged (single click, no confirmation, non-destructive). Import's old
  inline hidden-file-input/dry-run/confirm-banner state and handlers were
  removed entirely and replaced with a single `importModalOpen` boolean
  that renders `<ImportProfileModal>`; the modal owns all of its own
  upload/validate/confirm state and calls `onImported` (`= onSaved`) on
  success, so `App.jsx` still needs zero changes.

**Verification status:** NOT run this session — handed off per standing
preference. To test: open the side panel, click "Import profile" in the
Backup section, confirm the modal opens full-panel; try dragging a
previously-exported `.json` file onto the drop zone and via click-to-browse;
click "Copy prompt" and confirm the clipboard content and the "Copied ✓"
feedback; paste the prompt into an actual AI assistant with a real resume,
download its output, and drag that in to confirm the bare-profile
auto-wrap path actually works end-to-end (not just the enveloped-file path,
which was already tested last session).

**Known follow-ups:** none identified. The prompt content should be
spot-checked against at least one real AI assistant's output before relying
on it as the primary onboarding path, since prompt-following quality varies
by model/provider.

---

## 2026-07-13 — Intelligent Field Memory & Semantic Form Understanding

**Task:** Add a semantic identity layer so Impleo understands what a field *means*
(not its DOM id), remembers identity values entered once (Father's Name, DOB,
Aadhaar, Nationality, ...), and reuses them across any future form regardless of
labeling or language. Source of truth: docs/INTELLIGENT_FIELD_MEMORY.md. Planned in
plan mode (plan file: we-need-to-plan-glistening-sparrow.md), approved, then built.

**Key design decisions (confirmed with founder in planning):**
1. HYBRID classification, not a synonym dictionary. A small in-code registry
   (fieldRegistry.js) does fast, offline, deterministic matching for common fields;
   the AI classifies whatever the local matcher misses — folded into the generate
   call that ALREADY runs, so zero extra API cost and multilingual for free. The
   registry is a KEY SET (what canonical keys exist), not an exhaustive synonym table;
   aliases are a seed for the local matcher + few-shot hints. Rejected a pure
   dictionary as unmaintainable across languages.
2. No per-value confidence stored — confidence belongs to the transient per-form
   classification, not to a user-confirmed value. Store canonical_key, value, source,
   created_at, updated_at.
3. Capture + reuse + basic management UI (view/edit/delete remembered values).
4. Identity memory IS exported (optional additive envelope key; schemaVersion stays 1
   so existing v1 files still import), with a strengthened plaintext warning naming
   Aadhaar/DOB sensitivity.

**Server changes:**
- server/src/fieldRegistry.js (NEW) — CANONICAL_FIELDS (~20 identity keys with label,
  type, sensitive flag, English+Hindi seed aliases), isValidKey/labelFor/isSensitiveKey/
  registryPromptList, and classifyLocally() (diacritic/punctuation-normalizing, offline;
  exact alias → high, contained → medium, else null so the AI decides).
- server/src/db.js — new identity_memory table (canonical_key PK, value, source,
  timestamps) via CREATE TABLE IF NOT EXISTS. NOTE: initial version had a backtick
  inside the SQL comment which terminated the db.exec template literal — caught by a
  node --check syntax pass before handoff and fixed (comment reworded without backticks).
- server/src/routes/generate.js — getIdentityMemory() helper; local-classify each field
  before the call; buildSystemPrompt() now embeds remembered identity values + the valid
  canonical-key list and asks the model to return canonicalKey per field (or null, never
  invented); new mergeAnswer() reconciles AI output with the local match (local wins) and
  injects any remembered value verbatim server-side (fromMemory=true, high) so reuse never
  depends on the model echoing correctly. Output shape now
  [{id, canonicalKey, canonicalLabel, answer, confidence, fromMemory}]. regenerate-answer
  updated in parallel. Still ONE AI call — classification adds no round-trip.
- server/src/routes/identity-memory.js (NEW) — GET (with labels for the UI) / PUT (upsert,
  registry-validated) / DELETE; mounted at /api/identity-memory in index.js. Never touches
  settings.
- server/src/profileSchema.js — validateIdentityMemory() (lenient: drops non-registry keys /
  non-string values like qaHistory); validateEnvelope now returns identityMemory (default {})
  on both strict and bare-profile paths. CURRENT_SCHEMA_VERSION stays 1.
- server/src/routes/import-export.js — export envelope now includes identityMemory; import
  full-replaces the table inside the existing db.transaction (source='import'); dryRun summary
  gains identityMemoryCount. "Never touch settings/keys" guarantee unchanged.

**Extension changes:**
- lib/api.js — getIdentityMemory / saveIdentityMemory / deleteIdentityMemory.
- ReviewFlow.jsx — carry canonicalKey/canonicalLabel/fromMemory/remember into reviewState
  (remember defaults on for a newly-classified, non-memory value); handleToggleRemember;
  persist remembered identity values on Fill (mirrors the appendQaHistory Promise.allSettled
  pattern).
- components/ReviewCard.jsx — title now shows the semantic label with the raw questionText
  demoted to a muted "from field: ..." subtitle (fixes the user seeing txtBirthDate_First);
  a "from memory" chip; a "Remember as <label>" checkbox on classified fields.
- components/IdentityMemoryManager.jsx (NEW) — view/edit/delete remembered values, rendered
  in the Onboarding Backup section.
- components/Onboarding.jsx — mounts the manager; export warning strengthened to name Aadhaar/
  DOB sensitivity.
- components/ImportProfileModal.jsx — the AI prompt's output envelope now includes an
  identityMemory object with the recognized snake_case keys, so AI-generated profiles can seed
  identity memory (lenient validation drops anything unrecognized).
- content-scripts/generic-extractor.js — resolveLabel gains generic table-cell heuristics
  (row-leading cell + column header) before the name/id fallback, reducing DOM-id leakage
  uniformly across sites. Self-contained (serialization constraint respected).

**Verification status:** NOT run against the app this session — handed off per standing
preference. Static syntax pass (node --check) run on all 7 modified/new server files; all pass
after the db.js backtick fix. JSX files not statically checked (Vite build will validate). The
plan file's Verification section has the full manual test sequence: capture on a DOM-id form,
reuse across a differently-labeled + a Hindi form (exercises local vs AI paths), DevTools check
that only ONE generate call fires, management edit/delete, export/import round-trip incl. an old
v1 file, and graceful degradation with no provider configured.

**Deviations from plan:** none of substance. The resolveLabel table-heuristic (plan §9, marked
optional/cut-first) was included since it was small. Confirmed the single-AI-call cost invariant
held (classification folded in, not a second call).

**Known follow-ups:** registry is ~20 keys seeded for Indian gov/identity forms + common
personal fields; extend CANONICAL_FIELDS as new identity fields show up. Prompt-following
quality for classification should be spot-checked across providers.

---

## 2026-07-13 — Identity Memory Poisoning fix (root cause + architectural hardening)

**Task:** Investigate and fix a real, reported bug: on an ASP.NET government form,
"Father/Guardian Name" and "Mother's Name" both misclassified to canonical key
`full_name` (should be `father_name`/`mother_name`), and with "Remember" defaulting on,
the same `identity_memory.full_name` row got silently overwritten by three different
people's names in sequence, poisoning every future form's suggestion for that key.
Planned in plan mode (same plan file, we-need-to-plan-glistening-sparrow.md, overwritten
for this task), root-caused by direct code tracing plus an independent design-review
pass, approved, then implemented.

**Root cause (confirmed by reading the code, not inferred):** the corruption happened
upstream of BOTH classifiers, in generic-extractor.js's resolveLabel() table-cell
heuristic (added last session). `row.querySelector('th, td')` unconditionally grabbed
the ROW's first cell as the label, which is only correct when each row holds exactly
one label+input pair. This government form packs 3 label/input pairs per row
(Candidate Name, input, Father/Guardian Name, input, Mother's Name, input), so every
input in that row got labeled "Candidate Name" - the row's literal first cell, which is
also a real, intentional alias of full_name in the registry. The local classifier
wasn't malfunctioning; it correctly matched already-destroyed input. Critical finding
from the design-review pass: because both the local matcher and the AI receive the same
corrupted label text, no amount of "require local+AI agreement" cross-validation would
have caught this specific incident - that's a fix for a different failure class
(genuinely ambiguous or conflicting labels), not this one.

**A separate claim was checked and corrected mid-plan:** the plan originally also
alleged an "apostrophe bug" (that "Father's Name" fails to match father_name's
aliases). Verified empirically by running the normalize() function directly before
implementing anything - this claim was false. Both the alias and the input text
normalize through the identical function to the identical string, so they already
matched correctly at high confidence. The plan file was corrected in place rather than
silently implementing a fix for a non-problem. The independently real issue nearby (the
bare 'name' alias being too broad for the medium-confidence fuzzy pass - e.g. "Company
Name" would false-positive to full_name) was kept and fixed.

**What was built, in tiers:**
1. extension/content-scripts/generic-extractor.js - resolveLabel()'s table heuristic
   now counts inputs sharing a row; for more than one (the bug case), walks
   previousElementSibling backward within the row, skipping empty cells and any cell
   containing a nested form control (never mistakes another field's input-cell for a
   label-cell); for exactly one input per row, keeps the original, already-correct,
   row-wide behavior unchanged. rowspan layouts and div-based fake tables explicitly
   out of scope, documented as known follow-ups; the thead-fallback's own "position
   implies role" assumption flagged but not fixed (same bug class, second instance,
   noted for future awareness).
2. server/src/fieldRegistry.js - added a small excluded-alias set (currently just
   'name') skipped in the medium-confidence substring pass only, still eligible for
   exact match. Added a RISK_CLUSTER_KEYS set (full_name/father_name/mother_name plus
   all sensitive:true keys) and an isRiskClusterKey() helper.
3. server/src/routes/generate.js - new resolveCanonicalKey(): local exact match, any
   key, trusted unconditionally; local fuzzy match outside the risk cluster trusted as
   before (lower stakes); local fuzzy match inside the risk cluster requires the AI's
   independently-returned key to agree, else resolves to null ("unresolved") rather
   than guessing. Fixed "hint-anchoring": the local-match hint is now withheld from the
   AI specifically for risk-cluster-plus-medium-confidence fields, so its
   classification is a genuine second opinion instead of complying with "keep the hint
   if correct." New classificationSource field on each merged answer, kept separate
   from the existing confidence field, which was previously being conflated as an
   answer-groundedness signal with classification confidence. mergeAnswer() also now
   attaches existingMemoryValue (a snapshot of what's currently stored, independent of
   later edits) at zero extra cost since the data was already in closure. Both
   generate-answers and regenerate-answer share this logic uniformly.
4. extension/src/sidepanel/ReviewFlow.jsx - carries classificationSource and
   existingMemoryValue into reviewState from both generateAnswers() and
   handleRegenerate(). New same-batch collision guard in handleFill(): groups
   approved-and-remember-checked entries by canonicalKey before writing; if any key has
   multiple entries with differing values (the exact failure pattern that occurred),
   none of them are written, and a warning names the conflicting fields by their raw
   questionText. This is the most direct defense-in-depth for the reported pattern,
   purely client-side, no server change.
5. extension/src/sidepanel/components/ReviewCard.jsx - the "Update remembered value"
   checkbox now shows the currently-stored value inline when the user has edited a
   memory-sourced answer away from it, so an overwrite is visible before it's
   confirmed, no new modal, just richer copy on the existing opt-in checkbox. Added a
   small muted caption on cards that resolve to an "unresolved" classification, nudging
   the user to manually add the value via IdentityMemoryManager if they recognize it.

**Tier 7 (regression tests) explicitly skipped:** would have added the repo's first
test dependency (vitest/jsdom); docs/AGENTS.md states "no automated test suite for v1 -
not worth it at this scope" and requires asking before adding a dependency. Flagged to
the founder via a clarifying question rather than added unilaterally; founder chose to
skip it and rely on manual verification, matching the documented project convention.
This is the one place the original plan's recommendation was overridden by explicit
founder decision during implementation.

**Verification status:** node --check passed on all 3 modified plain-JS/server files
(fieldRegistry.js, generate.js, generic-extractor.js) - no syntax errors. The two
modified JSX files (ReviewFlow.jsx, ReviewCard.jsx) were not statically checked (will
validate at Vite build) and, per standing preference, no build or dev server was run
this session - handed off. The plan file's Verification section lists the full manual
sequence: reproducing the multi-pair-per-row layout and confirming correct
classification, confirming the single-pair-per-row and thead-columnar layouts still
work (no regression), the same-batch collision guard firing on a constructed
conflicting-values scenario, the risk-cluster agreement/disagreement paths, and a
DevTools check that hint-withholding didn't add a second generate-answers call.

**Remediation of already-poisoned data:** no automatic detection or cleanup was built
(undecidable in general, and risks reintroducing the same false-positive problem this
fix exists to prevent). The founder should manually delete or correct the current bad
full_name value via the existing IdentityMemoryManager UI (built last session) once
this fix is verified.

---

## 2026-07-14 — Real-page label-extraction bugs (doubled asterisk, unlabeled question, bare "*" label, stale fill selector)

**Task:** Fix a real bug report from testing against a live Google Form (job application)
and a live Luma event page (the first real-page testing since these extractors were
written and flagged "not yet verified against a real page"). Reported symptoms, from
screenshots: (1) a question rendering as `"Are you Interested for SRE - Ops Role? * *"`
(doubled required-asterisk), (2) two questions rendering as `"(unlabeled question)"`,
(3) `Fill: not_found — No element matches selector [data-impleo-id="impleo-gf-4"]` on a
field that had extracted and generated fine, (4) several Luma review cards titled just
`"*"` with a generic, unrelated AI-generated answer underneath, and one card titled
`"Discover Events · Luma"` (the event's own page title, not a real form field). Root-caused
by reading the three content-script extractors/fillers and `generate.js`'s prompt
construction directly (not inferred) — no plan-mode design review needed, symptoms mapped
cleanly onto specific functions.

**Root causes found, one per symptom:**
1. Doubled asterisk: `ReviewCard.jsx` always appends its own `" *"` for `required` fields,
   but the extracted `questionText` on some pages already includes the page's own literal
   `"*"` marker text — fixed at the source (extraction), not the display layer.
2. `"(unlabeled question)"`: `google-forms.js`'s `findQuestionTitle()` only accepted a
   zero-child leaf `<div>` as a title candidate; a title wrapped in a nested `<span>`
   (real Forms markup) has `children.length === 1` and matched neither the heading-role
   check nor the leaf-div check, falling through to the placeholder string.
3. Bare `"*"` label: `resolveLabel()`'s (`generic-extractor.js`, duplicated in `luma.js`)
   `previousElementSibling` walk returned the FIRST sibling with any non-empty text and
   stopped — when a required marker is rendered as its own separate `<span>*</span>`
   sibling immediately before the input, that's what got returned instead of continuing
   back to the real label one hop further.
4. Generic AI answers: confirmed by reading `generate.js`'s `buildSystemPrompt()` that
   this is NOT a prompt-quality bug — the no-fabrication/answering rules are correct. It's
   a direct downstream effect of symptoms 2/3: the model is handed `questionText: "*"` or
   `"(unlabeled question)"` and has nothing to ground an answer in, so it correctly (per
   its own instructions) writes something generic. No prompt changes made.
5. `Discover Events · Luma` mislabeled card: the same `resolveLabel()`, called on a
   *container* element for Luma's custom `[role="radio"]`/`[role="checkbox"]` groups, had
   an unbounded `previousElementSibling` walk — with no closely-associated label, it kept
   walking until it hit the page's own event-title heading.
6. `Fill: not_found` on a previously-good selector: a genuine live-page timing issue, not
   a static bug. Google Forms re-renders a question's DOM subtree on some interactions
   (e.g. a validation-state change), which wipes the `data-impleo-id` stamped at
   extraction time even though the field is still on the page and was correctly extracted.
7. Separately (not from a screenshot, found while reading the code): `luma.js`'s native
   radio/checkbox group path used `questionText: options[0] || el.name` — the first
   option's OWN label used as the question text, unconditionally wrong whenever a real
   group label exists.

**What was built, by file:**
- `extension/content-scripts/generic-extractor.js` — `resolveLabel()`'s sibling walk now
  skips a candidate whose trimmed text is only a marker (`/^[\s*✱•·]+$/`) and keeps
  walking, bounded to 4 hops (prevents both the bare-`"*"` bug and, via the hop bound,
  runaway walks grabbing unrelated text). New `stripTrailingMarker()` helper applied to
  every `questionText` assignment so a trailing `"*"` from page text never doubles up with
  the UI's own required-marker.
- `extension/content-scripts/luma.js` — same three `resolveLabel()` changes ported
  (duplicated per file, not shared, per `docs/AGENTS.md`'s self-contained content-script
  constraint). Native radio/checkbox group `questionText` now prefers a real
  `fieldset`/`legend`, then the label of the group's nearest common-DOM-ancestor
  container (found via a small ancestor-walk, mirroring how the custom ARIA groups
  already resolve their own container label), before falling back to
  `options[0] || el.name`. `fillLumaForm()` gained a fallback: when the stamped selector
  matches nothing and the answer carries a `questionText`, it re-derives labels for
  current-DOM radio/checkbox groups, comboboxes, and native inputs/textareas and matches
  by (case-insensitive, substring-tolerant) label text instead of failing immediately.
- `extension/content-scripts/google-forms.js` — `findQuestionTitle()` now accepts an
  `optionTexts` param (the caller already collects these) and, when no `[role="heading"]`
  is found, considers any `<div>` with no nested `<div>` descendants (relaxed from
  "zero children," which missed span-wrapped titles, but still excludes wrapper divs
  whose `textContent` would otherwise concatenate the title with every option — a wrapper
  div precedes its own children in document order, so an unfiltered "any div" pass would
  have picked the wrapper's giant concatenated string as the "title"). Filters out
  marker-only text, the literal string `"Required"`, and any text identical to a
  already-collected option label. `fillGoogleForm()` gained the same kind of fallback as
  luma.js's, matching by `[role="heading"]` text within `[role="listitem"]` when the
  stamped selector misses.
- `extension/src/sidepanel/ReviewFlow.jsx` — `handleFill()`'s `approvedAnswers` mapping
  now carries `questionText` alongside the existing `id`/`selector`/`fieldType`/`value`,
  so both fillers' new fallback paths have something to match against.

**Verified against:** Static read-through + `node --check` (extension's `package.json`
has `"type": "module"`, so this correctly parses the ESM `export function` syntax) on all
three edited content scripts — all pass. Per standing preference, no build or dev-server
run this session; not run against the actual Google Form/Luma pages from the screenshots.

**Acceptance criterion met?** Partial — the code changes directly address every root
cause traced from the screenshots, but per `docs/AGENTS.md`'s definition-of-done rule 1
("works against a real page"), this is not done until the founder re-tests against the
same real Google Form and Luma event URLs.

**Deviations from spec:** None. No prompt changes to `generate.js` (confirmed unnecessary,
see root cause 4). No shared/imported helper introduced for the duplicated label-resolution
logic across the three content scripts — kept duplicated per `docs/AGENTS.md`'s
self-contained-function constraint (MV3 `chrome.scripting.executeScript({ func })`
serializes each function independently via `toString()`).

**Known follow-ups:** The fill-time recovery fallbacks (google-forms.js, luma.js) match by
re-derived label text, which is a best-effort heuristic, not guaranteed — if a form's
label ALSO changed text on re-render (not just its DOM position), the fallback won't find
it either, and the field will still correctly report `not_found` rather than silently
filling the wrong control. `generic-extractor.js`/`generic-filler.js` did not get the same
fill-time recovery fallback — plain HTML forms aren't expected to silently re-render the
way Google Forms/Luma's React-driven pages do, so the extra complexity wasn't added there;
revisit if a similar `not_found` report ever surfaces on a generic form. The founder should
re-test against the exact Google Form and Luma event from the screenshots and confirm: no
doubled asterisk, no `(unlabeled question)`, no bare `"*"` labels, correct/specific AI
answers on the previously-mislabeled Luma fields, and that the SRE-Ops field either fills
directly or recovers via the fallback instead of reporting `not_found`.

---

## 2026-07-14 — Token optimization layer (free-tier survivability: 2-4 forms → target 10-20)

**Task:** The extension exhausted the Groq free tier (llama-3.3-70b-versatile) after ~2-4
forms. A prior read-only investigation (this session) identified the causes; this task
implements the fix. Preserve current UX and answer quality; no heavy dependencies (no
vector DB / embeddings / cloud), per AGENTS.md and the brief.

**Root causes addressed (from the investigation):** flat `max_tokens=4096` on every call
(Groq/OpenAI pre-flight-check `prompt_tokens + max_tokens` against the TPM budget, so a
trivial form still books 4096 completion tokens); deterministic fields (name/email/links/
identity) sent to the LLM and their answers discarded; full `resumeText`+`writingSampleText`
pasted every call; up to 10 full `qa_history` entries attached every call; and ReviewFlow
state loss forcing a full re-generate on panel reopen / Settings round-trip.

**What was built:**
1. `server/src/tokens.js` (NEW) — `estimateTokens()` (dependency-free ~3.6 chars/token
   heuristic; no cross-provider tokenizer exists and adding one is a disallowed
   dependency), `computeMaxTokens(generativeFieldCount)` (adaptive completion budget:
   `220 + 150/field`, clamped [512, 4096] — sizes off the fields that ACTUALLY reach the
   model, not the whole form: verified 2→520, 10→1720, 25→3970), and `logTokenMetrics()`
   printing the exact requested breakdown (fields extracted / direct / rule / generated /
   skipped, prompt / completion / estimated-total tokens).
2. `server/src/fieldRouter.js` (NEW) — deterministic router. `routeField()` returns
   direct / rule / generative / skip. DIRECT (0 AI tokens, field omitted from the prompt):
   identity-memory values, canonical profile values (full_name/email/phone via exact
   high-confidence local match only — so the risk-cluster guard is preserved), and
   non-registry profile-direct fields (LinkedIn/GitHub/portfolio/website/location by
   keyword). RULE: a choice field whose held value matches one of the page's own options
   verbatim (never invents an option). Everything uncertain falls through to GENERATIVE,
   exactly as before — no quality loss. `buildResolvedAnswer()` emits the identical
   client shape `mergeAnswer()` produces, so ReviewCard/ReviewFlow need no changes.
   Smoke-tested: on a 9-field form (name/email/LinkedIn/GitHub/DOB/country/why-attend/
   SRE-role/upload) → 5 direct + 1 skip resolved free, only 3 reached the LLM.
3. `server/src/promptContext.js` (NEW) — relevance-based context selection (rule-based,
   not embeddings). `selectContext()` always includes cheap structured basics; includes
   the EXPENSIVE resume/writing-sample/projects/achievements AND qa_history ONLY when a
   generative field is prose-style (textarea or "tell us / why / describe / experience…"
   keyword). `compressHistory()` relevance-ranks history against the current questions,
   keeps top 3, truncates each answer to ~220 chars, drops the context-URL/date. Verified:
   short "what's your email" form → basics only, profile context 121 chars; essay form →
   full sections, 2336 chars + 1 truncated history entry.
4. `server/src/routes/generate.js` (REWIRED) — both endpoints now: route all fields, and
   **skip the LLM call entirely when zero generative fields remain** (identity/simple
   forms cost 0 API tokens); size `max_tokens` via `computeMaxTokens`; build the system
   prompt from the relevance-selected context; gate the identity-classification block
   (`shouldClassify()`) so pure essay/choice forms don't pay for the ~470-token registry;
   reassemble answers in original order (deterministic + reconciled-LLM); log metrics. The
   existing risk-cluster protections (`resolveCanonicalKey`, hint-withholding, `mergeAnswer`)
   are unchanged and now apply only to the generative subset.
5. `extension/src/sidepanel/ReviewFlow.jsx` (EDITED) + `extension/manifest.json` (added
   `"storage"` permission) — persist `{phase, platform, formSchema, reviewState,
   fillReport, errorMessage}` to `chrome.storage.session`, keyed per tab. On mount, restore
   an in-progress review (coercing transient/`filling` phases to `reviewing`); guarded by a
   `hydratedRef` so the persist effect can't clobber a restore with defaults, and transient
   `extracting`/`generating` phases aren't persisted (would restore to a dead spinner).
   `resetFlow()`/`Start over` clears the tab's stored state. Reopening the panel or bouncing
   to Settings and back no longer re-runs generation.

**Before/after token estimates (per call, est.):**
- Small form, 5 fields all direct (name/email/phone/LinkedIn/DOB): **before ~1,200-5,400 →
  after ~0** (no LLM call at all).
- Medium form, 15 fields (say 8 direct, 2 rule, 5 generative incl. essays): **before
  ~2,050-7,000 → after ~1,000-1,800** (only 5 fields + selected context reach the model;
  `max_tokens` ~970 instead of 4096).
- Large form, 30 fields (say 12 direct/rule, 18 generative): **before ~3,200-9,100 → after
  ~2,200-3,500**, and the pre-flight `max_tokens` reservation drops from a flat 4096 to
  ~2,900.
The compounding wins are: (a) the flat 4096 reservation is gone on every call, (b)
resume/sample/history are omitted from any form without a prose field, and (c) whole forms
can now cost 0 tokens. Together these are consistent with the 10-20-forms-per-session target
on the same free Groq tier.

**Verified against:** Static + executable smoke tests only, per standing preference — no
build/dev-server run this session. `node --check` passes on all 3 new + 1 rewired server
module; `computeMaxTokens`, `routeField`, and `selectContext` were each run directly with
representative inputs (results above). NOT verified against the real Groq API or the live
extension. Handed off for the founder to: `cd server && npm run dev`, `cd extension &&
npm run build`, reload unpacked, then run a real form and watch the `[Impleo tokens]` lines
in the server terminal to confirm the routing counts and token drop, and confirm reopening
the panel restores the review instead of regenerating.

**Acceptance criterion met?** Partial — implements every requested piece and the numbers
check out in isolation, but AGENTS.md rule 1 (works against a real page) requires the
founder to confirm against a real Groq key + real forms.

**Deviations from spec / brief:** None of substance. Used a per-generative-field adaptive
budget rather than the brief's fixed field-count tiers (the brief invited a better
heuristic) — it scales off the count that actually drives cost. Token metrics are
estimates, not real API `usage` (kept `providers.js`'s `chat()` returning a plain string to
avoid touching test-key.js and every provider; the brief's own example labels them
"estimated"). No changes to the four hard-rule areas (no auto-submit, no direct LLM calls
from the panel/content scripts, no hosted backend, no fabrication — direct routing only
copies values the user actually provided).

**Known follow-ups:** (1) If accurate real-usage accounting is later wanted, extend
`providers.js` `chat()` to also surface each vendor's `usage`/`usageMetadata` and log that
instead of the estimate. (2) The rule-based choice router only fires when a held value
matches an option verbatim; genuinely-inferred choices (e.g. "Are you in Bangalore?" from
`location`) still go to the LLM by design (inferring them deterministically risks wrong
answers). (3) Session state is keyed by tab id, not URL — if a tab navigates to a different
form without "Start over", the stale review could restore; acceptable for v1, revisit if it
bites.

---

### Landing — Story-driven landing page redesign (v3), sections + layout + wiring — 2026-07-14

**What was built:**
Completed the interrupted v3 story redesign of `landing/`. A prior session had built the
engine (providers, hooks, motion tokens, animation helpers, components, mascot/jungle
assets) but never created `sections/` or `layouts/` — so `App.jsx` was still rendering the
OLD pre-redesign page out of `src/ui.jsx`, and none of the new architecture was reachable.
This task wrote the nine story beats (`src/sections/`, one file per beat, in the order
UPDATED_DESIGN_MD.md requires: Hero → Pain → Discovery → Extraction → Review → Privacy →
Providers → Success → CTA), the `StoryLayout` shell that owns Lenis + the mascot journey +
nav/rail/footer, a `StoryRail` chapter index with `useActiveSection`, and rewired `App.jsx`
to render the story. Deleted the superseded `src/ui.jsx` + `src/ReviewCardMock.jsx`.

**By file (new unless noted):**
- `src/layouts/StoryLayout.jsx` — provider stack + skip link + nav/rail/mascot/footer.
- `src/sections/*.jsx` (9) + `src/sections/index.js` — each beat owns its scenery, its GSAP
  setup (via `useGsap`), and its mascot state (via `useMascotSection`).
- `src/hooks/useActiveSection.js`, `src/components/StoryRail.jsx` — chapter rail.
- `src/components/HeroCanopy.jsx` + `src/assets/jungle/CanopyScene.jsx` — the R3F scene.
- `src/App.jsx` (REWRITTEN) — now only the running order.
- `src/components/primitives.jsx` (EDITED) — added `Section` (forwardRef), `Heading`, `Lead`.
- `src/components/PersistentMascot.jsx` (EDITED) — docks during hero; hop/float un-conflicted.
- `tailwind.config.js` (EDITED) — added the display `fontSize` scale the file's own comment
  had promised but never defined; `'Geist Variable'` fronts the sans stack.
- `src/main.jsx`, `package.json`, `src/index.css` (EDITED).

**Bugs found and fixed during self-review (all in code written this session unless noted):**
1. `Heading`/`Lead` didn't spread `...props`, silently swallowing the `[data-reveal]`
   attribute every section tags them with — every heading would have been dropped from the
   scroll choreography. Root cause of the whole class: `storyReveal.js` selects by attribute.
2. Transform contention (4 sites): GSAP writes inline `transform`, but CSS keyframes
   (`animate-float-slow`) and Tailwind transform utilities (`rotate`, `-translate-y-2`)
   target the same property — the CSS animation wins, so the GSAP motion silently never
   renders. Fixed by giving each its own element (hero mascot, pain scatter cards, discovery
   cards, success mascot).
3. Same contention pre-existed in `PersistentMascot` (NOT written this session): the
   state-change "hop" could never have been visible under `animate-float-slow`. Fixed.
4. `overflow-x-clip` on `<main>` (mine) risked cropping ScrollTrigger's `position:fixed` pin
   for the horizontal section; removed — `body { overflow-x: hidden }` already covers it.
5. Missing `relative` on two mascot wrappers would have anchored their `absolute` glow to the
   section, washing the whole beat.
6. Nested `[data-reveal]` on both wrapper and child in FinalCTA → double transform.

**Verified against:** Static only. All relative imports resolve (scripted check, 42 files).
Per the standing preference in this repo, no `npm install` / `npm run build` / dev-server run
this session — and the two new dependencies mean **the build cannot currently succeed until
`npm install` is run**. NOT verified in a browser: no Lighthouse/CLS measurement, the R3F
canopy has never been executed, Geist has never been rendered, and the pinned horizontal
scroll + Lenis + ScrollTrigger interaction is unobserved. These are the highest-risk unknowns.

**Acceptance criterion met?** Partial. Every required section, animation requirement and the
mandated folder structure are implemented, and the forbidden patterns are avoided by
construction. But AGENTS.md's definition-of-done rule 1 (works against a real page) and the
brief's own Lighthouse 90+ / CLS < 0.05 targets are unmeasured — they are claims about
runtime behaviour and cannot be asserted from a static read-through.

**Deviations from spec:**
- **R3F scope.** The brief asks for React Three Fiber "where appropriate" and lists Drei.
  Full-site R3F conflicts with Lighthouse 90+/mobile. Asked the founder, who chose
  **hero-only**: one lazy-loaded chunk gated on desktop + WebGL + motion-allowed + on-screen,
  so phones/reduced-motion never download three.js. **Drei is not used** — nothing in the
  scene needed it and it is pure bundle weight. Locomotive not used (Lenis, already built).
- **`@react-three/fiber` pinned to v8**, not latest: v9 requires React 19, this app is React
  18.3. Upgrading fiber without React will break the build.
- **Framer Motion listed in the brief but not used** — GSAP+ScrollTrigger and CSS cover every
  beat; adding a second animation runtime is bundle cost for no capability.
- **FAQ** is rendered inside the CTA beat rather than as a 10th section, to keep the story
  spine at the nine beats the brief specifies while retaining the content.
- **No GIF/Lottie assets authored.** Everything is SVG/canvas/WebGL — a Lottie runtime and
  GIFs would both cost bytes against the perf budget for motion already achieved in-engine.
- Mobile does NOT get the pinned horizontal scroll: it gets a native snap-swipe rail
  (`gsap.matchMedia`, lg+ only). Pinned scroll-jacking fights touch momentum; this protects
  the "maintain mobile performance" requirement.
- Only `@fontsource-variable/geist` (Sans) was added, not Geist Mono. The prominent clocks
  still use the default system mono stack; flagged as a follow-up rather than assumed.

**Known issues / follow-ups:**
1. **`npm install` is required before anything builds** (`@fontsource-variable/geist`,
   `@react-three/fiber@8`, `three`). Founder should run it, then `npm run build`/`npm run dev`
   in `landing/`.
2. Perf targets unmeasured. The hero now stacks SVG + a 2D canvas + a WebGL canvas; the R3F
   chunk is the thing to watch on a Lighthouse run. If mobile regresses, the canopy gate is
   one component (`HeroCanopy.jsx`) and can be dropped without touching any section.
3. `CHROME_STORE_URL` / `GITHUB_URL` in `lib/constants.js` are still `'#'` placeholders.
4. The `landing/` app is absent from AGENTS.md's project-structure tree (pre-existing).
5. `landing/Assets/` (an .mp4 and a standalone mascot .html) is unreferenced by the site —
   left untouched; unclear if it's intended source material.
6. Reduced-motion resolves each scroll-driven beat to its END state (cards filled, answers
   approved) so copy and visuals never contradict; worth an actual pass with the OS setting on.
