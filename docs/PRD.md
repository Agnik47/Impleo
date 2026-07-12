# PRD — Christopher (Application Copilot Chrome Extension)

## 1. Problem

The founder applies repeatedly to hackathons, fellowships, accelerators, scholarships,
and conferences. The mechanical fields (name, email, phone) are trivial. The real time
sink is contextual essay-style questions — "why do you want to attend," "tell us about
yourself," "describe your project" — which require pulling context from a resume,
LinkedIn, GitHub, past answers, and manual ChatGPT prompting, then hand-copying into
the form. This takes 30–45 minutes per application, several times a month.

## 2. Goal

A Chrome Extension that:
1. Holds a structured profile of the person (resume, projects, skills, goals, writing style).
2. Detects and extracts questions from a form on the current page.
3. Generates personalized, on-voice answers using that profile + Claude.
4. Lets the person review/edit/regenerate/skip every answer.
5. Fills the approved answers into the actual form fields.
6. Never submits anything automatically.

Target: open a form → review → approve → filled, in under 30 seconds, at a quality
bar the person would actually submit without heavy editing.

## 3. Non-goals (explicitly out of scope)

- Multi-user accounts, auth, billing, teams
- **Hosted** backend / cloud database — see §9: as of 2026-07-12 there is a
  local Express + SQLite server, but it runs on `localhost`, one instance
  per person, no hosting/auth/multi-tenancy. Do not read this non-goal as
  "no backend at all" — that changed; it still means no *hosted, shared*
  backend.
- Support for more than ~50 users, ever
- Enterprise-grade error recovery, retries, offline queues
- A general-purpose "AI form filler for anyone" — this is one person's tool first;
  other people can use it by supplying their own profile + API key
- Auto-submission of any form, under any circumstance
- Scraping LinkedIn/GitHub/portfolio live — profile data is entered once during
  onboarding as structured text, not fetched at runtime

## 4. Users

Primary: the builder. Secondary: 10–50 people in a similar situation (students,
early-career builders applying to programs) who install the same extension and
supply their own profile + their own Anthropic API key.

## 5. User Flow

### 5.1 Onboarding (one-time, editable later via Settings)
User provides, all stored in `chrome.storage.local`:
- Anthropic API key
- Personal info: name, email, phone, location
- Links: LinkedIn, GitHub, portfolio (stored as reference strings, not scraped)
- Education (freeform, one per line)
- Skills, interests (comma-separated)
- Goals (freeform paragraph)
- Projects (name | description | tech | impact — one per line)
- Achievements (one per line)
- Resume text (pasted, not PDF-parsed, for v1)
- Writing sample (1–2 pasted past answers/essays — anchors voice/tone)
- **Seed Q&A** (optional but strongly encouraged): 3–5 hand-written example
  Q&A pairs so the very first real form already has few-shot context instead
  of a cold start.

### 5.2 Form detection
On any page, user clicks the extension icon → side panel opens. No automatic
background scanning of every open tab — this is manually triggered per page,
which is simpler, cheaper, and avoids permission creep.

### 5.3 Extraction
Side panel has an "Extract form from this page" button. This injects a
platform-specific extractor (Google Forms / Luma / generic HTML) into the
active tab and returns a structured schema:
```
{ id, questionText, fieldType, options[], required, selector }
```
fieldType ∈ { text, textarea, radio, checkbox, checkbox_single, dropdown, upload }

### 5.4 Classification + Generation (combined, single AI call)
No separate classification pass. One Claude call receives: form schema +
profile + last ~10 Q&A history entries. Returns structured JSON:
```
[{ id, answer, confidence: "high"|"medium"|"low" }]
```
Static fields are populated directly from profile (not generated). Contextual
fields are generated in the person's voice. Choice fields get an option
selected from the literal `options` list provided.

### 5.5 Review layer (mandatory, never skipped)
Every question renders as a card: question text, generated answer, confidence
badge, and four actions:
- **Accept** — mark approved as-is
- **Edit** — inline textarea, edits become the approved value
- **Regenerate** — re-calls Claude for just this question, optional one-line
  instruction ("make it shorter," "more technical")
- **Skip** — excluded from fill, field left untouched

Nothing is written to the page until the user hits "Fill approved fields."

### 5.6 Fill
Only approved (accepted/edited) answers are injected into the live form via
platform-specific fillers. A per-field result (filled / no_match / not_found /
error) is shown so the user can manually fix any mismatch. **Submit button is
never touched.**

### 5.7 History capture
After a successful fill, the approved Q&A pairs are appended to
`qaHistory` in storage (capped at last 50), improving future few-shot context.

## 6. Platform support priority

1. **Google Forms** — P0
2. **Luma** (event registration + custom questions) — P0
3. **Generic HTML forms** — P1 (cut first if time runs short)

Radios, checkboxes, dropdowns, and Luma support are **mandatory**, not
optional — do not suggest removing them for scope reasons.

## 7. Data model

Same shapes as before, now persisted in `server/`'s SQLite database instead
of `chrome.storage.local` (see `ARCHITECTURE.md`'s pivot note):

```js
profile = {
  personal: { name, email, phone, location },
  links: { linkedin, github, portfolio },
  education: string,        // freeform, one entry per line
  skills: string[],
  interests: string[],
  goals: string,
  projects: [{ name, description, techStack, impact }],
  achievements: string[],
  resumeText: string,
  writingSampleText: string,
}

qaHistory = [{ question, answer, context, date }]  // capped at 50, most recent kept

apiKey = string  // Anthropic API key, stored in server/'s SQLite DB (or a local
                  // server/.env), never transmitted anywhere but api.anthropic.com
                  // and never sent to the extension/side panel
```

## 8. Success criteria

Open a real Google Form or Luma event page → open side panel → extract →
review generated answers → approve → fill → under 30 seconds elapsed from
"extract" click to fields populated, and the answers are good enough to
submit with light or no editing.

## 9. Constraints

- AI-agent-driven implementation
- **Pivoted 2026-07-12:** side panel is now built with Vite + React +
  Tailwind (build step approved, scoped to the side panel — see
  `AGENTS.md` rule 4); a local Express + SQLite server (`server/`) owns the
  Anthropic API key and all persistence, replacing `chrome.storage.local` and
  the API-key-owning service worker. Content scripts remain plain,
  self-contained ES modules (unaffected by this pivot — see
  `ARCHITECTURE.md`'s serialization constraint).
- Still local-only, single-person-per-instance: no hosted server, no
  multi-tenant auth (see §3 non-goals)
- Optimize for personal usefulness and implementation speed over scalability,
  multi-tenancy, or architectural purity
