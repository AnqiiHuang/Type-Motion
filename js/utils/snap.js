/**
 * Section snap — after the user stops scrolling, settle on the nearest panel.
 * Uses ScrollTrigger so pin spacers (hero / tutorial) stay in sync.
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from './animation.js';

/**
 * Document Y where a section's top meets the viewport top.
 * Pinned sections live inside a `.pin-spacer` — use that for scroll position.
 * @param {Element} section
 * @returns {number}
 */
function sectionScrollTop(section) {
  const parent = section.parentElement;
  const el =
    parent?.classList.contains('pin-spacer') ? parent : section;
  return el.offsetTop;
}

/**
 * @returns {Function} cleanup
 */
export function initSectionSnap() {
  if (prefersReducedMotion()) return () => {};

  const sections = gsap.utils.toArray('.section');
  if (sections.length < 2) return () => {};

  /** @type {(value: number) => number} */
  let snapProgress = (value) => value;

  function rebuildSnap() {
    const max = ScrollTrigger.maxScroll(window);
    if (!max) {
      snapProgress = (value) => value;
      return;
    }

    const points = sections
      .map((section) =>
        gsap.utils.clamp(0, 1, sectionScrollTop(section) / max)
      )
      .filter((point, i, arr) => i === 0 || point > arr[i - 1] + 0.001);

    if (!points.includes(0)) points.unshift(0);
    if (!points.includes(1) && points[points.length - 1] < 0.999) {
      points.push(1);
    }

    snapProgress = gsap.utils.snap(points);
  }

  rebuildSnap();

  const trigger = ScrollTrigger.create({
    id: 'section-snap',
    start: 0,
    end: 'max',
    snap: {
      snapTo: (value) => snapProgress(value),
      duration: { min: 0.2, max: ANIMATION.duration.scroll },
      delay: 0.06,
      ease: ANIMATION.ease.smooth,
      inertia: true,
    },
  });

  const onRefresh = () => rebuildSnap();
  ScrollTrigger.addEventListener('refresh', onRefresh);

  // Pins from eager sections may land just after this init
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });

  return () => {
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    trigger.kill();
  };
}
