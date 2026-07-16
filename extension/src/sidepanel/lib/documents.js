// Browser-side concerns for identity documents: turning a picked File into
// something the API can carry, and turning stored metadata into card copy.
//
// Not a wrapper around api.js — it holds what api.js can't (File/FileReader) and
// what the server shouldn't be asked for (relative-time strings for a card). The
// validation here is a UX affordance only: it fails a bad pick in the file dialog
// instead of after a 13MB round-trip. documentStore.js re-checks every rule on the
// server and remains the authority; this copy can only ever reject early, never
// admit something the server would refuse.
import { api } from './api.js';

/** @typedef {import('./documentTypes.js').StoredDocument} StoredDocument */

export const MAX_DOCUMENTS = 3;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Mirrors documentStore.js's MIME_BY_EXTENSION. The `accept` string for the file
// dialog is derived from the same list so the picker and the validator can't drift.
const EXTENSION_TO_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const FILE_ACCEPT_ATTRIBUTE = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function extensionOf(fileName) {
  const match = /\.([a-z0-9]+)$/i.exec(String(fileName || '').trim());
  return match ? match[1].toLowerCase() : '';
}

/**
 * Rejects a picked file with a sentence worth showing, or returns null if it's fine.
 *
 * Checks the extension rather than file.type: Chrome on Windows regularly reports
 * .doc/.docx as '' or application/octet-stream, so trusting the browser's MIME would
 * reject legitimate Word files on the founder's own platform.
 *
 * @param {File} file
 * @returns {string|null}
 */
export function validateFile(file) {
  if (!file) return 'No file selected.';
  if (!EXTENSION_TO_MIME[extensionOf(file.name)]) {
    return `"${file.name}" isn't a supported format. Identity documents must be PDF, DOC, or DOCX.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)}. Identity documents must be under ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  return null;
}

/**
 * Reads a File into base64 for transport.
 *
 * Uses readAsDataURL and strips the prefix rather than looping over a Uint8Array:
 * a 10MB byte-by-byte String.fromCharCode loop blocks the side panel's main thread
 * long enough to drop frames, while the FileReader does the encode off-thread.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Couldn't read "${file.name}" from disk.`));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error(`Couldn't encode "${file.name}".`));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Derives the MIME type to send. Prefers the extension for the reason in
 * validateFile; falls back to whatever the browser claimed.
 * @param {File} file
 */
export function mimeTypeFor(file) {
  return EXTENSION_TO_MIME[extensionOf(file.name)] || file.type || 'application/octet-stream';
}

/**
 * A default card label from a filename: "Resume_2026.pdf" -> "Resume 2026".
 * The user can rename it afterwards; this only avoids an empty-feeling card.
 */
export function labelFromFileName(fileName) {
  return String(fileName || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uploads a picked File end-to-end. @param {File} file */
export async function uploadFile(file, userDefinedLabel) {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);
  const contentBase64 = await fileToBase64(file);
  const { document } = await api.uploadDocument({
    originalName: file.name,
    mimeType: mimeTypeFor(file),
    contentBase64,
    userDefinedLabel: userDefinedLabel || labelFromFileName(file.name),
  });
  return document;
}

/** Swaps an existing document's bytes, keeping its fileId (and its domain preferences). */
export async function replaceFile(fileId, file) {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);
  const contentBase64 = await fileToBase64(file);
  const { document } = await api.replaceDocumentContent(fileId, {
    originalName: file.name,
    mimeType: mimeTypeFor(file),
    contentBase64,
  });
  return document;
}

// --- Display helpers --------------------------------------------------------

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const EXTENSION_LABEL = { pdf: 'PDF', doc: 'DOC', docx: 'DOCX' };

/** The format badge on a card. Reads the filename, not the MIME. */
export function formatLabel(document) {
  return EXTENSION_LABEL[extensionOf(document.originalName)] || 'Document';
}

/**
 * "Last used 2 days ago" / "Never used".
 *
 * Rounds down to the coarsest honest unit. Notably returns "Never used" for a null
 * timestamp rather than falling back to the upload time — a document you stored but
 * never sent anywhere is a meaningfully different thing, and it's exactly what the
 * recommender's recency nudge keys off.
 */
export function formatLastUsed(isoTimestamp) {
  if (!isoTimestamp) return 'Never used';
  const then = Date.parse(isoTimestamp);
  if (Number.isNaN(then)) return 'Never used';

  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return 'Last used just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Last used ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last used ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Last used ${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Last used ${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `Last used ${years} year${years === 1 ? '' : 's'} ago`;
}
