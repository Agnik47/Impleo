/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the two label-resolution bugs found on Internshala's
 * "Apply now" modal (issues #8 and #9). Both were silent: the field WAS found
 * and an answer WAS generated — for the wrong question — so only a human
 * reading the review cards could catch them. These tests are the floor that
 * stops either from coming back.
 *
 * jsdom rather than a hand-rolled fake DOM on purpose: the extractor leans on
 * closest(), previousElementSibling, contains() and textContent semantics, and
 * a fake that merely approximates those can pass while the real page fails —
 * which is the exact class of bug being fixed here.
 */
import { describe, expect, it } from 'vitest';
import { extractGenericForm } from '../../content-scripts/generic-extractor.js';

// Each case gets a fresh document body, so a field can never pick up text left
// behind by a previous test's markup.
function extractFrom(html) {
  document.body.innerHTML = html;
  return extractGenericForm();
}

describe('issue #8 — radio/checkbox group question text', () => {
  // The exact shape Internshala renders: a heading element above a plain <div>
  // of options, with no <fieldset>/<legend> anywhere.
  it('uses the heading above the group, not the first option, when there is no <legend>', () => {
    const [field] = extractFrom(`
      <div class="section">
        <h4>Confirm your availability</h4>
        <div class="options">
          <label><input type="radio" name="availability" value="1"> Yes, I am available to join immediately</label>
          <label><input type="radio" name="availability" value="2"> No, I am currently on notice period</label>
          <label><input type="radio" name="availability" value="3"> No, I will have to serve notice period</label>
        </div>
      </div>
    `);

    expect(field.questionText).toBe('Confirm your availability');
    expect(field.fieldType).toBe('radio');
    expect(field.options).toHaveLength(3);
    // The bug: this used to be 'Yes, I am available to join immediately'.
    expect(field.questionText).not.toBe(field.options[0]);
  });

  it('finds a heading that sits inside the group container, above the first option', () => {
    const [field] = extractFrom(`
      <div class="card">
        <p class="q-title">How did you hear about this role?</p>
        <label><input type="radio" name="source" value="a"> LinkedIn</label>
        <label><input type="radio" name="source" value="b"> A friend</label>
      </div>
    `);

    expect(field.questionText).toBe('How did you hear about this role?');
  });

  it('still prefers <legend> and reports it at high confidence', () => {
    const [field] = extractFrom(`
      <div><p>Some unrelated intro copy that must not win.</p>
        <fieldset>
          <legend>Preferred work mode</legend>
          <label><input type="radio" name="mode" value="r"> Remote</label>
          <label><input type="radio" name="mode" value="o"> On-site</label>
        </fieldset>
      </div>
    `);

    expect(field.questionText).toBe('Preferred work mode');
    expect(field.labelConfidence).toBe('high');
  });

  it('accepts ARIA group semantics as an explicit label', () => {
    const [field] = extractFrom(`
      <div role="radiogroup" aria-label="Notice period length">
        <label><input type="radio" name="np" value="0"> Immediate</label>
        <label><input type="radio" name="np" value="30"> 30 days</label>
      </div>
    `);

    expect(field.questionText).toBe('Notice period length');
    expect(field.labelConfidence).toBe('high');
  });

  it('falls back to the first option but flags it LOW when no heading exists', () => {
    const [field] = extractFrom(`
      <div>
        <label><input type="radio" name="bare" value="y"> Yes</label>
        <label><input type="radio" name="bare" value="n"> No</label>
      </div>
    `);

    expect(field.questionText).toBe('Yes');
    // The heart of the bug: this used to be reported as 'high' — option 1's own
    // label resolved cleanly, so nothing told the user the QUESTION was a guess.
    expect(field.labelConfidence).toBe('low');
  });

  it('leaves a lone consent checkbox labelled by its own text at high confidence', () => {
    const [field] = extractFrom(`
      <div>
        <h4>Before you submit</h4>
        <label><input type="checkbox" name="tos"> I agree to the terms and conditions</label>
      </div>
    `);

    // A single checkbox has no group heading to find — its own label IS the
    // question, so the group-heading hunt must not hijack it.
    expect(field.questionText).toBe('I agree to the terms and conditions');
    expect(field.fieldType).toBe('checkbox_single');
    expect(field.labelConfidence).toBe('high');
  });
});

describe('issue #9 — hint/example text mistaken for the question', () => {
  it('skips an instruction paragraph sitting between the question and the input', () => {
    const [field] = extractFrom(`
      <div>
        <p>Which AI coding tools have you used? Briefly describe something you built.</p>
        <p>If you want to share any documents or files, please upload them to Google Drive and paste the public link in the answer.</p>
        <textarea name="q1"></textarea>
      </div>
    `);

    expect(field.questionText).toBe(
      'Which AI coding tools have you used? Briefly describe something you built.'
    );
    expect(field.labelConfidence).toBe('medium');
  });

  it('skips an "Eg." sample answer and reaches the real question', () => {
    const [field] = extractFrom(`
      <div>
        <p>What is your availability over the next six months?</p>
        <p>Eg. I am available full-time in Pune for the next 6 months but will have exams in June.</p>
        <textarea name="q2"></textarea>
      </div>
    `);

    expect(field.questionText).toBe('What is your availability over the next six months?');
  });

  it('reaches the question when the input is wrapped in its own styled box', () => {
    const [field] = extractFrom(`
      <div>
        <p>How would you approach learning a technology you have never used?</p>
        <p>Eg. I would read the docs and build a small prototype first.</p>
        <div class="input-box"><textarea name="q3"></textarea></div>
      </div>
    `);

    // The textarea has no previous sibling at all here — before the wrapper walk
    // this fell through to the placeholder/name fallback.
    expect(field.questionText).toBe(
      'How would you approach learning a technology you have never used?'
    );
  });

  it('returns hint text at LOW confidence when it is genuinely all there is', () => {
    const [field] = extractFrom(`
      <div>
        <p>Eg. Something along these lines.</p>
        <textarea name="q4"></textarea>
      </div>
    `);

    expect(field.questionText).toBe('Eg. Something along these lines.');
    // Used, because it beats a placeholder — but never presented as resolved.
    expect(field.labelConfidence).toBe('low');
  });

  it('does not hand one field the previous field\'s label', () => {
    const fields = extractFrom(`
      <div>
        <p>Full Name</p>
        <input name="full_name">
        <input name="email">
      </div>
    `);

    const [fullName, email] = fields;
    expect(fullName.questionText).toBe('Full Name');
    expect(email.questionText).not.toBe('Full Name');
    expect(email.labelConfidence).toBe('low');
  });

  it('ignores a wall of page copy that is not a label', () => {
    const prose = 'About this internship. '.repeat(30);
    const [field] = extractFrom(`
      <div>
        <p>${prose}</p>
        <input name="years_of_experience">
      </div>
    `);

    expect(field.questionText).not.toContain('About this internship');
    expect(field.labelConfidence).toBe('low');
  });
});

describe('no regressions on well-formed markup', () => {
  it('still prefers an explicit label[for] association', () => {
    const [field] = extractFrom(`
      <div>
        <p>Eg. jane@example.com</p>
        <label for="em">Email address</label>
        <input id="em" name="email">
      </div>
    `);

    expect(field.questionText).toBe('Email address');
    expect(field.labelConfidence).toBe('high');
  });

  it('still reads a table layout label from the row cell', () => {
    const [field] = extractFrom(`
      <table><tr><td>Date of Birth</td><td><input name="dob"></td></tr></table>
    `);

    expect(field.questionText).toBe('Date of Birth');
    expect(field.labelConfidence).toBe('medium');
  });

  it('still strips a trailing required marker and reports required', () => {
    const [field] = extractFrom(`
      <div>
        <label for="ts">Tech Stack *</label>
        <input id="ts" name="tech_stack" required>
      </div>
    `);

    expect(field.questionText).toBe('Tech Stack');
    expect(field.required).toBe(true);
  });

  it('stamps every field with a unique, selectable id', () => {
    const fields = extractFrom(`
      <div>
        <label for="a">First</label><input id="a" name="a">
        <label for="b">Second</label><input id="b" name="b">
      </div>
    `);

    const ids = fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const field of fields) {
      expect(document.querySelectorAll(field.selector)).toHaveLength(1);
    }
  });
});
