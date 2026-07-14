// Horizontal-scroll section: pins the scope and translates its inner track
// sideways as the user scrolls vertically. The track's overflow width beyond one
// viewport determines how far it travels. Returns nothing — the ScrollTrigger is
// owned by the surrounding gsap.context() and reverted with it.
//
// Markup:
//   <section ref={scope}>            // the pinned viewport (100vh)
//     <div data-track> ...cards... </div>   // wider-than-viewport flex row
//   </section>
export function horizontalScroll(gsap, scopeEl, { endPadding = 1 } = {}) {
  const track = scopeEl.querySelector('[data-track]');
  if (!track) return;

  const getDistance = () => track.scrollWidth - scopeEl.offsetWidth;

  gsap.to(track, {
    x: () => -getDistance(),
    ease: 'none',
    scrollTrigger: {
      trigger: scopeEl,
      start: 'top top',
      // travel = horizontal overflow, plus a little padding so the last card
      // rests fully in view before the pin releases.
      end: () => `+=${getDistance() * endPadding + window.innerHeight}`,
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // Progress-linked accents: any [data-track-progress] element fills 0→100%.
  const bars = scopeEl.querySelectorAll('[data-track-progress]');
  if (bars.length) {
    gsap.fromTo(
      bars,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        transformOrigin: 'left center',
        scrollTrigger: {
          trigger: scopeEl,
          start: 'top top',
          end: () => `+=${getDistance() + window.innerHeight}`,
          scrub: 0.6,
        },
      }
    );
  }
}
