# INTERVIEW_GUIDE.md — Explaining Impleo Confidently

A companion to `docs/CURRENT_WORKFLOW.md`. That file is the ground truth for
*what's built*; this file is about *how to talk about it* — hackathons,
pitches, interviews, resume conversations, networking. Every technical claim
here is consistent with `CURRENT_WORKFLOW.md`; if the two ever disagree,
trust `CURRENT_WORKFLOW.md` and fix this file.

---

# Elevator Pitch (30 seconds)

"I kept spending 30-45 minutes per application writing the same kind of
answers — 'why do you want to join,' 'describe a project' — for hackathons
and fellowships, over and over. So I built Impleo: a Chrome extension that
reads the form on your screen, drafts personalized answers from a profile
you fill in once, and lets you review and approve every single answer
before anything touches the page. It never submits for you, and it never
makes something up that isn't in your profile — those were the two rules I
wouldn't break."

---

# 2 Minute Project Explanation

"Impleo is a Chrome extension plus a small local server. You fill in a
profile once — resume, projects, goals, a writing sample so it can match
your voice — and that's stored locally, never uploaded anywhere except to
whichever AI provider you've connected.

When you're on an application form — Google Forms, Luma events, or a plain
HTML form — you click 'Extract,' and a content script reads every question
on the page: text fields, radios, checkboxes, dropdowns. Those questions get
sent to a local server I built with Express and SQLite, which combines them
with your saved profile, builds a prompt with an explicit 'don't invent
facts' instruction, and calls whichever AI provider you've picked —
Anthropic, Gemini, OpenAI, or Groq, your choice.

The answers come back into a review screen. Every answer has a confidence
badge — high, medium, or low, based on how well your profile actually
supports it. You can accept, edit, skip, or regenerate any answer with a
custom instruction, or bulk-accept everything above low confidence in one
click. Only once you approve fields does anything get written into the
actual form — and even then, it never touches a submit button. That review
step isn't a nice-to-have, it's the core design constraint the whole system
is built around."

---

# 5 Minute Deep Dive

Use this as a talk track, not a script — hit these points in whatever order
the conversation naturally goes:

1. **The problem, concretely.** Not "forms are annoying" — specifically:
   mechanical fields (name/email) are trivial, but essay-style contextual
   questions require pulling facts from multiple sources and writing in your
   own voice, and that's the actual time sink, repeated per application.
2. **The profile is the product's foundation.** One structured JSON object —
   personal info, links, education, skills, interests, goals, projects with
   name/description/tech-stack/impact, achievements, pasted resume text, and
   a writing sample specifically to anchor tone. This is what makes answers
   personalized rather than generic AI filler.
3. **Extraction is DOM-first, not vision/ML-based.** Three extractors —
   generic HTML, Google Forms (ARIA-role-based, since Google's CSS class
   names are unstable), and Luma (native + custom ARIA widgets). Each field
   gets a unique injected attribute so the exact same script can find it
   again later for filling, without re-running detection logic.
4. **The server owns every model call and every API key — the extension
   never does.** This wasn't the original design (the extension originally
   called Claude directly, `chrome.storage.local`-only) — I deliberately
   pivoted to a local Express+SQLite server mid-build because centralizing
   API keys and persistence server-side is more defensible than spreading
   secrets across extension storage, and it let me support four LLM
   providers behind one normalized interface instead of hardcoding one
   vendor's SDK into the UI layer.
5. **Confidence scoring plus a mandatory review step is the trust
   mechanism.** The model self-reports confidence per answer based on how
   well-grounded it is in the profile; low-confidence answers are
   deliberately excluded from the one-click bulk-accept, so users only ever
   fast-track answers the model itself flagged as well-supported.
6. **Nothing auto-submits, ever.** Every filler function is structurally
   incapable of touching a submit control — there's no code path that
   references `form.submit()` or a submit button anywhere in the fill logic.
   That's a hard architectural rule, not a UI checkbox that could be
   accidentally left unchecked.

---

# Problem Statement

Applicants to hackathons, fellowships, accelerators, and scholarships spend
30-45 minutes per application on repetitive but individually-unique
essay-style questions, several times a month if they apply regularly. The
mechanical fields aren't the bottleneck — the free-text "why do you want to
attend" / "tell us about yourself" / "describe your project" fields are,
because each one requires re-deriving context from a resume, GitHub, and
past answers, then writing it fresh, per form, per question.

---

# Why Existing Solutions Fail

- **Browser/password-manager autofill** (Chrome autofill, LastPass, etc.)
  only handles a fixed schema of field types — name, email, phone, address,
  card number. There's no field type for "describe a project you're proud
  of," because that's not a lookup, it's generation.
- **Generic AI chat tools** (pasting a question into ChatGPT) require
  re-explaining your background in the prompt every single time, or
  maintaining your own separate context doc outside the tool — there's no
  persistent, structured, reusable profile the tool remembers for you.
- **AI browser extensions that do attempt open-ended generation** typically
  skip the review step and write straight into the page, or don't
  self-report how confident the answer actually is — you're trusting a
  single unverified generation with no signal about which parts are
  well-grounded versus which parts are the model's best guess.

Impleo's actual differentiation, as built: a persistent structured profile
+ per-answer confidence scoring + a mandatory review/approve step before any
DOM write, combined behind one system that works across four LLM providers
instead of being locked to one vendor.

---

# Technical Architecture Explanation

Two runtime pieces:

1. **A Manifest V3 Chrome extension** with a Vite + React + Tailwind side
   panel UI, plus three pairs of plain-JS content scripts (one pair per
   supported platform: Google Forms, Luma, generic HTML) that get injected
   on-demand via `chrome.scripting.executeScript` — never registered as
   persistent content scripts, and deliberately closure-free/self-contained
   because MV3 serializes injected functions via `toString()` and re-parses
   them inside the target page's own isolated DOM world.
2. **A local Express server** (Node.js) bound to `127.0.0.1` only, backed by
   a SQLite database via `better-sqlite3`. It owns every LLM provider's API
   key, the user's profile, and a capped Q&A history — the extension side
   panel talks to it purely over `fetch()` to `localhost`, never directly to
   any LLM vendor's API.

The two communicate over local HTTP with CORS locked down to
`chrome-extension://` origins only, so an ordinary web page open in another
tab can't reach the server just because it happens to be running on the
same machine.

---

# Why These Technologies Were Chosen

- **Chrome Extension (Manifest V3), not a website:** form extraction and
  in-page filling require DOM access to arbitrary third-party pages —
  that's only possible with extension-level permissions
  (`chrome.scripting`), not from a regular web app.
- **React + Tailwind for the side panel:** the review UI has real
  interactive state (per-field status, confidence, editing) that's a much
  better fit for component state than hand-rolled DOM manipulation; Tailwind
  keeps a consistent, compact design system (a full brand/dark-theme design
  pass was later applied on top of it) without hand-writing a CSS file per
  component.
- **Plain vanilla JS for content scripts specifically** — not React, not
  even shared imports — because of the `chrome.scripting.executeScript`
  serialization constraint above. This is a hard platform limitation, not a
  style preference.
- **Local Express + SQLite instead of `chrome.storage.local`:** this was a
  deliberate mid-build pivot. `chrome.storage.local` can't safely hold API
  keys behind any kind of access boundary beyond the extension itself, and
  centralizing all provider calls server-side meant the multi-provider
  system could be built once (one `chat()` shape) instead of duplicating
  four vendors' SDKs into the browser bundle.
- **SQLite specifically, not a hosted database:** the product is explicitly
  local-first and single-user-per-install (see non-goals below) — a hosted
  database would imply auth, multi-tenancy, and ongoing hosting cost for a
  tool with no such requirement.
- **Four LLM providers (Anthropic, Gemini, OpenAI, Groq), user-selectable,
  no auto-fallback:** built provider-agnostic specifically so a user without
  a paid Anthropic key could use a free-tier Gemini or Groq key instead —
  cost/access flexibility mattered more than optimizing for one vendor's
  best model.

---

# Biggest Technical Challenges

- **Form extraction across three very different DOM shapes.** Native HTML
  forms, Google Forms' ARIA-role-based custom components (no native
  `<select>`/`<input type=radio>` for a lot of question types, and unstable
  CSS class names that change between releases — so the extractor matches
  on `[role="listitem"]`/`[role="radio"]`/`[role="listbox"]` instead), and
  Luma's custom-styled widgets layered on top of some native elements. Each
  needed its own label-resolution and grouping logic.
- **Filling React-controlled inputs on the target page.** A plain
  `element.value = x` assignment silently does nothing on a React-controlled
  input, because React overrides the native property setter for its own
  virtual-DOM diffing. Fix: grab the native setter directly off the
  input/textarea prototype via `Object.getOwnPropertyDescriptor`, call that,
  then manually dispatch `input`/`change` events so React's own state
  update fires.
- **Hallucination risk.** An LLM asked to write personalized answers will,
  without explicit constraint, sometimes invent a plausible-sounding but
  false specific (a metric, a company name, a date). Mitigated with an
  explicit, prioritized no-fabrication instruction as the first substantive
  line of the system prompt — stated as taking priority over sounding
  impressive — plus the confidence-scoring mechanism as a second line of
  defense so the user has a signal about which answers to scrutinize.
- **Profile ambiguity / confidence handling.** Deciding how to represent "I
  don't have great material for this specific question" — the answer was to
  make the model self-report a `low` confidence rather than silently
  producing an equally-confident-looking generic answer, and to structurally
  exclude `low`-confidence answers from the one-click bulk-accept path.
- **Multi-provider normalization.** Four vendors, four different wire
  formats (system prompt as a top-level field vs. a leading chat message vs.
  a separate `systemInstruction` object; API key in a custom header vs.
  `Authorization: Bearer`; model ID in the request body vs. in the URL
  path). Solved with one `chat()` adapter shape all four implement, so
  nothing else in the codebase needs to know which provider is active.
- **Never letting the extension see plaintext keys twice.** Keys are
  write-only from the client's perspective — the settings endpoint returns
  only a `hasKey` boolean per provider, never the stored key, so the
  onboarding form always starts blank and re-entering a key is required to
  change it.
- **Data privacy of a running local server.** An Express server on
  `localhost` is reachable by anything else running on the same machine
  unless explicitly restricted — solved by binding to `127.0.0.1` only
  (never `0.0.0.0`) and restricting CORS to `chrome-extension://` origins,
  so a malicious webpage open in another tab can't quietly hit the same
  `localhost` port.

---

# Tradeoffs

- **Why the approval workflow exists (instead of full auto-fill):** trust.
  An LLM-generated answer can be wrong, generic, or subtly off-tone even
  when not outright hallucinated — for something as consequential as a
  submitted application, the cost of a bad unreviewed answer is much higher
  than the cost of one extra click. The confidence badges plus bulk-accept
  are the compromise: fast where the model is confident, deliberately
  friction-ful where it isn't.
- **Why not fully autonomous filling *and submitting*:** a hard,
  non-negotiable rule from day one. No code path anywhere touches a submit
  control. The risk of a wrong or incomplete auto-submission (duplicate
  applications, submitting with a hallucinated fact, submitting before the
  user meant to) is asymmetric — recoverable if the user catches it before
  submitting, not recoverable after.
- **Why local storage instead of cloud storage:** the product is explicitly
  scoped as a personal tool, not a hosted product — no accounts, no
  multi-tenancy, no ongoing hosting cost or liability for storing other
  people's resumes and API keys on a server I'd have to secure and maintain.
  Each install is one person's own copy, own key, own data, own machine.
- **Why a single active provider with no automatic fallback chain:**
  simplicity and predictability over resilience. An automatic fallback to a
  second provider on failure means a request could silently run against a
  different model with different behavior/cost than the one the user
  picked — better to surface the failure and let the user decide than to
  make that substitution invisibly.
- **Why plain JSON-blob profile storage instead of a normalized relational
  schema:** the profile shape is nested, UI-driven, and still evolving —
  storing it as one JSON column avoids a schema migration every time a
  profile field is added or restructured, at the cost of not being able to
  query into individual profile fields with SQL (not a real cost here, since
  nothing does that).

---

# Questions Judges May Ask

For each: a **Recommended** answer (what to actually say), a **Short**
answer (one-liner if cut off), and a **Deep** technical answer (if they push
further).

### 1. Why did you build this?

- **Short:** I was personally burning 30-45 minutes per application on
  repetitive essay questions and wanted my time back.
- **Recommended:** I apply to hackathons and fellowships regularly, and the
  actual bottleneck was never the mechanical fields — it was writing
  personalized answers to open-ended questions from scratch every time. I
  built the profile-plus-review system I wished existed.
- **Deep:** The PRD framing was explicit: target under 30 seconds from
  "open form" to "filled," at a quality bar I'd actually submit without
  heavy editing — that's the metric I designed the extraction → generation →
  review → fill pipeline around.

### 2. How do you prevent incorrect submissions?

- **Short:** Nothing auto-submits — there's no code path that touches a
  submit control, ever.
- **Recommended:** Two layers: a hard architectural rule that no filler
  function references a submit button or `form.submit()`, so it's
  structurally impossible regardless of UI state; and a mandatory review
  step where every field starts as "pending" and only gets filled after
  explicit user approval.
- **Deep:** The fill functions only ever call `.click()` on matched option
  elements or set input values via the native setter — I grepped for any
  submit-adjacent call before considering that rule "done," not just
  assumed it from the UI not having a submit button.

### 3. How is this different from browser autofill?

- **Short:** Browser autofill only handles fixed-schema fields; it has no
  answer for open-ended essay questions.
- **Recommended:** Chrome/LastPass-style autofill pattern-matches a fixed
  set of field types — name, email, address. There's no equivalent for
  "describe a project you're proud of" because that's generation, not
  lookup. Impleo's whole job is that second category.
- **Deep:** Under the hood they're solving different problems entirely —
  autofill is a matching problem (detect a known field type, insert a known
  value); this is a generation-plus-grounding problem (detect an open-ended
  question, generate a personalized answer constrained to only use facts
  present in a stored profile).

### 4. How do you handle hallucinations?

- **Short:** An explicit no-fabrication instruction is the first
  substantive line of every system prompt, plus per-answer confidence
  scoring.
- **Recommended:** The system prompt tells the model, in a dedicated
  CRITICAL RULE section, to only use facts literally present in the
  profile, and to write a more general (not fabricated) answer if the
  profile doesn't have enough material — and to mark that answer
  low-confidence. That confidence signal is structurally excluded from the
  one-click bulk-accept.
- **Deep:** It's prompt-engineering mitigation, not a hard guarantee —
  there's no post-generation fact-checking pass that verifies every claim
  against the profile programmatically. I'm honest that this hasn't been
  stress-tested across a large volume of generations; it's the single
  highest-value thing worth hardening next.

### 5. How do you scale this?

- **Short:** It's explicitly not meant to scale to thousands of users — it's
  a personal tool, each install is self-contained.
- **Recommended:** By design, this isn't a scale-to-millions product — it's
  a local-first tool where each person runs their own copy with their own
  API key and their own local database. "Scaling" here means more people
  installing their own independent instance, not one shared backend
  handling more load.
- **Deep:** There's no hosted backend to scale in the traditional sense —
  the Express server binds to localhost and serves exactly one user. If this
  became a hosted product, that would mean adding auth, multi-tenant
  storage, and centralized key management, which is explicitly out of scope
  for the current version (see non-goals in `PRD.md`).

### 6. Why not use embeddings / RAG?

- **Short:** The profile is small enough to fit entirely in one prompt — no
  retrieval step is needed yet.
- **Recommended:** Right now the whole profile fits comfortably in a single
  system prompt, so there's no retrieval problem to solve — embeddings would
  add complexity (a vector store, chunking strategy, retrieval-quality
  tuning) without a corresponding benefit at this profile size.
- **Deep:** It's on the roadmap conditionally — if profiles grow large
  enough that including everything in every prompt becomes wasteful or
  starts diluting focus on the actually-relevant sections for a given
  question, a retrieval/ranking step over profile sections is the natural
  next step. Not built because the problem it solves doesn't exist yet at
  current profile sizes.

### 7. How would you support teams?

- **Short:** Currently out of scope by design — one profile, one local
  install, no accounts.
- **Recommended:** It's explicitly a single-user, single-install tool right
  now — no auth, no shared backend. Supporting teams would mean adding
  accounts, a hosted (not local) database, and permissions, which is a
  meaningfully different product with different security requirements than
  what exists today.
- **Deep:** The current architecture (local Express + SQLite, API keys
  server-side per install) doesn't generalize to multi-tenant use without
  real changes — you'd need a hosted backend, per-user auth, and encrypted
  per-tenant key storage, none of which is built. I'd treat that as a
  separate v2 architecture decision, not an incremental feature.

### 8. What happens if the AI provider is down or the key is invalid?

- **Short:** The request fails with a clear, surfaced error — no silent
  failure, no automatic fallback.
- **Recommended:** Generation fails fast with a specific error message shown
  in the UI (never just logged to console) — missing provider, missing
  profile, and invalid-key cases are all distinguished with their own
  messages.
- **Deep:** There's deliberately no automatic fallback to a second
  configured provider — an invisible substitution to a different model with
  different behavior/cost felt worse than surfacing the failure and letting
  the user decide, per the "no auto-fallback chain" rule.

### 9. Why did you pick these four specific AI providers?

- **Short:** Anthropic, Gemini, OpenAI, and Groq — chosen for a mix of
  quality and free-tier accessibility.
- **Recommended:** I wanted the tool to work for someone without a paid API
  key, so free-tier-friendly options (Gemini, Groq) sit alongside
  higher-quality paid options (Anthropic, OpenAI) — the user picks whichever
  they have access to.
- **Deep:** All four are normalized behind one `chat()` interface in
  `providers.js`, so adding a fifth is a small, contained change (one
  adapter function plus two settings columns), not a rearchitecture.

### 10. What's your data privacy model?

- **Short:** Everything stays local — the only outbound call is to whichever
  single AI provider the user connects.
- **Recommended:** Profile data and API keys live only in a local SQLite
  database on the user's own machine. No analytics, no third-party
  services, no cloud sync. The only network call this system makes is the
  one the user explicitly configured, to generate an answer.
- **Deep:** The server binds to `127.0.0.1` only and restricts CORS to
  `chrome-extension://` origins specifically to prevent another tab/webpage
  on the same machine from reaching it over `localhost` — that's the
  concrete threat model being defended against, not just a general
  "it's local so it's private" claim.

### 11. What's the actual tech stack?

- **Short:** Chrome Extension (MV3, Vite+React+Tailwind) plus a local
  Express+SQLite server.
- **Recommended:** Manifest V3 Chrome extension with a React side panel
  built with Vite and styled with Tailwind, talking over local HTTP to a
  Node/Express server backed by SQLite (`better-sqlite3`), which handles all
  LLM provider calls.
- **Deep:** No ORM (raw parameterized `better-sqlite3` queries), no
  TypeScript (deliberate scope decision), no bundler on the server (plain
  Node), content scripts are plain vanilla JS with zero build step due to
  the `chrome.scripting.executeScript` serialization constraint.

### 12. How does form field detection actually work?

- **Short:** DOM traversal plus a label-resolution fallback chain — no
  computer vision, no ML classifier.
- **Recommended:** Each extractor walks the page DOM for form controls,
  resolves a human-readable label per field through a fallback chain
  (`label[for]`, wrapping label, ARIA attributes, nearby text,
  placeholder), and groups radio/checkbox inputs sharing a name into one
  question with an options list.
- **Deep:** Google Forms specifically needed ARIA-role matching
  (`[role="listitem"]`/`[role="radio"]`/`[role="listbox"]`) instead of CSS
  classes or native form elements, since Google Forms doesn't use native
  `<input type=radio>` for its custom-styled options and its class names are
  unstable across releases.

### 13. How do you fill fields back into the page reliably?

- **Short:** Each field is tagged with a unique attribute at extraction time
  and re-located by that same attribute at fill time.
- **Recommended:** Every detected field gets a `data-impleo-id` attribute
  stamped onto it during extraction, and a CSS selector built from that
  attribute is stored alongside the question. Filling just re-queries that
  exact selector — no re-running detection logic.
- **Deep:** Text values are set via the native property setter (not a plain
  assignment) plus manually dispatched `input`/`change` events, because
  React-controlled inputs on the target page override the native setter and
  a plain `.value =` assignment would silently not register with React's
  state.

### 14. What was the hardest bug you had to fix?

- **Short:** React-controlled inputs silently ignoring plain value
  assignment during fill.
- **Recommended:** Filling a text field with `element.value = "..."` worked
  on plain HTML forms but silently did nothing on Luma's React-built pages —
  React overrides the native input setter for its virtual-DOM diffing, so a
  plain assignment never triggers React's own state update.
- **Deep:** Fixed by grabbing the native setter directly off the prototype
  via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')`,
  calling `.set.call(element, value)` through that descriptor, then manually
  dispatching `input` and `change` events so React's own listeners fire as
  if a real user had typed.

### 15. Is this open source / can I use it?

- **Short:** It's currently a personal project scoped for individual use,
  not a published product.
- **Recommended:** Right now it's built for me and a small group of people
  in a similar situation — each person runs their own copy with their own
  API key. It's not a hosted product you sign up for.
- **Deep:** (Answer according to actual current repo/license status at the
  time of the conversation — this guide doesn't assume a license decision
  that hasn't been made.)

### 16. What would you build next if you had another month?

- **Short:** Real-world verification of the Google Forms/Luma extractors
  against a wide sample of live pages — that's the biggest unaddressed risk.
- **Recommended:** Two things: hardening extraction against real-world page
  variety (the current selectors are principled but not stress-tested at
  scale), and structured resume parsing instead of pasted free text, to
  reduce ambiguity when multiple profile entries could answer one question.
- **Deep:** See the "Future Roadmap" section of `CURRENT_WORKFLOW.md` for
  the full prioritized list.

### 17. How do you know the extracted answer actually matches the form's
question?

- **Short:** Each answer is matched back to its question by a stable ID
  assigned at extraction time, not by re-matching text later.
- **Recommended:** The extractor assigns each question a unique ID and
  sends only that ID plus the question text to the AI; the AI's response
  includes the same ID per answer, so there's never any fuzzy re-matching —
  it's a direct lookup.
- **Deep:** The system prompt explicitly instructs the model to return "one
  entry per question given, in the same order, using the exact id values
  provided" — the server doesn't have to guess which answer belongs to which
  question.

### 18. What if the form has a field type you don't support?

- **Short:** File uploads are detected but explicitly flagged as
  not-automatable — never silently skipped.
- **Recommended:** Upload fields are the one field type the tool
  deliberately doesn't attempt to fill — they're extracted and shown to the
  user as a clear "do this manually" reminder rather than being silently
  ignored or (worse) attempted incorrectly.
- **Deep:** Every extractor returns a `fieldType` value, and the system
  prompt instructs the model to return `null` for any `upload` field's
  answer; the review UI renders upload fields as a non-actionable card, not
  a normal review card with Accept/Edit/Skip.

### 19. How do you handle multi-select checkbox questions differently from
single-choice?

- **Short:** The model returns a single string for single-choice fields and
  an array of strings for multi-select.
- **Recommended:** The system prompt explicitly distinguishes `checkbox`
  (multi-select, expects an array of one or more verbatim option strings)
  from `radio`/`checkbox_single`/`dropdown` (single-choice, expects exactly
  one verbatim option string) — and the fill logic branches accordingly,
  clicking every matched option for multi-select versus one for
  single-choice.
- **Deep:** Options are matched exact-first, then case-insensitive
  substring as a fallback, in both directions (model answer contains option
  text, or option text contains model answer) — this handles minor wording
  differences between what the model wrote and the option's exact label
  text.

### 20. Why build a Chrome extension instead of a web app?

- **Short:** In-page form filling requires DOM access to arbitrary
  third-party sites — only extensions can do that.
- **Recommended:** A regular web app has no way to read or write into a
  form on a completely different site the user has open — that requires
  browser extension-level permissions (`chrome.scripting`), which is why
  this had to be an extension, not a website.
- **Deep:** Specifically `chrome.scripting.executeScript` with
  `host_permissions: ["<all_urls>"]`, since the set of sites a user might
  apply through can't be known in advance.

### 21. What's your system prompt strategy?

- **Short:** One prompt template, profile embedded in full, with an explicit
  no-fabrication rule stated as the highest-priority instruction.
- **Recommended:** The system prompt states the no-fabrication rule first
  and explicitly says it outranks sounding impressive, then includes the
  entire formatted profile, then per-field-type formatting rules, then the
  confidence-labeling instruction, then the required JSON output format.
- **Deep:** The user message is structured JSON (`{formSchema,
  recentQaHistory}`), not natural language — this is closer to a structured
  extraction+generation task than open-ended chat, so structured input made
  more sense than a conversational framing.

### 22. How do you test this?

- **Short:** Honestly — no automated test suite yet; verification has been
  manual/logged, not CI-enforced.
- **Recommended:** There's no automated regression suite currently — I've
  relied on direct HTTP verification of the server routes and manual
  browser testing of the extraction/fill flow, logged in an append-only
  build log so I can track what's actually been verified versus just
  written.
- **Deep:** This is a known gap I'd address before calling any part of this
  production-grade — `docs/OUTCOME.md` deliberately distinguishes "written"
  from "verified" per task so the gap is visible rather than hidden.

### 23. What was your biggest design mistake, and how did you catch it?

- **Short:** Building the fourth AI provider as xAI's "Grok" when the
  actual target was Groq — a same-sounding but completely unrelated
  service.
- **Recommended:** I initially wired up "xAI (Grok)" as the fourth provider
  based on a naming mishearing, when the actual requested provider was
  Groq — a different company with a similar-sounding name. It was caught
  when a real Groq API key failed against the wrong host, traced back to
  the mismatch, and fixed by swapping the provider adapter, settings
  columns, and UI labels.
- **Deep:** The fix is logged as its own dated entry rather than silently
  editing the original decision out of the build log — I treat that log as
  an append-only audit trail specifically so mistakes like this stay
  visible instead of getting quietly erased.

### 24. How do you decide what NOT to build?

- **Short:** An explicit non-goals list in the PRD, revisited before any
  scope-expanding change.
- **Recommended:** The PRD has an explicit non-goals section — no
  multi-user accounts, no hosted backend, no auto-submission, no scraping
  live profile data — and any change that would touch one of those gets a
  deliberate stop-and-reconsider rather than being added incrementally.
- **Deep:** This is written down specifically so scope decisions don't drift
  silently over many small changes — e.g., the multi-provider work was a
  deliberate, explicitly-approved exception to "single API key," not a
  quiet expansion.

### 25. What would break first if 1000 people used this at once?

- **Short:** Nothing would break from the extension's side, because it
  isn't shared infrastructure — every user's own local server hits their
  own configured provider independently.
- **Recommended:** There's no shared backend to overload — each install is
  its own isolated local server and database. The real constraint 1000
  users would hit is each individual person's own chosen LLM provider's
  personal rate limits, not anything in this system.
- **Deep:** If this became a genuinely hosted multi-tenant product, that's
  a different architecture entirely (see the "how would you support teams"
  answer above) — the current design intentionally has no shared
  bottleneck because it has no shared infrastructure at all.

### 26. How do you version or migrate the database schema?

- **Short:** A guarded `ALTER TABLE` migration runs on server startup,
  checking existing columns before adding new ones.
- **Recommended:** `db.js` checks the current table schema via `PRAGMA
  table_info` and adds any missing columns before the server does anything
  else — this is how the single-provider-to-multi-provider settings schema
  change was rolled out without losing any existing saved key.
- **Deep:** One real backfill migration exists: legacy single-column
  `api_key` values get copied into the new `anthropic_key` column and the
  active provider gets set to `'anthropic'`, specifically so upgrading an
  existing install doesn't silently lose a previously-saved key.

### 27. What's the confidence score actually based on?

- **Short:** The model's own self-assessment of how well the profile
  supports a given answer — not a separate scoring model.
- **Recommended:** It's not a separate classifier — the same generation
  call that writes the answer also labels it `high`/`medium`/`low` per the
  system prompt's explicit instruction: high only when the profile has
  solid, specific grounding; low when the profile has little relevant
  material.
- **Deep:** This means confidence quality is only as good as the underlying
  model's self-assessment, not an independently verified metric — a known
  limitation worth being upfront about if pushed on it.

### 28. Why cap Q&A history at 50 entries?

- **Short:** Bounded storage growth — an append-only history table would
  otherwise grow unbounded forever.
- **Recommended:** Every new entry triggers a delete-oldest query that keeps
  only the newest 50 rows, so the table has a predictable, bounded size
  regardless of how long someone's used the tool.
- **Deep:** Only the most recent 10 of those 50 are actually pulled into any
  given generation call as context — the 50-cap is a storage bound, the
  10-limit is a prompt-size/relevance bound, and they're deliberately
  different numbers for different reasons.

### 29. What's the one feature you're most proud of?

- **Short:** The bulk "Accept high/mid" action — because of what it
  deliberately excludes, not just what it does.
- **Recommended:** It only ever touches fields the model itself marked
  high/medium confidence, and structurally cannot bulk-accept a
  low-confidence answer — it's a small feature, but it encodes the whole
  product's trust philosophy in one button.
- **Deep:** It's implemented as a pure client-side state transition (no
  extra network call) that filters `reviewState` by `status === 'pending'
  && confidence in {high, medium}` — deliberately simple, no server
  round-trip needed since the confidence data is already in memory from
  generation.

### 30. What would you do differently if you started over?

- **Short:** Get real Google Forms/Luma URLs to test against from day one,
  instead of building selectors against documented-but-unverified DOM
  strategies.
- **Recommended:** The extraction logic for two of the three platforms was
  written before I had real live pages to test against, based on documented
  strategy rather than direct inspection — I'd front-load getting real test
  URLs before writing platform-specific selector logic next time.
- **Deep:** This is explicitly logged as a known risk in the build log
  rather than something discovered after the fact by a judge asking a hard
  question — I'd rather be upfront about it.

### 31. How is the extension icon/branding structured?

- **Short:** A single source mascot image, resized into the four standard
  Chrome extension icon sizes via a one-off script — no separate design
  tool dependency added.
- **Recommended:** One 1024×1024 source image gets resized to the 16/32/48/
  128px sizes Chrome's manifest expects, referenced from `manifest.json`'s
  `icons` and `action.default_icon` fields.
- **Deep:** Done with Python's PIL rather than adding an image-processing
  npm dependency to the project, since it was a one-time build step, not a
  runtime need.

---

# Questions About AI Usage

Be straightforward here — judges and interviewers can tell when someone's
being evasive about tooling, and honesty about *what* AI helped with plus
clarity about *your own* decisions reads as more credible than claiming
either "I wrote every line myself" or "the AI built it."

### What did AI help with?

I used an AI coding assistant (Claude Code) heavily during implementation —
scaffolding the extension and server structure, writing the content-script
extraction/fill logic across three platforms, wiring the multi-provider
adapter layer, and iterating on the UI. It was genuinely fast at producing
working code across a lot of files consistently once the architecture and
rules were set.

### What did you personally build/decide?

The product scope and non-goals (what this is and explicitly isn't), the
mid-build architecture pivot from a zero-backend design to a local
Express+SQLite server (and the reasoning for it — key security, multi-
provider support), the hard rules that shaped every implementation decision
after them (never auto-submit, never call an LLM provider from the browser,
no fabricated profile facts), the brand/design direction, and every
verification decision about what actually got tested versus just written.
When a naming mistake happened (the Groq/xAI mixup), I caught it from a real
API key failing, traced the root cause, and directed the fix.

### What architectural decisions did you make?

The self-contained-content-script constraint (a direct consequence of how
`chrome.scripting.executeScript` serializes functions — I understood *why*
that constraint exists, not just that it does), the decision to centralize
every provider's API key and every model call behind the local server
rather than the browser, the decision to make confidence-scoring and manual
review non-negotiable rather than optional settings, and the explicit
non-goals that kept scope from drifting (no accounts, no hosted backend, no
auto-submission, ever).

### Are you comfortable explaining any part of the code without AI help?

Yes — be ready to actually open a specific file (the system-prompt builder
in `generate.js`, or the native-setter fix in a filler script) and walk
through it line by line if asked. If a specific implementation detail
genuinely isn't something you could explain unprompted, it's better to say
"I'd need to look at that file again" than to bluff — that's a normal,
credible answer for any project of this size, AI-assisted or not.

---

# Resume Bullet Points

**1-line version:**

Built Impleo, a Chrome extension + local Express/SQLite server that
extracts application-form questions and generates personalized, reviewed-
before-fill answers across four LLM providers.

**3-line version:**

- Designed and built a Chrome Extension (Manifest V3, React + Tailwind) that
  extracts form questions from Google Forms, Luma, and generic HTML pages
  and fills user-approved, AI-generated answers back into the live page.
- Built a local Express + SQLite backend normalizing four LLM providers
  (Anthropic, Gemini, OpenAI, Groq) behind one interface, with a
  no-fabrication prompt strategy and per-answer confidence scoring.
- Drove a mid-build architecture pivot from browser-only storage to a
  server-owned persistence/security model, and enforced a mandatory
  human-review step before any field is written to a page.

**ATS-optimized version** (keyword-dense, plain phrasing):

Developed a Chrome Extension (JavaScript, React, Tailwind CSS, Manifest V3)
integrated with a Node.js/Express backend and SQLite database, supporting
multiple LLM provider APIs (Anthropic Claude, Google Gemini, OpenAI, Groq).
Implemented DOM-based form field extraction and automated form-filling
across multiple web platforms, REST API design, prompt engineering for
structured JSON generation, and a client-side review/approval workflow.
Applied CORS security policy and local-only server binding for API key
protection.

---

# Demo Script

A live, hackathon-length demo flow (~90 seconds of clicking, rest is
narration):

1. **Open with the problem, 10 seconds.** "This is a real hackathon
   application form. Normally I'd spend 10+ minutes on the essay questions
   alone." *(Have a real, simple form pre-loaded in a tab — a generic HTML
   form or a real Google Form, whichever you've verified works.)*
2. **Show the profile briefly, don't dwell.** Open Settings for 2-3 seconds
   to show the saved profile exists — don't re-fill it live, that's dead
   air. "This is filled in once, ahead of time."
3. **Click Extract.** Narrate while it runs: "It's reading every question on
   this page right now — text fields, multiple choice, dropdowns — no
   pre-configuration needed for this specific form."
4. **Show the review screen.** Point at one high-confidence answer and one
   lower-confidence one. "Notice the confidence badges — this one's
   well-grounded in my profile, this one the model's less sure about, and
   it's telling me that instead of hiding it."
5. **Demonstrate one edit or regenerate.** Type a short instruction ("make
   it shorter") on one field to show the interaction is real, not just a
   static demo answer.
6. **Click "Accept high/mid."** "One click accepts everything the model
   itself is confident about — the low-confidence ones I still review
   individually."
7. **Click Fill.** Watch the actual page fields populate live. This is the
   moment that lands — let it breathe, don't talk over it.
8. **Close on the constraint, not the feature.** "And that's it — it never
   submits. That's a hard rule in the code, not a checkbox I could forget to
   check." This line does more for credibility with technical judges than
   any feature you could show.

---

# Failure Recovery

Live demos break. Have this ready rather than improvising under pressure:

- **If extraction returns zero fields:** don't debug live. Say "this
  particular page's markup is one I haven't verified selectors against yet
  — let me switch to one I know works," and switch to a pre-verified backup
  form/tab you had ready before the demo started. Framing it as "not yet
  verified against this specific page" (true, per the project's own
  documented limitations) is more credible than pretending it's a fluke.
- **If the AI call fails or times out:** "This is hitting a live third-party
  API, so let's see what error comes back" — then show the actual error
  message in the UI (it should be a real, readable message, not a blank
  screen, since that's a design requirement of the system) as proof the
  failure is handled gracefully, not silently swallowed. Turn the failure
  into a demonstration of the error-surfacing design.
- **If the fill doesn't visually update:** check whether the field report
  says `filled` — if it does but the page doesn't look different, say "the
  value did get set — this page's re-render might be delayed" and click
  elsewhere on the page to force a repaint, or scroll to reveal it. If the
  report says `no_match`/`not_found`, be honest: "this means the selector
  didn't find the field — that's exactly the kind of real-page verification
  gap I've been upfront about."
- **General principle:** always have a pre-tested backup form/tab open in
  another tab before you start. Never debug selectors or read a stack trace
  live in front of judges — narrate what's happening at a level judges can
  follow, then move to the backup.

---

# Future Vision

Impleo today is an **AI autofill tool**: extract questions, generate
answers grounded in a stored profile, review, fill. The natural evolution
is toward an **AI application copilot** — not just answering the questions
already on the page, but actively helping someone manage the whole
application lifecycle: tracking which programs they've applied to and with
what answers (the Q&A history table is the seed of this — it already exists
and is already used as generation context), suggesting which of several
past answers best fits a new but similar question, flagging when a new
form's questions overlap heavily with one already answered elsewhere, and
eventually helping decide *what* to apply to next based on fit with the
stored profile — not just filling in forms faster, but reducing the total
cognitive overhead of the whole "find and apply to opportunities" process.
The architecture already supports this direction without a rewrite: the
profile is the durable asset, the Q&A history is already a lightweight
memory of past answers, and the provider-agnostic generation layer means
new copilot-style features aren't locked to a single vendor's capabilities.
