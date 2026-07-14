// Multi-layer parallax helper. Given a scope element, moves every child marked
// with [data-parallax] by a depth-proportional amount as the scope scrolls
// through the viewport. depth > 0 moves slower (background), depth < 0 faster
// (foreground) — the classic layered-jungle effect.
//
// Usage inside a useGsap setup:
//   applyParallax(gsap, scopeEl);
// Markup: <div data-parallax="0.4" /> ... data-parallax is the depth.
export function applyParallax(gsap, scopeEl, { extra = 120 } = {}) {
  const layers = scopeEl.querySelectorAll('[data-parallax]');
  layers.forEach((layer) => {
    const depth = parseFloat(layer.getAttribute('data-parallax')) || 0;
    gsap.fromTo(
      layer,
      { yPercent: -depth * 10 },
      {
        yPercent: depth * 10,
        y: depth * extra,
        ease: 'none',
        scrollTrigger: {
          trigger: scopeEl,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      }
    );
  });
}
