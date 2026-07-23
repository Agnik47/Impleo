// Self-contained by design: see generic-extractor.js's top comment.
//
// Runs ONLY after the user clicks "Inject file" in the review panel. Nothing in
// this file decides anything — it is handed one document and one field and does
// exactly that, once. There is no scan, no loop over fields, and no code path that
// reaches a submit button (AGENTS.md rule 1).
//
// RUNS IN THE PAGE'S MAIN WORLD (see ReviewFlow.handleApproveUpload's
// executeScript call, which sets world: 'MAIN'). This matters: a synthetic
// `drop` event dispatched from the extension's ISOLATED world carries a
// DataTransfer whose `.files` the page's own drop handler cannot read across the
// world boundary — so every drag-and-drop uploader (react-dropzone, Greenhouse,
// Ashby, Lever's styled widgets) silently ignored the file. That was the whole
// "detects and recommends but never attaches" bug for those platforms. In the
// MAIN world the DragEvent and its files are the page's own objects, so its
// handler sees them. Setting `input.files` works in either world (the input is a
// shared DOM node), so nothing on the native-input path regresses.
//
// Why bytes arrive as base64: executeScript args must be JSON-serializable. A
// File/Blob cannot be structured-cloned across that boundary, so the side panel
// base64s the document and the File is reconstructed here, where it must exist
// anyway for DataTransfer to accept it.
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
  // An upload field's stamped selector must resolve to EXACTLY ONE element. Zero
  // means the field is gone (re-render). More than one means the page has more than
  // one element carrying our marker — the marker is a per-scan random nonce applied
  // to a single node, so a second match is not a coincidence: it is a page that
  // copied the stamp onto a decoy file input (typically placed earlier in the DOM)
  // to capture the user's document. Refuse rather than write the file into a
  // node we didn't stamp — silently attaching a resume/identity document to an
  // attacker-controlled input is the worst outcome this code can produce.
  const matches = document.querySelectorAll(selector);
  if (matches.length === 0) {
    return {
      status: 'not_found',
      reason: 'That upload field is no longer on the page. Re-scan the form and try again.',
    };
  }
  if (matches.length > 1) {
    return {
      status: 'error',
      reason: 'This upload field could not be matched unambiguously on the page, so Impleo did not attach the file. Re-scan the form and try again.',
    };
  }
  const host = matches[0];

  let file;
  try {
    file = new File([decodeBase64(contentBase64)], fileName, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch (err) {
    return { status: 'error', reason: `Could not rebuild the file in the page: ${err.message}` };
  }

  // A fresh DataTransfer per use: the same one can't be reused across an input
  // assignment and a drop, and a drop handler may consume/neuter it.
  function buildTransfer() {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt;
  }

  // The full dragenter -> dragover -> drop sequence: libraries commonly ignore a
  // drop they never saw a dragover for. `composed` lets it cross shadow-DOM
  // boundaries some styled uploaders use.
  function fireDropSequence(target) {
    for (const type of ['dragenter', 'dragover', 'drop']) {
      target.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: buildTransfer() })
      );
    }
  }

  // The dropzone a hidden input lives inside — where the page's own drag handler
  // is bound. Walk up a bounded number of levels for a container that looks like a
  // dropzone or actually has a drop handler; fall back to the input's parent.
  function findDropzone(input) {
    let node = input.parentElement;
    let hops = 0;
    while (node && hops < 6) {
      const cls = (node.className && String(node.className)) || '';
      if (/dropzone|drop-zone|file-?upload|uploader/i.test(cls) || typeof node.ondrop === 'function') {
        return node;
      }
      node = node.parentElement;
      hops += 1;
    }
    return input.parentElement || input;
  }

  function inputHoldsOurFile(input) {
    return Boolean(input.files && input.files.length > 0 && input.files[0].name === fileName);
  }

  try {
    // The selector may point at the input itself, or at a wrapper whose input is
    // nested (a styled uploader), or at a pure dropzone with no input at all.
    const input =
      host.tagName === 'INPUT' && host.type === 'file' ? host : host.querySelector('input[type="file"]');

    // No input anywhere — a genuine drag-only widget. Dispatching the drop is the
    // only route, and there's nothing to read back, so this is honestly reported
    // as unverified rather than as a confirmed attach.
    if (!input) {
      fireDropSequence(host);
      return {
        status: 'dispatched',
        reason: 'Sent the file to the drop area. Check the page to confirm it appeared.',
      };
    }

    // Native-input path — the reliable one. Assigning `.files` is the supported way
    // to populate a file input programmatically. This is NOT the setNativeValue
    // dance text inputs need: React overrides the `value` descriptor, but not
    // `files` — and a file input's `value` can only ever be set to '' by script — so
    // a plain assignment is correct here and the prototype-setter trick wouldn't help.
    input.files = buildTransfer().files;
    // `input` then `change`, the order a real user selection produces. react-dropzone
    // and every controlled uploader listen for `change` on their hidden input.
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    // Read the field back rather than trusting the dispatch. A framework that
    // remounted the input mid-handler leaves it empty, and reporting "filled" then
    // would be exactly the lie that costs someone a submitted application.
    if (inputHoldsOurFile(input)) {
      return { status: 'filled', fileName };
    }

    // The input didn't retain the file — the widget cleared it, or it only reacts to
    // a drop on its dropzone, not to a change on the hidden input. Try the drop as a
    // fallback. Gated on the input path having FAILED so a working uploader is never
    // sent the file twice (some dropzones append, which would attach two copies).
    fireDropSequence(findDropzone(input));
    if (inputHoldsOurFile(input)) {
      return { status: 'filled', fileName };
    }

    return {
      status: 'dispatched',
      reason: 'The input cleared the file, so Impleo sent it as a drop instead. Check the page to confirm it attached.',
    };
  } catch (err) {
    return { status: 'error', reason: err.message };
  }
}
