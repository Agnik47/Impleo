// Self-contained by design: see generic-extractor.js's top comment.
export function fillGenericForm(approvedAnswers) {
  // React overrides the native <input>/<textarea> value setter with its own
  // getter/setter for virtual-DOM diffing; a plain `el.value = x` bypasses
  // it and React never learns the value changed. Grabbing the native setter
  // off the prototype and dispatching input/change afterward fixes it.
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
    if (el.id) {
      const labelFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelFor && labelFor.textContent.trim()) return labelFor.textContent.trim();
    }
    const wrappingLabel = el.closest('label');
    if (wrappingLabel && wrappingLabel.textContent.trim()) return wrappingLabel.textContent.trim();
    return el.value || '';
  }

  function matchOption(elements, targetLabel, getLabel) {
    const target = String(targetLabel ?? '').trim();
    let match = elements.find((el) => getLabel(el).trim() === target);
    if (match) return match;
    const lowerTarget = target.toLowerCase();
    match = elements.find((el) => {
      const l = getLabel(el).trim().toLowerCase();
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
      if (fieldType === 'text' || fieldType === 'textarea') {
        setNativeValue(elements[0], String(value ?? ''));
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'dropdown') {
        const select = elements[0];
        const options = Array.from(select.options);
        const match = matchOption(options, value, (o) => o.textContent);
        if (!match) {
          report.push({ id, status: 'no_match', reason: `No option matched "${value}"` });
          continue;
        }
        select.value = match.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'radio' || fieldType === 'checkbox_single') {
        const target = matchOption(elements, value, labelOf);
        if (!target) {
          report.push({ id, status: 'no_match', reason: `No option matched "${value}"` });
          continue;
        }
        if (!target.checked) target.click();
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'checkbox') {
        const values = Array.isArray(value) ? value : [value];
        let anyMatched = false;
        for (const v of values) {
          const target = matchOption(elements, v, labelOf);
          if (target) {
            anyMatched = true;
            if (!target.checked) target.click();
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
        report.push({ id, status: 'error', reason: `Unknown fieldType: ${fieldType}` });
      }
    } catch (err) {
      report.push({ id, status: 'error', reason: err.message });
    }
  }

  return report;
}
