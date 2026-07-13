/**
 * Section 8 — About / Ending
 *
 * Closing statement → credit. Soft restart lives in the header.
 */

import { ANIMATION } from '../config.js';
import { hideContinueHint } from '../utils/feedback.js';

/**
 * Initialize About section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initAbout(section) {
  const eyebrow = section.querySelector('.about__eyebrow');
  const title = section.querySelector('.about__title');
  const tagline =
    section.querySelector('[data-about-tagline]') ||
    section.querySelector('.about__tagline');
  const rule = section.querySelector('.about__rule');
  const body = section.querySelector('.about__body');
  const footer = section.querySelector('.about__footer');

  const cleanups = [];

  const prep = [eyebrow, title, tagline, rule, body, footer].filter(Boolean);

  gsap.set(prep, { opacity: 0, y: 24 });

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: () => {
      hideContinueHint();

      const tl = gsap.timeline({
        defaults: { ease: ANIMATION.ease.expo },
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
          '-=0.2'
        )
        .to(
          tagline,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.normal,
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
          '-=0.4'
        )
        .to(
          body,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.slow,
          },
          '-=0.35'
        )
        .to(
          footer,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.normal,
          },
          '-=0.4'
        );
    },
  });

  cleanups.push(() => entrance.kill());

  return () => cleanups.forEach((fn) => fn());
}
