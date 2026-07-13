/**
 * Animation utilities — GSAP helpers shared across sections
 */

import { ANIMATION } from '../config.js';

/** Register GSAP plugins once */
let pluginsRegistered = false;

export function registerGSAPPlugins() {
  if (pluginsRegistered) return;
  gsap.registerPlugin(ScrollTrigger);
  pluginsRegistered = true;
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Standard fade-in for section elements
 * @param {Element|Element[]} targets
 * @param {object} [options]
 */
export function fadeIn(targets, options = {}) {
  const {
    delay = 0,
    duration = ANIMATION.duration.normal,
    ease = ANIMATION.ease.out,
    y = 24,
  } = options;

  return gsap.from(targets, {
    opacity: 0,
    y,
    duration,
    delay,
    ease,
  });
}

/**
 * Create a lazy section initializer
 * Only runs initFn when the section enters the viewport.
 * @param {string} selector — section element selector
 * @param {Function} initFn — section init function, returns cleanup
 * @returns {Function} cleanup
 */
export function lazyInitSection(selector, initFn) {
  const section = document.querySelector(selector);
  if (!section) return () => {};

  let cleanup = null;
  let initialized = false;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !initialized) {
        initialized = true;
        cleanup = initFn(section) ?? null;
        observer.disconnect();
      }
    },
    { rootMargin: '50px 0px', threshold: 0.01 }
  );

  observer.observe(section);

  // Hero is above the fold — init immediately if already visible
  const rect = section.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0 && !initialized) {
    initialized = true;
    observer.disconnect();
    cleanup = initFn(section) ?? null;
  }

  return () => {
    observer.disconnect();
    cleanup?.();
  };
}
