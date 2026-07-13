/**
 * Section 8 — About
 *
 * Closing statement. Quiet fade-in as the experience resolves.
 */

import { ANIMATION } from '../config.js';

/**
 * Initialize About section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initAbout(section) {
  const eyebrow = section.querySelector('.about__eyebrow');
  const title = section.querySelector('.about__title');
  const rule = section.querySelector('.about__rule');
  const body = section.querySelector('.about__body');
  const footer = section.querySelector('.about__footer');

  const parts = [eyebrow, title, rule, body, footer].filter(Boolean);

  gsap.set(parts, { opacity: 0, y: 28 });

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: () => {
      const tl = gsap.timeline({
        defaults: {
          ease: ANIMATION.ease.expo,
        },
      });

      tl.to(eyebrow, {
        opacity: 1,
        y: 0,
        duration: ANIMATION.duration.normal,
      })
        .to(
          title,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.slow,
          },
          '-=0.35'
        )
        .to(
          rule,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.normal,
          },
          '-=0.55'
        )
        .to(
          body,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.slow,
          },
          '-=0.45'
        )
        .to(
          footer,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.normal,
          },
          '-=0.55'
        );
    },
  });

  return () => entrance.kill();
}
