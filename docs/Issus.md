# Issue: Edited Answers Are Not Persisting or Learning From User Corrections

> **RESOLVED — 2026-07-14.** Implemented; see `OUTCOME.md` for the full entry.
> Runtime verification (real form, running server) is still outstanding.
>
> **The diagnosis below is wrong in a way worth keeping.** This report reads as
> "the memory architecture is missing, build it." It wasn't. `fieldRouter.js`
> already implemented the exact four-tier lookup order this doc asks for, and
> `identity_memory` was already the user-override store, already reused verbatim
> at HIGH confidence via `mergeAnswer`. Nothing was broken.
>
> The real cause was one line of missing **data**, not architecture:
> `fieldRegistry.js`'s `CANONICAL_FIELDS` is a deliberately *closed* set of
> identity fields (`father_name`, `aadhaar_number`, …). It had no `current_ctc`,
> `expected_ctc`, or `notice_period_days`. So `classifyLocally()` returned null →
> the AI was instructed to return `canonicalKey: null` → `ReviewFlow`'s save
> filters on `canonicalKey` → **the edit had nowhere to go and was dropped.**
> Adding those four keys fixes all three examples below on its own.
>
> What was genuinely missing was the *second* memory system this doc describes:
> the closed registry can only ever learn keys someone anticipated. That gap is
> now `learned_answers` — keyed by the question's own normalized text, so an
> unregistered question ("How many hackathons have you attended?") can be
> remembered too.
>
> Two requests here were **not** followed as written, both deliberately:
> - `identity_memory` writes stay on **Fill**, not Accept — that path carries a
>   collision guard added after a real misclassification incident, and the guard
>   needs the whole form batch. Learned answers do save on Accept.
> - **Essays are never learned** (`textarea`, or answers > 120 chars). Replaying a
>   motivation letter verbatim into a different form is worse than regenerating
>   it. Every example in this doc is a short fact ("5", "0", "Hybrid"), which is
>   what the learned store is scoped to.
>
> Rationale for both, plus a latent `pan`-matches-"com**pan**y" bug found while
> testing, is in `OUTCOME.md`.

## Problem Summary

Impleo currently generates answers correctly for many fields, but it fails one of the most important product expectations:

> If a user manually corrects an answer once, Impleo should remember it and reuse it next time.

Currently this is not happening.

---

# Reproduction Steps

## Example 1 — Current CTC

Form Field:

Current Fixed CTC (in Lakhs)

Initial Generated Answer:

Not applicable, as I am a student.

User Action:

Edited answer manually to:

5

Accepted and saved.

Expected Behavior:

Next time Impleo sees:

- Current Fixed CTC
- Current CTC
- Current Salary
- Current Compensation
- Existing Salary

or similar semantic variants,

it should immediately suggest:

5

with HIGH confidence.

Actual Behavior:

Impleo generates:

"Not applicable, as I am a student."

again.

This proves the edited value is not being persisted or not being retrieved.

---

## Example 2 — Expected CTC

Form Field:

Expected CTC (in Lakhs)

Initial AI Answer:

"I am open to discussion..."

User Action:

Edited answer manually:

5-6

Accepted.

Expected Behavior:

Future occurrences of:

- Expected CTC
- Salary Expectation
- Expected Compensation
- Expected Package

should reuse:

5-6

with HIGH confidence.

Actual Behavior:

Impleo regenerates the generic answer again.

---

## Example 3 — Notice Period

Form Field:

Notice Period (In days)

Initial AI Answer:

"Not applicable, as I am a student.

User Edited:

0

Accepted.

Expected Behavior:

Future occurrences of:

- Notice Period
- Joining Availability
- Available From
- Immediate Joining
- Days to Join

should automatically map to:

0

with HIGH confidence.

Actual Behavior:

The old generic answer keeps returning.

---

# Expected Product Behavior

Impleo should behave like a memory system.

## Rule 1

Unknown field:

Confidence:

LOW or MEDIUM

because Impleo has never seen it before.

Example:

Current Fixed CTC

---

## Rule 2

User edits answer manually and presses Accept.

Impleo should immediately save:

Rule 3

Future semantically similar questions should reuse the saved answer.

Examples:

Current Fixed CTC
Current Salary
Current Compensation
Present CTC
Current Package

should all resolve to:

current_ctc

and return:

5

Rule 4

User corrected answers always have higher priority than AI generated answers.

Priority order:

User Override Memory
Explicit Profile Fields
Rule Based Mapping
AI Generation

AI should never overwrite user-confirmed values.

Rule 5

If a field has a user-confirmed answer stored previously:

Confidence should become:

HIGH

because this answer came directly from the user.

Required Architecture

Need two separate memory systems:

1. Profile Database

Examples:

Name
Email
Phone
LinkedIn
GitHub
College

Static information.

2. Learned Field Memory

Examples:

{
  "current_ctc": "5",
  "expected_ctc": "5-6",
  "notice_period_days": "0",
  "work_mode": "Hybrid"
}

Dynamic information learned from corrections.

Required Feature

When user presses:

Accept

after editing,

automatically execute:

saveUserCorrection(
    normalizedQuestion,
    finalAcceptedAnswer
)
Semantic Matching Required

Current CTC examples:

Current CTC
Current Salary
Existing Salary
Current Fixed CTC
Present Compensation

Expected CTC examples:

Expected Salary
Salary Expectation
Desired Compensation
Expected Package

Notice Period examples:

Notice Period
Joining Availability
Available From
Days To Join
Immediate Joining

These should map to the same canonical key.

Success Criteria

Scenario:

Form 1:

Current CTC

User edits:

5

Form 2:

Current Fixed CTC

Expected Result:

Impleo immediately suggests:

5

Confidence:

HIGH

No API call required.

No regeneration required.

No user edit required.

Product Principle

The entire value of Impleo is:

The more you use it, the smarter it becomes.

Currently this learning loop is broken.