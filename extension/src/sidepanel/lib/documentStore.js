// Identity-document persistence, replacing server/src/documentStore.js +
// routes/documents.js's business logic (the route layer itself has nothing
// left to port — there's no Express to shell out from). Metadata and bytes
// both live in IndexedDB (not chrome.storage.local — a 10MB document would
// eat most of storage.local's quota); domain preferences are small enough to
// stay in chrome.storage.local (see storage.js's DOCUMENT_PREFERENCES key).
//
// NAMING NOTE: this file is deliberately NOT called lib/documents.js, even
// though PRODUCTION.md's migration table used that name — extension/src/
// sidepanel/lib/documents.js already exists as a *different*, already-shipped
// module (browser File→base64 helpers, display formatting; imports api.js).
// Reusing that name here would collide with a file two components already
// import. documentStore.js matches the server file's own name exactly and
// avoids the collision; Phase 8 rewires lib/documents.js to call the
// functions below instead of api.js.
//
// Deliberately a flat set of exported functions, not a class with an injected
// repository — per AGENTS.md, no strategy interfaces for a store with exactly
// one backend. Same reasoning the server-side file already documented.
import { readKey, writeKey, STORAGE_KEYS } from './storage.js';
import { rankDocuments, buildTieBreakPrompt } from './documentRecommender.js';
import { getActiveProviderConfig } from './settings.js';

// Product cap. Enforced on the insert path (see saveDocument).
export const MAX_DOCUMENTS = 3;

// 10 MB. Comfortably above a real resume (~100KB-3MB). The old comment about
// bounding a base64 HTTP request body no longer applies (no HTTP hop) — the
// cap itself is unchanged because the actual reason for it (a sane upper
// bound on what a resume file should be) didn't change.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// PDF/DOC/DOCX only. Keyed by MIME with an extension fallback, because
// Windows + Chrome regularly report DOC/DOCX as empty-string or
// application/octet-stream rather than the registered type — trusting MIME
// alone would reject legitimate .docx files.
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
 */
export function resolveMimeType(fileName, reportedMimeType) {
  const byExtension = MIME_BY_EXTENSION[extensionOf(fileName)];
  if (byExtension) return byExtension;
  if (ALLOWED_MIME_TYPES.has(reportedMimeType)) return reportedMimeType;
  return null;
}

// --- IndexedDB plumbing ------------------------------------------------------
// Each helper opens its own transaction and issues exactly one request
// synchronously within it, deliberately not sharing a transaction across an
// `await` boundary — an IDB transaction auto-commits once no more requests
// are queued, so awaiting something else mid-transaction can silently close
// it before a later request in the same transaction ever fires.

const DB_NAME = 'impleo-documents';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open the document database.'));
  });
}

async function idbGet(fileId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(fileId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Failed to read the document.'));
  });
}

async function idbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error('Failed to list documents.'));
  });
}

async function idbPut(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to save the document.'));
  });
}

async function idbDelete(fileId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(fileId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to delete the document.'));
  });
}

async function idbCount() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to count documents.'));
  });
}

function stripBytes(record) {
  if (!record) return null;
  const { bytes, ...metadata } = record;
  return metadata;
}

// Metadata only — never the bytes. Called on every Settings open and every
// form review; shipping 3 x 10MB of ArrayBuffer to render three cards that
// display a filename and a size would be indefensible.
export async function listDocuments() {
  const all = await idbGetAll();
  return all
    .slice()
    .sort((a, b) => (a.uploadTimestamp || '').localeCompare(b.uploadTimestamp || ''))
    .map(stripBytes);
}

export async function getDocumentMetadata(fileId) {
  return stripBytes(await idbGet(fileId));
}

// The bytes, for injection. Separate from getDocumentMetadata precisely so
// that reading a document's bytes is always an explicit, deliberate call.
// Returns a raw ArrayBuffer — base64 conversion happens only in
// getDocumentContent() below, at the moment of approval.
export async function getDocumentBytes(fileId) {
  const record = await idbGet(fileId);
  return record ? record.bytes : null;
}

export async function countDocuments() {
  return idbCount();
}

/**
 * Thrown for conditions the user can act on (wrong format, too big, at the
 * cap). Carries a status so callers can render a sentence instead of a raw
 * stack trace.
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
  // Buffer.isBuffer(bytes) in the server-era version -- there is no Buffer in
  // a browser/extension context. The upload path now hands this function a
  // raw ArrayBuffer (from File.arrayBuffer()), so that's what gets validated.
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0) {
    throw new DocumentError(400, `"${name}" appears to be empty.`);
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
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
 * two different tools is a real and reasonable thing to hold, and the label
 * (not the filename) is the user-facing identity of a card. fileId is what
 * everything keys off, so nothing downstream is ambiguous.
 */
export async function saveDocument({ originalName, mimeType, bytes, userDefinedLabel }) {
  const validated = validate(originalName, bytes, mimeType);

  if ((await countDocuments()) >= MAX_DOCUMENTS) {
    throw new DocumentError(
      409,
      `You can store up to ${MAX_DOCUMENTS} identity documents. Delete one to add another.`
    );
  }

  // node:crypto's randomUUID in the server-era version -- the browser/
  // extension global `crypto` already exposes the same method natively, no
  // import needed.
  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();
  // Fall back to the filename minus its extension, so a card is never labelled ''.
  const label =
    String(userDefinedLabel || '').trim() || validated.name.replace(/\.[a-z0-9]+$/i, '') || validated.name;

  await idbPut({
    fileId,
    originalName: validated.name,
    userDefinedLabel: label,
    mimeType: validated.mimeType,
    size: bytes.byteLength,
    bytes,
    uploadTimestamp: now,
    lastUsedTimestamp: null,
  });

  return getDocumentMetadata(fileId);
}

/**
 * Swaps the bytes of an existing document, keeping its fileId.
 *
 * Preserving the fileId is the whole point of replace-vs-delete-and-re-add:
 * every domain preference pointing at this document keeps working, so
 * dropping in an updated resume doesn't silently un-teach Impleo which
 * document each site should preselect.
 */
export async function replaceDocumentContent(fileId, { originalName, mimeType, bytes }) {
  const existing = await idbGet(fileId);
  if (!existing) throw new DocumentError(404, 'That document no longer exists.');

  const validated = validate(originalName, bytes, mimeType);
  await idbPut({
    ...existing,
    originalName: validated.name,
    mimeType: validated.mimeType,
    size: bytes.byteLength,
    bytes,
    uploadTimestamp: new Date().toISOString(),
  });

  return getDocumentMetadata(fileId);
}

export async function renameDocument(fileId, userDefinedLabel) {
  const label = String(userDefinedLabel || '').trim();
  if (!label) throw new DocumentError(400, 'A document label cannot be empty.');
  if (label.length > 60) throw new DocumentError(400, 'Keep document labels under 60 characters.');

  const existing = await idbGet(fileId);
  if (!existing) throw new DocumentError(404, 'That document no longer exists.');

  await idbPut({ ...existing, userDefinedLabel: label });
  return getDocumentMetadata(fileId);
}

export async function deleteDocument(fileId) {
  await idbDelete(fileId);
  // Replaces the SQLite FK CASCADE (domain_document_preference.file_id
  // REFERENCES documents(file_id) ON DELETE CASCADE) -- chrome.storage.local
  // has no foreign keys, so any domain preference pointing at the deleted
  // file has to be cleaned up explicitly here, at the same call site the
  // cascade used to fire from.
  const prefs = await readKey(STORAGE_KEYS.DOCUMENT_PREFERENCES, {});
  let changed = false;
  for (const [domain, prefFileId] of Object.entries(prefs)) {
    if (prefFileId === fileId) {
      delete prefs[domain];
      changed = true;
    }
  }
  if (changed) await writeKey(STORAGE_KEYS.DOCUMENT_PREFERENCES, prefs);
}

/**
 * Records that a document was actually injected into a form. Called only from
 * the post-approval path, never on upload or on mere selection.
 */
export async function touchDocument(fileId) {
  const existing = await idbGet(fileId);
  if (!existing) return null;
  await idbPut({ ...existing, lastUsedTimestamp: new Date().toISOString() });
  return getDocumentMetadata(fileId);
}

// --- Bytes for injection -----------------------------------------------------

function arrayBufferToBase64(buffer) {
  // chrome.scripting.executeScript args must be JSON-serializable, so bytes
  // still cross that boundary as a base64 string, exactly as they did over
  // the old HTTP hop -- removing the server didn't remove that constraint
  // (file-injector.js's atob() on the receiving side is unchanged). Doing the
  // conversion only here, at the moment of approval, keeps the "bytes are
  // read fresh at approval time, never held in component state" property the
  // original design already had.
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // avoid a call-stack blowup from one giant String.fromCharCode(...bytes) spread
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// The bytes, base64'd, for injection into a page. Deliberately its own
// function: the list/metadata calls stay cheap, and reading a document's
// contents is always an explicit act.
export async function getDocumentContent(fileId) {
  const metadata = await getDocumentMetadata(fileId);
  const bytes = metadata && (await getDocumentBytes(fileId));
  if (!metadata || !bytes) {
    throw new DocumentError(404, 'That document no longer exists. It may have been deleted.');
  }
  return {
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    mimeType: metadata.mimeType,
    contentBase64: arrayBufferToBase64(bytes),
  };
}

// --- Domain preferences (chrome.storage.local, not IndexedDB — small) ------

export async function getDomainPreference(domain) {
  const prefs = await readKey(STORAGE_KEYS.DOCUMENT_PREFERENCES, {});
  const fileId = prefs[String(domain || '').toLowerCase()];
  if (!fileId) return null;
  // Defensive: a preference could in principle point at a deleted document if
  // delete's cascade-cleanup didn't run (e.g. a crash mid-delete) -- report
  // "no preference" rather than a fileId that 404s downstream.
  return (await getDocumentMetadata(fileId)) ? fileId : null;
}

export async function saveDomainPreference(domain, fileId) {
  const normalized = String(domain || '').toLowerCase();
  if (!normalized) throw new DocumentError(400, 'domain is required');
  if (!(await getDocumentMetadata(fileId))) throw new DocumentError(404, 'That document no longer exists.');

  const prefs = await readKey(STORAGE_KEYS.DOCUMENT_PREFERENCES, {});
  prefs[normalized] = fileId;
  await writeKey(STORAGE_KEYS.DOCUMENT_PREFERENCES, prefs);
}

// Records an actual injection (and, with a domain, that site's preference for
// next time). Called only after a successful approved fill — never on
// selection. Combines touchDocument + saveDomainPreference into one call,
// matching routes/documents.js's POST /documents/:fileId/used handler, which
// is the one place this pairing happened server-side.
export async function markDocumentUsed(fileId, domain) {
  const document = await touchDocument(fileId);
  if (!document) throw new DocumentError(404, 'That document no longer exists.');
  if (domain) await saveDomainPreference(domain, fileId);
  return document;
}

// --- Recommendation orchestration -------------------------------------------
// Was routes/documents.js's POST /recommend-document handler. Ranks the
// stored documents for one detected upload field and returns a SUGGESTION —
// side-effect free by construction: it can reorder a list and preselect a
// radio, and nothing else. Injection happens only via explicit approval
// elsewhere.
export async function recommendDocument({ fieldLabel, pageTitle, pageUrl, formText }) {
  const documents = await listDocuments();
  if (documents.length === 0) {
    return { suggestedFileId: null, reason: '', needsTieBreak: false, source: 'empty' };
  }

  let domain = '';
  try {
    domain = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    // No/invalid URL — rank on field label alone.
  }
  const preferredFileId = domain ? await getDomainPreference(domain) : null;

  const result = rankDocuments(documents, { fieldLabel, pageTitle, pageUrl, formText, preferredFileId });

  if (!result.needsTieBreak) {
    return { ...result, preferredFileId };
  }

  // Genuinely undecided: spend one model call. Everything below is
  // best-effort — any failure (no provider configured, API down, unparseable
  // reply, a fileId the model invented) falls back to the heuristic's answer
  // rather than surfacing an error, because a tie-break failing is not a
  // reason to block the user from approving a document themselves.
  const active = await getActiveProviderConfig();
  if (!active) return { ...result, preferredFileId };

  try {
    const { system, user } = buildTieBreakPrompt(documents, { fieldLabel, pageTitle, pageUrl });
    const text = await active.provider.chat({
      apiKey: active.apiKey,
      model: active.model,
      systemPrompt: system,
      userContent: user,
      maxTokens: 200,
    });
    const match = /\{[\s\S]*\}/.exec(text);
    const parsed = match ? JSON.parse(match[0]) : null;
    const chosen = documents.find((d) => d.fileId === parsed?.fileId);
    if (!chosen) return { ...result, preferredFileId };

    return {
      ...result,
      suggestedFileId: chosen.fileId,
      reason: String(parsed.reason || result.reason).slice(0, 240),
      source: 'ai-tiebreak',
      preferredFileId,
    };
  } catch {
    return { ...result, preferredFileId };
  }
}
