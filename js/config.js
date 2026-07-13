/**
 * Global configuration — shared animation constants
 * Keep durations and eases consistent across all sections.
 */

export const ANIMATION = {
  // GSAP ease strings
  ease: {
    out: 'power3.out',
    inOut: 'power3.inOut',
    expo: 'expo.out',
    smooth: 'power2.inOut',
  },

  // Duration in seconds
  duration: {
    fast: 0.4,
    normal: 0.8,
    slow: 1.2,
    scroll: 1.6,
  },

  // Mouse parallax
  parallax: {
    strength: 40,   // max displacement in px
    duration: 1.2,  // follow lag
  },
};
