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

  // Text that commonly sits BETWEEN a question and its input without being the
  // question: a sample answer ("Eg. I am available full-time in Pune..."), an
  // instruction ("If you want to share files, upload them to Drive and paste
  // the link"), a "Note:"/"Optional" aside. The sibling walk below used to
  // return the FIRST non-empty text it found, so on any page that renders a
  // hint under its question the hint BECAME the question, and the model was
  // asked to answer an example instead of the real prompt.
  const HINT_PREFIX_RE =
    /^(e\.?\s*g\.?|ex\.?|example|for example|note|hint|tip|optional|if you|please note|kindly note)\b/i;
  // A wall of prose is page copy, not a field label. Kept separate from
  // looksLikeHint because the two are rejected differently: hint text is still
  // usable as a last resort (it at least belongs to this question), whereas an
  // over-long blob is never a label and must not be offered even then — the
  // field's own name attribute is a better question than a paragraph of copy.
  const MAX_LABEL_LENGTH = 300;

  function isPlausibleLabel(text) {
    const trimmed = String(text || '').trim();
    return trimmed.length > 0 && trimmed.length <= MAX_LABEL_LENGTH && !MARKER_ONLY_RE.test(trimmed);
  }

  function looksLikeHint(text) {
    return HINT_PREFIX_RE.test(String(text || '').trim());
  }

  function isControl(node) {
    const tag = node.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    // A hidden input (CSRF token, serialized state) sits between a label and its
    // real field often enough that treating it as a field boundary would cut the
    // walk short on perfectly ordinary markup.
    return tag === 'INPUT' && (node.type || '').toLowerCase() !== 'hidden';
  }

  // True when `node` holds (or is) a form control that isn't part of the field
  // currently being labelled — meaning we've walked into a DIFFERENT field's
  // markup, where any text belongs to that field and not to ours. This is the
  // same protection the table-layout branch below already applies to cells,
  // generalized to arbitrary (non-table) markup.
  function containsForeignControl(node, ownControls) {
    if (isControl(node) && !ownControls.includes(node)) return true;
    const controls = node.querySelectorAll('input:not([type="hidden"]), textarea, select');
    for (const control of controls) {
      if (!ownControls.includes(control)) return true;
    }
    return false;
  }

  // Scans backwards over a node's previous siblings for label text, preferring
  // the nearest candidate that does NOT read like hint text. Any hint found on
  // the way is returned separately rather than discarded, so a caller can still
  // fall back to it — at LOW confidence — once every better source is exhausted.
  function scanPreviousSiblings(node, ownControls) {
    // Bounded: a required-marker span is usually 1 hop before the real label,
    // but walking indefinitely risks grabbing unrelated text (e.g. a distant
    // page heading) on pages with sparse label markup.
    const MAX_SIBLING_HOPS = 4;
    let sibling = node.previousElementSibling;
    let hops = 0;
    let hint = null;
    while (sibling && hops < MAX_SIBLING_HOPS) {
      // STOP, don't skip: crossing another field's control walking backwards
      // means everything beyond it belongs to that field. Skipping past it is
      // how a bare "<p>Full Name</p><input name=full_name><input name=email>"
      // hands "Full Name" to the email field — confidently, at 'medium'.
      // Stopping instead falls through to the name/placeholder fallback, which
      // is honestly reported as 'low'.
      if (containsForeignControl(sibling, ownControls)) break;
      const text = sibling.textContent && sibling.textContent.trim();
      if (isPlausibleLabel(text)) {
        if (!looksLikeHint(text)) return { label: text, hint };
        if (!hint) hint = text;
      }
      sibling = sibling.previousElementSibling;
      hops += 1;
    }
    return { label: null, hint };
  }

  // Walks up from a field through its wrapper elements, scanning each level's
  // previous siblings. Needed because a question is frequently a sibling of the
  // input's WRAPPER (a bordered box, a grid cell, a styled control container)
  // rather than of the input itself — in which case the input has no previous
  // sibling at all and the scan above finds nothing.
  //
  // Stops at the first ancestor that also holds another field's control: past
  // that boundary the preceding text belongs to that other field, and
  // attributing it here is exactly how one field's label ends up on another.
  function scanAncestorSiblings(startEl, ownControls) {
    const MAX_ASCEND_LEVELS = 3;
    let node = startEl;
    let level = 0;
    let hint = null;
    while (node && level < MAX_ASCEND_LEVELS) {
      const parent = node.parentElement;
      if (!parent || parent === document.body || containsForeignControl(parent, ownControls)) break;
      const found = scanPreviousSiblings(parent, ownControls);
      if (found.label) return { label: found.label, hint: hint || found.hint };
      if (!hint) hint = found.hint;
      node = parent;
      level += 1;
    }
    return { label: null, hint };
  }

  // Returns { text, confidence } — confidence reflects how trustworthy the
  // source is: 'high' for an explicit label association, 'medium' for a
  // positional/structural guess, 'low' for a last-resort fallback that isn't
  // really a label at all (hint text/placeholder/name/none). Callers that only
  // need the text (e.g. resolving one option's own label inside a
  // radio/checkbox group) use the resolveLabel(el) wrapper below.
  //
  // `ownControls` names every control belonging to the field being labelled (a
  // single input, or all members of a radio/checkbox group) so the positional
  // walks can tell "still inside my own field" from "now inside someone else's".
  function resolveLabelWithConfidence(el, ownControls) {
    const own = ownControls || [el];
    if (el.id) {
      const labelFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelFor && labelFor.textContent.trim()) return { text: labelFor.textContent.trim(), confidence: 'high' };
    }
    const wrappingLabel = el.closest('label');
    if (wrappingLabel && wrappingLabel.textContent.trim()) return { text: wrappingLabel.textContent.trim(), confidence: 'high' };
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return { text: ariaLabel.trim(), confidence: 'high' };
    const ariaLabelledby = el.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const referenced = document.getElementById(ariaLabelledby);
      if (referenced && referenced.textContent.trim()) return { text: referenced.textContent.trim(), confidence: 'high' };
    }
    const siblingScan = scanPreviousSiblings(el, own);
    if (siblingScan.label) return { text: siblingScan.label, confidence: 'medium' };
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
              if (t) return { text: t, confidence: 'medium' };
            }
            node = node.previousElementSibling;
          }
        } else {
          // Exactly one field in this row — the row's first cell is reliably its label.
          const firstCell = row.querySelector('th, td');
          if (firstCell && firstCell !== cell) {
            const t = firstCell.textContent && firstCell.textContent.trim();
            if (t) return { text: t, confidence: 'medium' };
          }
        }

        const table = cell.closest('table');
        const colIndex = Array.prototype.indexOf.call(row.children, cell);
        if (table && colIndex >= 0) {
          const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
          if (headerRow && headerRow !== row && headerRow.children[colIndex]) {
            const t = headerRow.children[colIndex].textContent &&
              headerRow.children[colIndex].textContent.trim();
            if (t) return { text: t, confidence: 'medium' };
          }
        }
      }
    }
    // Tried only after the structural sources above: the question is often a
    // sibling of the input's WRAPPER rather than of the input, which is why a
    // boxed/styled control can look completely unlabeled to the scan above.
    const ancestorScan = scanAncestorSiblings(el, own);
    if (ancestorScan.label) return { text: ancestorScan.label, confidence: 'medium' };

    // Last resort before the non-label fallbacks: the hint line the walks
    // deliberately passed over. It's still closer to the question than a
    // placeholder is, but it is NOT the question — reported LOW so the review
    // UI flags it as uncertain instead of presenting it as a resolved label.
    const hintText = siblingScan.hint || ancestorScan.hint;
    if (hintText) return { text: hintText, confidence: 'low' };

    if (el.placeholder) return { text: el.placeholder, confidence: 'low' };
    if (el.name) return { text: el.name, confidence: 'low' };
    return { text: '(unlabeled field)', confidence: 'low' };
  }

  function resolveLabel(el) {
    return resolveLabelWithConfidence(el).text;
  }

  // The heading that labels a whole radio/checkbox GROUP.
  //
  // <legend> is the semantic answer, but most modern form UIs don't use
  // <fieldset> at all — the group's heading is a plain <div>/<p>/<h4> above the
  // options. A legend-less group used to fall straight through to options[0],
  // so THE FIRST OPTION'S OWN TEXT became the question ("Yes, I am available to
  // join immediately" in place of "Confirm your availability"), and it was
  // reported at the confidence of that option's own label — usually 'high' —
  // so nothing marked it for review and the model answered a question the form
  // never asked.
  //
  // Returns null when no heading can be found, leaving the caller to fall back
  // to options[0] explicitly (and at LOW confidence).
  function resolveGroupLabel(group) {
    const fieldset = group[0].closest('fieldset');
    const legend = fieldset && fieldset.querySelector('legend');
    if (legend && legend.textContent.trim()) {
      return { text: legend.textContent.trim(), confidence: 'high' };
    }

    // ARIA group semantics are as explicit as a <legend> and just as trustworthy.
    const groupBox = group[0].closest('[role="radiogroup"], [role="group"], fieldset');
    if (groupBox) {
      const ariaLabel = groupBox.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.trim()) return { text: ariaLabel.trim(), confidence: 'high' };
      const ariaLabelledby = groupBox.getAttribute('aria-labelledby');
      if (ariaLabelledby) {
        const text = ariaLabelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .filter(Boolean)
          .map((node) => node.textContent.trim())
          .filter(Boolean)
          .join(' ');
        if (text) return { text, confidence: 'high' };
      }
    }

    // The smallest element containing every option — the block a heading would
    // sit above (or, when the heading is inside it, ahead of the first option).
    let container = group[0];
    while (container.parentElement && !group.every((c) => container.contains(c))) {
      container = container.parentElement;
    }

    // Case 1: the heading is INSIDE the container, above the first option.
    let firstBlock = group[0];
    while (firstBlock.parentElement && firstBlock.parentElement !== container) {
      firstBlock = firstBlock.parentElement;
    }
    const innerScan =
      firstBlock === container ? { label: null, hint: null } : scanPreviousSiblings(firstBlock, group);
    if (innerScan.label) return { text: innerScan.label, confidence: 'medium' };

    // Case 2: the heading is a sibling of the container, or of one of its wrappers.
    const siblingScan = scanPreviousSiblings(container, group);
    if (siblingScan.label) return { text: siblingScan.label, confidence: 'medium' };
    const ancestorScan = scanAncestorSiblings(container, group);
    if (ancestorScan.label) return { text: ancestorScan.label, confidence: 'medium' };

    const hintText = innerScan.hint || siblingScan.hint || ancestorScan.hint;
    if (hintText) return { text: hintText, confidence: 'low' };
    return null;
  }

  // Help/description text via aria-describedby only -- deliberately no
  // sibling-text fallback. Unlike resolveLabel (which already walks
  // previousElementSibling for the label itself), a NEXT-sibling walk for
  // description text has no reliable "this is help text, not the next
  // field's own label" signal on arbitrary generic HTML, and a wrong
  // description would actively mislead the user reviewing the answer --
  // worse than having none.
  function resolveDescription(el) {
    const describedBy = el && el.getAttribute('aria-describedby');
    if (!describedBy) return undefined;
    const text = describedBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .join(' ');
    return text || undefined;
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
  // range/color are unambiguously not application-form inputs (a volume
  // slider, a theme picker) and are safe to exclude outright. date/tel/search
  // etc. stay included — those ARE legitimate on real forms (DOB, phone,
  // autocomplete fields), so ruling out an irrelevant PAGE is the relevance
  // heuristic's job (lib/formRelevance.js), not further type exclusion here.
  const skipTypes = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'range', 'color']);

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
      const firstOption = resolveLabelWithConfidence(group[0]);
      // A lone checkbox ("I agree to the terms") has no group heading to look
      // for — its own label genuinely IS the question, which options[0] already
      // holds. Only a real multi-option group needs a heading resolved.
      const groupLabel = group.length > 1 ? resolveGroupLabel(group) : null;
      let questionText;
      let labelConfidence;
      if (groupLabel) {
        questionText = stripTrailingMarker(groupLabel.text);
        labelConfidence = groupLabel.confidence;
      } else if (options[0]) {
        questionText = stripTrailingMarker(options[0]);
        // LOW for a multi-option group even when option 1's own label resolved
        // confidently: resolving that label says nothing about whether it is the
        // group's QUESTION, and here we already know it isn't one — no heading
        // was found. Reporting the option's own confidence is what previously
        // let a wrong question through the review UI unflagged.
        labelConfidence = group.length > 1 ? 'low' : firstOption.confidence;
      } else {
        questionText = stripTrailingMarker(el.name);
        labelConfidence = 'low';
      }
      const description = resolveDescription(fieldset || group[0]);
      const id = stampId(group);
      results.push({
        id,
        questionText,
        fieldType,
        options,
        required: group.some((c) => c.required),
        selector: `[data-impleo-id="${id}"]`,
        labelConfidence,
        ...(description ? { description } : {}),
      });
      continue;
    }

    const fieldType = fieldTypeFor(el);
    const resolved = resolveLabelWithConfidence(el);
    const questionText = stripTrailingMarker(resolved.text);
    const description = resolveDescription(el);
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
      labelConfidence: resolved.confidence,
      ...(description ? { description } : {}),
    });
  }

  return results;
}
