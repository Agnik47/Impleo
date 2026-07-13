// Self-contained by design: see generic-extractor.js's top comment.
//
// NOT YET VERIFIED AGAINST A REAL GOOGLE FORM. Google's class names are
// unstable and change periodically, so this matches on ARIA roles
// ([role="listitem"], [role="radio"], [role="checkbox"], [role="listbox"])
// per ARCHITECTURE.md, which is the documented stable strategy — but role
// structure can also shift between Forms releases. Per AGENTS.md's
// definition of done, this needs inspection against 2-3 real form URLs and
// selector adjustment before it's trustworthy; do not treat "the code
// exists" as "this phase is done."
export function extractGoogleForm() {
  function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function findQuestionTitle(container) {
    const heading = container.querySelector('[role="heading"]');
    if (heading && textOf(heading)) return textOf(heading);
    const leafDivs = Array.from(container.querySelectorAll('div')).filter(
      (d) => d.children.length === 0 && textOf(d).length > 0
    );
    return leafDivs.length > 0 ? textOf(leafDivs[0]) : '(unlabeled question)';
  }

  function isRequired(container) {
    return textOf(container).includes('*') || container.querySelector('[aria-label*="Required"]') !== null;
  }

  let counter = 0;
  function stampId(elements) {
    counter += 1;
    const id = `impleo-gf-${counter}`;
    elements.forEach((el) => el.setAttribute('data-impleo-id', id));
    return id;
  }

  const results = [];
  const listItems = Array.from(document.querySelectorAll('[role="listitem"]'));

  for (const item of listItems) {
    const radios = Array.from(item.querySelectorAll('[role="radio"]'));
    const checkboxes = Array.from(item.querySelectorAll('[role="checkbox"]'));
    const textInputs = Array.from(
      item.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"]')
    );
    const textareas = Array.from(item.querySelectorAll('textarea'));
    const listboxes = Array.from(item.querySelectorAll('[role="listbox"]'));
    const fileInputs = Array.from(item.querySelectorAll('input[type="file"]'));

    if (
      radios.length === 0 &&
      checkboxes.length === 0 &&
      textInputs.length === 0 &&
      textareas.length === 0 &&
      listboxes.length === 0 &&
      fileInputs.length === 0
    ) {
      continue; // section header or non-question listitem
    }

    const questionText = findQuestionTitle(item);
    const required = isRequired(item);

    if (radios.length > 0) {
      const options = radios.map((r) => r.getAttribute('aria-label') || r.getAttribute('data-value') || textOf(r));
      const id = stampId(radios);
      results.push({ id, questionText, fieldType: 'radio', options, required, selector: `[data-impleo-id="${id}"]` });
    } else if (checkboxes.length > 0) {
      const options = checkboxes.map(
        (c) => c.getAttribute('aria-label') || c.getAttribute('data-answer-value') || textOf(c)
      );
      const fieldType = checkboxes.length > 1 ? 'checkbox' : 'checkbox_single';
      const id = stampId(checkboxes);
      results.push({ id, questionText, fieldType, options, required, selector: `[data-impleo-id="${id}"]` });
    } else if (listboxes.length > 0) {
      const listbox = listboxes[0];
      const options = Array.from(listbox.querySelectorAll('[role="option"]')).map(textOf).filter(Boolean);
      const id = stampId([listbox]);
      results.push({ id, questionText, fieldType: 'dropdown', options, required, selector: `[data-impleo-id="${id}"]` });
    } else if (textareas.length > 0) {
      const id = stampId([textareas[0]]);
      results.push({ id, questionText, fieldType: 'textarea', options: [], required, selector: `[data-impleo-id="${id}"]` });
    } else if (fileInputs.length > 0) {
      const id = stampId([fileInputs[0]]);
      results.push({ id, questionText, fieldType: 'upload', options: [], required, selector: `[data-impleo-id="${id}"]` });
    } else if (textInputs.length > 0) {
      const id = stampId([textInputs[0]]);
      results.push({ id, questionText, fieldType: 'text', options: [], required, selector: `[data-impleo-id="${id}"]` });
    }
  }

  return results;
}

// Never touches any submit control — no code path here references a
// submit button, form.submit(), or navigation, by construction.
export function fillGoogleForm(approvedAnswers) {
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
    return el.getAttribute('aria-label') || el.getAttribute('data-value') || el.textContent.trim();
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
      if (fieldType === 'text' || fieldType === 'textarea') {
        setNativeValue(elements[0], String(value ?? ''));
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'radio' || fieldType === 'checkbox_single') {
        const target = matchOption(elements, value);
        if (!target) {
          report.push({ id, status: 'no_match', reason: `No option matched "${value}"` });
          continue;
        }
        if (target.getAttribute('aria-checked') !== 'true') target.click();
        report.push({ id, status: 'filled' });
      } else if (fieldType === 'checkbox') {
        const values = Array.isArray(value) ? value : [value];
        let anyMatched = false;
        for (const v of values) {
          const target = matchOption(elements, v);
          if (target) {
            anyMatched = true;
            if (target.getAttribute('aria-checked') !== 'true') target.click();
          }
        }
        report.push(
          anyMatched
            ? { id, status: 'filled' }
            : { id, status: 'no_match', reason: `No options matched ${JSON.stringify(values)}` }
        );
      } else if (fieldType === 'dropdown') {
        const listbox = elements[0];
        listbox.click();
        const optionEls = Array.from(document.querySelectorAll('[role="option"]'));
        const target = matchOption(optionEls, value);
        if (!target) {
          report.push({ id, status: 'no_match', reason: `No option matched "${value}"` });
          continue;
        }
        target.click();
        report.push({ id, status: 'filled' });
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
