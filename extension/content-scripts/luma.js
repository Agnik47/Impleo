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
    let node = el.previousElementSibling;
    while (node) {
      const text = textOf(node);
      if (text) return text;
      node = node.previousElementSibling;
    }
    return el.placeholder || el.name || '(unlabeled field)';
  }

  let counter = 0;
  function stampId(elements) {
    counter += 1;
    const id = `christopher-luma-${counter}`;
    elements.forEach((el) => el.setAttribute('data-christopher-id', id));
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
      const id = stampId(group);
      results.push({
        id,
        questionText: options[0] || el.name,
        fieldType,
        options,
        required: group.some((c) => c.required),
        selector: `[data-christopher-id="${id}"]`,
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
      questionText: resolveLabel(el),
      fieldType,
      options,
      required: Boolean(el.required),
      selector: `[data-christopher-id="${id}"]`,
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
      questionText: resolveLabel(container),
      fieldType,
      options,
      required: false,
      selector: `[data-christopher-id="${id}"]`,
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
      questionText: resolveLabel(combobox),
      fieldType: 'dropdown',
      options,
      required: false,
      selector: `[data-christopher-id="${id}"]`,
    });
  }

  return results;
}

// Never touches any submit control — no code path here references a
// submit button, form.submit(), or navigation, by construction.
export function fillLumaForm(approvedAnswers) {
  // React-controlled inputs (see ARCHITECTURE.md landmine #1): a plain
  // el.value assignment does not update Luma's React state because React
  // overrides the native value setter with its own for virtual-DOM diffing.
  function setNativeValue(el, value) {
    const proto =
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function labelOf(el) {
    return el.getAttribute('aria-label') || el.textContent.trim() || el.value || '';
  }

  function matchOption(elements, targetLabel) {
    const target = String(targetLabel ?? '').trim();
    let match = elements.find((el) => labelOf(el).trim() === target);
    if (match) return match;
    const lowerTarget = target.toLowerCase();
    match = elements.find((el) => {
      const l = labelOf(el).trim().toLowerCase();
      return l.length > 0 && (l.includes(lowerTarget) || lowerTarget.includes(l));
    });
    return match || null;
  }

  const report = [];

  for (const answer of approvedAnswers) {
    const { id, selector, fieldType, value } = answer;
    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length === 0) {
      report.push({ id, status: 'not_found', reason: `No element matches selector ${selector}` });
      continue;
    }

    try {
      const el = elements[0];
      const tag = el.tagName.toLowerCase();

      if ((fieldType === 'text' || fieldType === 'textarea') && (tag === 'input' || tag === 'textarea')) {
        setNativeValue(el, String(value ?? ''));
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'dropdown' && tag === 'select') {
        const options = Array.from(el.options);
        const match = matchOption(options, value, (o) => o.textContent);
        if (!match) {
          report.push({ id, status: 'no_match', reason: `No option matched "${value}"` });
          continue;
        }
        el.value = match.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'dropdown') {
        // Custom-styled dropdown: click to open, then click the visible option.
        el.click();
        const optionEls = Array.from(document.querySelectorAll('[role="option"]'));
        const target = matchOption(optionEls, value);
        if (!target) {
          report.push({ id, status: 'no_match', reason: `No option matched "${value}"` });
          continue;
        }
        target.click();
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'radio' || fieldType === 'checkbox_single') {
        const target = matchOption(elements, value);
        if (!target) {
          report.push({ id, status: 'no_match', reason: `No option matched "${value}"` });
          continue;
        }
        const alreadySet =
          target.checked === true || target.getAttribute('aria-checked') === 'true';
        if (!alreadySet) target.click();
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'checkbox') {
        const values = Array.isArray(value) ? value : [value];
        let anyMatched = false;
        for (const v of values) {
          const target = matchOption(elements, v);
          if (target) {
            anyMatched = true;
            const alreadySet = target.checked === true || target.getAttribute('aria-checked') === 'true';
            if (!alreadySet) target.click();
          }
        }
        report.push(
          anyMatched
            ? { id, status: 'filled' }
            : { id, status: 'no_match', reason: `No options matched ${JSON.stringify(values)}` }
        );
      } else if (fieldType === 'upload') {
        report.push({ id, status: 'no_match', reason: 'Upload fields cannot be filled automatically' });
      } else {
        report.push({ id, status: 'error', reason: `Unhandled fieldType/element combination: ${fieldType}/${tag}` });
      }
    } catch (err) {
      report.push({ id, status: 'error', reason: err.message });
    }
  }

  return report;
}
