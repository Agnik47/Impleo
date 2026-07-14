// Motion tokens — the single source of truth for durations/easings used across
// GSAP timelines and CSS. Mirrors the brand guide's motion language but, per the
// v3 story brief (UPDATED_DESIGN_MD.md), the marketing site is allowed richer
// scroll-driven motion than the compact in-app 150–250ms range. Scroll-linked
// tweens use `scrub` (tied to scroll position, no fixed duration); these fixed
// values are for discrete, event-triggered animations (approval pop, nav, etc.).

export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.45,
  story: 0.9, // section-scale entrance beats
};

// GSAP-friendly easing strings (gsap parses these natively).
export const EASE = {
  premium: 'power2.out', // ~cubic-bezier(0.4,0,0.2,1) feel
  inOut: 'power2.inOut',
  expo: 'expo.out', // long, confident settles for hero/story
  back: 'back.out(1.6)', // approval checkmark pop (used sparingly, not "bounce spam")
};

// Default ScrollTrigger scrub value (seconds of smoothing between scroll and
// tween). A little smoothing feels premium; too much feels laggy.
export const SCRUB = 0.6;

// Shared GSAP defaults applied inside timelines for consistency.
export const GSAP_DEFAULTS = {
  ease: EASE.premium,
  duration: DURATION.story,
};
