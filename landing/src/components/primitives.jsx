import { forwardRef } from 'react';
import { cn } from '../lib/utils.js';

// Layout + text primitives, tokenized to Impleo Design System v2. Kept in one
// file so imports stay tidy; each is a thin, reusable building block.

export function Container({ className = '', children }) {
  return <div className={cn('mx-auto w-full max-w-container px-6', className)}>{children}</div>;
}

// A story beat. forwardRef because every section hands its element to both
// useGsap (animation scope) and useMascotSection (IntersectionObserver), and
// `relative` because sections layer jungle/particles behind their content.
export const Section = forwardRef(function Section(
  { id, className = '', children, ...props },
  ref
) {
  return (
    <section ref={ref} id={id} className={cn('relative', className)} {...props}>
      {children}
    </section>
  );
});

// Section heading — one place for the display scale + measure, so all nine
// story beats share a hierarchy instead of re-deciding it each time.
// ...props MUST be spread: sections tag these with [data-reveal], which is how
// animations/storyReveal.js finds them. Swallowing unknown props here silently
// drops every heading out of the scroll choreography.
export function Heading({ as: Tag = 'h2', size = 'lg', className = '', children, ...props }) {
  const scale = size === 'xl' ? 'text-display-xl font-bold' : size === 'md' ? 'text-display-md font-semibold' : 'text-display-lg font-semibold';
  return (
    <Tag className={cn(scale, 'text-ink-primary', className)} {...props}>
      {children}
    </Tag>
  );
}

export function Lead({ className = '', children, ...props }) {
  return (
    <p className={cn('text-lead text-ink-secondary', className)} {...props}>
      {children}
    </p>
  );
}

export function Eyebrow({ children, className = '' }) {
  return (
    <p className={cn('text-[12px] font-semibold uppercase tracking-[0.14em] text-lime', className)}>
      {children}
    </p>
  );
}

export function PrimaryButton({ as = 'a', className = '', children, ...props }) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-btn bg-brand px-5 py-3 text-[15px] font-semibold text-surface-bg shadow-soft outline-none transition duration-200 ease-premium',
        'hover:-translate-y-0.5 hover:bg-brand-hover hover:text-ink-primary',
        'focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg',
        className
      )}
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
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-btn border border-surface-border bg-transparent px-5 py-3 text-[15px] font-medium text-ink-primary outline-none transition duration-200 ease-premium',
        'hover:bg-surface-card-hover',
        'focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-card border border-surface-border bg-surface-card transition duration-200 ease-premium',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
