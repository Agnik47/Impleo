// Identity-document persistence. The ONLY module that touches the `documents`
// and `domain_document_preference` tables — routes/documents.js is a thin HTTP
// shell over these functions, mirroring how learnedMemory.js sits under
// routes/learned-answers.js.
//
// Deliberately a flat set of exported functions, not a `DocumentStorageService`
// class with an injected `IndexedDBRepository` (as the feature brief sketched):
// per AGENTS.md, no strategy interfaces or plugin seams for a store that has
// exactly one backend. The brief's module boundaries are preserved as *files*
// (store / recommender / detector / injector), which is the part that carries
// real value; the class wrapper around a single implementation would not.
import { randomUUID } from 'node:crypto';
import { db } from './db.js';

// Product cap from the brief. Enforced on the insert path (see saveDocument) —
// see db.js for why this isn't a table constraint.
export const MAX_DOCUMENTS = 3;

// 10 MB. Comfortably above a real resume (~100KB-3MB) while bounding what a
// single base64 request body can inflate to (4/3 of this, see routes/documents.js's
// parser limit) and what a page can be asked to swallow through executeScript args.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// PDF/DOC/DOCX only, per the brief. Keyed by MIME with an extension fallback,
// because Windows + Chrome regularly report DOC/DOCX as empty-string or
// application/octet-stream rather than the registered type — trusting MIME alone
// would reject legitimate .docx files on the founder's own platform.
const MIME_BY_EXTENSION = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

export function extensionOf(fileName) {
  const match = /\.([a-z0-9]+)$/i.exec(String(fileName || '').trim());
  return match ? match[1].toLowerCase() : '';
}

/**
 * Resolves the MIME type to store, reconciling the browser's claim with the
 * filename. Returns null when the file is not a supported type at all.
 *
 * The extension wins over a browser-reported MIME that we don't recognize: the
 * extension is what the user actually chose, and octet-stream/"" is Chrome
 * declining to guess, not evidence the file is unsupported.
 */
export function resolveMimeType(fileName, reportedMimeType) {
  const byExtension = MIME_BY_EXTENSION[extensionOf(fileName)];
  if (byExtension) return byExtension;
  if (ALLOWED_MIME_TYPES.has(reportedMimeType)) return reportedMimeType;
  return null;
}

function rowToMetadata(row) {
  return {
    fileId: row.file_id,
    originalName: row.original_name,
    userDefinedLabel: row.user_defined_label,
    mimeType: row.mime_type,
    size: row.size,
    uploadTimestamp: row.upload_timestamp,
    lastUsedTimestamp: row.last_used_timestamp,
  };
}

// Metadata only — never the BLOB. The list endpoint is called on every Settings
// open and every form review; shipping 3 x 10MB of base64 to render three cards
// that display a filename and a size would be indefensible.
export function listDocuments() {
  const rows = db
    .prepare(
      `SELECT file_id, original_name, user_defined_label, mime_type, size,
              upload_timestamp, last_used_timestamp
         FROM documents
        ORDER BY upload_timestamp ASC`
    )
    .all();
  return rows.map(rowToMetadata);
}

export function getDocumentMetadata(fileId) {
  const row = db
    .prepare(
      `SELECT file_id, original_name, user_defined_label, mime_type, size,
              upload_timestamp, last_used_timestamp
         FROM documents WHERE file_id = ?`
    )
    .get(fileId);
  return row ? rowToMetadata(row) : null;
}

// The bytes, for injection. Separate from getDocumentMetadata precisely so that
// reading a document's bytes is always an explicit, deliberate call.
export function getDocumentBytes(fileId) {
  const row = db.prepare('SELECT bytes FROM documents WHERE file_id = ?').get(fileId);
  return row ? row.bytes : null;
}

export function countDocuments() {
  return db.prepare('SELECT COUNT(*) AS n FROM documents').get().n;
}

/**
 * Thrown for conditions the user can act on (wrong format, too big, at the cap).
 * Carries an HTTP status so the route layer can stay a pass-through and the side
 * panel gets a sentence worth showing instead of a 500.
 */
export class DocumentError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DocumentError';
    this.status = status;
  }
}

function validate(originalName, bytes, reportedMimeType) {
  const name = String(originalName || '').trim();
  if (!name) throw new DocumentError(400, 'File has no name.');

  const mimeType = resolveMimeType(name, reportedMimeType);
  if (!mimeType) {
    throw new DocumentError(
      400,
      `"${name}" isn't a supported format. Identity documents must be PDF, DOC, or DOCX.`
    );
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new DocumentError(400, `"${name}" appears to be empty.`);
  }
  if (bytes.length > MAX_FILE_BYTES) {
    const mb = (bytes.length / (1024 * 1024)).toFixed(1);
    throw new DocumentError(
      413,
      `"${name}" is ${mb} MB. Identity documents must be under ${MAX_FILE_BYTES / (1024 * 1024)} MB.`
    );
  }
  return { name, mimeType };
}

/**
 * Stores a new document. Enforces the 3-document cap.
 *
 * Duplicate filenames are allowed on purpose: "Resume.pdf" exported twice from
 * two different tools is a real and reasonable thing to hold, and the label (not
 * the filename) is the user-facing identity of a card. fileId is what everything
 * keys off, so nothing downstream is ambiguous.
 */
export function saveDocument({ originalName, mimeType, bytes, userDefinedLabel }) {
  const validated = validate(originalName, bytes, mimeType);

  if (countDocuments() >= MAX_DOCUMENTS) {
    throw new DocumentError(
      409,
      `You can store up to ${MAX_DOCUMENTS} identity documents. Delete one to add another.`
    );
  }

  const fileId = randomUUID();
  const now = new Date().toISOString();
  // Fall back to the filename minus its extension, so a card is never labelled ''.
  const label =
    String(userDefinedLabel || '').trim() || validated.name.replace(/\.[a-z0-9]+$/i, '') || validated.name;

  db.prepare(
    `INSERT INTO documents
       (file_id, original_name, user_defined_label, mime_type, size, bytes,
        upload_timestamp, last_used_timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
  ).run(fileId, validated.name, label, validated.mimeType, bytes.length, bytes, now);

  return getDocumentMetadata(fileId);
}

/**
 * Swaps the bytes of an existing document, keeping its fileId.
 *
 * Preserving the fileId is the whole point of Replace-vs-delete-and-re-add: every
 * domain_document_preference row pointing at this document keeps working, so
 * dropping in an updated resume doesn't silently un-teach Impleo which document
 * each site should preselect.
 */
export function replaceDocumentContent(fileId, { originalName, mimeType, bytes }) {
  const existing = getDocumentMetadata(fileId);
  if (!existing) throw new DocumentError(404, 'That document no longer exists.');

  const validated = validate(originalName, bytes, mimeType);
  db.prepare(
    `UPDATE documents
        SET original_name = ?, mime_type = ?, size = ?, bytes = ?, upload_timestamp = ?
      WHERE file_id = ?`
  ).run(validated.name, validated.mimeType, bytes.length, bytes, new Date().toISOString(), fileId);

  return getDocumentMetadata(fileId);
}

export function renameDocument(fileId, userDefinedLabel) {
  const label = String(userDefinedLabel || '').trim();
  if (!label) throw new DocumentError(400, 'A document label cannot be empty.');
  if (label.length > 60) throw new DocumentError(400, 'Keep document labels under 60 characters.');

  const result = db
    .prepare('UPDATE documents SET user_defined_label = ? WHERE file_id = ?')
    .run(label, fileId);
  if (result.changes === 0) throw new DocumentError(404, 'That document no longer exists.');

  return getDocumentMetadata(fileId);
}

export function deleteDocument(fileId) {
  // Cascades to domain_document_preference (db.js enables foreign_keys).
  db.prepare('DELETE FROM documents WHERE file_id = ?').run(fileId);
}

/**
 * Records that a document was actually injected into a form. Called only from the
 * post-approval path, never on upload or on mere selection.
 */
export function touchDocument(fileId) {
  db.prepare('UPDATE documents SET last_used_timestamp = ? WHERE file_id = ?').run(
    new Date().toISOString(),
    fileId
  );
  return getDocumentMetadata(fileId);
}

// --- Domain preferences -----------------------------------------------------

export function getDomainPreference(domain) {
  const row = db
    .prepare('SELECT file_id FROM domain_document_preference WHERE domain = ?')
    .get(String(domain || '').toLowerCase());
  if (!row) return null;
  // Defensive: FK + CASCADE should make a dangling row impossible, but a DB
  // restored from an older file (written before foreign_keys was enabled) can
  // still hold one. Report "no preference" rather than a fileId that 404s.
  return getDocumentMetadata(row.file_id) ? row.file_id : null;
}

export function saveDomainPreference(domain, fileId) {
  const normalized = String(domain || '').toLowerCase();
  if (!normalized) throw new DocumentError(400, 'domain is required');
  if (!getDocumentMetadata(fileId)) throw new DocumentError(404, 'That document no longer exists.');

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domain_document_preference (domain, file_id, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(domain) DO UPDATE SET file_id = excluded.file_id, updated_at = excluded.updated_at`
  ).run(normalized, fileId, now);
}
