// Story reveals — NOT fade-ins (a forbidden pattern in the brief). These are
// scroll-driven transforms: elements arrive with a clip-path wipe + directional
// slide + slight scale settle, keyed to scroll position. The baseline (no-JS /
// reduced-motion) state is fully visible; GSAP sets the hidden-start state at
// runtime, so content is never gated behind the animation.
//
// Markup: add [data-reveal] to children; optional [data-reveal-x] for a
// horizontal origin. Call inside a useGsap setup: revealChildren(gsap, scopeEl).
export function revealChildren(gsap, scopeEl, { stagger = 0.08 } = {}) {
  const items = scopeEl.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  items.forEach((item) => {
    const dx = parseFloat(item.getAttribute('data-reveal-x')) || 0;
    gsap.fromTo(
      item,
      {
        y: 40,
        x: dx,
        scale: 0.98,
        clipPath: 'inset(0% 0% 100% 0%)',
      },
      {
        y: 0,
        x: 0,
        scale: 1,
        clipPath: 'inset(0% 0% 0% 0%)',
        ease: 'power3.out',
        duration: 0.9,
        stagger,
        scrollTrigger: {
          trigger: item,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  });
}
