// Line icons — no emoji (brand rule). Reused across sections. Stroke inherits
// currentColor so callers control color with text-*.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const PATHS = {
  voice: <path d="M12 3v18M8 7v10M4 10v4M16 6v12M20 9v6" />,
  review: (
    <>
      <path d="M9 12l2 2 4-4" />
      <rect x="3" y="4" width="18" height="16" rx="2" />
    </>
  ),
  options: (
    <>
      <circle cx="7" cy="8" r="2.4" />
      <circle cx="7" cy="16" r="2.4" />
      <path d="M12 8h8M12 16h8" />
    </>
  ),
  form: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  model: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 9h6v6H9zM2 9h2M2 15h2M20 9h2M20 15h2M9 2v2M15 2v2M9 20v2M15 20v2" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  detect: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  fill: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16l9-9 3 3-9 9H7v-3z" />
    </>
  ),
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 17.9l-5.25 2.8 1-5.85L3.5 9.7l5.9-.9z" />,
  // A bug on a leaf, not a generic alert: this is the "an extractor stopped
  // biting on a real page" report, which is the most useful issue anyone files.
  issue: (
    <>
      <circle cx="12" cy="13" r="5" />
      <path d="M12 8V5M8.6 9.4L6.5 7.3M15.4 9.4l2.1-2.1M7 13H4M20 13h-3M8.6 16.6l-2.1 2.1M15.4 16.6l2.1 2.1" />
    </>
  ),
  fork: (
    <>
      <circle cx="7" cy="5" r="2" />
      <circle cx="17" cy="5" r="2" />
      <circle cx="12" cy="19" r="2" />
      <path d="M7 7v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7M12 12v5" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7.5 9.5l2.5 2.5-2.5 2.5M13 15h3.5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  // Two leaves off a shoot — the growth metaphor the availability rail is built
  // on (seed → sprout → canopy).
  sprout: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12c0-3.3 2.2-5.5 5.5-5.5C17.5 9.8 15.3 12 12 12z" />
      <path d="M12 14.5c0-2.8-1.9-4.8-4.8-4.8C7.2 12.5 9.2 14.5 12 14.5z" />
      <path d="M6.5 20h11" />
    </>
  ),
  github: (
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.3 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
  ),
};

// Brand marks are solid shapes, not line art — they have to invert the base
// stroke/fill contract or they render as a smear. Everything else stays stroked.
const FILLED = new Set(['github', 'star']);

export function Icon({ name, className = '' }) {
  const filled = FILLED.has(name);
  return (
    <svg
      {...base}
      {...(filled && { fill: 'currentColor', stroke: 'none' })}
      className={className}
      aria-hidden="true"
      width="1em"
      height="1em"
    >
      {PATHS[name]}
    </svg>
  );
}
