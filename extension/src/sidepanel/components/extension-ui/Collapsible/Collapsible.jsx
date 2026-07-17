import { useState } from 'react';

// Generic disclosure panel used to keep growing lists (learned answers,
// remembered identity, ...) from taking over the settings screen. Renders
// its children into a CSS grid-rows track so the expand/collapse transition
// animates height without ever measuring scrollHeight in JS, and picks up
// the app-wide prefers-reduced-motion kill switch (index.css) for free since
// it's a plain CSS transition.
//
// Open/closed state is persisted to localStorage (not chrome.storage.local)
// keyed by `storageKey` -- this is a UI preference, not app data, so it
// deliberately stays out of the domain storage modules those own.
function ChevronIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function readInitialOpen(storageKey, defaultOpen) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === null ? defaultOpen : stored === 'true';
  } catch {
    return defaultOpen;
  }
}

export default function Collapsible({ storageKey, title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(() => readInitialOpen(storageKey, defaultOpen));

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // localStorage unavailable -- collapse state just won't persist.
      }
      return next;
    });
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-between gap-2 py-1 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-card text-ink-primary">{title}</span>
          <span className="shrink-0 rounded-full border border-surface-border bg-surface-card-hover px-1.5 py-0.5 text-caption text-ink-secondary">
            {count}
          </span>
        </span>
        <ChevronIcon
          className={`h-3.5 w-3.5 shrink-0 text-ink-secondary transition-transform duration-250 ease-premium ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-250 ease-premium ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden" aria-hidden={!open}>
          <div className="min-w-0 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
