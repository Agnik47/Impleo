# ROADMAP.md — Phases

Spec-driven development loop for this project, per phase:

```
1. Open docs/AGENTS.md — re-read it. Rules don't change per phase.
2. Open the phase's entry in docs/TASKS.md.
3. Execute tasks in docs/PROMPTS.md, one at a time, in order.
4. Verify each task against its acceptance criterion before starting the next.
5. Write a docs/OUTCOME.md entry for the phase before moving to the next phase.
```

A phase is not "done" until its **exit criterion** below is demonstrably
true against real pages/data — not until the code merely exists.

---

## Phase 0 — Clarification & Environment Setup

**Goal:** resolve every open question in `CLARIFICATION_QUESTIONS.md` and
confirm the dev environment works, before any product code is written.

**Entry criterion:** none (starting point).

**Exit criterion:** `CLARIFICATION_QUESTIONS.md` has zero unanswered
questions in its "must answer before Phase 1" section. An Anthropic API key
is in hand. At least 2 real Google Form URLs and 1 real Luma event URL (with
custom questions) are collected.

**Deliverables:** answered `CLARIFICATION_QUESTIONS.md`, a working Anthropic
API key, real test URLs on hand.

---

## Phase 1 — Core Foundation

**Goal:** manifest, storage layer, onboarding UI, API key test — the
extension installs, opens, and can save/reload a profile.

**Entry criterion:** Phase 0 complete.

**Exit criterion:** Loading the unpacked extension shows onboarding on first
run, saves a real profile + API key, reloads into the main view on next open,
and the "Test key" button correctly reports success/failure against the real
Anthropic API.

**Deliverables:** `manifest.json`, `lib/storage.js`, `sidepanel/index.html`
(onboarding + main view shells), `sidepanel/sidepanel.js` (onboarding logic
only), `background.js` (TEST_API_KEY handler only).

---

## Phase 2 — Extraction Engine

**Goal:** pull a structured question schema out of a real Google Form and a
real generic HTML form.

**Entry criterion:** Phase 1 complete.

**Exit criterion:** Running the extractor against the real form URLs from
Phase 0 returns a complete, correctly-typed field list, verified by eyeball
against the actual rendered form (every visible question present exactly
once, correct fieldType, correct options for choice fields).

**Deliverables:** `content-scripts/google-forms.js` (extract only),
`content-scripts/generic-extractor.js`.

---

## Phase 3 — AI Generation Layer

**Goal:** turn an extracted form schema + profile into personalized,
non-fabricated answers.

**Entry criterion:** Phase 2 complete (need real schemas to test against).

**Exit criterion:** Given a real extracted schema and a real filled profile,
`GENERATE_ANSWERS` returns valid JSON, one entry per question, static fields
copied verbatim from profile, choice fields matching an option from the
provided list exactly, and — checked manually — no invented facts outside
the profile. See `BACKEND_VERIFICATION.md` for the exact check procedure.

**Deliverables:** `background.js` (GENERATE_ANSWERS + REGENERATE_ANSWER
handlers, system prompt construction).

---

## Phase 4 — Review & Approval UI

**Goal:** the mandatory human-in-the-loop layer.

**Entry criterion:** Phase 3 complete.

**Exit criterion:** Generated answers render as cards with working Accept /
Edit / Regenerate / Skip actions; approval state is tracked accurately; the
Fill action is inert until at least one answer is approved.

**Deliverables:** `sidepanel/sidepanel.js` (review rendering + state),
`sidepanel/style.css`.

---

## Phase 5 — Fill Engine

**Goal:** write approved answers back into the real page for Google Forms,
generic HTML, and Luma — without ever touching a submit control.

**Entry criterion:** Phase 4 complete.

**Exit criterion:** On each of the three platforms, clicking Fill correctly
populates every approved field type (including at least one radio, one
checkbox, one dropdown), verified visually in the rendered page — and no
submit button is clicked or focused programmatically.

**Deliverables:** `content-scripts/google-forms.js` (fill added),
`content-scripts/generic-filler.js`, `content-scripts/luma.js` (extract +
fill, both — Luma wasn't touched until now since it needs the React-input
fix validated against a real page).

---

## Phase 6 — Platform Routing & Integration

**Goal:** wire everything into one coherent flow driven by the active tab's
hostname, with visible loading/error states throughout.

**Entry criterion:** Phase 5 complete.

**Exit criterion:** the PRD's actual success criterion — open a real Google
Form, extract → review → approve → fill in under 30 seconds, no console
errors; repeat on a real Luma event page.

**Deliverables:** `sidepanel/sidepanel.js` (routing logic, loading/error
states), `lib/storage.js` (qaHistory append wired into the fill flow).

---

## Phase 7 — End-to-End Verification & Ship

**Goal:** confirm the whole thing is trustworthy enough to actually use for
a real application.

**Entry criterion:** Phase 6 complete.

**Exit criterion:** every item in `BACKEND_VERIFICATION.md` checked off
against real forms; a full `OUTCOME.md` retrospective written; known
limitations documented rather than silently present.

**Deliverables:** completed `BACKEND_VERIFICATION.md`, final `OUTCOME.md`
entry, a short "known limitations" note for future-you.

---

## If time runs out (see AGENTS.md / PRD §6 for what's non-negotiable)

Cut order if Phase 5 isn't finished by end of Day 2 morning:
1. Drop generic HTML fill support (Phase 5) — keep extraction only, ship
   Google Forms + Luma fill.
2. Drop Regenerate-with-instruction (Phase 4) — keep plain regenerate.
3. Never cut: review-before-fill, radios/checkboxes/dropdowns, Luma.
