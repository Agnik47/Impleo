import { memo, useState } from 'react';

const confidenceStyles = {
  high: 'bg-brand/15 text-brand',
  medium: 'bg-signature/15 text-signature',
  low: 'bg-red-500/15 text-red-400',
};

const statusStyles = {
  accepted: 'border-brand/50',
  edited: 'border-lime/50',
  skipped: 'border-surface-border opacity-50',
  pending: 'border-surface-border',
};

const inputClass =
  'w-full min-w-0 rounded-input border border-surface-border bg-surface-bg px-2.5 py-1.5 text-body text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-colors duration-150';

const chipBtn =
  'inline-flex shrink-0 items-center gap-1 rounded-btn px-2 py-1 text-caption font-medium transition-colors duration-150';

const ANSWER_CLAMP_THRESHOLD = 220;

function Icon({ path, className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  check: 'M20 6 9 17l-5-5',
  pencil: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  refresh: 'M21 12a9 9 0 1 1-3-6.7M21 3v6h-6',
  x: 'M18 6 6 18M6 6l12 12',
  more: 'M12 6h.01M12 12h.01M12 18h.01',
  chevron: 'm6 9 6 6 6-6',
};

function ReviewCard({ question, review, fillResult, onAccept, onEdit, onSkip, onRegenerate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review?.answer ?? '');
  const [instruction, setInstruction] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (question.fieldType === 'upload') {
    return (
      <div className="min-w-0 rounded-card border border-signature/30 bg-signature/10 p-3 break-words">
        <p className="text-card text-signature">Upload: {question.questionText}</p>
        <p className="text-caption text-ink-secondary">
          Files can't be filled automatically — do this manually on the page.
        </p>
      </div>
    );
  }

  const isMulti = question.fieldType === 'checkbox';
  const isChoice = ['radio', 'checkbox_single', 'dropdown', 'checkbox'].includes(question.fieldType);

  function startEdit() {
    setDraft(review?.answer ?? (isMulti ? [] : ''));
    setEditing(true);
  }

  function saveEdit() {
    onEdit(question.id, draft);
    setEditing(false);
  }

  function toggleMultiOption(option) {
    setDraft((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(option) ? arr.filter((o) => o !== option) : [...arr, option];
    });
  }

  const answerText = Array.isArray(review?.answer) ? review.answer.join(', ') : review?.answer || '';
  const isLongAnswer = answerText.length > ANSWER_CLAMP_THRESHOLD;

  return (
    <div
      className={`min-w-0 max-w-full space-y-2 rounded-card border bg-surface-card p-3 shadow-soft-sm transition-colors duration-150 ${statusStyles[review?.status] || statusStyles.pending}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 break-words text-card text-ink-primary">
          {question.questionText}
          {question.required && <span className="text-signature"> *</span>}
        </p>
        {review?.confidence && (
          <span className={`shrink-0 rounded-btn px-2 py-0.5 text-caption capitalize ${confidenceStyles[review.confidence] || ''}`}>
            {review.confidence}
          </span>
        )}
      </div>

      {editing ? (
        isChoice ? (
          <div className="space-y-1">
            {question.options.map((opt) => (
              <label key={opt} className="flex min-w-0 items-center gap-2 break-words text-body text-ink-secondary">
                <input
                  type={isMulti ? 'checkbox' : 'radio'}
                  name={question.id}
                  checked={isMulti ? Array.isArray(draft) && draft.includes(opt) : draft === opt}
                  onChange={() => (isMulti ? toggleMultiOption(opt) : setDraft(opt))}
                  className="shrink-0 accent-brand"
                />
                <span className="min-w-0 break-words">{opt}</span>
              </label>
            ))}
          </div>
        ) : (
          <textarea
            rows={3}
            className={inputClass}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            autoFocus
          />
        )
      ) : (
        <div className="min-w-0">
          <p
            className={`whitespace-pre-wrap break-words text-body text-ink-secondary ${
              isLongAnswer && !expanded ? 'line-clamp-4' : ''
            }`}
          >
            {answerText || '(no answer generated)'}
          </p>
          {isLongAnswer && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-caption font-medium text-brand hover:text-brand-hover"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {fillResult && (
        <p className={`break-words text-caption ${fillResult.status === 'filled' ? 'text-brand' : 'text-red-400'}`}>
          Fill: {fillResult.status}
          {fillResult.reason ? ` — ${fillResult.reason}` : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => onAccept(question.id)} className={`${chipBtn} bg-brand/15 text-brand hover:bg-brand/25`}>
          <Icon path={ICONS.check} />
          <span>Accept</span>
        </button>
        {editing ? (
          <button onClick={saveEdit} className={`${chipBtn} bg-lime/15 text-lime hover:bg-lime/25`}>
            <Icon path={ICONS.check} />
            <span>Save</span>
          </button>
        ) : (
          <button onClick={startEdit} className={`${chipBtn} bg-surface-card-hover text-ink-secondary hover:text-ink-primary`}>
            <Icon path={ICONS.pencil} />
            <span>Edit</span>
          </button>
        )}
        <button onClick={() => onSkip(question.id)} className={`${chipBtn} bg-surface-card-hover text-ink-secondary hover:text-ink-primary`}>
          <Icon path={ICONS.x} />
          <span>Skip</span>
        </button>
        <button
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          aria-label="More actions"
          className={`${chipBtn} ml-auto bg-surface-card-hover text-ink-secondary hover:text-ink-primary`}
        >
          <Icon path={ICONS.more} />
          <Icon path={ICONS.chevron} className={`h-3 w-3 transition-transform duration-150 ${showMore ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showMore && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-surface-border pt-2">
          <button
            onClick={() => onRegenerate(question, instruction)}
            disabled={review?.regenerating}
            className={`${chipBtn} bg-surface-card-hover text-ink-secondary hover:text-ink-primary disabled:opacity-50`}
          >
            <Icon path={ICONS.refresh} />
            <span>{review?.regenerating ? 'Regenerating…' : 'Regenerate'}</span>
          </button>
          <input
            className="min-w-[8rem] flex-1 rounded-input border border-surface-border bg-surface-bg px-2 py-1 text-caption text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none"
            placeholder="e.g. make it shorter"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </div>
      )}

      <p className="text-caption capitalize text-ink-muted">{review?.status}</p>
    </div>
  );
}

export default memo(ReviewCard);
