# TASKS.md — Granular Task Checklist

Every task below follows the same loop. Do not skip either end of it:

```
START:  Read docs/AGENTS.md before writing any code for this task.
WORK:   Implement exactly what the task describes — see docs/PROMPTS.md
        for the ready-to-paste prompt for this task.
VERIFY: Check the task's acceptance criterion against real data/pages.
END:    Append an entry to docs/OUTCOME.md for this task before starting
        the next one (see OUTCOME.md's template for the required fields).
```

Checkboxes are for you to mark as Claude Code completes each one.

---

## Phase 0 — Clarification & Environment Setup

- [ ] 0.1 Answer every question in `CLARIFICATION_QUESTIONS.md`
- [ ] 0.2 Obtain a working Anthropic API key
- [ ] 0.3 Collect 2-3 real Google Form URLs (forms you've actually applied through)
- [ ] 0.4 Collect 1 real Luma event URL with custom registration questions
- [ ] 0.5 Confirm Chrome Developer mode works (`chrome://extensions`)

## Phase 1 — Core Foundation

- [ ] 1.1 Scaffold `manifest.json` + empty `background.js` + placeholder `sidepanel/index.html`
- [ ] 1.2 Implement `lib/storage.js` (all 7 exported functions per ARCHITECTURE.md)
- [ ] 1.3 Build onboarding form UI + wire save/load to storage
- [ ] 1.4 Build settings re-entry (edit existing profile)
- [ ] 1.5 Implement `TEST_API_KEY` handler in `background.js` + wire "Test key" button

## Phase 2 — Extraction Engine

- [ ] 2.1 Inspect real Google Form DOM structure (manual, in browser DevTools, before writing extractor)
- [ ] 2.2 Implement `extractGoogleForm()` in `content-scripts/google-forms.js`
- [ ] 2.3 Verify extraction against all 2-3 real Google Form URLs from Phase 0
- [ ] 2.4 Implement `extractGenericForm()` in `content-scripts/generic-extractor.js`
- [ ] 2.5 Verify extraction against a real plain-HTML form

## Phase 3 — AI Generation Layer

- [ ] 3.1 Write system prompt construction (profile embedding + no-fabrication instruction) in `background.js`
- [ ] 3.2 Implement `GENERATE_ANSWERS` handler
- [ ] 3.3 Verify against a real extracted schema — check for fabricated facts (see BACKEND_VERIFICATION.md §3)
- [ ] 3.4 Implement `REGENERATE_ANSWER` handler (single question + optional instruction)
- [ ] 3.5 Verify regenerate produces a genuinely different, still-grounded answer

## Phase 4 — Review & Approval UI

- [ ] 4.1 Render review cards (question, answer, confidence badge) from GENERATE_ANSWERS output
- [ ] 4.2 Wire Accept action
- [ ] 4.3 Wire Edit action (inline textarea, saves on blur)
- [ ] 4.4 Wire Regenerate action (with optional instruction input)
- [ ] 4.5 Wire Skip action
- [ ] 4.6 Running "N of M approved" counter + Fill button enable/disable logic

## Phase 5 — Fill Engine

- [ ] 5.1 Implement `setNativeValue` helper + `fillGenericForm()` in `content-scripts/generic-filler.js`
- [ ] 5.2 Verify generic fill against a real plain-HTML form (text, radio, checkbox, dropdown)
- [ ] 5.3 Add `fillGoogleForm()` to `content-scripts/google-forms.js`
- [ ] 5.4 Verify Google Forms fill against real form URLs — confirm submit button is never touched
- [ ] 5.5 Inspect real Luma event page DOM (manual, before writing extractor/filler)
- [ ] 5.6 Implement `extractLumaForm()` + `fillLumaForm()` in `content-scripts/luma.js`
- [ ] 5.7 Verify Luma fill visually populates fields (not just sets underlying `.value`)

## Phase 6 — Platform Routing & Integration

- [ ] 6.1 Add hostname-based routing logic in `sidepanel.js`
- [ ] 6.2 Add loading states (extracting / generating / filling)
- [ ] 6.3 Add error states (failed extraction, failed API call, failed fill) with visible, readable messages
- [ ] 6.4 Wire `appendQaHistory()` call after a successful fill
- [ ] 6.5 Full run-through on a real Google Form, timed
- [ ] 6.6 Full run-through on a real Luma event, timed

## Phase 7 — End-to-End Verification & Ship

- [ ] 7.1 Complete every item in `BACKEND_VERIFICATION.md`
- [ ] 7.2 Write final `OUTCOME.md` retrospective entry
- [ ] 7.3 Write a short "known limitations" note
- [ ] 7.4 Confirm no console errors in either the side panel or service worker context
