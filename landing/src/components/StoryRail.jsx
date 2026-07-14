import { SECTIONS } from '../lib/constants.js';
import { useActiveSection } from '../hooks/useActiveSection.js';
import { useSmoothScroll } from '../providers/SmoothScrollProvider.jsx';
import { cn } from '../lib/utils.js';

/*
 * Chapter rail — a fixed, right-edge index of the nine story beats. Gives the
 * reader a sense of place in a long scroll (Arc/Apple-product-page behaviour)
 * and doubles as navigation.
 *
 * Not decorative, so unlike the mascot it is NOT aria-hidden: it is a real
 * <nav> of in-page links, keyboard reachable, with the current beat exposed via
 * aria-current. Labels are visible on hover/focus only, so the rail stays quiet
 * while reading. Hidden below xl, where there is no gutter to spare.
 */
export default function StoryRail() {
  const active = useActiveSection();
  const { scrollTo } = useSmoothScroll();

  return (
    <nav
      aria-label="Story sections"
      className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 xl:block"
    >
      <ul className="flex flex-col items-end gap-1">
        {SECTIONS.map(({ id, label }) => {
          const isActive = active === id;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(`#${id}`);
                }}
                className="group flex items-center justify-end gap-2.5 rounded-btn py-1.5 pl-3 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                <span
                  className={cn(
                    'text-[11px] font-medium transition-opacity duration-200 ease-premium',
                    // Label appears on hover/focus, or while this beat is active.
                    isActive
                      ? 'text-ink-secondary opacity-100'
                      : 'text-ink-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                  )}
                >
                  {label}
                </span>
                {/* The marker grows into a bar on the active beat rather than
                    scaling on hover — hover scaling is a forbidden pattern. */}
                <span
                  className={cn(
                    'h-[2px] rounded-full transition-all duration-300 ease-premium',
                    isActive
                      ? 'w-6 bg-lime'
                      : 'w-3 bg-surface-border group-hover:bg-ink-muted'
                  )}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
