import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// View / edit / delete the semantic identity values Impleo has remembered
// (father_name, date_of_birth, aadhaar_number, ...). Lets a user fix a
// mis-classified or outdated value without re-triggering a form.
//
// Every button here MUST carry type="button". This component renders inside
// Onboarding's <form onSubmit={handleSave}>, and a <button> in a form defaults to
// type="submit" — so an untyped Edit/Save/Delete would submit the whole profile
// form, which saves the profile and calls onSaved() -> App.load() -> setStatus('main'),
// bouncing the user to the homepage mid-edit. Onboarding.jsx and ImportProfileModal.jsx
// already follow this rule for their own buttons.
const secondaryBtn =
  'shrink-0 rounded-btn border border-surface-border bg-surface-card-hover px-2 py-0.5 text-caption text-ink-primary transition-colors duration-150 hover:bg-surface-border disabled:opacity-50';

export default function IdentityMemoryManager() {
  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');

  async function load() {
    setError(null);
    try {
      setItems(await api.getIdentityMemory());
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(item) {
    setEditingKey(item.canonicalKey);
    setDraft(item.value);
  }

  async function saveEdit(canonicalKey) {
    try {
      await api.saveIdentityMemory(canonicalKey, draft, 'user');
      setEditingKey(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(canonicalKey) {
    try {
      await api.deleteIdentityMemory(canonicalKey);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (items === null) {
    return <p className="text-caption text-ink-muted">Loading remembered identity…</p>;
  }

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-caption text-ink-muted">
        Remembered identity — values Impleo reuses across forms.
      </p>

      {error && (
        <div className="min-w-0 break-words rounded-card border border-red-900/50 bg-red-950/30 p-2 text-caption text-red-300">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-caption text-ink-muted">
          Nothing remembered yet. When you fill a recognized field (e.g. Father's Name) and keep
          “Remember” checked, it shows up here.
        </p>
      ) : (
        <ul className="min-w-0 space-y-1.5">
          {items.map((item) => (
            <li
              key={item.canonicalKey}
              className="min-w-0 rounded-input border border-surface-border bg-surface-bg p-2"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 break-words text-caption font-medium text-ink-primary">
                  {item.label}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  {editingKey === item.canonicalKey ? (
                    <button type="button" className={secondaryBtn} onClick={() => saveEdit(item.canonicalKey)}>
                      Save
                    </button>
                  ) : (
                    <button type="button" className={secondaryBtn} onClick={() => startEdit(item)}>
                      Edit
                    </button>
                  )}
                  <button type="button" className={secondaryBtn} onClick={() => remove(item.canonicalKey)}>
                    Delete
                  </button>
                </div>
              </div>
              {editingKey === item.canonicalKey ? (
                <input
                  className="mt-1 w-full rounded-input border border-surface-border bg-surface-card px-2 py-1 text-body text-ink-primary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  // The other half of the type="button" problem above: Enter in a
                  // text field inside a form triggers implicit submission, so
                  // without preventDefault this saves the value AND submits the
                  // profile form, landing the user back on the homepage. Enter here
                  // must mean "save this one value" and nothing more.
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveEdit(item.canonicalKey);
                    }
                    if (e.key === 'Escape') setEditingKey(null);
                  }}
                  autoFocus
                />
              ) : (
                <p className="mt-0.5 min-w-0 break-words text-body text-ink-secondary">{item.value}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
