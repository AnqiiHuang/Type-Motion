/**
 * Section 8 — About / Ending
 *
 * Closing summary → credit → soft restart (header + footer CTA).
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

  gsap.set(prep, { opacity: 0, y: 20 });

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: () => {
      hideContinueHint();

      const tl = gsap.timeline({
        defaults: {
          ease: ANIMATION.ease.smooth,
          duration: ANIMATION.duration.normal,
        },
      });

      tl.to(eyebrow, {
        opacity: 1,
        y: 0,
      })
        .to(
          title,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.slow,
          },
          '-=0.18'
        )
        .to(
          tagline,
          {
            opacity: 1,
            y: 0,
          },
          '-=0.28'
        )
        .to(
          rule,
          {
            opacity: 1,
            y: 0,
          },
          '-=0.32'
        )
        .to(
          body,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.slow,
          },
          '-=0.28'
        )
        .to(
          footer,
          {
            opacity: 1,
            y: 0,
          },
          '-=0.32'
        );
    },
  });

  cleanups.push(() => entrance.kill());

  return () => cleanups.forEach((fn) => fn());
}
