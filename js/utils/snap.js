/**
 * Section snap — after the user stops scrolling, settle on the nearest panel.
 * Uses ScrollTrigger so pin spacers (hero / tutorial) stay in sync.
 */

import { ANIMATION, isCoarsePointer } from '../config.js';
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

  const coarse = isCoarsePointer();

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
      // Touch: slightly longer settle so momentum finishes before snap
      duration: coarse
        ? { min: 0.15, max: 0.35 }
        : { min: 0.2, max: ANIMATION.duration.scroll },
      delay: coarse ? 0.12 : 0.06,
      ease: ANIMATION.ease.smooth,
      // Inertia on mobile lands between sections (empty black gaps)
      inertia: !coarse,
      directional: true,
    },
  });

  const onRefresh = () => rebuildSnap();
  ScrollTrigger.addEventListener('refresh', onRefresh);

  // Mobile browser chrome show/hide shifts layout — rebuild snap points
  let resizeTimer = 0;
  const onViewportChange = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      ScrollTrigger.refresh();
    }, 120);
  };

  window.addEventListener('orientationchange', onViewportChange);
  window.visualViewport?.addEventListener('resize', onViewportChange);

  // Pins from eager sections may land just after this init
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });

  return () => {
    window.clearTimeout(resizeTimer);
    window.removeEventListener('orientationchange', onViewportChange);
    window.visualViewport?.removeEventListener('resize', onViewportChange);
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    trigger.kill();
  };
}
