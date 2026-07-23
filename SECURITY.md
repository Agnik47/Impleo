# Security Policy — Impleo

Impleo is a **client-only** browser extension (Manifest V3). There is no Impleo
server, account, or backend; no analytics or telemetry. Every AI call goes
directly from the side panel to the AI provider **the user chose**, using the
**user's own** API key. This document is the security model and the record of
security decisions made before public launch. The testing plan that produced it
is `docs/Security_Testing.md`.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to **devshare69@gmail.com**
rather than opening a public issue. Include steps to reproduce and the extension
version. We aim to acknowledge within a few days.

## Threat model

**In scope**
- Malicious or compromised web pages the user runs Extract/Fill/Upload on
  (the extension can execute code in any page's DOM on user action).
- A local attacker or malicious co-installed extension reading extension storage.
- Malicious/malformed profile-import files.
- Over-exposure of the user's data to the third-party AI provider.

**Out of scope**
- The AI provider's own handling of data the user knowingly sends it (governed by
  that provider's policy). Impleo minimizes what it sends (see below).
- The legacy `server/` directory — it is **not shipped** and not part of the
  live extension. Do not deploy it.

## What has been hardened (verified in code)

- **Selector-hijack defense (form fill & document upload).** Page elements are
  stamped with a **per-scan random nonce**, not a predictable id, so a malicious
  page cannot pre-seed the marker on a decoy element. Both injectors additionally
  **refuse to act when a single-value marker matches more than one element**
  (`file-injector.js`, `injection-engine.js`), defeating a page that copies the
  marker onto a decoy to capture a value or the user's uploaded document.
- **Sensitive-PII data minimization.** Government/financial IDs (Aadhaar, PAN,
  passport, date of birth) are **never sent to the AI provider**. The model
  classifies such a field from its label; the remembered value is injected
  **locally** afterward (`generate.js` withholds `isSensitiveKey` values from the
  prompt). Non-sensitive values (name, city, email…) may still be sent.
- **No dangerous DOM sinks.** No `eval`, `new Function`, `innerHTML`,
  `document.write`, or `dangerouslySetInnerHTML` anywhere in the extension.
- **No unsafe link rendering.** User-supplied links (LinkedIn/GitHub/portfolio)
  are only ever bound to React-escaped input `value`s or injected into forms via
  DOM property setters — never rendered into an `href`, `<a>`, or `window.open`,
  so `javascript:`-URL and stored-XSS-via-render vectors are not present.
- **Import validation.** Imported JSON is structurally validated with fixed key
  whitelists before any storage write (`profileSchema.js`); no prototype-pollution
  vector (no recursive merge / `Object.assign` onto a prototype-bearing target;
  identity keys gated by `isValidKey`). Import is dry-run-previewed and requires
  explicit user confirmation.
- **Never auto-submits.** No fill/inject/upload path touches a submit control; the
  user always reviews before anything is submitted.
- **HTTPS-only egress** to the four provider hosts; the API key travels only in the
  documented auth header, nowhere else.

## Accepted risks / decisions

- **Data at rest is not encrypted.** API keys and remembered identity values live
  in plaintext in `chrome.storage.local`; documents live as raw bytes in
  IndexedDB. This is inherent to a keyless, account-less, serverless design — there
  is no server-side secret to encrypt against, and a device-local passphrase would
  add friction to a tool whose premise is "no accounts." The residual risk (a local
  attacker or malicious co-installed extension with sufficient access) is disclosed
  in the privacy policy, which also warns that the **plaintext export file** can
  contain government IDs and must be handled like a resume "or more carefully."
  *Status: accepted for launch. Revisit if a passphrase-unlock option is added.*
- **`host_permissions: ["<all_urls>"]`.** Required so the user can Extract/Fill on
  any site with an application form. Paired with `activeTab` semantics (code runs
  only on the tab the user acted on, only on user action) and no persistent content
  script. Justification is documented for Chrome Web Store review in
  `docs/CWS_SUBMISSION.md`. *Status: accepted; a narrower `activeTab`-only manifest
  remains a possible future tightening.*
- **Build-tooling advisories (`npm audit`).** The only `npm audit` findings are in
  dev/build dependencies (esbuild → vite → vite-plugin-static-copy); the esbuild
  advisory affects the **dev server only**, which is never used in production and
  never shipped in `dist/`. No runtime dependency is affected. *Status: accepted;
  not force-upgrading Vite to a breaking major for a dev-only issue.*

## Build & bundle

Production build (`npm run build`) bundles only `src/` + `content-scripts/`; the
`server/` directory is never referenced by the Vite build. Real user data
(`server/data/*.db`) is gitignored and never committed.
