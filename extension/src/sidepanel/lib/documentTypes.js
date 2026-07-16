// Type contracts for the identity-documents feature, as JSDoc typedefs rather than
// TypeScript interfaces (founder's call — AGENTS.md rule 4 keeps TS out of the repo;
// these give editors and `checkJs` the same contract without a toolchain change).
//
// This module intentionally exports no runtime values. Importing it is unnecessary
// for the types to resolve — editors pick typedefs up project-wide — so it stays a
// pure declaration file that Vite tree-shakes to nothing.

/**
 * A document's metadata. Never carries bytes: the list endpoint returns only this,
 * so rendering three cards doesn't move 30MB of base64.
 *
 * Timestamps are ISO-8601 strings, not epoch numbers as the original brief sketched.
 * Every other table in this DB (identity_memory, learned_answers, qa_history) stores
 * ISO text, and one table storing integers would be a trap for the next reader.
 *
 * @typedef {Object} StoredDocument
 * @property {string} fileId                        Server-generated UUID. The only stable identity.
 * @property {string} originalName                  Filename as chosen by the user, e.g. "Resume_2026.pdf".
 * @property {string} userDefinedLabel              Card title, e.g. "Resume 2026". Renameable.
 * @property {SupportedMimeType} mimeType
 * @property {number} size                          Bytes.
 * @property {string} uploadTimestamp               ISO-8601. Reset when content is replaced.
 * @property {string|null} lastUsedTimestamp        ISO-8601, or null if never injected into a form.
 */

/**
 * @typedef {'application/pdf'
 *   | 'application/msword'
 *   | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 * } SupportedMimeType
 */

/**
 * A document plus its bytes, as returned by the content endpoint and handed to the
 * injector. base64 because executeScript args must be JSON-serializable — a File
 * cannot cross into the page's world (see file-injector.js).
 *
 * @typedef {Object} DocumentContent
 * @property {string} fileId
 * @property {string} originalName
 * @property {SupportedMimeType} mimeType
 * @property {string} contentBase64
 */

/**
 * An upload field found on the page by detectUploadFields().
 *
 * @typedef {Object} UploadField
 * @property {string} id                            Stamped id, unique per detection pass.
 * @property {string} selector                      `[data-impleo-upload-id="..."]`.
 * @property {string} label                         The field's question text, e.g. "Resume/CV".
 * @property {UploadFieldKind} kind
 * @property {string} kindLabel                     Human form of `kind`, e.g. "Cover letter".
 * @property {string} accept                        Raw accept attribute; '' when unfiltered.
 * @property {boolean} required
 * @property {boolean} multiple
 * @property {'input'|'drop'|'drive-picker'} strategy  How injection would reach it.
 * @property {boolean} injectable                   False = surfaced for awareness only (e.g. Google Drive picker).
 * @property {string} [reason]                      Why it isn't injectable, when it isn't.
 */

/**
 * @typedef {'resume'|'cv'|'cover_letter'|'portfolio'|'supporting'|'generic'} UploadFieldKind
 */

/**
 * A ranking result for one upload field. A SUGGESTION — it can reorder a list and
 * preselect a radio, and nothing else. Injection happens only via explicit approval.
 *
 * @typedef {Object} DocumentRecommendation
 * @property {string|null} suggestedFileId
 * @property {string} reason                        Shown verbatim under "Reason".
 * @property {RecommendationSource} source
 * @property {string|null} [preferredFileId]        This domain's remembered choice, if any.
 * @property {Array<{fileId: string, score: number, matchedThemes: string[]}>} [ranked]
 */

/**
 * How the suggestion was reached — surfaced in the UI so "why this file?" is always
 * answerable.
 * - `domain-preference`: the user's own prior choice on this site.
 * - `heuristic`: keyword evidence on the page.
 * - `ai-tiebreak`: the heuristic was undecided and a model broke the tie.
 * - `fallback`: no evidence; most recently used.
 * - `empty`: nothing stored yet.
 *
 * @typedef {'domain-preference'|'heuristic'|'ai-tiebreak'|'fallback'|'empty'} RecommendationSource
 */

/**
 * Per-field review state in the side panel.
 *
 * `status` is the approval gate's state machine. It starts at 'pending' and only a
 * user click moves it — there is no timer, no auto-advance, and no path from
 * 'pending' to 'uploaded' that doesn't pass through a click on Approve.
 *
 * @typedef {Object} UploadReviewState
 * @property {'pending'|'uploading'|'uploaded'|'skipped'|'failed'} status
 * @property {string|null} selectedFileId           What the radio group has selected.
 * @property {DocumentRecommendation|null} recommendation
 * @property {string|null} error
 * @property {string|null} note                     Post-injection detail, e.g. the drop-strategy caveat.
 */

export {};
