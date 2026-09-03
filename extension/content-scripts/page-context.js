// Extracts a short description of WHAT is being applied to.
//
// Until now the model was told the questions and nothing else. "Why do you
// want to join?" was answered with no idea what "join" referred to, which is
// why those answers came back as generic enthusiasm — there was nothing
// specific available to be specific about.
//
// This is deliberately small. It is not a scraper and not a readability
// extraction: it takes the page's own self-description (title, og:site_name,
// meta description, the h1, and the most substantial paragraph before the
// form) and caps the result hard. The model needs enough to know "this is a
// climate-tech fellowship run by X, twelve weeks, for early-career engineers".
// It does not need the page.
//
// SELF-CONTAINED, no closures over outer scope: MV3 serializes this function
// body via toString() and re-parses it in the page's isolated world, so every
// helper has to be defined inside (AGENTS.md's serialization rule).
//
// PRIVACY: this is the first thing that sends page CONTENT to the third-party
// provider — everything before it sent only the questions. It is gated by a
// user-facing setting and disclosed in SECURITY.md and the privacy policy.
// Keep the cap tight and keep it to self-description; do not extend this to
// grab arbitrary page text.

export function extractPageContext() {
  const MAX_TOTAL = 1200;
  const MAX_BLOCK = 600;

  const clean = (s) =>
    String(s || '')
      .replace(/\s+/g, ' ')
      .trim();

  const metaContent = (selector) => {
    const el = document.querySelector(selector);
    return el ? clean(el.getAttribute('content')) : '';
  };

  // Skip boilerplate that describes the site rather than the opportunity.
  const isNoise = (text) => {
    const t = text.toLowerCase();
    return (
      t.length < 40 ||
      t.includes('cookie') ||
      t.includes('privacy policy') ||
      t.includes('terms of service') ||
      t.includes('all rights reserved') ||
      t.includes('enable javascript')
    );
  };

  const visible = (el) => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const orgName =
    metaContent('meta[property="og:site_name"]') ||
    clean(document.querySelector('header a[href="/"]')?.textContent) ||
    '';

  const headline = clean(document.querySelector('h1')?.textContent);

  const metaDescription =
    metaContent('meta[name="description"]') || metaContent('meta[property="og:description"]');

  // The best in-page description is usually the longest paragraph that sits
  // ABOVE the form — the pitch you read before deciding to apply. Anything
  // after the form is normally footer boilerplate.
  let aboutText = '';
  const form = document.querySelector('form') || document.querySelector('[role="list"]');
  const paragraphs = Array.from(document.querySelectorAll('p, li'));
  const candidates = [];
  for (const p of paragraphs) {
    if (form && !(form.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
    if (!visible(p)) continue;
    const text = clean(p.textContent);
    if (isNoise(text)) continue;
    candidates.push(text);
  }
  candidates.sort((a, b) => b.length - a.length);
  aboutText = (candidates[0] || '').slice(0, MAX_BLOCK);

  // Fall back to the meta description when the page has no readable prose
  // above the form (common on bare Google Forms and single-purpose ATS pages).
  if (!aboutText) aboutText = metaDescription.slice(0, MAX_BLOCK);

  const context = {
    title: clean(document.title).slice(0, 200),
    url: '',
    orgName: orgName.slice(0, 100),
    headline: headline.slice(0, 200),
    aboutText,
  };

  // Hard overall cap, trimming the most expendable field first, so a verbose
  // page can never balloon the prompt.
  const size = () => context.title.length + context.orgName.length + context.headline.length + context.aboutText.length;
  if (size() > MAX_TOTAL) {
    context.aboutText = context.aboutText.slice(0, Math.max(0, MAX_TOTAL - (size() - context.aboutText.length)));
  }

  return context;
}
