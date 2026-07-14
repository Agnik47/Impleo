import { useEffect, useLayoutEffect } from 'react';

// useLayoutEffect warns during SSR. This site is client-rendered, but GSAP's
// own recommendation is to use this guarded variant for setup so timelines
// are created synchronously before paint on the client without SSR noise.
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
