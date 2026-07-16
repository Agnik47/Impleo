// Identity-document CRUD + recommendation. A thin HTTP shell over
// documentStore.js and documentRecommender.js — all rules (the 3-doc cap, format
// and size checks, ranking) live in those modules, not here.
//
// Bytes cross this boundary as base64 in JSON rather than as multipart. Two
// reasons: it keeps the wire format identical to the shape executeScript can
// actually carry into a page (args must be JSON-serializable — a File/Blob cannot
// be passed), so there's no format change mid-flight; and it avoids adding a
// multipart dependency (multer et al.) to a server AGENTS.md wants kept plain.
import { Router } from 'express';
import express from 'express';
import {
  DocumentError,
  MAX_DOCUMENTS,
  MAX_FILE_BYTES,
  deleteDocument,
  getDocumentBytes,
  getDocumentMetadata,
  getDomainPreference,
  listDocuments,
  renameDocument,
  replaceDocumentContent,
  saveDocument,
  saveDomainPreference,
  touchDocument,
} from '../documentStore.js';
import { buildTieBreakPrompt, rankDocuments } from '../documentRecommender.js';
import { getActiveProvider } from './generate.js';

const router = Router();

// index.js's global express.json({ limit: '2mb' }) is far too small for these
// routes: base64 inflates bytes by 4/3, so a 10MB PDF becomes ~13.4MB of JSON and
// would be rejected well inside the documented limit.
//
// Exported for index.js to mount PATH-SCOPED, ahead of the global parser, rather
// than applied here with router.use(). Two things force that:
//   - the global parser runs before any router, so a router-level parser would
//     never see an oversized body — the 413 would already have been thrown;
//   - mounting this router at a shared '/api' prefix with its own parser would
//     raise the limit for every /api route that merely passes through it (the body
//     gets parsed on the way in, and the global parser then skips it), quietly
//     handing 20MB bodies to /api/profile. Scoping the paths keeps the widened
//     limit on exactly the endpoints that need it.
export const DOCUMENT_BODY_PATHS = ['/api/documents', '/api/recommend-document'];
export const documentBodyParser = express.json({
  limit: `${Math.ceil((MAX_FILE_BYTES * 4) / 3 / (1024 * 1024)) + 2}mb`,
});

// Buffer.from(x, 'base64') never throws — it silently discards anything outside
// the alphabet, so a truncated or corrupted payload would be stored as valid-looking
// garbage and only surface as a broken PDF months later, at the worst moment. Reject
// it at the door instead.
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

function decodeBase64(contentBase64, fileName) {
  const raw = String(contentBase64 || '');
  if (!raw || !BASE64_RE.test(raw) || raw.length % 4 !== 0) {
    throw new DocumentError(400, `"${fileName || 'That file'}" didn't transfer correctly. Try again.`);
  }
  return Buffer.from(raw, 'base64');
}

// Routes throw DocumentError for anything the user can fix; this keeps every
// handler free of status-code plumbing. Non-DocumentErrors fall through to
// index.js's error handler untouched.
function handle(fn) {
  return (req, res, next) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof DocumentError) {
        return res.status(err.status).json({ ok: false, error: err.message });
      }
      return next(err);
    }
  };
}

router.get(
  '/documents',
  handle((req, res) => {
    res.json({ ok: true, documents: listDocuments(), maxDocuments: MAX_DOCUMENTS });
  })
);

router.post(
  '/documents',
  handle((req, res) => {
    const { originalName, mimeType, contentBase64, userDefinedLabel } = req.body || {};
    const bytes = decodeBase64(contentBase64, originalName);
    const document = saveDocument({ originalName, mimeType, bytes, userDefinedLabel });
    res.json({ ok: true, document });
  })
);

// The bytes, base64'd, for injection into a page. Deliberately its own endpoint:
// the list endpoint stays cheap, and reading a document's contents is always an
// explicit act.
router.get(
  '/documents/:fileId/content',
  handle((req, res) => {
    const metadata = getDocumentMetadata(req.params.fileId);
    const bytes = metadata && getDocumentBytes(req.params.fileId);
    if (!metadata || !bytes) {
      throw new DocumentError(404, 'That document no longer exists. It may have been deleted.');
    }
    res.json({
      ok: true,
      fileId: metadata.fileId,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      contentBase64: bytes.toString('base64'),
    });
  })
);

router.patch(
  '/documents/:fileId',
  handle((req, res) => {
    const document = renameDocument(req.params.fileId, (req.body || {}).userDefinedLabel);
    res.json({ ok: true, document });
  })
);

router.put(
  '/documents/:fileId/content',
  handle((req, res) => {
    const { originalName, mimeType, contentBase64 } = req.body || {};
    const bytes = decodeBase64(contentBase64, originalName);
    const document = replaceDocumentContent(req.params.fileId, { originalName, mimeType, bytes });
    res.json({ ok: true, document });
  })
);

router.delete(
  '/documents/:fileId',
  handle((req, res) => {
    deleteDocument(req.params.fileId);
    res.json({ ok: true });
  })
);

// Records an actual injection. Separate from GET content because reading bytes and
// having used a document are different facts: opening the review panel reads
// nothing, and a user who previews then skips has not "used" the document.
router.post(
  '/documents/:fileId/used',
  handle((req, res) => {
    const document = touchDocument(req.params.fileId);
    if (!document) throw new DocumentError(404, 'That document no longer exists.');

    // A domain preference is recorded here — on the approved-and-injected path —
    // and nowhere else, so Impleo can only ever remember a choice the user actually
    // made and saw through.
    const domain = (req.body || {}).domain;
    if (domain) saveDomainPreference(domain, req.params.fileId);

    res.json({ ok: true, document });
  })
);

router.get(
  '/document-preferences/:domain',
  handle((req, res) => {
    res.json({ ok: true, fileId: getDomainPreference(req.params.domain) });
  })
);

// Ranks the stored documents for one detected upload field. Returns a SUGGESTION —
// this endpoint has no side effects and cannot cause an upload.
router.post('/recommend-document', async (req, res, next) => {
  try {
    const { fieldLabel, pageTitle, pageUrl, formText } = req.body || {};
    const documents = listDocuments();
    if (documents.length === 0) {
      return res.json({ ok: true, suggestedFileId: null, reason: '', source: 'empty' });
    }

    let domain = '';
    try {
      domain = new URL(pageUrl).hostname.toLowerCase();
    } catch {
      // No/invalid URL — rank on field label alone.
    }
    const preferredFileId = domain ? getDomainPreference(domain) : null;

    const result = rankDocuments(documents, {
      fieldLabel,
      pageTitle,
      pageUrl,
      formText,
      preferredFileId,
    });

    if (!result.needsTieBreak) {
      return res.json({ ok: true, ...result, preferredFileId });
    }

    // Genuinely undecided: spend one model call. Everything below is best-effort —
    // any failure (no provider configured, API down, unparseable reply, a fileId
    // the model invented) falls back to the heuristic's answer rather than
    // surfacing an error, because a tie-break failing is not a reason to block the
    // user from approving a document themselves.
    const active = getActiveProvider();
    if (!active) return res.json({ ok: true, ...result, preferredFileId });

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
      if (!chosen) return res.json({ ok: true, ...result, preferredFileId });

      return res.json({
        ok: true,
        ...result,
        suggestedFileId: chosen.fileId,
        reason: String(parsed.reason || result.reason).slice(0, 240),
        source: 'ai-tiebreak',
        preferredFileId,
      });
    } catch {
      return res.json({ ok: true, ...result, preferredFileId });
    }
  } catch (err) {
    if (err instanceof DocumentError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    return next(err);
  }
});

export default router;
