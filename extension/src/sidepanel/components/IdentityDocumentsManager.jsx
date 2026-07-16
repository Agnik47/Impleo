import { useEffect, useRef, useState } from 'react';
import { listDocuments, renameDocument, deleteDocument } from '../lib/documentStore.js';
import {
  FILE_ACCEPT_ATTRIBUTE,
  MAX_DOCUMENTS,
  formatBytes,
  formatLabel,
  formatLastUsed,
  labelFromFileName,
  replaceFile,
  uploadFile,
  validateFile,
} from '../lib/documents.js';

// Settings > Identity Documents. Upload / rename / replace / delete the (up to 3)
// documents Impleo can offer during a form review.
//
// Sibling of IdentityMemoryManager: same "here's what Impleo remembers about you,
// and here's how to fix it" contract, for files instead of strings.
//
// Every button here MUST carry type="button", and Enter in the rename field MUST
// preventDefault. This component renders inside Onboarding's
// <form onSubmit={handleSave}>, where a <button> defaults to type="submit" and Enter
// in a text field triggers implicit submission. Either one saves the profile and
// calls onSaved() -> App.load() -> setStatus('main'), throwing the user back to the
// homepage mid-edit. Onboarding.jsx and ImportProfileModal.jsx already follow this
// rule for their own buttons.

const secondaryBtn =
  'shrink-0 rounded-btn border border-surface-border bg-surface-card-hover px-2 py-0.5 text-caption text-ink-primary transition-colors duration-150 hover:bg-surface-border disabled:opacity-50';

const dangerBtn =
  'shrink-0 rounded-btn border border-red-500/30 bg-red-950/30 px-2 py-0.5 text-caption text-red-300 transition-colors duration-150 hover:bg-red-950/60 disabled:opacity-50';

function DocIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export default function IdentityDocumentsManager() {
  const [documents, setDocuments] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  // Which card a pending Replace belongs to. Held in a ref, not state: the file
  // dialog resolves in a change handler, and re-rendering between click and change
  // isn't guaranteed to have flushed a setState.
  const replaceTargetRef = useRef(null);

  async function load() {
    setError(null);
    try {
      const list = await listDocuments();
      setDocuments(list);
    } catch (err) {
      setError(err.message);
      setDocuments([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const atLimit = Boolean(documents && documents.length >= MAX_DOCUMENTS);

  async function handleAdd(file) {
    if (!file) return;
    const invalid = validateFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadFile(file);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReplace(file) {
    const fileId = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !fileId) return;
    setBusy(true);
    setError(null);
    try {
      await replaceFile(fileId, file);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(fileId) {
    setError(null);
    try {
      await renameDocument(fileId, draftLabel);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(fileId) {
    setError(null);
    setConfirmingDeleteId(null);
    try {
      await deleteDocument(fileId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    setDragActive(false);
    if (atLimit || busy) return;
    // One file per drop: the cap is 3 and silently ignoring extras from a
    // multi-file drop would look like a bug. Take the first, say nothing clever.
    const file = event.dataTransfer?.files?.[0];
    if (file) handleAdd(file);
  }

  if (documents === null) {
    return <p className="text-caption text-ink-muted">Loading identity documents…</p>;
  }

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-caption text-ink-muted">
        Identity documents — the resume, CV, or portfolio Impleo offers when a form asks for a file.{' '}
        <span className="text-ink-secondary">Stored locally on your device.</span> Impleo never
        uploads one without your approval.
      </p>

      {error && (
        <div className="min-w-0 break-words rounded-card border border-red-900/50 bg-red-950/30 p-2 text-caption text-red-300">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <p className="text-caption text-ink-muted">
          No documents yet. Add your resume once and Impleo will offer it on every application that
          asks.
        </p>
      ) : (
        <ul className="min-w-0 space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.fileId}
              className="min-w-0 rounded-input border border-surface-border bg-surface-bg p-2 transition-colors duration-150 hover:border-surface-card-hover"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-brand">
                    <DocIcon />
                  </span>
                  <div className="min-w-0">
                    {editingId === doc.fileId ? (
                      <input
                        className="w-full rounded-input border border-surface-border bg-surface-card px-2 py-1 text-body text-ink-primary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            // Without this, Enter saves the rename AND implicitly
                            // submits the surrounding profile form — see the note at
                            // the top of this file.
                            e.preventDefault();
                            saveRename(doc.fileId);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <p className="min-w-0 break-words text-caption font-medium text-ink-primary">
                        {doc.userDefinedLabel}
                      </p>
                    )}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-ink-muted">
                      <span className="rounded bg-surface-card-hover px-1 py-px font-medium text-ink-secondary">
                        {formatLabel(doc)}
                      </span>
                      <span>{formatBytes(doc.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatLastUsed(doc.lastUsedTimestamp)}</span>
                    </p>
                    {/* The filename is shown only when it differs from the label —
                        otherwise it's the same string twice. It still matters: it's
                        what the receiving site will actually see. */}
                    {labelFromFileName(doc.originalName) !== doc.userDefinedLabel && (
                      <p className="mt-0.5 min-w-0 break-all text-caption text-ink-muted">
                        {doc.originalName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {editingId === doc.fileId ? (
                    <>
                      <button type="button" className={secondaryBtn} onClick={() => saveRename(doc.fileId)}>
                        Save
                      </button>
                      <button type="button" className={secondaryBtn} onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : confirmingDeleteId === doc.fileId ? (
                    <>
                      {/* Two-step rather than window.confirm: deleting a document also
                          drops every site preference pointing at it, and a native
                          modal in a side panel reads as a browser error. */}
                      <span className="self-center text-caption text-ink-secondary">Delete?</span>
                      <button type="button" className={dangerBtn} onClick={() => remove(doc.fileId)}>
                        Yes
                      </button>
                      <button type="button" className={secondaryBtn} onClick={() => setConfirmingDeleteId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={secondaryBtn}
                        disabled={busy}
                        onClick={() => {
                          setEditingId(doc.fileId);
                          setDraftLabel(doc.userDefinedLabel);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className={secondaryBtn}
                        disabled={busy}
                        onClick={() => {
                          replaceTargetRef.current = doc.fileId;
                          replaceInputRef.current?.click();
                        }}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        className={dangerBtn}
                        disabled={busy}
                        onClick={() => setConfirmingDeleteId(doc.fileId)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="rounded-input border border-signature/25 bg-signature/10 p-2 text-caption text-signature">
          You can store up to {MAX_DOCUMENTS} identity documents. Delete or replace one to add
          another.
        </p>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`rounded-input border border-dashed p-3 text-center transition-colors duration-150 ${
            dragActive ? 'border-brand bg-brand/10' : 'border-surface-border bg-surface-bg'
          }`}
        >
          <p className="text-caption text-ink-secondary">
            {busy ? 'Saving…' : 'Drop a PDF, DOC, or DOCX here'}
          </p>
          <button
            type="button"
            className="mt-1.5 rounded-btn bg-brand px-2.5 py-1 text-caption font-medium text-jungle transition-colors duration-150 hover:bg-brand-hover disabled:opacity-50"
            disabled={busy}
            onClick={() => addInputRef.current?.click()}
          >
            Choose file
          </button>
          <p className="mt-1 text-caption text-ink-muted">
            {documents.length} of {MAX_DOCUMENTS} stored
          </p>
        </div>
      )}

      {/* Both inputs reset value on every change so re-picking the SAME file still
          fires change — otherwise a failed upload can't be retried with the same file. */}
      <input
        ref={addInputRef}
        type="file"
        accept={FILE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          handleAdd(file);
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={FILE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          handleReplace(file);
        }}
      />
    </div>
  );
}
