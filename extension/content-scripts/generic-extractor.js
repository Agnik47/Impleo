// Self-contained by design: chrome.scripting.executeScript serializes this
// function via toString() and re-parses it inside the target page's
// isolated world, so it cannot reference anything outside its own body.
export function extractGenericForm() {
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
    let node = el.previousElementSibling;
    while (node) {
      const text = node.textContent && node.textContent.trim();
      if (text) return text;
      node = node.previousElementSibling;
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

  let counter = 0;
  function stampId(elements) {
    counter += 1;
    const id = `christopher-${counter}`;
    elements.forEach((el) => el.setAttribute('data-christopher-id', id));
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
      const questionText = legend && legend.textContent.trim() ? legend.textContent.trim() : options[0] || el.name;
      const id = stampId(group);
      results.push({
        id,
        questionText,
        fieldType,
        options,
        required: group.some((c) => c.required),
        selector: `[data-christopher-id="${id}"]`,
      });
      continue;
    }

    const fieldType = fieldTypeFor(el);
    const questionText = resolveLabel(el);
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
      selector: `[data-christopher-id="${id}"]`,
    });
  }

  return results;
}
