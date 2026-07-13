/**
 * Soft restart — return to Hero and reset interactive state without reload.
 */

import { ANIMATION } from '../config.js';
import { setTheme, getBootTheme } from '../theme.js';
import {
  hideContinueHint,
  resetStageProgress,
  showContinueHint,
} from './feedback.js';
import { resetMouseInteraction } from '../sections/mouse-interaction.js';
import { resetFontPlayground } from '../sections/font-playground.js';
import { resetHero } from '../sections/hero.js';

let restarting = false;

/**
 * Wire the header Restart control.
 * @returns {Function} cleanup
 */
export function initRestart() {
  const buttons = document.querySelectorAll('[data-restart]');

  const onClick = (e) => {
    e.preventDefault();
    restartExperience();
  };

  buttons.forEach((btn) => btn.addEventListener('click', onClick));

  return () => {
    buttons.forEach((btn) => btn.removeEventListener('click', onClick));
  };
}

/**
 * Reset journey state and smoothly return to the top.
 */
export function restartExperience() {
  if (restarting) return;
  restarting = true;

  hideContinueHint();
  resetStageProgress();
  resetMouseInteraction();
  resetFontPlayground();

  // Restore boot theme (palette from existing theme tokens only)
  setTheme(getBootTheme(), { animate: true });

  const hint = document.querySelector('.scroll-hint:not(.scroll-hint--section)');
  const hintText = hint?.querySelector('.scroll-hint__text');
  if (hintText) hintText.textContent = 'Scroll to Start';

  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const duration = reduced ? 0.2 : ANIMATION.duration.climax;
  const startY = window.scrollY || window.pageYOffset || 0;

  gsap.to(
    { y: startY },
    {
      y: 0,
      duration,
      ease: ANIMATION.ease.smooth,
      onUpdate() {
        window.scrollTo(0, this.targets()[0].y);
      },
      onComplete: () => {
        window.scrollTo(0, 0);
        ScrollTrigger.refresh();
        resetHero();
        showContinueHint('Scroll to Start');
        restarting = false;
      },
    }
  );
}
