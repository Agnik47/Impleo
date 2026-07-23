# Impleo — SEO & Discoverability Plan

**Live site:** https://impleo-snowy.vercel.app
**Repo:** https://github.com/Agnik47/Impleo
**Goal:** When people search Google for **Impleo**, **AI form filler / AI autofill**, and
related intent phrases, the Impleo **landing page and GitHub repo** should appear.

This is a living document. Sections marked ✅ are done in code; ⏳ are manual steps
you run (Google/GitHub UIs) that can't be done from the repo.

---

## 1. The core problem (why we were invisible)

The landing page is a **client-rendered React SPA** (Vite + three.js + GSAP + a loading
screen). The HTML that ships was an empty `<div id="root"></div>` — every word of copy is
painted in by JavaScript. Google *can* run JS, but it does so slowly, on a delay, and
unreliably; many crawlers and link-preview bots don't run it at all. So the page had
**no indexable text**, plus it was missing sitemap, robots, structured data, social tags,
and was never registered with Google Search Console.

We fixed the on-page side by embedding a **static, crawlable content mirror** inside
`#root` (React replaces it on mount, so users still get the full SPA), plus full meta and
structured data. The remaining work is **off-page** (Search Console, backlinks) — that's
what actually gets you crawled and ranked.

---

## 2. Keyword strategy (be realistic)

### ⚠️ Reality check (observed 2026-07-24)
A Google search for `impleo form fillup ai` returned **impleo.ai — "Impleo AI", an
established SAP-consultant AI copilot** — ranking #1 for both "impleo" and our exact
query. Google's AI Overview names them as the recognized "Impleo" entity and does not
mention us at all. Takeaways:
- **We do NOT yet appear** because the site is not indexed — nobody has submitted it to
  Google Search Console (see §5). This is the blocker, not a code problem. Confirm with a
  `site:impleo-snowy.vercel.app` search: currently returns nothing = not indexed.
- **Bare "impleo" is contested.** impleo.ai owns the exact `.ai` domain and an established
  entity; outranking them for the single word "impleo" from a `vercel.app` subdomain is
  slow-to-unlikely. Don't target it head-on.
- **A custom domain is the biggest branding lever** (deferred by choice for now). Revisit
  `getimpleo.com` / `useimpleo.com` / `impleo.app` if branded ranking stalls.

### Tier 1 — Branded-product (the realistic branded wins)
Pair "impleo" with the product category so we don't collide with the SAP tool:
`impleo form filler` · `impleo autofill` · `impleo chrome extension` ·
`impleo form filler extension` · `impleo github`
> The `<title>`, H1, and lead paragraph now pair "Impleo" with "form filler / autofill /
> Chrome extension" specifically to win these, backed by the `SoftwareApplication`
> structured data. This is where branded traffic realistically comes from near-term.

### Tier 2 — Long-tail intent (the real traffic; achievable)
- `AI autofill for application forms`
- `AI form filler that never auto-submits`
- `fill Google Forms with AI`
- `AI to fill out application forms`
- `open source AI form autofill`
- `bring your own key form filler`
- `AI for hackathon / fellowship / scholarship applications`
- `local-first AI autofill Chrome extension`

### Tier 3 — Head terms (do NOT chase head-on)
`ai form filler`, `ai autofill`, `autofill extension` — dominated by funded competitors
(Simplify, Teal, LazyApply, Sonara). We rank for these *eventually*, as a side effect of
winning Tier 2 + authority, not by targeting them directly.

**Primary phrase to weave everywhere:** *"AI autofill for application forms."*

---

## 3. On-page SEO — DONE ✅ (in `landing/`)

| Item | File | Status |
|---|---|---|
| `<title>` (fixed 10s/30s mismatch → "under 10 seconds") | `landing/index.html` | ✅ |
| Meta description, keywords, author, theme-color, robots | `landing/index.html` | ✅ |
| Canonical URL | `landing/index.html` | ✅ |
| Open Graph tags (type, site_name, title, desc, url, image) | `landing/index.html` | ✅ |
| Twitter Card tags | `landing/index.html` | ✅ |
| `SoftwareApplication` JSON-LD (entity + free/MIT offer) | `landing/index.html` | ✅ |
| `FAQPage` JSON-LD (6 Q&As, rich-snippet eligible) | `landing/index.html` | ✅ |
| **Crawlable static content mirror** inside `#root` (H1, one-liner, 5-step pipeline, privacy, providers, forms, FAQ) | `landing/index.html` | ✅ |
| `robots.txt` (allow all + sitemap pointer) | `landing/public/robots.txt` | ✅ |
| `sitemap.xml` (homepage + privacy) | `landing/public/sitemap.xml` | ✅ |
| Privacy policy as a real indexable HTML page | `landing/public/privacy-policy.html` | ✅ |
| Apple touch icon | `landing/index.html` | ✅ |
| **`og-image.png` (1200×630)** social card — wordmark, tagline, mascot, trust chips | `landing/public/og-image.png` | ✅ |

### Still to do on-page ⏳
- **Keep the mirror in sync:** if you change the H1, FAQ, pipeline steps, or providers in
  `src/lib/constants.js` or the section components, update the matching copy in
  `index.html` (both the visible fallback block **and** the `FAQPage` JSON-LD).

### Note on Core Web Vitals (ranking factor)
three.js + GSAP + the full-screen loading screen are heavy. Not being re-architected now
(chosen scope = tags + content, keep the SPA). If rankings stall, the highest-leverage
performance fixes are: lazy-load the WebGL canopy, defer non-critical JS, and make sure the
loading screen never removes the static `#root` content from the DOM before paint.

---

## 4. GitHub repo optimization ⏳ (do this on github.com — 5 minutes)

The repo is a high-authority page that ranks well for niche + branded queries. Right now
its ranking levers are unused.

1. **About panel → Description** (click the ⚙ next to "About"):
   > Impleo — AI autofill for application forms. Reads any form, writes answers in your voice, fills only what you approve. Never auto-submits. BYOK, local-first, MIT.
2. **About panel → Website:** `https://impleo-snowy.vercel.app`
3. **Topics** (the "Add topics" field — currently empty, this matters a lot):
   `chrome-extension` `ai` `autofill` `form-filler` `manifest-v3` `openai` `anthropic`
   `claude` `gemini` `groq` `productivity` `job-applications` `google-forms` `local-first`
   `bring-your-own-key` `react`
4. **Confirm the repo is Public** (Settings → General). Google can't index a private repo.
5. **README:** already strong. Confirm the first paragraph contains "AI autofill for
   application forms", all screenshot `alt` text is descriptive, and there's a link to the
   live landing page near the top.
6. **Settings → Social preview:** upload the same `og-image.png` so shared repo links look right.

---

## 5. Off-page & indexing ⏳ (this is what actually gets you ranked)

Ordered by impact.

1. **Google Search Console — do this first.** https://search.google.com/search-console
   - Add property for `impleo-snowy.vercel.app` (URL-prefix; verify via the HTML-tag or DNS
     method — Vercel makes the tag method easy).
   - Submit `https://impleo-snowy.vercel.app/sitemap.xml`.
   - Use **URL Inspection → Request indexing** on the homepage and the privacy page.
   - Without this, Google may take weeks to find the site or never prioritize it.
2. **Bing Webmaster Tools** — https://www.bing.com/webmasters — import from Search Console,
   submit the same sitemap. Powers Bing + DuckDuckGo. Quick win.
3. **Backlinks / entity signals** (each adds a `sameAs` and referral trail). These work
   **today** with the clone-and-run GitHub install:
   - A `dev.to` or Hashnode write-up: "I built an open-source AI autofill that never
     submits your forms" → link the site + repo.
   - Reddit: r/chrome_extensions, r/SideProject, r/opensource (read each sub's self-promo
     rules first).
   - Hacker News "Show HN".
   - Submit to "awesome" lists: awesome-chrome-extensions, awesome-ai-tools, etc. (PRs).
4. **Cross-link consistently:** landing ↔ GitHub ↔ (later) Chrome Web Store all point at
   each other using the exact name "Impleo" and the same description. Consistency is what
   builds the entity Google recognizes.

### The single biggest future lever: publish to the Chrome Web Store
The extension isn't on the CWS yet. When it is, the store listing becomes a major authority
source and a huge boost to branded "impleo" search — **and** it's when a Product Hunt launch
makes sense (a "clone the repo" launch converts poorly, so hold PH until then). Treat CWS
publication as the top off-page milestone. `docs/CWS_SUBMISSION.md` has the draft listing.

---

## 6. Measurement (check monthly)

- **Search Console:** Coverage/Pages → how many URLs are "Indexed"; Performance → which
  queries show impressions/clicks. First goal: homepage indexed within ~1–2 weeks of
  submitting.
- **Rank checks:** Google `site:impleo-snowy.vercel.app` (what's indexed), then `impleo`,
  `impleo github`, and a couple of Tier-2 phrases (in an incognito window).
- **Rich results:** re-run Google's Rich Results Test after any copy change to confirm
  `SoftwareApplication` + `FAQPage` still validate.

---

## 7. Verification checklist for the on-page changes

1. `cd landing && npm run build && npm run preview`, open the preview and **View Source**
   (Ctrl+U) — confirm the static content block, all meta/OG/Twitter tags, and both JSON-LD
   blocks are in the **raw** HTML (not just the DevTools Elements panel).
2. **Disable JavaScript** and reload — the H1, one-liner, pipeline, providers, and FAQ text
   must still be readable. This is exactly what a non-rendering crawler sees.
3. Paste the deployed URL into Google's **Rich Results Test** — both schemas validate.
4. Paste the deployed URL into a link-preview debugger (or Slack/X compose) — image, title,
   description render (needs `og-image.png` to exist).
5. Confirm `/robots.txt`, `/sitemap.xml`, and `/privacy-policy.html` all resolve on the live
   domain.
