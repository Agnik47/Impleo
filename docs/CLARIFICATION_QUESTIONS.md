# CLARIFICATION_QUESTIONS.md — Open Questions

Questions genuinely requiring your input — an agent shouldn't guess on these,
and I haven't guessed on them either. Answer the "must answer before Phase 1"
section before build starts; the rest can be answered as you hit them.

---

## Must answer before Phase 1

**1. Real test URLs.** Phase 2 and Phase 5 both require inspecting *real*
DOM structure, not mocked fixtures — selectors on real sites drift and
mocks hide that. I need:
- 2-3 real Google Form URLs you've actually applied through
- 1 real Luma event URL with custom registration questions (not just RSVP)

**2. Anthropic API key.** Which key will `background.js` use during
development — a personal key you're comfortable spending test-run tokens on?
Roughly how many test generations do you expect during the 2-day build (this
just informs whether cost is worth thinking about at all — for ~50-100 test
calls total, cost is negligible regardless of answer).

**3. Seed Q&A history.** From the brainstorm: do you want to hand-write 3-5
example Q&A pairs during onboarding so the first real form doesn't cold-start
with zero few-shot context? If yes, do you have 3-5 past answers you're happy
with, ready to paste in?

---

## Answer during Phase 1-3 (not blocking, but decide before the relevant phase)

**4. Character/word limits.** Some applications enforce a character limit on
essay fields (e.g. "500 characters max"). Does the extractor need to detect
and respect stated limits (e.g. parse "500 characters" from the question
text) so generated answers don't overflow, or is that an edit-it-yourself
problem for v1? (Recommendation: skip auto-detection for v1 — mention the
limit if visible in `questionText` and let the review step catch overflow by
eye. Revisit only if it's actually annoying in practice.)

**5. Required-field handling.** If a question is marked required and the
model returns `confidence: "low"` or an unusually thin answer, should the UI
flag it more aggressively than a normal low-confidence badge (e.g. a warning
before Fill), or is the existing review step sufficient? (Recommendation:
existing review step is sufficient for v1 — you're the only user and you'll
notice a bad required-field answer during review.)

**6. Multiple forms per application.** Some accelerators have a multi-page
application (Google Form with sections, or a multi-step Luma-style flow). Is
single-page extraction sufficient for v1, or do you regularly hit multi-page
forms that need re-extraction per page? (Recommendation: single-page for v1
— re-clicking Extract on each page/section is an acceptable manual step,
don't build multi-page state tracking speculatively.)

**7. Upload fields.** The PRD marks upload fields as un-fillable
(`answer: null`). Do you want the review UI to at least *surface* upload
questions as a reminder ("Upload: portfolio PDF — do this manually"), or is
silently skipping them fine since you'll see the empty field on the actual
page? (Recommendation: surface them as a non-actionable reminder card —
cheap to add in Phase 4, prevents forgetting an upload field entirely.)

---

## Answer during Phase 5-6 (platform-specific, decide when you get there)

**8. Google Forms "Other" option.** Radio/checkbox groups on Google Forms
sometimes include an "Other" option with a free-text sub-field. Should the
extractor treat this as just another option string, or does it need special
handling to also fill the free-text sub-field when "Other" is selected?
(Recommendation: treat as a normal option for v1; if the model selects
"Other," the review step will show it and you can manually add the specific
text — add sub-field handling only if you hit this often in practice.)

**9. Luma's ticket/RSVP step vs. custom questions.** Luma events sometimes
gate custom questions behind a "select ticket type" step first. Should
extraction wait for/detect that state, or is it acceptable to require you to
click through to the custom-questions step manually before hitting Extract?
(Recommendation: manual click-through is fine for v1 — detecting dynamic
multi-step gating is real complexity for a rare case.)

**10. What counts as "done" filling a dropdown with no exact match?** If
none of a dropdown's options are a good semantic match for what's being
asked (e.g. a "How did you hear about us?" dropdown with options that don't
fit), should the filler leave it unset and report `no_match`, or should the
model be instructed to always pick the closest option even if it's a stretch?
(Recommendation: always pick the closest option — an unset required dropdown
blocks submission entirely, whereas a slightly-off selection is visible and
one click to fix during your final manual check before submitting.)

---

## Answered already (documented here so they're not re-litigated mid-build)

- **PDF resume upload** — deferred, paste resume as text instead (see
  ARCHITECTURE.md). Revisit only if pasting text proves genuinely annoying
  after a week of real use.
- **LinkedIn/GitHub/portfolio live scraping** — explicitly out of scope, URLs
  stored as reference strings only (see ARCHITECTURE.md).
- **Generic HTML form support priority** — first thing cut if time runs
  short (see ROADMAP.md cut order).
- **Multi-user/auth/billing** — explicitly out of scope for all phases (see
  PRD.md §3, AGENTS.md rule 5).
