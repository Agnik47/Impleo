import { useEffect, useRef, useState } from 'react';

/* ---------- Layout ---------- */

export function Container({ className = '', children }) {
  return (
    <div className={`mx-auto w-full max-w-container px-6 ${className}`}>{children}</div>
  );
}

// Section rhythm from LANDING_PAGE.md: 128px desktop / 72px mobile.
export function Section({ id, className = '', children }) {
  return (
    <section id={id} className={`py-[72px] md:py-[128px] ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children, className = '' }) {
  return (
    <p
      className={`text-[12px] font-semibold uppercase tracking-[0.08em] text-lime ${className}`}
    >
      {children}
    </p>
  );
}

/* ---------- Buttons ---------- */

export function PrimaryButton({ as = 'a', className = '', children, ...props }) {
  const Tag = as;
  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 rounded-btn bg-brand px-5 py-3 text-[15px] font-semibold text-surface-bg shadow-soft outline-none transition duration-200 ease-premium hover:-translate-y-0.5 hover:bg-brand-hover hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function GhostButton({ as = 'a', className = '', children, ...props }) {
  const Tag = as;
  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 rounded-btn border border-surface-border bg-transparent px-5 py-3 text-[15px] font-medium text-ink-primary outline-none transition duration-200 ease-premium hover:bg-surface-card-hover focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ---------- Card ---------- */

export function Card({ className = '', children }) {
  return (
    <div
      className={`rounded-card border border-surface-border bg-surface-card transition duration-200 ease-premium ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- Scroll reveal (respects prefers-reduced-motion via CSS) ---------- */

export function Reveal({ className = '', delay = 0, children }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={`${shown ? 'animate-reveal-up' : 'opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- Line icons (no emoji — brand rule) ---------- */

const iconBase = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function Icon({ name, className = '' }) {
  const paths = {
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
  };
  return (
    <svg {...iconBase} className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
