/**
 * Global configuration — shared animation constants
 * Keep durations and eases consistent across all sections.
 */

export const ANIMATION = {
  // GSAP ease strings — keep one vocabulary across the piece
  ease: {
    out: 'power3.out',
    inOut: 'power3.inOut',
    expo: 'expo.out',
    smooth: 'power2.inOut',
    spring: 'elastic.out(1, 0.55)',
    softSpring: 'back.out(1.6)',
    soft: 'power2.out',
    settle: 'power3.out',
  },

  // Duration in seconds
  duration: {
    fast: 0.4,
    normal: 0.8,
    slow: 1.2,
    scroll: 1.6,
    climax: 2.2,
    ending: 1.6,
    opening: 1.6,
  },

  // Mouse parallax
  parallax: {
    strength: 40, // max displacement in px
    duration: 1.35, // follow lag
  },

  /**
   * Hover response layers (ms) — properties awaken in sequence,
   * never all at once. Used as lag multipliers on delayed targets.
   */
  layers: {
    scale: 0,
    rotate: 40,
    weight: 80,
    tracking: 120,
    blur: 160,
    settle: 220,
  },
};

/** Experience flow timing for the interactive typography chapter */
export const EXPERIENCE = {
  /** Minimum explore time before climax can trigger (ms) */
  minExploreMs: 14000,
  /** Energy needed to unlock climax (0–1 accumulated) */
  climaxEnergy: 1,
  /** Energy gains per interaction */
  energy: {
    move: 0.0012,
    click: 0.055,
    hold: 0.0045,
    wheel: 0.012,
    key: 0.04,
    touch: 0.002,
  },
  /** Hold threshold (ms) before long-press activates */
  holdMs: 280,
  /** Idle soft-ending after no interaction (ms) */
  idleEndingMs: 5000,
  /** Minimum energy before idle ending can arm */
  idleEndingMinEnergy: 0.12,
  /** Climax reform word */
  climaxWord: 'MOTION',
  /** Opening hold before interaction (ms) */
  openingHoldMs: 1600,
  /** Fallback ending copy (session may override) */
  endingTitle: 'Typography Never Stands Still.',
  idleEndingTitle: 'Still Moving.',
  endingCta: 'Play Again',
};

/** Coordinated palette sets — applied randomly on load */
export const PALETTES = [
  {
    id: 'ink',
    bg: '#f7f5f2',
    bgAlt: '#ebe7e1',
    text: '#121212',
    muted: '#8a8580',
    accent: '#1a1a1a',
    trail: '18, 18, 18',
  },
  {
    id: 'blueviolet',
    bg: '#f4f2fa',
    bgAlt: '#e8e4f4',
    text: '#1a1530',
    muted: '#7a7394',
    accent: '#5b4fcf',
    trail: '91, 79, 207',
  },
  {
    id: 'amber',
    bg: '#faf6ef',
    bgAlt: '#f0e6d4',
    text: '#1c1408',
    muted: '#9a8770',
    accent: '#c45c16',
    trail: '196, 92, 22',
  },
  {
    id: 'teal',
    bg: '#f0f7f5',
    bgAlt: '#dceee9',
    text: '#0c1f1c',
    muted: '#6d8a84',
    accent: '#0d8f78',
    trail: '13, 143, 120',
  },
  {
    id: 'signal',
    bg: '#0e1110',
    bgAlt: '#171c1a',
    text: '#e8f5ef',
    muted: '#6d8a7c',
    accent: '#3dff9a',
    trail: '61, 255, 154',
  },
  {
    id: 'rose',
    bg: '#faf3f5',
    bgAlt: '#f2e4e9',
    text: '#1f1218',
    muted: '#9a7a86',
    accent: '#c23d6a',
    trail: '194, 61, 106',
  },
  {
    id: 'slate',
    bg: '#eef1f4',
    bgAlt: '#dde3ea',
    text: '#141a22',
    muted: '#74808f',
    accent: '#2f5d9f',
    trail: '47, 93, 159',
  },
];
