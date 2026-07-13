/**
 * Subtle device-orientation (gyroscope) offset for mobile typography.
 * Fails closed when unsupported, denied, or reduced-motion is on.
 */

import { prefersReducedMotion } from './animation.js';
import { isCoarsePointer } from '../config.js';

const LIMIT_DEG = 18;
const SMOOTH = 0.08;

/**
 * @typedef {{ beta: number, gamma: number, ready: boolean }} OrientationState
 */

/**
 * @returns {OrientationState}
 */
function emptyState() {
  return { beta: 0, gamma: 0, ready: false };
}

/**
 * Map device tilt into a tiny normalized offset (−1…1).
 * @param {number} deg
 * @returns {number}
 */
function normalizeTilt(deg) {
  const clamped = Math.max(-LIMIT_DEG, Math.min(LIMIT_DEG, deg));
  return clamped / LIMIT_DEG;
}

/**
 * Boot a low-amplitude orientation reader.
 * Call `request()` after a user gesture on iOS 13+.
 *
 * @returns {{
 *   state: OrientationState,
 *   request: () => Promise<boolean>,
 *   sample: () => { x: number, y: number },
 *   destroy: () => void
 * }}
 */
export function createOrientationReader() {
  const state = emptyState();
  let enabled = false;
  let permissionAsked = false;
  /** @type {number} */
  let sx = 0;
  /** @type {number} */
  let sy = 0;

  const onOrient = (e) => {
    if (e.beta == null || e.gamma == null) return;
    // beta: front-back (−180…180), gamma: left-right (−90…90)
    state.beta = e.beta;
    state.gamma = e.gamma;
    state.ready = true;
  };

  function attach() {
    if (enabled) return;
    enabled = true;
    window.addEventListener('deviceorientation', onOrient, { passive: true });
  }

  function detach() {
    if (!enabled) return;
    enabled = false;
    window.removeEventListener('deviceorientation', onOrient);
    state.ready = false;
    state.beta = 0;
    state.gamma = 0;
    sx = 0;
    sy = 0;
  }

  /**
   * Attempt to enable orientation. Safe to call repeatedly.
   * @returns {Promise<boolean>}
   */
  async function request() {
    if (!isCoarsePointer() || prefersReducedMotion()) return false;
    if (typeof window.DeviceOrientationEvent === 'undefined') return false;

    if (
      typeof DeviceOrientationEvent.requestPermission === 'function' &&
      !permissionAsked
    ) {
      permissionAsked = true;
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') return false;
      } catch {
        return false;
      }
    }

    attach();
    return true;
  }

  /**
   * Smoothed normalized tilt for typography offsets.
   * @returns {{ x: number, y: number }}
   */
  function sample() {
    if (!enabled || !state.ready) return { x: 0, y: 0 };
    const tx = normalizeTilt(state.gamma);
    const ty = normalizeTilt(state.beta - 45); // rest phone ~ upright
    sx += (tx - sx) * SMOOTH;
    sy += (ty - sy) * SMOOTH;
    return { x: sx, y: sy };
  }

  function destroy() {
    detach();
  }

  return { state, request, sample, destroy };
}
