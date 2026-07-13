# PROMPTS.md — Ready-to-Paste Agent Prompts

Paste one task at a time into Claude Code. Let it finish and show you the
result before pasting the next — do not batch multiple tasks into one turn.
Every prompt below already contains the "start with AGENTS.md, end with
OUTCOME.md" wrapper — you don't need to add it yourself.

---

## Phase 1 — Core Foundation

### 1.1
> Read docs/AGENTS.md, docs/STRUCTURE.md, and docs/ARCHITECTURE.md in this
> repo first. Then scaffold a Manifest V3 Chrome Extension exactly per
> docs/STRUCTURE.md's file tree: manifest.json (permissions: storage,
> activeTab, scripting, sidePanel; host_permissions: <all_urls>;
> side_panel.default_path pointing to sidepanel/index.html;
> background.service_worker as background.js with type "module"), an empty
> background.js that just logs "Impleo background loaded," and a
> minimal sidepanel/index.html with a placeholder heading. When done, append
> an entry to docs/OUTCOME.md for task 1.1 per its template, including
> confirmation that Load Unpacked in chrome://extensions produced zero
> console errors.

### 1.2
> Read docs/AGENTS.md first. Implement lib/storage.js per
> docs/ARCHITECTURE.md's data flow section: getProfile, saveProfile,
> getQaHistory, appendQaHistory (cap at last 50 entries), getApiKey,
> saveApiKey, isOnboarded — all using chrome.storage.local, this is the ONLY
> file allowed to touch chrome.storage directly per docs/STRUCTURE.md's
> module boundary rules. Append an OUTCOME.md entry for task 1.2 confirming
> each function was tested (e.g. via the extension's DevTools console) to
> actually persist and retrieve data.

### 1.3
> Read docs/AGENTS.md first. Build the onboarding view in
> sidepanel/index.html per docs/PRD.md §5.1 — one input/textarea per profile
> field (personal info, links, education, skills, interests, goals,
> projects, achievements, resume text, writing sample), plus an API key
> field. Wire sidepanel/sidepanel.js so on load it calls isOnboarded() — if
> false, show onboarding; if true, show the (still placeholder) main view.
> "Save profile" collects all fields into the profile object shape from
> docs/PRD.md §7, calls saveProfile()/saveApiKey(), then switches views.
> Append an OUTCOME.md entry for 1.3, including a screenshot-equivalent
> description of what was tested (fill form → save → reload → confirm main
> view shows, not onboarding).

### 1.4
> Read docs/AGENTS.md first. Add a settings gear icon to the header
> (sidepanel/index.html + sidepanel.js) that reopens the onboarding view
> pre-filled with the currently saved profile values, allowing edits, and
> saves back over the existing profile on submit. Append an OUTCOME.md entry
> for 1.4 confirming pre-fill and re-save both work correctly.

### 1.5
> Read docs/AGENTS.md first. Implement a chrome.runtime.onMessage listener
> in background.js handling type 'TEST_API_KEY': make a minimal request to
> https://api.anthropic.com/v1/messages (model claude-sonnet-4-6, max_tokens
> 10, a trivial prompt) using headers x-api-key, anthropic-version:
> 2023-06-01, anthropic-dangerous-direct-browser-access: true. Return
> {ok:true} or {ok:false, error}. Wire the "Test key" button in
> sidepanel.js to call this via chrome.runtime.sendMessage and show a status
> line. Append an OUTCOME.md entry for 1.5, confirming you tested both a
> real valid key (success) and a deliberately wrong key (readable error, no
> unhandled promise rejection in either console).

---

## Phase 2 — Extraction Engine

### 2.1 + 2.2 (combined — inspection informs implementation directly)
> Read docs/AGENTS.md first. Open these real Google Forms in a browser and
> inspect their live DOM yourself using DevTools — do not guess selectors
> from memory, Google's class names are unstable and change periodically:
> [PASTE YOUR 2-3 REAL GOOGLE FORM URLS HERE]. Then write
> content-scripts/google-forms.js exporting extractGoogleForm() as a fully
> self-contained function (per docs/AGENTS.md's serialization rule — no
> references to outer scope, no imports). Match questions using role
> attributes ([role="listitem"], [role="radio"], [role="checkbox"]) and
> visible label text, not brittle class names. Return the schema shape:
> {id, selector or identifying info, questionText, fieldType, options,
> required} using the fieldType constants from docs/STRUCTURE.md's naming
> conventions section. Append an OUTCOME.md entry for 2.1/2.2 that lists,
> for each of the 2-3 real URLs tested, the number of questions extracted
> and confirmation this matches the actual visible question count on the
> form.

### 2.3
> Read docs/AGENTS.md first. Implement content-scripts/generic-extractor.js
> exporting extractGenericForm() per docs/ARCHITECTURE.md's label-resolution
> strategy (label[for], wrapping label, aria-label, nearest preceding text,
> placeholder/name fallback). Group radio/checkbox inputs sharing a `name`
> into single question entries. Handle text, textarea, select/dropdown,
> radio, checkbox (group and single), and file/upload field types. Append an
> OUTCOME.md entry for 2.3, confirming it was tested against a real plain
> HTML form (name a specific form/site used) with no duplicate or missing
> fields.

---

## Phase 3 — AI Generation Layer

### 3.1 + 3.2 (combined)
> Read docs/AGENTS.md first — pay particular attention to rule 7
> (never fabricate profile data) and rule 2 (API calls only from
> background.js). Implement the GENERATE_ANSWERS message handler in
> background.js per docs/ARCHITECTURE.md and docs/PRD.md §5.4: build a
> system prompt embedding the full profile with an explicit, unambiguous
> instruction not to invent facts, companies, numbers, or achievements
> outside what's given. Send the form schema + last 10 qaHistory entries as
> user context. Request ONLY a raw JSON array response with
> {id, answer, confidence}. Strip markdown code fences defensively before
> JSON.parse, and surface parse errors as visible text, not silent failure.
> Append an OUTCOME.md entry for 3.1/3.2 including the exact system prompt
> text you ended up with (for future reference/tuning).

### 3.3
> Read docs/AGENTS.md first. Using a real extracted Google Form schema
> (from Phase 2's output) and a real filled-out test profile, call
> GENERATE_ANSWERS and manually read through every generated answer,
> checking specifically for any fact not present in the profile (invented
> company names, numbers, dates, achievements). Do not just check that the
> JSON parsed — actually read the content. Append an OUTCOME.md entry for
> 3.3 listing each question and whether its answer was fully grounded in
> the profile, with any hallucinations found and how the prompt was
> adjusted to fix them.

### 3.4 + 3.5 (combined)
> Read docs/AGENTS.md first. Implement a REGENERATE_ANSWER handler in
> background.js for a single question, accepting an optional one-line
> instruction (e.g. "make it shorter," "more technical"), reusing the same
> system prompt construction as GENERATE_ANSWERS. Append an OUTCOME.md entry
> for 3.4/3.5 confirming you tested it with at least one instruction and
> confirmed the regenerated answer both differs from the original and
> incorporates the instruction.

---

## Phase 4 — Review & Approval UI

### 4.1 through 4.6 (build together, verify together — this is one cohesive UI)
> Read docs/AGENTS.md first. Build the review card UI in sidepanel.js per
> docs/PRD.md §5.5: after extraction + generation, render one card per
> question showing question text, generated answer, a confidence badge
> (high/medium/low, color coded), and four actions — Accept; Edit (inline
> textarea, saves on blur); Regenerate (optional one-line instruction input,
> calls REGENERATE_ANSWER for just that question); Skip. Track per-question
> approval state in-memory in sidepanel.js. Show a running "N of M approved"
> count. The Fill button (can be a placeholder/disabled stub for now, Phase
> 5 wires the real action) should only be enabled once at least one question
> is approved. Append an OUTCOME.md entry for Phase 4 confirming you tested
> the full set of actions (accept some, edit one, regenerate one with an
> instruction, skip one) against a real generated answer set, and that the
> approved count matched expectations at every step.

---

## Phase 5 — Fill Engine

### 5.1 + 5.2 (combined)
> Read docs/AGENTS.md first — rule 1 (never auto-submit) applies to every
> filler in this phase. Implement content-scripts/generic-filler.js
> exporting fillGenericForm(approvedAnswers), following the
> self-contained-function pattern and the setNativeValue approach from
> docs/ARCHITECTURE.md for text/textarea, plus click-based selection for
> radio/checkbox/dropdown (exact match against the options list first,
> substring match as fallback). Return a per-field report:
> {id, status: filled|no_match|not_found|error, reason}. Append an OUTCOME.md
> entry for 5.1/5.2 confirming a real plain-HTML form test covering at least
> one text field, one radio group, one checkbox group, and one dropdown, and
> explicitly confirming the submit button was never clicked or focused
> programmatically.

### 5.3 + 5.4 (combined)
> Read docs/AGENTS.md first. Add fillGoogleForm(approvedAnswers) to
> content-scripts/google-forms.js using the same approach as the generic
> filler, adapted to Google Forms' DOM structure from Phase 2's extraction
> work. Wire the "Fill approved fields" button in sidepanel.js (routing to
> the right filler comes in Phase 6 — for now, hardcode calling the Google
> Forms filler if that's what you're testing against) to call this via
> chrome.scripting.executeScript with args, and render the returned report.
> Append an OUTCOME.md entry for 5.3/5.4 confirming a real Google Form test
> — every approved field type filled correctly, submit button never
> touched.

### 5.5 + 5.6 + 5.7 (combined — Luma needs live-page inspection before any code)
> Read docs/AGENTS.md first, especially the React-controlled-input landmine
> in docs/ARCHITECTURE.md. Open this real Luma event page and inspect its
> live DOM: [PASTE YOUR REAL LUMA EVENT URL HERE]. Write content-scripts/luma.js
> exporting extractLumaForm() and fillLumaForm(approvedAnswers). Text/textarea
> fields MUST use the native-setter + dispatchEvent approach — plain
> el.value assignment will not update Luma's React state. For
> custom-styled dropdown/radio components (not native <select>), locate and
> .click() the visible option element instead of setting a value. Append an
> OUTCOME.md entry for 5.5/5.6/5.7 confirming you visually watched the real
> Luma page's fields populate on fill — not just that the DOM's underlying
> value attribute changed, but that the rendered UI shows the filled text as
> if typed.

---

## Phase 6 — Platform Routing & Integration

### 6.1 through 6.4 (combined)
> Read docs/AGENTS.md first. In sidepanel.js, add routing logic: on Extract
> click, check location.hostname of the active tab via chrome.tabs.query —
> docs.google.com routes to extractGoogleForm/fillGoogleForm, lu.ma routes
> to extractLumaForm/fillLumaForm, everything else falls back to
> extractGenericForm/fillGenericForm. Add loading states (extracting...,
> generating..., filling...) and error states (failed extraction, failed API
> call, failed fill) that show clear, visible text — never a silently stuck
> UI. After a successful fill, call appendQaHistory() with the approved
> Q&A pairs. Append an OUTCOME.md entry for Phase 6 confirming routing was
> tested against both a Google Form and a Luma page, and at least one
> deliberately-triggered error state (e.g. temporarily using a bad API key)
> was confirmed to display readably rather than hanging or throwing
> unhandled.

### 6.5 + 6.6
> Read docs/AGENTS.md first. Do a full timed run-through: open a real Google
> Form, click the extension icon, extract, review, approve, fill — time it
> start to finish. Repeat on a real Luma event page. Append an OUTCOME.md
> entry for 6.5/6.6 recording both timings and confirming there were zero
> console errors (check both the side panel's DevTools console and the
> service worker's console via chrome://extensions) during either run.

---

## Phase 7 — End-to-End Verification & Ship

> Read docs/AGENTS.md first. Work through every item in
> docs/BACKEND_VERIFICATION.md in order, checking each one against real
> pages/data as specified, not by inspection of code alone. For any item
> that fails, fix it and re-verify before moving to the next item. When all
> items pass, write the final docs/OUTCOME.md retrospective entry per its
> template, and add a "Known Limitations" section documenting anything
> intentionally left unfinished or fragile (e.g. "Google Forms selectors may
> break if Google changes their DOM structure — re-run Phase 2's inspection
> step if extraction stops working").
