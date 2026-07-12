import { useState } from 'react';

const confidenceStyles = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
};

const statusStyles = {
  accepted: 'border-green-300',
  edited: 'border-blue-300',
  skipped: 'border-slate-200 opacity-60',
  pending: 'border-slate-200',
};

export default function ReviewCard({ question, review, fillResult, onAccept, onEdit, onSkip, onRegenerate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review?.answer ?? '');
  const [instruction, setInstruction] = useState('');

  if (question.fieldType === 'upload') {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-3">
        <p className="font-medium text-amber-800">Upload: {question.questionText}</p>
        <p className="text-xs text-amber-700">
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
    onEdit(draft);
    setEditing(false);
  }

  function toggleMultiOption(option) {
    setDraft((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(option) ? arr.filter((o) => o !== option) : [...arr, option];
    });
  }

  return (
    <div className={`space-y-2 rounded border p-3 ${statusStyles[review?.status] || statusStyles.pending}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-800">
          {question.questionText}
          {question.required && <span className="text-red-500"> *</span>}
        </p>
        {review?.confidence && (
          <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${confidenceStyles[review.confidence] || ''}`}>
            {review.confidence}
          </span>
        )}
      </div>

      {editing ? (
        isChoice ? (
          <div className="space-y-1">
            {question.options.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-slate-700">
                <input
                  type={isMulti ? 'checkbox' : 'radio'}
                  name={question.id}
                  checked={isMulti ? Array.isArray(draft) && draft.includes(opt) : draft === opt}
                  onChange={() => (isMulti ? toggleMultiOption(opt) : setDraft(opt))}
                />
                {opt}
              </label>
            ))}
          </div>
        ) : (
          <textarea
            rows={3}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            autoFocus
          />
        )
      ) : (
        <p className="whitespace-pre-wrap text-slate-700">
          {Array.isArray(review?.answer) ? review.answer.join(', ') : review?.answer || '(no answer generated)'}
        </p>
      )}

      {fillResult && (
        <p className={fillResult.status === 'filled' ? 'text-xs text-green-700' : 'text-xs text-red-600'}>
          Fill: {fillResult.status}
          {fillResult.reason ? ` — ${fillResult.reason}` : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={onAccept} className="rounded bg-green-100 px-2 py-1 text-green-800 hover:bg-green-200">
          Accept
        </button>
        {editing ? (
          <button onClick={saveEdit} className="rounded bg-blue-100 px-2 py-1 text-blue-800 hover:bg-blue-200">
            Save edit
          </button>
        ) : (
          <button onClick={startEdit} className="rounded bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200">
            Edit
          </button>
        )}
        <button
          onClick={() => onRegenerate(instruction)}
          disabled={review?.regenerating}
          className="rounded bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          {review?.regenerating ? 'Regenerating…' : 'Regenerate'}
        </button>
        <input
          className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1"
          placeholder="e.g. make it shorter"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
        <button onClick={onSkip} className="rounded bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200">
          Skip
        </button>
      </div>

      <p className="text-xs capitalize text-slate-400">{review?.status}</p>
    </div>
  );
}
