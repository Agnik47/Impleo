// Self-contained by design: see generic-extractor.js's top comment.
//
// NOT YET VERIFIED AGAINST A REAL LUMA EVENT PAGE — this is the least
// certain of the three extractors/fillers. No live Luma DOM was inspected
// while writing this (no real event URL was available); it combines native
// form-element handling (same label-resolution as generic-extractor.js)
// with ARIA-role-based custom components ([role="radio"], [role="checkbox"],
// [role="combobox"]/[role="option"]), since Luma is documented to use
// custom-styled controls rather than native <select>. Per AGENTS.md's
// definition of done, this must be inspected against a real Luma event with
// custom registration questions and its selectors corrected before use.
export function extractLumaForm() {
  function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  // Matches text that is ONLY a required-field marker (an asterisk/bullet,
  // maybe repeated, maybe with whitespace) — used to skip over a marker
  // rendered as its own DOM node (a separate <span>*</span> sibling of the
  // real label) instead of mistaking it for the label itself.
  const MARKER_ONLY_RE = /^[\s*✱•·]+$/;
  // Strips a trailing marker segment off an otherwise-real label so the
  // required asterisk isn't shown twice when the UI also renders its own
  // "*" for required fields.
  const TRAILING_MARKER_RE = /[\s]*[*✱]+\s*$/;
  function stripTrailingMarker(text) {
    return String(text || '').replace(TRAILING_MARKER_RE, '').trim();
  }

  function resolveLabel(el) {
    if (el.id) {
      const labelFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelFor && textOf(labelFor)) return textOf(labelFor);
    }
    const wrappingLabel = el.closest('label');
    if (wrappingLabel && textOf(wrappingLabel)) return textOf(wrappingLabel);
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    const ariaLabelledby = el.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const referenced = document.getElementById(ariaLabelledby);
      if (referenced && textOf(referenced)) return textOf(referenced);
    }
    // Bounded to a few hops: a required-marker span is usually 1 hop before
    // the real label, but walking indefinitely risks grabbing unrelated text
    // (e.g. the page's own event-title heading) when there's no close label —
    // this previously mislabeled a field with distant page content.
    let node = el.previousElementSibling;
    let hops = 0;
    const MAX_SIBLING_HOPS = 4;
    while (node && hops < MAX_SIBLING_HOPS) {
      const text = textOf(node);
      if (text && !MARKER_ONLY_RE.test(text)) return text;
      node = node.previousElementSibling;
      hops += 1;
    }
    return el.placeholder || el.name || '(unlabeled field)';
  }

  let counter = 0;
  function stampId(elements) {
    counter += 1;
    const id = `impleo-luma-${counter}`;
    elements.forEach((el) => el.setAttribute('data-impleo-id', id));
    return id;
  }

  const results = [];
  const seenNames = new Set();

  // Native form elements (text/textarea/select/native radio-checkbox).
  const nativeCandidates = Array.from(document.querySelectorAll('input, textarea, select'));
  const skipTypes = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

  for (const el of nativeCandidates) {
    const type = (el.type || '').toLowerCase();
    if (skipTypes.has(type) || el.disabled) continue;

    if ((type === 'radio' || type === 'checkbox') && el.name) {
      if (seenNames.has(el.name)) continue;
      seenNames.add(el.name);
      const group = nativeCandidates.filter((c) => c.name === el.name && (c.type || '').toLowerCase() === type);
      const options = group.map((c) => resolveLabel(c));
      const fieldType = type === 'radio' ? 'radio' : group.length > 1 ? 'checkbox' : 'checkbox_single';
      // The first option's own label is a last-resort fallback, not the group's
      // question -- prefer a real fieldset/legend, then the label of the group's
      // nearest common-ancestor container (same lookup the custom ARIA groups
      // below already use for their container), before falling back to it.
      const fieldset = group[0].closest('fieldset');
      const legend = fieldset && textOf(fieldset.querySelector('legend'));
      let groupContainer = group[0].parentElement;
      for (const c of group.slice(1)) {
        while (groupContainer && !groupContainer.contains(c)) groupContainer = groupContainer.parentElement;
      }
      const groupLabel = groupContainer ? resolveLabel(groupContainer) : null;
      const questionText = stripTrailingMarker(
        legend || (groupLabel && groupLabel !== '(unlabeled field)' ? groupLabel : null) || options[0] || el.name
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

    const tag = el.tagName.toLowerCase();
    const fieldType = tag === 'textarea' ? 'textarea' : tag === 'select' ? 'dropdown' : type === 'file' ? 'upload' : 'text';
    const options =
      fieldType === 'dropdown'
        ? Array.from(el.options || []).map((o) => textOf(o)).filter(Boolean)
        : [];
    const id = stampId([el]);
    results.push({
      id,
      questionText: stripTrailingMarker(resolveLabel(el)),
      fieldType,
      options,
      required: Boolean(el.required),
      selector: `[data-impleo-id="${id}"]`,
    });
  }

  // Custom-styled ARIA components (Luma's own radio/dropdown widgets).
  const customGroups = new Map();
  for (const el of document.querySelectorAll('[role="radio"], [role="checkbox"]')) {
    const groupKey = el.getAttribute('role') + '::' + (el.closest('[role="radiogroup"]') || el.parentElement);
    if (!customGroups.has(groupKey)) customGroups.set(groupKey, []);
    customGroups.get(groupKey).push(el);
  }
  for (const [groupKey, elements] of customGroups) {
    const role = groupKey.startsWith('radio') ? 'radio' : 'checkbox';
    const container = elements[0].closest('[role="radiogroup"]') || elements[0].parentElement;
    const options = elements.map((el) => el.getAttribute('aria-label') || textOf(el));
    const fieldType = role === 'radio' ? 'radio' : elements.length > 1 ? 'checkbox' : 'checkbox_single';
    const id = stampId(elements);
    results.push({
      id,
      questionText: stripTrailingMarker(resolveLabel(container)),
      fieldType,
      options,
      required: false,
      selector: `[data-impleo-id="${id}"]`,
    });
  }

  for (const combobox of document.querySelectorAll('[role="combobox"]')) {
    const optionsContainerId = combobox.getAttribute('aria-controls') || combobox.getAttribute('aria-owns');
    const optionsContainer = optionsContainerId ? document.getElementById(optionsContainerId) : null;
    const options = optionsContainer
      ? Array.from(optionsContainer.querySelectorAll('[role="option"]')).map(textOf).filter(Boolean)
      : [];
    const id = stampId([combobox]);
    results.push({
      id,
      questionText: stripTrailingMarker(resolveLabel(combobox)),
      fieldType: 'dropdown',
      options,
      required: false,
      selector: `[data-impleo-id="${id}"]`,
    });
  }

  return results;
}
