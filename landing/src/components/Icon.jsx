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
};

export function Icon({ name, className = '' }) {
  return (
    <svg {...base} className={className} aria-hidden="true" width="1em" height="1em">
      {PATHS[name]}
    </svg>
  );
}
