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

  // Duration in seconds — unified interaction rhythm
  duration: {
    hover: 0.25,
    click: 0.35,
    scroll: 0.5,
    reset: 0.4,
    fast: 0.35,
    normal: 0.5,
    slow: 0.8,
    climax: 1.2,
    ending: 1.0,
    opening: 1.0,
  },

  // Mouse parallax
  parallax: {
    strength: 40, // max displacement in px
    duration: 1.0, // follow lag
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

/** Guided tutorial — Move → Tap → Hold → Drag */
export const EXPERIENCE = {
  /** Opening concept hold (ms) */
  openingHoldMs: 1000,
  /** Move: minimum time before completion can fire (ms) */
  moveMinMs: 4500,
  /** Move: cursor travel near type needed to complete (px) */
  moveDistance: 900,
  /** Feedback hold after step success (ms) */
  feedbackHoldMs: 500,
  /** Click: settle pause after click reaction (ms) */
  clickSettleMs: 500,
  /** Hold: minimum press duration to complete (ms) */
  holdMinMs: 900,
  /** Hold: settle after release (ms) */
  holdSettleMs: 500,
  /** Drag: minimum drag distance to complete (px) */
  dragDistance: 180,
  /** Drag: minimum drag time (ms) */
  dragMinMs: 700,
  /** Quiet hold before continue hint (ms) */
  endingHoldMs: 2000,
  /** Clicks required before advancing */
  clicksRequired: 2,
  /** Copy */
  endingKicker: 'Great!',
  endingTitle: 'Continue Scrolling',
  endingSub: 'Explore More',
  endingCta: 'Replay',
  stages: {
    move: 'Move',
    moveDone: '✓',
    click: 'Tap',
    clickAgain: 'Tap',
    clickDone: '✓',
    hold: 'Hold',
    holding: 'Hold',
    release: 'Release',
    holdDone: '✓',
    drag: 'Drag',
    dragging: 'Drag',
    dragRelease: 'Release',
    dragDone: '✓',
  },
  feedback: {
    great: 'Great!',
    nice: 'Nice!',
    perfect: 'Perfect!',
    completed: 'Completed',
    unlocked: 'Unlocked',
    stageComplete: 'Stage Complete',
  },
};

/**
 * Scale tutorial distances/times to the current viewport (phones / landscape).
 * @returns {{ moveDistance: number, moveMinMs: number, dragDistance: number, dragMinMs: number }}
 */
export function getExperienceThresholds() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const short = Math.min(w, h);
  const isCompact = short < 700 || h < 560;
  const isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const scale = isCompact ? Math.max(0.45, short / 900) : 1;

  return {
    moveDistance: Math.round(EXPERIENCE.moveDistance * scale),
    moveMinMs: isTouch || isCompact
      ? Math.round(EXPERIENCE.moveMinMs * 0.55)
      : EXPERIENCE.moveMinMs,
    dragDistance: Math.round(EXPERIENCE.dragDistance * Math.max(0.55, scale)),
    dragMinMs: isTouch || isCompact
      ? Math.round(EXPERIENCE.dragMinMs * 0.75)
      : EXPERIENCE.dragMinMs,
  };
}

/** Exhibition chapters shown in the progress indicator (post-tutorial) */
export const PROGRESS_SECTIONS = [
  { id: 'font-playground', label: '01', name: 'Playground' },
  { id: 'wave-typography', label: '02', name: 'Wave' },
  { id: 'typography-physics', label: '03', name: 'Physics' },
  { id: 'poster-generator', label: '04', name: 'Poster' },
  { id: 'theme-switch', label: '05', name: 'Theme' },
  { id: 'about', label: '06', name: 'About' },
];
