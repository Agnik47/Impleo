import { useEffect, useState } from 'react';
import { SECTIONS } from '../lib/constants.js';

/*
 * Tracks which story section currently owns the viewport's middle band.
 * IntersectionObserver (not ScrollTrigger) so it keeps working under
 * reduced-motion, where GSAP never initializes. The root margin collapses the
 * viewport to a thin horizontal band at its center, so exactly one section is
 * "active" at a time and the handoff happens as a beat crosses the middle —
 * the same rule useMascotSection uses, keeping the rail and the mascot in sync.
 */
export function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return active;
}
