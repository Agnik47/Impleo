// Self-contained by design: chrome.scripting.executeScript serializes this
// function via toString() and re-parses it inside the target page's
// isolated world, so it cannot reference anything outside its own body.
export function extractGenericForm() {
  // Matches text that is ONLY a required-field marker (an asterisk/bullet,
  // maybe repeated, maybe with whitespace) and nothing else — used to skip
  // over a marker rendered as its own DOM node (a separate <span>*</span>
  // sibling of the real label) instead of mistaking it for the label itself.
  const MARKER_ONLY_RE = /^[\s*✱•·]+$/;
  // Strips a trailing marker segment off an otherwise-real label (e.g.
  // "Tech Stack *" -> "Tech Stack") so the required asterisk isn't shown
  // twice when the UI also renders its own "*" for required fields.
  const TRAILING_MARKER_RE = /[\s]*[*✱]+\s*$/;
  function stripTrailingMarker(text) {
    return String(text || '').replace(TRAILING_MARKER_RE, '').trim();
  }

  function resolveLabel(el) {
    if (el.id) {
      const labelFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelFor && labelFor.textContent.trim()) return labelFor.textContent.trim();
    }
    const wrappingLabel = el.closest('label');
    if (wrappingLabel && wrappingLabel.textContent.trim()) return wrappingLabel.textContent.trim();
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    const ariaLabelledby = el.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const referenced = document.getElementById(ariaLabelledby);
      if (referenced && referenced.textContent.trim()) return referenced.textContent.trim();
    }
    // Bounded to a few hops: a required-marker span is usually 1 hop before
    // the real label, but walking indefinitely risks grabbing unrelated text
    // (e.g. a distant page heading) on pages with sparse label markup.
    let node = el.previousElementSibling;
    let hops = 0;
    const MAX_SIBLING_HOPS = 4;
    while (node && hops < MAX_SIBLING_HOPS) {
      const text = node.textContent && node.textContent.trim();
      if (text && !MARKER_ONLY_RE.test(text)) return text;
      node = node.previousElementSibling;
      hops += 1;
    }
    // Table layouts (common on legacy/government forms): a field's label is usually
    // in a nearby cell — not a sibling of the input in the flat previousSibling sense.
    // Generic DOM structure, not a per-site rule.
    const cell = el.closest('td, th');
    if (cell) {
      const row = cell.closest('tr');
      if (row) {
        const inputsInRow = row.querySelectorAll('input, textarea, select');
        if (inputsInRow.length > 1) {
          // Multiple fields share this row (common in compact forms — several
          // label/input pairs packed side by side to save vertical space). The row's
          // first cell is only the correct label for the FIRST field in the row; for
          // every other field it would silently attribute an unrelated field's label
          // (this exact bug previously misclassified Father's Name / Mother's Name as
          // Full Name because they shared a row with the Candidate Name field). Walk
          // backward from THIS field's own cell instead, skipping empty cells and any
          // cell that itself holds another field's control (never treat another
          // field's input-cell as a label-cell).
          let node = cell.previousElementSibling;
          while (node) {
            if (
              (node.tagName === 'TD' || node.tagName === 'TH') &&
              !node.querySelector('input, textarea, select')
            ) {
              const t = node.textContent && node.textContent.trim();
              if (t) return t;
            }
            node = node.previousElementSibling;
          }
        } else {
          // Exactly one field in this row — the row's first cell is reliably its label.
          const firstCell = row.querySelector('th, td');
          if (firstCell && firstCell !== cell) {
            const t = firstCell.textContent && firstCell.textContent.trim();
            if (t) return t;
          }
        }

        const table = cell.closest('table');
        const colIndex = Array.prototype.indexOf.call(row.children, cell);
        if (table && colIndex >= 0) {
          const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
          if (headerRow && headerRow !== row && headerRow.children[colIndex]) {
            const t = headerRow.children[colIndex].textContent &&
              headerRow.children[colIndex].textContent.trim();
            if (t) return t;
          }
        }
      }
    }
    if (el.placeholder) return el.placeholder;
    if (el.name) return el.name;
    return '(unlabeled field)';
  }

  function fieldTypeFor(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'dropdown';
    const type = (el.type || 'text').toLowerCase();
    if (type === 'radio') return 'radio';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'file') return 'upload';
    return 'text';
  }

  // The stamp id carries a per-scan random nonce, not just a sequential counter.
  // A predictable id (`impleo-1`) can be pre-seeded by a malicious page onto a
  // decoy element placed earlier in the DOM; at injection time the engine's
  // selector would then also match the attacker's node and could write the user's
  // answer into it. An unguessable nonce defeats blind pre-seeding, and
  // injection-engine.js additionally refuses to fill a single-value field whose
  // selector matches more than one element, which defeats a page that copies the
  // stamp after it's applied.
  const scanNonce = (
    (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
    `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  ).replace(/-/g, '').slice(0, 16);
  let counter = 0;
  function stampId(elements) {
    counter += 1;
    const id = `impleo-${scanNonce}-${counter}`;
    elements.forEach((el) => el.setAttribute('data-impleo-id', id));
    return id;
  }

  const results = [];
  const seenNames = new Set();
  const candidates = Array.from(document.querySelectorAll('input, textarea, select'));
  const skipTypes = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

  for (const el of candidates) {
    const type = (el.type || '').toLowerCase();
    if (skipTypes.has(type) || el.disabled) continue;

    if ((type === 'radio' || type === 'checkbox') && el.name) {
      if (seenNames.has(el.name)) continue;
      seenNames.add(el.name);
      const group = candidates.filter(
        (c) => c.name === el.name && (c.type || '').toLowerCase() === type
      );
      const options = group.map((c) => resolveLabel(c));
      const fieldType = type === 'radio' ? 'radio' : group.length > 1 ? 'checkbox' : 'checkbox_single';
      const fieldset = group[0].closest('fieldset');
      const legend = fieldset && fieldset.querySelector('legend');
      const questionText = stripTrailingMarker(
        legend && legend.textContent.trim() ? legend.textContent.trim() : options[0] || el.name
      );
      const id = stampId(group);
      results.push({
        id,
        questionText,
        fieldType,
        options,
        required: group.some((c) => c.required),
        selector: `[data-impleo-id="${id}"]`,
      });
      continue;
    }

    const fieldType = fieldTypeFor(el);
    const questionText = stripTrailingMarker(resolveLabel(el));
    const options =
      fieldType === 'dropdown'
        ? Array.from(el.options || [])
            .map((o) => o.textContent.trim())
            .filter((t) => t.length > 0)
        : [];
    const id = stampId([el]);
    results.push({
      id,
      questionText,
      fieldType,
      options,
      required: Boolean(el.required),
      selector: `[data-impleo-id="${id}"]`,
    });
  }

  return results;
}
