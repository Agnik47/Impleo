// THE injection engine. Every path that writes a text/choice answer onto a page
// goes through injectFields() — "Fill approved", per-field "Inject", and any
// future auto-fill. There is deliberately no second implementation.
//
// It replaces fillGenericForm/fillGoogleForm/fillLumaForm, which were three
// copies of the same logic that had drifted apart: only two of the three could
// recover a stale selector, all three reported success without ever checking,
// and all three raced the dropdown popup. Those three defects are the whole of
// the "some accepted fields don't inject" bug report.
//
// File uploads are NOT handled here. file-injector.js owns that path: it writes
// via DataTransfer rather than a value setter (a file input's `value` cannot be
// assigned by script at all), and it already reads the input back the way this
// engine does. Merging it would mean rewriting correct code to look like this
// code, which buys nothing.
//
// Self-contained by design: see generic-extractor.js's top comment. Every helper
// lives inside the exported function because chrome.scripting.executeScript
// serializes it via toString() and re-parses it in the page's isolated world.
//
// Never touches any submit control — no code path here references a submit
// button, form.submit(), or navigation, by construction (AGENTS.md rule 1).

// request: { platform, fields, scrollIntoView }
//   platform  — 'google-forms' | 'luma' | 'generic'. Only selects the
//               re-location strategy; the write logic is shape-driven.
//   fields    — [{ id, selector, fieldType, value, questionText }]
//   scrollIntoView — bring each target into view before writing (per-field Inject
//               sets this; a bulk fill does not, since it would fight the user).
//
// Returns [{ id, status, reason? }] where status is one of:
//   'filled'     — written AND read back as correct.
//   'dispatched' — written, but the widget exposes no state to verify against.
//   'not_found'  — the field isn't on the page any more.
//   'no_match'   — the field is here, but none of its options match the answer.
//   'reverted'   — written, then the page cleared it. Previously reported as
//                  'filled', which is the lie this engine exists to stop.
//   'error'      — anything thrown.
export async function injectFields(request) {
  const { platform, fields, scrollIntoView = false } = request || {};
  const list = Array.isArray(fields) ? fields : [];

  // Field types that must resolve to exactly one element. A radio/checkbox group
  // legitimately stamps several elements with one id, so those are excluded; but a
  // text/textarea/dropdown answer has a single target, and a stamped selector that
  // matches more than one of them means the page copied our (per-scan random)
  // marker onto a decoy node to capture the value. injectOne refuses to write in
  // that case rather than risk filling an attacker-controlled element.
  const SINGLE_ELEMENT_TYPES = new Set(['text', 'textarea', 'dropdown']);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // One frame is enough for a synchronous re-render to have happened; the extra
  // timeout covers a framework that batches its state flush into a microtask.
  //
  // Raced against a timer because requestAnimationFrame does not fire in a
  // backgrounded tab. The user switching tabs mid-fill would otherwise park this
  // function on a promise that never settles — and since executeScript awaits it,
  // the side panel would sit on "Filling…" forever with no way out.
  async function settle() {
    const frames = new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.race([frames, sleep(150)]);
    await sleep(30);
  }

  function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  const MARKER_ONLY_RE = /^[\s*✱•·]+$/;

  // React (and every framework that copies its trick) replaces the value
  // property on the element INSTANCE with its own setter for virtual-DOM
  // diffing, so a plain `el.value = x` is swallowed and the framework never
  // learns the value changed. Reaching for the setter on the prototype writes
  // the real value underneath it; the subsequent input/change events are what
  // make the framework notice. Handles <select> too — the old generic/luma
  // fillers used a bare `el.value = ...` there, which is the same bug the text
  // path had already been fixed for.
  function setNativeValue(el, value) {
    const tag = el.tagName;
    const proto =
      tag === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : tag === 'SELECT'
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  // The visible text of one option-ish element, across all three platforms:
  // Google stamps aria-label/data-value on its role=radio divs, Luma and generic
  // pages use real labels or the element's own text.
  function labelOf(el) {
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const dataValue = el.getAttribute && (el.getAttribute('data-value') || el.getAttribute('data-answer-value'));
    if (dataValue && dataValue.trim()) return dataValue.trim();
    if (el.id) {
      const labelFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelFor && textOf(labelFor)) return textOf(labelFor);
    }
    const wrapping = el.closest && el.closest('label');
    if (wrapping && textOf(wrapping)) return textOf(wrapping);
    const own = textOf(el);
    if (own) return own;
    return el.value || '';
  }

  // Verbatim first, then a loose contains-match. Never invents an option.
  function matchOption(elements, target, getLabel) {
    const wanted = String(target ?? '').trim();
    if (!wanted) return null;
    const label = getLabel || labelOf;
    let hit = elements.find((el) => label(el).trim() === wanted);
    if (hit) return hit;
    const lower = wanted.toLowerCase();
    hit = elements.find((el) => {
      const l = label(el).trim().toLowerCase();
      return l.length > 0 && (l.includes(lower) || lower.includes(l));
    });
    return hit || null;
  }

  function isChecked(el) {
    return el.checked === true || el.getAttribute('aria-checked') === 'true';
  }

  // ---- Locating a field -----------------------------------------------------

  // Mirrors generic-extractor.js's resolveLabel closely enough to re-find a
  // field the same way it was first labelled. Not shared with it: both run
  // serialized into the page, so neither can import the other.
  function resolveLabel(el) {
    if (el.id) {
      const labelFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelFor && textOf(labelFor)) return textOf(labelFor);
    }
    const wrapping = el.closest('label');
    if (wrapping && textOf(wrapping)) return textOf(wrapping);
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const referenced = document.getElementById(labelledby);
      if (referenced && textOf(referenced)) return textOf(referenced);
    }
    let node = el.previousElementSibling;
    let hops = 0;
    while (node && hops < 4) {
      const text = textOf(node);
      if (text && !MARKER_ONLY_RE.test(text)) return text;
      node = node.previousElementSibling;
      hops += 1;
    }
    const cell = el.closest('td, th');
    if (cell) {
      let prev = cell.previousElementSibling;
      while (prev) {
        if ((prev.tagName === 'TD' || prev.tagName === 'TH') && !prev.querySelector('input, textarea, select')) {
          const t = textOf(prev);
          if (t) return t;
        }
        prev = prev.previousElementSibling;
      }
    }
    if (el.placeholder) return el.placeholder;
    if (el.name) return el.name;
    return '';
  }

  function looseEqual(a, b) {
    if (!a || !b) return false;
    return a.includes(b) || b.includes(a);
  }

  // Google Forms wraps each question in a [role="listitem"] with a
  // [role="heading"] title, so the question text alone is enough to re-find the
  // whole group after a re-render.
  function findInGoogleForm(questionText, fieldType) {
    const target = String(questionText || '').trim().toLowerCase();
    if (!target) return [];
    for (const item of Array.from(document.querySelectorAll('[role="listitem"]'))) {
      const heading = item.querySelector('[role="heading"]');
      const headingText = heading ? textOf(heading).toLowerCase() : '';
      if (!looseEqual(headingText, target)) continue;
      if (fieldType === 'radio') return Array.from(item.querySelectorAll('[role="radio"]'));
      if (fieldType === 'checkbox' || fieldType === 'checkbox_single') {
        return Array.from(item.querySelectorAll('[role="checkbox"]'));
      }
      if (fieldType === 'dropdown') return Array.from(item.querySelectorAll('[role="listbox"], select'));
      if (fieldType === 'textarea') return Array.from(item.querySelectorAll('textarea'));
      return Array.from(
        item.querySelectorAll(
          'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"]'
        )
      );
    }
    return [];
  }

  // Luma and every generic page: no question-container convention to lean on, so
  // re-derive each candidate's label and match it against the question text.
  function findInGenericPage(questionText, fieldType) {
    const target = String(questionText || '').trim().toLowerCase();
    if (!target) return [];

    if (fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'checkbox_single') {
      // ARIA-widget groups first (Luma), then native input groups (generic).
      const roleEls = Array.from(document.querySelectorAll('[role="radio"], [role="checkbox"]'));
      const groups = new Map();
      for (const el of roleEls) {
        const container = el.closest('[role="radiogroup"], [role="group"], fieldset') || el.parentElement;
        if (!container) continue;
        if (!groups.has(container)) groups.set(container, []);
        groups.get(container).push(el);
      }
      for (const [container, elements] of groups.entries()) {
        const legend = container.querySelector && container.querySelector('legend');
        const groupLabel = (legend && textOf(legend)) || resolveLabel(container) || labelOf(elements[0]);
        if (looseEqual(groupLabel.toLowerCase(), target)) return elements;
      }

      const natives = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
      const seen = new Set();
      for (const el of natives) {
        if (!el.name || seen.has(el.name)) continue;
        seen.add(el.name);
        const group = natives.filter((c) => c.name === el.name && c.type === el.type);
        const fieldset = group[0].closest('fieldset');
        const legend = fieldset && fieldset.querySelector('legend');
        const groupLabel = (legend && textOf(legend)) || resolveLabel(group[0]) || el.name;
        if (looseEqual(groupLabel.toLowerCase(), target)) return group;
      }
      return [];
    }

    if (fieldType === 'dropdown') {
      const candidates = Array.from(document.querySelectorAll('select, [role="combobox"], [role="listbox"]'));
      for (const el of candidates) {
        if (looseEqual(resolveLabel(el).toLowerCase(), target)) return [el];
      }
      return [];
    }

    const fields = Array.from(document.querySelectorAll('input, textarea')).filter(
      (el) => !['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes((el.type || '').toLowerCase())
    );
    for (const el of fields) {
      if (looseEqual(resolveLabel(el).toLowerCase(), target)) return [el];
    }
    return [];
  }

  // The stamped data-impleo-id is the fast path. When a re-render has wiped it,
  // fall back to the question's visible text and RE-STAMP whatever we find, so
  // the next write (a retry, or a later per-field Inject) hits the fast path
  // again instead of re-scanning the document.
  //
  // Re-stamping is also what makes per-field Inject safe to use repeatedly on a
  // form that re-renders on every blur — which is the exact scenario the bug
  // report describes.
  function locate(field) {
    const stamped = field.selector ? Array.from(document.querySelectorAll(field.selector)) : [];
    if (stamped.length > 0) return stamped;
    if (!field.questionText) return [];

    const found =
      platform === 'google-forms'
        ? findInGoogleForm(field.questionText, field.fieldType)
        : findInGenericPage(field.questionText, field.fieldType);

    if (found.length > 0 && field.id) {
      for (const el of found) el.setAttribute('data-impleo-id', field.id);
    }
    return found;
  }

  // ---- Writing --------------------------------------------------------------

  // A custom dropdown renders its options only after the control is opened, and
  // it does so asynchronously. The old fillers clicked and queried in the same
  // tick, so the options were reliably not there yet and every custom dropdown
  // came back 'no_match'. Poll instead.
  async function waitForOptions(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const opts = Array.from(document.querySelectorAll('[role="option"]')).filter(
        (o) => o.offsetParent !== null || o.getClientRects().length > 0
      );
      if (opts.length > 0) return opts;
      await sleep(40);
    }
    return [];
  }

  function isNativeValueField(el) {
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea';
  }

  async function write(field, elements) {
    const { fieldType, value } = field;
    const el = elements[0];

    if (fieldType === 'text' || fieldType === 'textarea') {
      if (!isNativeValueField(el)) {
        return { status: 'error', reason: `Expected an input for "${field.questionText}", found <${el.tagName.toLowerCase()}>.` };
      }
      setNativeValue(el, String(value ?? ''));
      return { status: 'filled' };
    }

    if (fieldType === 'dropdown') {
      if (el.tagName === 'SELECT') {
        const options = Array.from(el.options);
        const match = matchOption(options, value, (o) => textOf(o));
        if (!match) return { status: 'no_match', reason: `No option matched "${value}"` };
        setNativeValue(el, match.value);
        return { status: 'filled' };
      }
      // ARIA widget: open it, wait for the popup, click the option.
      el.click();
      const optionEls = await waitForOptions(1200);
      if (optionEls.length === 0) {
        return { status: 'no_match', reason: 'The dropdown did not open in time.' };
      }
      const target = matchOption(optionEls, value, (o) => textOf(o) || labelOf(o));
      if (!target) {
        // Leaving a dropdown hanging open over the page is its own small bug.
        el.click();
        return { status: 'no_match', reason: `No option matched "${value}"` };
      }
      target.click();
      return { status: 'filled' };
    }

    if (fieldType === 'radio' || fieldType === 'checkbox_single') {
      const target = matchOption(elements, value);
      if (!target) return { status: 'no_match', reason: `No option matched "${value}"` };
      if (!isChecked(target)) target.click();
      return { status: 'filled' };
    }

    if (fieldType === 'checkbox') {
      const values = Array.isArray(value) ? value : [value];
      let matched = 0;
      for (const v of values) {
        const target = matchOption(elements, v);
        if (!target) continue;
        matched += 1;
        if (!isChecked(target)) target.click();
      }
      if (matched === 0) return { status: 'no_match', reason: `No options matched ${JSON.stringify(values)}` };
      return { status: 'filled' };
    }

    if (fieldType === 'upload') {
      // Reachable only for an upload the detector missed, since ReviewFlow never
      // routes upload fields here. file-injector.js is the real path.
      return { status: 'no_match', reason: 'Files are attached from the document card, not the fill.' };
    }

    return { status: 'error', reason: `Unknown fieldType: ${fieldType}` };
  }

  // ---- Verifying ------------------------------------------------------------

  // Re-locates the field from scratch and reads it back. Returns true (confirmed
  // written), false (the page reset it), or null (nothing readable to check).
  //
  // Re-locating rather than reusing the element we just wrote to is the point: a
  // framework that remounted the subtree mid-write leaves the OLD node holding
  // the value we set, detached and invisible. Checking that node would report
  // success for a field the user can see is empty.
  function verify(field) {
    const elements = locate(field);
    if (elements.length === 0) return false;
    const el = elements[0];
    const { fieldType, value } = field;

    if (fieldType === 'text' || fieldType === 'textarea') {
      const expected = String(value ?? '');
      if (el.value === expected) return true;
      // An input that reformats what it's given (phone masks, date pickers,
      // currency fields) holds a value that is neither what we wrote nor empty.
      // Strict equality alone would call that a revert and retry it twice before
      // reporting a failure on a field that is, visibly, correctly filled. Only
      // an EMPTY field is real evidence the page threw the write away.
      if (el.value === '' && expected !== '') return false;
      return null;
    }

    if (fieldType === 'dropdown') {
      if (el.tagName === 'SELECT') {
        const selected = el.options[el.selectedIndex];
        return Boolean(selected && looseEqual(textOf(selected).toLowerCase(), String(value ?? '').trim().toLowerCase()));
      }
      // A custom dropdown's committed value usually surfaces as the control's own
      // text once the popup closes. When it doesn't, say so rather than guess.
      const shown = textOf(el).toLowerCase();
      const wanted = String(value ?? '').trim().toLowerCase();
      if (!shown) return null;
      return looseEqual(shown, wanted);
    }

    if (fieldType === 'radio' || fieldType === 'checkbox_single') {
      const target = matchOption(elements, value);
      if (!target) return false;
      return isChecked(target);
    }

    if (fieldType === 'checkbox') {
      const values = Array.isArray(value) ? value : [value];
      const targets = values.map((v) => matchOption(elements, v)).filter(Boolean);
      if (targets.length === 0) return false;
      return targets.every((t) => isChecked(t));
    }

    return null;
  }

  // ---- Per-field orchestration ----------------------------------------------

  async function injectOne(field) {
    let elements = locate(field);
    if (elements.length === 0) {
      return {
        status: 'not_found',
        reason: 'That field is no longer on the page. Re-scan the form and try again.',
      };
    }

    // A single-value field whose marker matches more than one element is a stamp
    // collision — most likely a page that copied our marker onto a decoy to capture
    // the value. Refuse rather than write the answer into the wrong (possibly
    // attacker-controlled) element.
    if (SINGLE_ELEMENT_TYPES.has(field.fieldType) && elements.length > 1) {
      return {
        status: 'error',
        reason: 'This field could not be matched unambiguously on the page, so Impleo did not fill it.',
      };
    }

    if (scrollIntoView) {
      elements[0].scrollIntoView({ block: 'center', inline: 'nearest' });
    }

    // Two attempts. A form that re-renders in response to our own first write
    // (validation on change is the common case) can swallow it; the second write
    // lands on the settled DOM. A third would just be superstition — if two
    // verified writes both got reverted, the page is actively fighting us and
    // the user needs to know rather than watch a spinner.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const result = await write(field, elements);
      // no_match/error are decisions about the answer, not timing — retrying
      // cannot change them.
      if (result.status !== 'filled') return result;

      await settle();

      const verified = verify(field);
      if (verified === true) return { status: 'filled' };
      if (verified === null) {
        return {
          status: 'dispatched',
          reason: "Written, but Impleo couldn't confirm the final value — the page may have reformatted it. Check the page.",
        };
      }

      elements = locate(field);
      if (elements.length === 0) {
        return { status: 'reverted', reason: 'The page removed this field right after it was filled.' };
      }
    }

    return {
      status: 'reverted',
      reason: 'The page cleared this field after it was filled. Try filling it manually.',
    };
  }

  const report = [];
  for (const field of list) {
    try {
      const result = await injectOne(field);
      report.push({ id: field.id, ...result });
    } catch (err) {
      report.push({ id: field.id, status: 'error', reason: err.message });
    }
  }
  return report;
}
