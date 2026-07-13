/**
 * Per-visit motion seed — subtle randomness that keeps the same language.
 * Regenerated on every page load.
 */

const OPENING_LINES = [
  'Move the Type',
  'Typography in Motion',
  'Follow the Gesture',
];

const OPENING_LINES_TOUCH = [
  'Touch the Type',
  'Typography in Motion',
  'Follow the Gesture',
];

const ENDING_LINES = [
  'Typography Never Stands Still.',
  'Every Movement Creates Meaning.',
  'Type Keeps Moving.',
];

/**
 * @param {number} min
 * @param {number} max
 */
function range(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Create a session-scoped motion profile.
 * Values stay within a narrow band so the feel remains coherent.
 */
export function createSessionMotion() {
  const coarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none), (pointer: coarse)').matches;

  return {
    /** Global tempo multiplier for springs / idle */
    tempo: range(0.88, 1.14),
    /** Wave / stagger direction: 1 = L→R, -1 = R→L */
    waveDir: Math.random() > 0.5 ? 1 : -1,
    /** Stagger origin for entrance / climax */
    staggerFrom: /** @type {'start' | 'end' | 'center' | 'edges'} */ (
      pick(['start', 'end', 'center', 'edges'])
    ),
    /** Hover deformation intensity */
    hoverIntensity: range(0.88, 1.18),
    /** Max rotate multiplier */
    rotateRange: range(0.78, 1.22),
    /** Max scale multiplier */
    scaleRange: range(0.9, 1.16),
    /** Idle breath period scale */
    idlePeriod: range(0.00088, 0.00128),
    /** Idle float amp scale */
    idleFloat: range(0.75, 1.25),
    /** Spring stiffness scale */
    springK: range(0.86, 1.16),
    /** Spring damping scale (higher = less bounce) */
    springDamp: range(0.94, 1.08),
    /** Wave catch-rate base */
    waveBase: range(0.26, 0.38),
    waveStep: range(0.036, 0.058),
    /** Influence radius (px) */
    influenceRadius: range(230, 290),
    /** Velocity stretch scale */
    velStretch: range(0.85, 1.2),
    /** Opening / ending copy */
    openingLine: pick(coarse ? OPENING_LINES_TOUCH : OPENING_LINES),
    endingLine: pick(ENDING_LINES),
    endingCta: 'Replay',
  };
}

/** Singleton for this page visit */
export const SESSION = createSessionMotion();
