import { useEffect } from 'react';
import { useMascot } from '../providers/MascotProvider.jsx';

// Switches the persistent mascot to `mascotState` while the given section is the
// dominant one in view. Uses IntersectionObserver (not ScrollTrigger) so the
// mascot journey works even under reduced-motion, and is cheap. The section that
// is most centered wins via a mid-viewport root margin.
export function useMascotSection(ref, mascotState) {
  const { setMascotState } = useMascot();

  useEffect(() => {
    const el = ref.current;
    if (!el || !mascotState) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setMascotState(mascotState);
      },
      // Fire when the section crosses the vertical middle of the viewport.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, mascotState, setMascotState]);
}
