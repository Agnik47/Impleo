# BACKEND_VERIFICATION.md — Service Layer Verification

Christopher has no traditional server, but `background.js` + `lib/storage.js`
play that role: they own the API key, make the only network calls, and hold
persistent state. Treat them with the same rigor you'd give a real backend —
this checklist is the thing standing between "looks like it works" and
"actually safe and correct to use with your real data."

Work through every item against **real** data and **real** pages — not mocked
fixtures. Check items off only when personally verified, not when the code
merely looks right.

---

## 1. Storage layer (`lib/storage.js`)

- [ ] `saveProfile()` → `getProfile()` round-trips exactly (no field loss,
      no type coercion issues — arrays stay arrays, objects stay objects)
- [ ] `saveApiKey()` → `getApiKey()` round-trips exactly
- [ ] `appendQaHistory()` correctly caps at 50 entries — verify by appending
      55 entries and confirming only the most recent 50 remain
- [ ] `isOnboarded()` returns `false` on a fresh install (no profile, no key)
      and `true` only once both exist
- [ ] Reloading the extension (not just the side panel — actually removing
      and re-loading unpacked) preserves all saved data
- [ ] No other file in the repo calls `chrome.storage.*` directly — grep for
      `chrome.storage` outside `lib/storage.js` and confirm zero results

## 2. API key handling

- [ ] The API key is never logged to any console, anywhere in the codebase —
      grep for `console.log` near any variable holding the key
- [ ] The API key is never included in any `chrome.runtime.sendMessage`
      payload sent *to* the side panel or content scripts — it should only
      ever be read inside `background.js` via `getApiKey()` and used
      directly in the `fetch()` call, never passed around
- [ ] `TEST_API_KEY` correctly distinguishes an invalid key (401/403 from
      Anthropic) from a network failure (fetch throws) — the user-facing
      error message should differ meaningfully between these two cases
- [ ] A request made with a valid key but no `anthropic-dangerous-direct-browser-access`
      header is confirmed to fail (sanity-check that this header is actually
      required and not silently doing nothing)

## 3. Generation quality & grounding (`GENERATE_ANSWERS`)

This is the highest-value check in this entire document — a technically
correct pipeline that produces fabricated content is worse than a broken one,
because it looks trustworthy.

- [ ] Run against a real extracted form schema with a real filled profile.
      Read every single generated answer line by line.
- [ ] For each answer, confirm every fact/claim traces back to something
      literally present in the stored profile (no invented company names,
      metrics, dates, awards, or experience)
- [ ] Confirm static fields (name, email, phone) are copied verbatim, not
      paraphrased or reformatted unexpectedly
- [ ] Confirm every radio/checkbox/dropdown answer is an exact string match
      (or clearly resolvable substring match) against the `options` array
      provided in the schema — an answer that doesn't correspond to any real
      option will silently fail to fill later
- [ ] Confirm `confidence` values look reasonable — "high" answers should
      actually have solid profile grounding, "low" should correspond to
      genuinely thin profile data on that topic
- [ ] Test with a deliberately sparse/incomplete profile (missing goals,
      missing projects) — confirm the model gracefully writes general
      answers rather than fabricating specifics to fill the gap

## 4. Error handling & resilience

- [ ] Malformed/non-JSON response from Claude (simulate by temporarily
      lowering `max_tokens` so a response gets cut off mid-JSON) produces a
      readable error in the side panel, not a silent failure or raw
      `[object Object]`
- [ ] A network failure (e.g. toggle Chrome to offline mode mid-request)
      surfaces a clear error rather than hanging indefinitely
- [ ] `chrome.runtime.onMessage` handlers that do async work all correctly
      `return true` — grep every handler and confirm this explicitly, this
      is a well-known MV3 footgun that silently drops responses if missed
- [ ] Extraction against a page with zero matching fields (e.g. a page with
      no form at all) returns an empty list gracefully, not a thrown error

## 5. Fill safety (the most important category)

- [ ] Across all three fillers (generic, Google Forms, Luma), grep the code
      for any reference to a submit button, `form.submit()`, `.click()` on
      anything with `type="submit"`, or navigation calls — confirm none
      exist
- [ ] Confirm a "no_match" or "not_found" field status never causes the
      filler to guess/fill a different field instead — it should report
      the miss and stop for that field, not fall through to something else
- [ ] Confirm re-running Fill twice in a row on the same form doesn't
      duplicate content in text fields (e.g. doesn't append instead of
      replacing)

## 6. Cost & rate sanity (informal, but worth a gut-check)

- [ ] Note the approximate token count of one full GENERATE_ANSWERS call
      (profile + schema + history) — confirm it's not accidentally sending
      the entire resume text multiple times or duplicating the profile in
      the prompt
- [ ] Confirm `qaHistory` is capped (see §1) so the prompt doesn't grow
      unbounded in size/cost over months of use

## 7. Cross-context console check

- [ ] Zero errors in the side panel's DevTools console during a full
      extract → generate → review → fill cycle
- [ ] Zero errors in the service worker's console (`chrome://extensions` →
      "service worker" link) during the same cycle — this is a separate
      console from the side panel's and errors here are easy to miss
