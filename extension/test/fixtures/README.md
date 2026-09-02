# Golden fixtures

`schemas/*.json` are the forms every eval run is scored against. Each is one
real extraction: `{ name, platform, pageTitle, pageUrl, schema }`, where
`schema` is exactly what a content-script extractor returned.

## The two fixtures here are SYNTHETIC — replace them

They are hand-written and marked `"source": "SYNTHETIC"`. They are shaped
correctly and are good enough to develop the harness against, but they are
**not** a substitute for real captures, for one specific reason: hand-written
fixtures agree with whatever the extractor currently does. Real pages don't.
Both `content-scripts/google-forms.js` and `content-scripts/luma.js` still
carry "NOT YET VERIFIED AGAINST A REAL..." headers, and a synthetic fixture
will happily pass while the real extractor mangles a live form.

Capture real ones during the Phase 5 extractor-verification pass
(`docs/PRODUCTION_CHECKLIST.md`) — one session produces both the verified
extractor and the fixture.

## How to capture a real one

1. Open the target form in Chrome.
2. Open the side panel, then right-click it → Inspect to get its DevTools.
3. In that console, run the extraction the way `ReviewFlow.handleExtract` does:

```js
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const mod = await import('/assets/index.js'); // or paste the extractor body directly
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: extractGenericForm, // or extractGoogleForm / extractLumaForm
});
copy(JSON.stringify({
  name: 'some-slug',
  platform: 'generic',
  source: `real capture ${new Date().toISOString().slice(0, 10)}`,
  pageTitle: tab.title,
  pageUrl: tab.url,
  schema: result,
}, null, 2));
```

4. Paste into a new file in `schemas/`.

## Before committing a real capture

These files go into a repo you intend to publish. Scrub them:

- The extractor stamps a per-scan random nonce into each field's selector.
  That's fine to keep — it's random per scan and identifies nothing.
- **Check `pageUrl` for tokens.** Application links often carry an invite or
  session token in the query string. Trim the query string unless you know
  it's clean.
- If the form itself contains anything personal in its labels or option
  values, either drop the fixture or redact it. A fixture is worth far less
  than an accidental leak.

## `profile.js`

One synthetic profile, used for every fixture so scores are comparable
run to run. It has deliberately specific particulars (named projects, real
numbers) because some assertions check whether an answer actually used one —
and a distinctive writing sample, because voice matching is the thing being
measured. If you swap in your own profile for a local run, don't commit it.
