// Self-contained by design: see generic-extractor.js's top comment.
//
// Runs ONLY after the user clicks "Approve upload" in the review panel. Nothing in
// this file decides anything — it is handed one document and one field and does
// exactly that, once. There is no scan, no loop over fields, and no code path that
// reaches a submit button (AGENTS.md rule 1).
//
// Why bytes arrive as base64: chrome.scripting.executeScript args must be
// JSON-serializable. A File/Blob cannot be structured-cloned across that boundary,
// so the side panel base64s the document and the File is reconstructed here, inside
// the page's world, where it must exist anyway for DataTransfer to accept it.
export function injectDocumentIntoField(selector, descriptor) {
  const { contentBase64, mimeType, fileName, strategy } = descriptor;

  function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // The page may have re-rendered between detection and approval (React remounts,
  // multi-step forms). The stamped attribute is the first choice; if it's gone, the
  // element it was on is gone too, and silently grabbing "some other file input"
  // could attach a resume to the wrong question — so this reports not_found instead
  // of guessing.
  const host = document.querySelector(selector);
  if (!host) {
    return {
      status: 'not_found',
      reason: 'That upload field is no longer on the page. Re-scan the form and try again.',
    };
  }

  let file;
  try {
    file = new File([decodeBase64(contentBase64)], fileName, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch (err) {
    return { status: 'error', reason: `Could not rebuild the file in the page: ${err.message}` };
  }

  function buildTransfer() {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt;
  }

  try {
    if (strategy === 'drop') {
      // No input exists — the widget listens for drop events (react-dropzone and
      // friends). The full dragenter -> dragover -> drop sequence matters: libraries
      // commonly ignore a drop they never saw a dragover for.
      const dt = buildTransfer();
      for (const type of ['dragenter', 'dragover', 'drop']) {
        host.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: dt })
        );
      }
      // Genuinely unverifiable: a dropzone exposes no state to read back, so unlike
      // the input path there is nothing to confirm against. Say so rather than
      // reporting a success that was never checked.
      return {
        status: 'dispatched',
        reason: 'Sent the file to the drop area. Check the page to confirm it appeared.',
      };
    }

    // Native input path. The selector may point at the input itself, or at a wrapper
    // whose input is nested (a styled uploader).
    const input =
      host.tagName === 'INPUT' && host.type === 'file' ? host : host.querySelector('input[type="file"]');
    if (!input) {
      return { status: 'error', reason: 'No file input found for that field.' };
    }

    const dt = buildTransfer();
    // Assigning .files is the supported way to populate a file input programmatically.
    // Note this is NOT the setNativeValue dance generic-filler.js needs for text
    // inputs: React overrides the `value` property descriptor, but not `files` — and
    // a file input's `value` can only ever be set to '' by script. So a plain
    // assignment here is correct, and the prototype-setter trick would not help.
    input.files = dt.files;

    // React/Vue/Angular all listen for these; `input` first, then `change`, matching
    // the order a real user selection produces.
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    // Some wrappers only bind their handler to the dropzone, not the hidden input.
    // Sending the drop as well costs nothing and covers uploaders that hide an input
    // purely for accessibility while doing the real work on drop.
    if (host !== input) {
      const dropTransfer = buildTransfer();
      for (const type of ['dragenter', 'dragover', 'drop']) {
        host.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: dropTransfer })
        );
      }
    }

    // Read the field back rather than trusting the dispatch. A framework that
    // remounted the input mid-handler leaves it empty, and reporting "filled" then
    // would be exactly the lie that costs someone a submitted application.
    const attached = input.files && input.files.length > 0 && input.files[0].name === fileName;
    if (!attached) {
      return {
        status: 'error',
        reason: 'The page cleared the file right after it was attached. Try attaching it manually.',
      };
    }

    return { status: 'filled', fileName };
  } catch (err) {
    return { status: 'error', reason: err.message };
  }
}
