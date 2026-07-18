// Self-contained by design: see generic-extractor.js's top comment. Every helper
// lives inside the exported function because chrome.scripting.executeScript
// serializes it via toString() and re-parses it in the page's isolated world.
//
// Why this is separate from generic-extractor.js's `upload` fieldType: that
// extractor finds native input[type=file] and stops, because filling one was
// impossible before this feature (ReviewFlow marked every upload 'unactionable').
// Upload fields need things text fields never did — the accept filter, what kind
// of document is being asked for, and whether the field is reachable at all — and
// on real ATS pages half of them aren't native inputs in the first place. This
// runs as its own pass over all platforms rather than being bolted onto three
// separate extractors.
export function detectUploadFields() {
  // Phrases that mean "give us a document". Ordered most- to least-specific so
  // classify() can return on its first hit and "upload your cover letter" is a
  // cover_letter, not a generic upload.
  const KIND_PATTERNS = [
    { kind: 'cover_letter', label: 'Cover letter', terms: ['cover letter', 'coverletter', 'motivation letter', 'statement of purpose'] },
    { kind: 'portfolio', label: 'Portfolio', terms: ['portfolio', 'work sample', 'showcase'] },
    { kind: 'cv', label: 'CV', terms: ['curriculum vitae', 'cv'] },
    { kind: 'resume', label: 'Resume', terms: ['resume', 'résumé'] },
    { kind: 'supporting', label: 'Supporting document', terms: ['supporting document', 'supporting material', 'additional document', 'attach document', 'attachment', 'transcript'] },
    { kind: 'generic', label: 'Document', terms: ['upload', 'attach', 'browse', 'choose file', 'select file', 'drag and drop', 'drop file'] },
  ];

  // Accept-attribute tokens that mean "a document", used to keep image/video
  // pickers (avatar uploaders, demo-video fields) out of the results. A field that
  // only takes PNGs is not somewhere a resume belongs.
  const DOC_ACCEPT_TOKENS = ['pdf', 'doc', 'docx', 'msword', 'wordprocessingml', 'application/*', 'text/*'];
  const NON_DOC_ACCEPT_TOKENS = ['image/', 'video/', 'audio/', '.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov', '.zip'];

  function normalize(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function classify(text) {
    const normalized = normalize(text);
    for (const pattern of KIND_PATTERNS) {
      if (pattern.terms.some((term) => normalized.includes(term))) {
        return { kind: pattern.kind, kindLabel: pattern.label };
      }
    }
    return null;
  }

  // Bare control text ("Upload", "Attach a file") is what the BUTTON says, not what
  // the FIELD is for. Treating it as the label would render three identical
  // "Upload" cards on a form asking for a resume, a cover letter, and a transcript.
  const CONTROL_ONLY = /^(upload|attach|browse|choose file|select file|add file|upload file|drag and drop|drop file here|or)\b[\s.:*]*$/;

  function isMeaningfulLabel(text) {
    const normalized = normalize(text);
    return normalized.length > 0 && normalized.length <= 160 && !CONTROL_ONLY.test(normalized);
  }

  function directText(el) {
    // Own text only — a container's textContent includes every descendant, which on
    // a dense ATS page is most of the form.
    return Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join(' ')
      .trim();
  }

  function resolveLabel(el) {
    if (el.id) {
      const labelFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelFor && isMeaningfulLabel(labelFor.textContent)) return labelFor.textContent.trim();
    }
    const aria = el.getAttribute('aria-label');
    if (aria && isMeaningfulLabel(aria)) return aria.trim();

    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      // aria-labelledby is a space-separated ID LIST, not one id — Workday and Ashby
      // both use multi-id forms ("question-label required-marker").
      const text = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((node) => node.textContent.trim())
        .join(' ');
      if (isMeaningfulLabel(text)) return text.trim();
    }

    const wrapping = el.closest('label');
    if (wrapping && isMeaningfulLabel(directText(wrapping))) return directText(wrapping);

    // Custom uploaders hide the real <input> deep inside a styled widget, so the
    // field's actual question lives on an ancestor, not a sibling. Walk up a bounded
    // number of levels and take the nearest heading/legend/own-text that reads like
    // a question rather than like a button.
    let node = el.parentElement;
    let hops = 0;
    const MAX_HOPS = 6;
    while (node && hops < MAX_HOPS) {
      const heading = node.querySelector('label, legend, h1, h2, h3, h4, h5, h6, [class*="label" i], [class*="title" i]');
      if (heading && isMeaningfulLabel(directText(heading) || heading.textContent)) {
        return (directText(heading) || heading.textContent).trim();
      }
      const own = directText(node);
      if (isMeaningfulLabel(own)) return own;
      node = node.parentElement;
      hops += 1;
    }

    // Attribute names are a last resort but often carry real intent on ATS markup
    // (name="resume", id="cover_letter_upload").
    const attr = el.getAttribute('name') || el.getAttribute('id') || '';
    if (attr) return attr.replace(/[_\-]+/g, ' ').trim();
    return 'Upload';
  }

  function acceptAllowsDocuments(accept) {
    const normalized = normalize(accept);
    if (!normalized) return true; // No filter at all — accepts anything, including PDFs.
    if (DOC_ACCEPT_TOKENS.some((t) => normalized.includes(t))) return true;
    // Only reject when the filter is exclusively non-document types.
    return !NON_DOC_ACCEPT_TOKENS.some((t) => normalized.includes(t));
  }

  // A hidden input is the NORM for custom uploaders (react-dropzone, Greenhouse,
  // Ashby all hide it behind a styled button), so invisibility must not disqualify
  // a field the way it would for a text input. Only detached/disabled ones are out.
  function isUsable(el) {
    if (el.disabled) return false;
    return el.isConnected;
  }

  // Clear stamps from any previous scan BEFORE this one starts. `counter` restarts
  // at 1 every run, so a leftover `impleo-upload-1` from a prior scan would collide
  // with this scan's first field — and file-injector's querySelector returns the
  // FIRST match in document order, which would be the stale element, attaching the
  // resume to the wrong field. Stale stamps also make passes 2/3 skip real fields
  // (they treat an already-stamped ancestor as claimed). A fresh scan owns the
  // stamps outright.
  for (const stale of Array.from(document.querySelectorAll('[data-impleo-upload-id]'))) {
    stale.removeAttribute('data-impleo-upload-id');
  }

  let counter = 0;
  function stamp(el) {
    counter += 1;
    const id = `impleo-upload-${counter}`;
    el.setAttribute('data-impleo-upload-id', id);
    return id;
  }

  const results = [];
  const claimed = new Set();

  // --- Pass 1: native file inputs -------------------------------------------
  // Covers Greenhouse, Lever, Ashby, Workday and any react-dropzone-based widget,
  // all of which keep a real input[type=file] behind whatever styling they add.
  for (const el of Array.from(document.querySelectorAll('input[type="file"]'))) {
    if (!isUsable(el)) continue;

    const accept = el.getAttribute('accept') || '';
    if (!acceptAllowsDocuments(accept)) continue;

    const label = resolveLabel(el);
    const classified = classify(`${label} ${accept} ${el.getAttribute('name') || ''} ${el.getAttribute('id') || ''}`);

    const id = stamp(el);
    // Mark the widget around the input as claimed so pass 2 doesn't report the same
    // field twice — the styled dropzone wrapping a hidden input is the same field.
    let ancestor = el.parentElement;
    let hops = 0;
    while (ancestor && hops < 6) {
      claimed.add(ancestor);
      ancestor = ancestor.parentElement;
      hops += 1;
    }

    results.push({
      id,
      selector: `[data-impleo-upload-id="${id}"]`,
      label: label,
      kind: classified ? classified.kind : 'generic',
      kindLabel: classified ? classified.kindLabel : 'Document',
      accept,
      required: Boolean(el.required),
      multiple: Boolean(el.multiple),
      strategy: 'input',
      injectable: true,
    });
  }

  // --- Pass 2: custom components with no file input ---------------------------
  // Dropzones that never render an input (they listen for `drop` and open a picker
  // on click). Injection reaches these by dispatching a synthetic drop — see
  // file-injector.js.
  //
  // Deliberately conservative: text alone is not enough (a page explaining "upload
  // your resume below" would match), so a candidate must also present itself as an
  // interactive target. False positives here are worse than misses — a bogus card
  // asks the user to approve an upload into something that isn't an upload field.
  const DROPZONE_SELECTOR = [
    '[class*="dropzone" i]',
    '[class*="drop-zone" i]',
    '[class*="file-upload" i]',
    '[class*="fileupload" i]',
    '[data-testid*="upload" i]',
    '[role="button"]',
  ].join(',');

  for (const el of Array.from(document.querySelectorAll(DROPZONE_SELECTOR))) {
    if (!isUsable(el)) continue;
    if (claimed.has(el) || el.querySelector('input[type="file"]')) continue;
    if (el.closest('[data-impleo-upload-id]')) continue;

    const text = normalize(el.textContent).slice(0, 200);
    const classified = classify(text);
    // Require an explicit upload phrase — role="button" alone matches most of the
    // page's chrome.
    if (!classified) continue;
    if (!/upload|attach|drop|drag|browse|choose file|select file/.test(text)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue; // Not a real target.

    const id = stamp(el);
    results.push({
      id,
      selector: `[data-impleo-upload-id="${id}"]`,
      label: isMeaningfulLabel(resolveLabel(el)) ? resolveLabel(el) : classified.label,
      kind: classified.kind,
      kindLabel: classified.kindLabel,
      accept: '',
      required: false,
      multiple: false,
      strategy: 'drop',
      injectable: true,
    });
  }

  // --- Pass 3: Google Forms / Drive-backed pickers ----------------------------
  // Honest reporting rather than a broken promise. A Google Forms file question
  // uploads through a Drive picker in a cross-origin iframe: there is no input to
  // set and no drop target we can reach, so injection is impossible — not merely
  // unimplemented. Surfacing the field with injectable:false tells the user which
  // document to pick and why Impleo can't do it for them, which beats silently
  // showing nothing on a form that plainly asks for a resume.
  if (location.hostname.includes('docs.google.com')) {
    for (const el of Array.from(document.querySelectorAll('[role="listitem"]'))) {
      if (el.querySelector('[data-impleo-upload-id]')) continue;
      const text = normalize(el.textContent);
      if (!/add file|upload file|your files/.test(text)) continue;

      const heading = el.querySelector('[role="heading"]');
      const label = heading && isMeaningfulLabel(heading.textContent) ? heading.textContent.trim() : 'File upload';
      const classified = classify(label) || { kind: 'generic', kindLabel: 'Document' };

      const id = stamp(el);
      results.push({
        id,
        selector: `[data-impleo-upload-id="${id}"]`,
        label,
        kind: classified.kind,
        kindLabel: classified.kindLabel,
        accept: '',
        required: false,
        multiple: false,
        strategy: 'drive-picker',
        injectable: false,
        reason: 'Google Forms uploads go through a Google Drive picker that extensions cannot reach.',
      });
    }
  }

  return results;
}
