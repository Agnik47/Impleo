import { useEffect, useState } from 'react';
import { getLearnedAnswers, deleteLearnedAnswer } from '../lib/learnedAnswers.js';
import Collapsible from './extension-ui/Collapsible/Collapsible.jsx';

// View / delete the answers Impleo has learned from confirmed reviews — the
// questions that have no canonical identity key ("How many hackathons have you
// attended?"), which IdentityMemoryManager structurally can't show.
//
// Delete is the point of this screen. A learned answer is reused at HIGH confidence
// and is bulk-acceptable, so a wrong one is quietly self-reinforcing; without a way
// to see and remove it, the only fix would be editing the same field on every future
// form forever. Editing values isn't offered — the natural way to correct one is to
// edit it on a real form, which re-learns it as 'user_edit'.
const secondaryBtn =
  'shrink-0 rounded-btn border border-surface-border bg-surface-card-hover px-2 py-0.5 text-caption text-ink-primary transition-colors duration-150 hover:bg-surface-border disabled:opacity-50';

export default function LearnedAnswersManager() {
  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try {
      setItems(await getLearnedAnswers());
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(questionNorm) {
    try {
      await deleteLearnedAnswer(questionNorm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (items === null) {
    return <p className="text-caption text-ink-muted">Loading learned answers…</p>;
  }

  return (
    <div className="min-w-0 space-y-2">
      <Collapsible storageKey="impleo.ui.learnedAnswersOpen" title="Learned answers" count={items.length} defaultOpen={items.length <= 10}>
        <div className="min-w-0 space-y-2">
          <p className="text-caption text-ink-muted">
            Questions Impleo now answers from memory instead of asking the AI.
          </p>

          {error && (
            <div className="min-w-0 break-words rounded-card border border-red-900/50 bg-red-950/30 p-2 text-caption text-red-300">
              {error}
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-caption text-ink-muted">
              Nothing learned yet. Accept or edit a short answer during a review and it shows up here.
            </p>
          ) : (
            <ul className="min-w-0 max-h-80 space-y-1.5 overflow-y-auto pr-0.5">
              {items.map((item) => (
                <li
                  key={item.questionNorm}
                  className="min-w-0 rounded-input border border-surface-border bg-surface-bg p-2"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="min-w-0 break-words text-caption font-medium text-ink-primary">
                        {item.canonicalLabel || item.questionText}
                      </span>
                      {item.canonicalLabel && (
                        <p className="min-w-0 break-words text-caption text-ink-muted">
                          from field: {item.questionText}
                        </p>
                      )}
                    </div>
                    {/* type="button" is required: this renders inside Onboarding's
                        <form onSubmit={handleSave}>, where an untyped button defaults to
                        type="submit" and would save the profile + bounce to the homepage. */}
                    <button type="button" className={secondaryBtn} onClick={() => remove(item.questionNorm)}>
                      Forget
                    </button>
                  </div>
                  <p className="mt-0.5 min-w-0 break-words text-body text-ink-secondary">{item.answer}</p>
                  {/* Provenance matters here in a way it doesn't for identity memory: an
                      answer you typed and one you rubber-stamped from the AI are both
                      reused at HIGH confidence, and only this line distinguishes them. */}
                  <p className="text-caption text-ink-muted">
                    {item.source === 'user_edit'
                      ? 'You typed this'
                      : item.source === 'import'
                        ? 'From a backup file'
                        : 'You accepted the suggested answer'}
                    {item.canonicalLabel ? ' · value kept in remembered identity' : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
