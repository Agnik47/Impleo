import { memo, useRef, useState } from 'react';
import { FILE_ACCEPT_ATTRIBUTE, MAX_DOCUMENTS, formatBytes, formatLabel } from '../lib/documents.js';

const chipBtn =
  'inline-flex shrink-0 items-center gap-1 rounded-btn px-2 py-1 text-caption font-medium transition-colors duration-150';

const SOURCE_BADGE = {
  'domain-preference': { text: 'Your last choice here', className: 'bg-brand/15 text-brand' },
  heuristic: { text: 'Matched to this form', className: 'bg-brand/15 text-brand' },
  'ai-tiebreak': { text: 'AI tie-break', className: 'bg-signature/15 text-signature' },
  fallback: { text: 'Most recently used', className: 'bg-surface-card-hover text-ink-secondary' },
};

function UploadIcon({ className = 'h-4 w-4' }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

function ReviewUploadCard({ field, review, documents, onSelect, onApprove, onSkip, onAddDocument }) {
  const [adding, setAdding] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const fileInputRef = useRef(null);
  const status = review?.status ?? 'pending';
  const selectedFileId = review?.selectedFileId ?? null;
  const recommendation = review?.recommendation ?? null;
  const suggestedFileId = recommendation?.suggestedFileId ?? null;
  const atLimit = documents.length >= MAX_DOCUMENTS;
  const selectedDoc = documents.find((d) => d.fileId === selectedFileId) ?? null;
  const manualPickDoc =
    documents.find((d) => d.fileId === suggestedFileId) ?? selectedDoc ?? documents[0] ?? null;

  const borderClass =
    status === 'uploaded'
      ? 'border-brand/50'
      : status === 'failed'
        ? 'border-red-500/40'
        : status === 'skipped'
          ? 'border-surface-border opacity-50'
          : 'border-signature/30';

  async function handlePick(file) {
    if (!file) return;
    setAdding(true);
    try {
      await onAddDocument(field.id, file);
      setChoosing(false);
    } finally {
      setAdding(false);
    }
  }

  const badge = recommendation && SOURCE_BADGE[recommendation.source];

  return (
    <div className={`min-w-0 space-y-2 rounded-card border bg-surface-card p-3 shadow-soft-sm ${borderClass}`}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-signature">
            <UploadIcon />
          </span>
          <div className="min-w-0">
            <p className="min-w-0 break-words text-card text-ink-primary">{field.label}</p>
            <p className="text-caption text-ink-muted">
              {field.kindLabel} upload{field.required ? ' · required' : ''}
            </p>
          </div>
        </div>
        {status === 'uploaded' && (
          <span className="shrink-0 rounded bg-brand/15 px-1.5 py-0.5 text-caption font-medium text-brand">
            Attached
          </span>
        )}
      </div>

      {/* Fields we can see but genuinely cannot reach (Google Drive pickers). Telling
          the user which document to grab is still worth something; pretending we can
          attach it would not be. So this names the file to upload by hand — with its
          label, format, and size — rather than leaving them to guess which stored
          document the form wants. */}
      {!field.injectable ? (
        <div className="min-w-0 space-y-1.5 rounded-input border border-surface-border bg-surface-bg p-2">
          <p className="text-caption text-ink-secondary">
            {field.reason || 'Impleo can’t attach files to this field.'} You’ll need to attach it
            yourself.
          </p>
          {manualPickDoc ? (
            <div className="min-w-0 rounded border border-surface-border bg-surface-card p-1.5">
              <p className="text-caption text-ink-muted">Upload this file</p>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="min-w-0 break-all text-caption font-medium text-ink-primary">
                  {manualPickDoc.originalName}
                </span>
              </div>
              <p className="mt-0.5 min-w-0 break-words text-caption text-ink-muted">
                {manualPickDoc.userDefinedLabel} · {formatLabel(manualPickDoc)} ·{' '}
                {formatBytes(manualPickDoc.size)}
              </p>
            </div>
          ) : (
            documents.length === 0 && (
              <p className="text-caption text-ink-muted">
                Add a resume in Settings and Impleo will tell you which one to use here.
              </p>
            )
          )}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-input border border-dashed border-surface-border bg-surface-bg p-2.5 text-center">
          <p className="text-caption text-ink-secondary">
            No stored documents yet. Add one and Impleo will offer it here and on every future
            application.
          </p>
          <button
            className="mt-1.5 rounded-btn bg-brand px-2.5 py-1 text-caption font-medium text-jungle transition-colors duration-150 hover:bg-brand-hover disabled:opacity-50"
            disabled={adding}
            onClick={() => fileInputRef.current?.click()}
          >
            {adding ? 'Saving…' : 'Upload a document'}
          </button>
        </div>
      ) : (
        <>
          {!choosing ? (
            <div className="min-w-0 rounded-input border border-surface-border bg-surface-bg p-2">
              <p className="text-caption text-ink-muted">Selected file</p>
              {selectedDoc ? (
                <>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="min-w-0 break-all text-caption font-medium text-ink-primary">
                      {selectedDoc.originalName}
                    </span>
                    {badge && selectedDoc.fileId === suggestedFileId && (
                      <span className={`shrink-0 rounded px-1.5 py-px text-caption font-medium ${badge.className}`}>
                        {badge.text}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 min-w-0 break-words text-caption text-ink-muted">
                    {selectedDoc.userDefinedLabel} · {formatLabel(selectedDoc)} · {formatBytes(selectedDoc.size)}
                  </p>
                  {/* Why this file, kept next to the file itself rather than in its own
                      box: collapsed, the reason is only meaningful as a caption on the
                      name it's justifying. */}
                  {recommendation?.reason && selectedDoc.fileId === suggestedFileId && (
                    <p className="mt-1 min-w-0 break-words text-caption text-ink-secondary">
                      {recommendation.reason}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-caption text-signature">
                  No file selected yet — choose one to continue.
                </p>
              )}
            </div>
          ) : (
            <fieldset className="min-w-0 space-y-1" disabled={status === 'uploading'}>
              <legend className="mb-1 text-caption text-ink-muted">Choose a file</legend>
              {documents.map((doc) => {
                const checked = selectedFileId === doc.fileId;
                return (
                  <label
                    key={doc.fileId}
                    className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-input border p-2 transition-colors duration-150 ${
                      checked
                        ? 'border-brand/50 bg-brand/10'
                        : 'border-surface-border bg-surface-bg hover:bg-surface-card-hover'
                    }`}
                  >
                    <input
                      type="radio"
                      className="shrink-0 accent-brand"
                      name={`impleo-upload-${field.id}`}
                      checked={checked}
                      onChange={() => {
                        onSelect(field.id, doc.fileId);
                        // Collapse straight back to the approval gate: picking a file
                        // is the whole purpose of this list, so staying open would
                        // leave the user to work out that they're now done choosing.
                        setChoosing(false);
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 break-all text-caption font-medium text-ink-primary">
                          {doc.originalName}
                        </span>
                        {doc.fileId === suggestedFileId && (
                          <span className="shrink-0 rounded bg-brand/15 px-1 py-px text-caption font-medium text-brand">
                            Suggested
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-caption text-ink-muted">
                        {doc.userDefinedLabel} · {formatLabel(doc)} · {formatBytes(doc.size)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </>
      )}

      {review?.error && (
        <p className="min-w-0 break-words rounded-input border border-red-900/50 bg-red-950/30 p-2 text-caption text-red-300">
          {review.error}
        </p>
      )}
      {/* The drop-strategy caveat lands here: injection into a dropzone can be sent
          but not verified, and the user is the one who can actually confirm it. */}
      {review?.note && status === 'uploaded' && (
        <p className="min-w-0 break-words rounded-input border border-signature/25 bg-signature/10 p-2 text-caption text-signature">
          {review.note}
        </p>
      )}

      {field.injectable && documents.length > 0 && status !== 'uploaded' && status !== 'skipped' && (
        <div className="flex flex-wrap gap-2">
          {choosing ? (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={adding || atLimit || status === 'uploading'}
                title={atLimit ? `You can store up to ${MAX_DOCUMENTS} identity documents.` : undefined}
                className={`${chipBtn} min-w-[8rem] flex-1 justify-center border border-surface-border text-ink-secondary hover:bg-surface-card-hover hover:text-ink-primary disabled:opacity-40`}
              >
                {adding ? 'Saving…' : 'Upload new'}
              </button>
              <button
                onClick={() => setChoosing(false)}
                className={`${chipBtn} border border-surface-border text-ink-secondary hover:bg-surface-card-hover hover:text-ink-primary`}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setChoosing(true)}
                disabled={status === 'uploading'}
                className={`${chipBtn} border border-surface-border text-ink-secondary hover:bg-surface-card-hover hover:text-ink-primary disabled:opacity-40`}
              >
                Change file
              </button>
              {/* The approval gate. Renamed from "Approve upload" to match the verb
                  the rest of the review now uses for "put this on the page" — but it
                  is the same gate, with the same rule: nothing reaches the page until
                  this specific button is clicked for this specific field. */}
              <button
                onClick={() => onApprove(field.id)}
                disabled={!selectedFileId || status === 'uploading'}
                className={`${chipBtn} min-w-[7rem] flex-1 justify-center bg-brand text-jungle hover:bg-brand-hover hover:shadow-glow disabled:opacity-40 disabled:shadow-none`}
              >
                {status === 'uploading' ? 'Attaching…' : 'Inject file'}
              </button>
              <button
                onClick={() => onSkip(field.id)}
                disabled={status === 'uploading'}
                className={`${chipBtn} border border-surface-border text-ink-secondary hover:bg-surface-card-hover hover:text-ink-primary disabled:opacity-40`}
              >
                Skip
              </button>
            </>
          )}
        </div>
      )}

      {status === 'skipped' && (
        <button
          onClick={() => onSelect(field.id, selectedFileId)}
          className={`${chipBtn} border border-surface-border text-ink-secondary hover:bg-surface-card-hover hover:text-ink-primary`}
        >
          Undo skip
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so re-picking the same file after a failure still fires change.
          e.target.value = '';
          handlePick(file);
        }}
      />
    </div>
  );
}

export default memo(ReviewUploadCard);
