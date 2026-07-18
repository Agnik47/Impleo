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

  // Matches text that is ONLY a required-field marker -- used to filter out a
  // marker rendered as its own div rather than mistaking it for the title.
  const MARKER_ONLY_RE = /^[\s*✱•·]+$/;
  const TRAILING_MARKER_RE = /[\s]*[*✱]+\s*$/;
  function stripTrailingMarker(text) {
    return String(text || '').replace(TRAILING_MARKER_RE, '').trim();
  }

  // optionTexts lets the caller pass in the option labels it already
  // collected (radios/checkboxes) so they can be excluded from title
  // candidates -- without this, a question with no [role="heading"] whose
  // first option happens to be the first div with text gets its option
  // mistaken for the title.
  function findQuestionTitle(container, optionTexts) {
    const heading = container.querySelector('[role="heading"]');
    if (heading && textOf(heading)) return textOf(heading);
    // Previously required a zero-child "leaf" div, which misses titles
    // wrapped in a nested <span> (real Google Forms markup does this) and
    // fell through to '(unlabeled question)'. Relaxed to "no nested <div>
    // descendants" instead -- still excludes wrapper divs (which would
    // otherwise concatenate the title + every option's text into one
    // candidate, since a wrapper div precedes its own children in document
    // order), but tolerates inline wrapping like <span>. First surviving
    // candidate wins (title normally precedes description/options in DOM
    // order); only marker-only and option-duplicate text is excluded.
    const seenOptions = new Set((optionTexts || []).map((t) => String(t || '').trim()).filter(Boolean));
    const candidates = Array.from(container.querySelectorAll('div'))
      .filter((d) => d.querySelectorAll('div').length === 0)
      .map((d) => textOf(d))
      .filter((t) => t.length > 0 && !MARKER_ONLY_RE.test(t) && !seenOptions.has(t) && t !== 'Required');
    return candidates.length > 0 ? candidates[0] : '(unlabeled question)';
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

    const required = isRequired(item);

    if (radios.length > 0) {
      const options = radios.map((r) => r.getAttribute('aria-label') || r.getAttribute('data-value') || textOf(r));
      const questionText = stripTrailingMarker(findQuestionTitle(item, options));
      const id = stampId(radios);
      results.push({ id, questionText, fieldType: 'radio', options, required, selector: `[data-impleo-id="${id}"]` });
    } else if (checkboxes.length > 0) {
      const options = checkboxes.map(
        (c) => c.getAttribute('aria-label') || c.getAttribute('data-answer-value') || textOf(c)
      );
      const questionText = stripTrailingMarker(findQuestionTitle(item, options));
      const fieldType = checkboxes.length > 1 ? 'checkbox' : 'checkbox_single';
      const id = stampId(checkboxes);
      results.push({ id, questionText, fieldType, options, required, selector: `[data-impleo-id="${id}"]` });
    } else if (listboxes.length > 0) {
      const listbox = listboxes[0];
      const options = Array.from(listbox.querySelectorAll('[role="option"]')).map(textOf).filter(Boolean);
      const questionText = stripTrailingMarker(findQuestionTitle(item, options));
      const id = stampId([listbox]);
      results.push({ id, questionText, fieldType: 'dropdown', options, required, selector: `[data-impleo-id="${id}"]` });
    } else if (textareas.length > 0) {
      const questionText = stripTrailingMarker(findQuestionTitle(item, []));
      const id = stampId([textareas[0]]);
      results.push({ id, questionText, fieldType: 'textarea', options: [], required, selector: `[data-impleo-id="${id}"]` });
    } else if (fileInputs.length > 0) {
      const questionText = stripTrailingMarker(findQuestionTitle(item, []));
      const id = stampId([fileInputs[0]]);
      results.push({ id, questionText, fieldType: 'upload', options: [], required, selector: `[data-impleo-id="${id}"]` });
    } else if (textInputs.length > 0) {
      const questionText = stripTrailingMarker(findQuestionTitle(item, []));
      const id = stampId([textInputs[0]]);
      results.push({ id, questionText, fieldType: 'text', options: [], required, selector: `[data-impleo-id="${id}"]` });
    }
  }

  return results;
}
