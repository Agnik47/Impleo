# Impleo — Landing Page Blueprint

> A build-ready, design-driven specification for the Impleo marketing landing page.
> Extends **Impleo Design System v2** (`docs/Impleo_Brand_Guide.md`) — it does not
> introduce a competing system. Every color, radius, and type size below traces
> back to that guide.

---

## 1. Product Context

| | |
|---|---|
| **Product** | Impleo — an AI-powered autofill copilot (Chrome Extension) |
| **What it does** | Detects application forms, generates personalized on-voice answers, and fills them after a mandatory human review |
| **Audience** | Students & early-career builders applying to hackathons, fellowships, accelerators, scholarships, conferences |
| **Job to be done** | "Stop spending 30–45 minutes hand-copying essay answers into every application." |
| **Personality** | Adaptive · Fast · Trustworthy · Playful · Premium · Professional |
| **Mascot** | A smart chameleon that adapts to any form. Never redraw it, never put text inside it. |
| **Emotional target** | *"This feels premium and in-control — not a spammy autofill hack."* |

---

## 2. Chosen Visual Style — Premium Developer-Tool (Dark-first)

**Reference feel:** MongoDB Atlas × Linear × Arc Browser × Raycast.

**Why this style fits Impleo**

- The audience is technical and design-literate; they trust tools that look like the
  tools they already love (Linear, Raycast). Corporate/Bootstrap styling would read as
  low-trust for something that touches their private profile data.
- Dark-first matches the extension's own **Dark Theme** (`#0B0F0E`), so the marketing
  site and the product feel like one continuous surface.
- The chameleon-green palette is vivid enough to carry a "classic modern" hero without
  resorting to the default purple→blue AI gradient (an explicit anti-pattern).
- Compact typography + premium whitespace signals *fast and intelligent*, matching the
  under-30-seconds product promise.

**Explicitly avoided:** purple/blue AI gradients, glassmorphism-everywhere, emoji-as-icons,
oversized fonts, Bootstrap card stacks, centered-single-column applied to every section.

---

## 3. Design Tokens

All values inherited from Impleo Design System v2. Use these as the single source of
truth — no one-off hex codes in components.

### Color

```txt
--brand-green        #28C94E   Primary CTAs, active states, brand marks
--brand-green-2      #00A050   Hover / secondary / success
--jungle             #002B2B   Deep section backgrounds, dark cards, footer
--lime               #A6D91A   AI highlights, accents, chameleon glow
--yellow             #F5D000   Checkmarks, approval, CTA highlight ticks
--cream              #F4F060   Subtle highlight, hover glow
--white              #F5F5F5   Primary text

/* Dark theme surfaces */
--bg                 #0B0F0E   Page background
--surface            #171C1A   Card background
--surface-hover      #1E2522   Card hover
--sidebar            #121816   Elevated nav / panels
--border             #27332D   Hairline borders, dividers

--text-primary       #F5F5F5
--text-secondary     #A3A3A3
--text-muted         #737373
```

**Signature gradient (use sparingly — hero headline accent & CTA only):**
`linear-gradient(90deg, #28C94E 0%, #A6D91A 60%, #F5D000 100%)`
This is the "chameleon shift." It replaces the generic AI gradient and is the one
gradient allowed on the page.

### Typography

```txt
Font:      Geist  (fallback: Inter, system-ui)
Weights:   regular 400 · medium 500 · semibold 600 · bold 700

Marketing scale (larger than the compact in-app scale, but same family):
  Display / hero        48–64px   700   line-height 1.05   tracking -0.02em
  Section heading       32–40px   600   line-height 1.15
  Subheading            20–24px   500   line-height 1.3
  Body                  16–18px   400   line-height 1.6    color: text-secondary
  Small / meta          13–14px   500   color: text-muted
  Eyebrow / label       12px      600   uppercase   tracking 0.08em   color: lime
```

Body copy runs on `--text-secondary`, not pure white — reserves white for headings and
key phrases so the hierarchy reads instantly.

### Spacing, Layout & Radius

```txt
Base unit         4px  (all spacing is a multiple: 4/8/12/16/24/32/48/64/96/128)
Container         max-width 1120px, 24px side gutters
Section rhythm    128px vertical padding desktop · 72px mobile
Grid              12-col desktop · 6-col tablet · 4-col mobile · 24px gutter

Radius   cards 12px · buttons 10px · inputs 10px · pills/full 999px
Shadow   very soft only:  0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.25)
         Never heavy drop shadows — premium SaaS restraint.
Border   1px solid --border on every card; no shadow-only separation
```

### Motion

```txt
duration    fast 150ms · base 200ms · slow 250ms   (cap at 250ms per brand guide)
easing      cubic-bezier(0.4, 0, 0.2, 1)
principle   subtle > flashy. Hover lifts, color shifts, fades. No bounce, no parallax spam.
```

---

## 4. Page Structure (top to bottom)

```
┌─ Sticky Nav ──────────────────────────────────────────────┐
├─ 1. Hero                       (chameleon + headline + CTA) │
├─ 2. Social proof strip         (logos / "works on" row)     │
├─ 3. Problem                     (the 30–45 min pain)         │
├─ 4. How it works                (5-step, chameleon flow)     │
├─ 5. Features grid               (6 cards)                    │
├─ 6. Review-first / Trust        (the "you stay in control")  │
├─ 7. Multi-provider              (Anthropic/Gemini/OpenAI/Groq)│
├─ 8. Privacy & local-first       (no hosted server pledge)    │
├─ 9. FAQ                                                      │
├─ 10. Final CTA                                               │
└─ Footer                                                     │
```

---

## 5. Section-by-Section Spec

### Nav (sticky, translucent)

- Background `--bg` at 80% opacity with `backdrop-filter: blur(12px)`; 1px bottom
  border `--border`. Height 64px.
- **Left:** chameleon mark (28px) from `/Icon` + wordmark "Impleo" (Geist semibold,
  no logo lockup with text baked in — text is separate DOM).
- **Center (desktop):** How it works · Features · Privacy · FAQ — `--text-secondary`,
  hover → `--white`, 150ms.
- **Right:** ghost "GitHub" link + primary button **"Add to Chrome"** (`--brand-green`).
- **Mobile:** left mark + hamburger → full-screen `--sidebar` sheet.

### 1 — Hero

> **Layout:** asymmetric two-column on desktop (7 / 5), stacked on mobile. Not centered —
> the chameleon anchors the right, copy leads on the left. This deliberately breaks the
> generic centered-hero anti-pattern.

- **Eyebrow:** `AI AUTOFILL, BUT YOU STAY IN CONTROL` — lime, 12px uppercase.
- **Headline (48–64px, 700):**
  > Fill any application form in **under 30 seconds.**
  >
  > Apply the "under 30 seconds" phrase with the **chameleon-shift gradient** as a text
  > clip — the single hero accent.
- **Subhead (20px, text-secondary, max-width 52ch):**
  > Impleo reads the form, writes personalized answers in *your* voice, and lets you
  > review every one before a single field is touched. Hackathons, fellowships,
  > scholarships — done.
- **CTA row:**
  - Primary: **"Add to Chrome — Free"** (`--brand-green`, white text, 10px radius,
    soft shadow; hover → `--brand-green-2` + 1px lift).
  - Secondary: **"See how it works"** ghost button (1px `--border`, text-primary,
    hover `--surface-hover`).
- **Under-CTA meta (13px, text-muted):** `Bring your own API key · Works locally · Never auto-submits`
- **Right visual:** the chameleon mascot sitting on a stylized "review card" mock
  (a real ReviewCard: question text, generated answer, confidence badge, Accept/Edit/
  Regenerate/Skip). Lime radial glow behind the mascot at ~12% opacity. A soft
  `--yellow` checkmark animates in on the Accept action (150ms fade+scale).

### 2 — "Works where you apply" strip

- Muted row on `--bg`: eyebrow `WORKS ON` then quiet monochrome labels —
  **Google Forms · Luma · Generic HTML forms**. `--text-muted`, 14px.
- Keep it understated (Stripe-style logo strip), not a loud badge wall.

### 3 — The Problem

- Two-column: left heading + copy, right a small "before" visual.
- **Heading:** `The mechanical fields are easy. The essays are the time sink.`
- **Copy:** Restate the PRD pain — resume + LinkedIn + GitHub + manual ChatGPT +
  hand-copying = 30–45 minutes, several times a month.
- **Visual:** a subtle "45:00" stopwatch styled in `--text-muted` on `--surface`,
  crossed toward a green `0:30`. Contrast sells the value.

### 4 — How it works (the chameleon flow)

Horizontal 5-step tracker on desktop, vertical timeline on mobile. Each step = a
`--surface` card, 12px radius, 1px border, numbered chip in `--brand-green`.

```
1  Detect      Open the side panel on any form page.
2  Extract     Impleo reads every question + field type.
3  Generate    Personalized answers in your voice, one AI call.
4  Review       Accept · Edit · Regenerate · Skip — every answer.
5  Fill         Only approved answers are written. Submit is never touched.
```

- Connector line between steps uses the **chameleon-shift gradient** at low opacity —
  reinforces "adapts as it moves." Active step chip glows `--lime`.

### 5 — Features grid (6 cards, 3×2 desktop / 1-col mobile)

Each card: `--surface`, 12px radius, 1px `--border`, hover → `--surface-hover` + 1px
lift (200ms). Icon in a `--jungle` rounded square with `--lime` glyph (line icons —
**no emoji**). Card title 14–16px semibold white, body 14px text-secondary.

| # | Title | Body |
|---|-------|------|
| 1 | **Answers in your voice** | Learns tone from your writing sample + past answers — no robotic filler. |
| 2 | **Human review, always** | Nothing is written until you approve. Accept, edit, regenerate, or skip each one. |
| 3 | **Radios, checkboxes, dropdowns** | Not just text fields — it picks the right option from the real choices. |
| 4 | **Google Forms & Luma native** | First-class extractors for the platforms you actually apply through. |
| 5 | **Bring your own model** | Anthropic, Gemini, OpenAI, or Groq — your key, your choice. |
| 6 | **Never auto-submits** | A hard product rule. Impleo fills — you press submit. |

### 6 — Review-first / "You stay in control"

- Full-bleed `--jungle` (`#002B2B`) band — the one deep, dark, premium moment on the
  page. White heading, lime eyebrow.
- **Heading:** `AI writes the draft. You own the decision.`
- Left: copy on the mandatory review layer. Right: an enlarged, interactive-looking
  **ReviewCard** showing the four actions with a confidence badge
  (high = `--brand-green`, medium = `--yellow`, low = `--text-muted`).
- Yellow checkmark = approval language, consistent with the in-product Signature Yellow.

### 7 — Multi-provider

- Four provider tiles (Anthropic · Google Gemini · OpenAI · Groq) as quiet monochrome
  cards; the active-selection tile shows a `--brand-green` ring.
- **Heading:** `One active model at a time. Your key, never ours.`
- Sub: You pick the provider and paste your own key. Impleo routes every call through a
  local server — the key never leaves your machine and is never sent to the browser.

### 8 — Privacy & local-first

- Two-column trust section on `--bg`. Left: three checkmarked pledges (yellow ticks):
  - `Runs on your machine — a local server, not our cloud.`
  - `Your profile & keys live in a local database, single-user.`
  - `Your data is only ever sent to the model provider you chose.`
- Right: a simple diagram — `Your Browser → localhost server → your chosen provider`.
  All `--border` hairlines, `--brand-green` arrows. No third-party cloud in the picture.

### 9 — FAQ (accordion)

- Single-column, max-width 720px, centered. Each row: question (16px medium white),
  chevron rotates 180° on open (200ms). Answer in `--text-secondary`.
- Seed questions:
  - *Does Impleo submit forms for me?* → No. Never. You always press submit.
  - *Do I need my own API key?* → Yes — bring a key from any supported provider.
  - *Where is my data stored?* → Locally, on your machine, single-user.
  - *Which forms are supported?* → Google Forms and Luma natively, generic HTML too.
  - *Is it free?* → The extension is free; you pay only your model provider's usage.

### 10 — Final CTA

- Centered, `--surface` panel inside the container with a soft `--lime` glow behind it.
- Chameleon peeks over the top edge of the panel.
- **Heading (40px):** `Stop hand-copying essays. Start applying.`
- Primary CTA **"Add to Chrome — Free"** + meta line repeating the trust triad.

### Footer

- `--jungle` background, `--text-muted` links, 4-column: Product · Docs · Privacy ·
  GitHub. Chameleon mark + "Impleo" wordmark. Fine print 12px.

---

## 6. Component Rules (page-level, extends v2)

**Buttons**
- Primary: `--brand-green` bg, `#0B0F0E` or white text (whichever passes contrast),
  10px radius, `padding: 12px 20px`, soft shadow. Hover `--brand-green-2` + `translateY(-1px)`.
- Secondary/ghost: transparent, 1px `--border`, text-primary; hover bg `--surface-hover`.
- Focus: 2px `--lime` outline, 2px offset — visible on the dark background.

**Cards**
- `--surface` bg, 12px radius, 1px `--border`. Hover → `--surface-hover` + 1px lift.
- No shadow-only cards; always the hairline border for definition.

**Badges (confidence)**
- Pill, 999px radius, 12px semibold. high `--brand-green` / medium `--yellow` /
  low `--text-muted`, each on a 12%-opacity tint of itself.

**Accordion**
- Rows divided by `--border`. Chevron 200ms rotate. One-open-at-a-time optional.

**Nav pill / links**
- text-secondary → white on hover, 150ms, no underline; active route gets a `--lime`
  2px underline.

---

## 7. Interaction & Motion

- **Scroll reveal:** sections fade + rise 8px on enter, 250ms, staggered 40ms per card.
  Gated behind `prefers-reduced-motion` (see §8).
- **Hover:** cards lift 1px; buttons shift green + lift; chameleon glow intensifies
  slightly. All ≤ 250ms, `cubic-bezier(0.4,0,0.2,1)`.
- **Hero micro-demo:** the Accept action plays a one-time yellow checkmark fade+scale.
- **No:** parallax, autoplaying video backgrounds, bounce easing, gradient animation loops.

---

## 8. Accessibility Notes

- **Contrast:** Body text uses `--white`/`--text-secondary` on `#0B0F0E`/`#171C1A` —
  passes WCAG AA. ⚠️ **Do not** put `--brand-green` (#28C94E) text on white, or white
  text on lime/yellow — those fail AA. Green/lime/yellow are for large elements, fills,
  and glyphs, never small body text on a light field. Verify every button label's
  contrast against its fill (green button → use `#0B0F0E` text if white fails).
- **Keyboard:** full tab order, visible `--lime` focus ring on every interactive
  element, accordion operable via Enter/Space, skip-to-content link.
- **Screen readers:** chameleon is decorative → `alt=""`; provider logos get text labels;
  accordion uses `aria-expanded` / `aria-controls`.
- **Touch targets:** ≥ 44×44px on mobile.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables scroll-reveal
  and the hero micro-demo — content appears immediately.

---

## 9. Responsive Strategy

| Breakpoint | Layout behavior |
|---|---|
| **Mobile ≤ 640px** | Single column. Hero stacks (copy → chameleon). How-it-works becomes a vertical timeline. Feature grid 1-col. Nav → hamburger sheet. Section padding 72px. |
| **Tablet 641–1024px** | 6-col grid. Feature grid 2-col. Hero may stay stacked or go 60/40. |
| **Desktop 1025–1440px** | Full 12-col, 1120px container. Hero 7/5 asymmetric. Feature grid 3×2. Section padding 128px. |
| **Ultra-wide > 1440px** | Container stays capped at 1120px, centered; generous side whitespace — do **not** stretch text lines. Background glows may extend full-bleed. |

Mobile-first: write base styles for mobile, layer complexity up via `min-width` queries.

---

## 10. Copy Bank (ready to paste)

- **Tagline:** *AI autofill, but you stay in control.*
- **One-liner:** *Impleo reads any application form, writes personalized answers in your
  voice, and fills them — after you approve every one.*
- **CTA:** *Add to Chrome — Free*
- **Trust triad:** *Bring your own key · Runs locally · Never auto-submits*

---

## 11. Open Questions (decide before build)

1. **Is Impleo publicly on the Chrome Web Store yet?** The "Add to Chrome" CTA implies a
   live store listing. If it's still load-unpacked only, the primary CTA should be
   "Get the extension" → install/setup docs instead.
2. **GitHub repo public?** The nav + footer assume an open repo link.
3. **Do we have a rendered product screenshot / short demo GIF** of the real side panel
   for the hero and §6, or should those use styled mock ReviewCards for v1?
4. **Framework for the actual page** — plain HTML/CSS, or reuse the extension's
   Vite + React + Tailwind stack? (This doc is framework-agnostic; tokens map cleanly
   to a Tailwind theme extension either way.)
5. **Hosting** — where does the marketing page live? (It's outside the local-first
   product constraint, so a static host like GitHub Pages/Vercel is fine.)
```
