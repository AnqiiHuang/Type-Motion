/**
 * Section 8 — About / Ending
 *
 * Project statement → back to top.
 */

import { ANIMATION } from '../config.js';
import {
  resetStageProgress,
  hideContinueHint,
} from '../utils/feedback.js';
import { resetMouseInteraction } from './mouse-interaction.js';

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
  const restartBtn = section.querySelector('[data-about-restart]');

  const cleanups = [];

  const prep = [eyebrow, title, rule, body, footer, restartBtn].filter(Boolean);

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
          rule,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.normal,
          },
          '-=0.45'
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

      if (restartBtn) {
        tl.to(
          restartBtn,
          {
            opacity: 1,
            y: 0,
            duration: ANIMATION.duration.normal,
          },
          '-=0.25'
        );
      }
    },
  });

  const onRestart = (e) => {
    e.preventDefault();
    hideContinueHint();
    resetStageProgress();
    resetMouseInteraction();

    const hint = document.querySelector('.scroll-hint');
    const hintText = hint?.querySelector('.scroll-hint__text');
    if (hintText) hintText.textContent = 'Scroll';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => ScrollTrigger.refresh(), 600);
  };

  if (restartBtn) {
    restartBtn.addEventListener('click', onRestart);
    cleanups.push(() => restartBtn.removeEventListener('click', onRestart));
  }

  cleanups.push(() => entrance.kill());

  return () => cleanups.forEach((fn) => fn());
}
