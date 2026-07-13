/**
 * Boot loader — TYPE + progress bar, then hand off to Hero.
 * Uses only existing theme color tokens.
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from './animation.js';

/**
 * Run the loading sequence, then resolve when the overlay is gone.
 * @returns {Promise<void>}
 */
export function runLoader() {
  const loader = document.querySelector('[data-loader]');
  const bar = document.querySelector('[data-loader-bar]');
  const status = loader?.querySelector('.loader__status');
  const word = loader?.querySelector('.loader__word');

  document.body.classList.add('is-loading');

  if (!loader) {
    document.body.classList.remove('is-loading');
    return Promise.resolve();
  }

  const reduced = prefersReducedMotion();

  return new Promise((resolve) => {
    const finish = () => {
      loader.classList.add('is-done');
      loader.setAttribute('aria-busy', 'false');
      document.body.classList.remove('is-loading');
      window.setTimeout(() => {
        loader.remove();
        resolve();
      }, reduced ? 40 : 700);
    };

    if (reduced) {
      if (bar) bar.style.width = '100%';
      finish();
      return;
    }

    const progress = { value: 0 };
    if (word) gsap.set(word, { opacity: 0, y: 8, scale: 1.04 });
    if (status) gsap.set(status, { opacity: 0 });
    if (bar) gsap.set(bar, { width: '0%' });

    const tl = gsap.timeline({
      onComplete: finish,
    });

    if (word) {
      tl.to(word, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.expo,
      });
    }

    if (status) {
      tl.to(
        status,
        {
          opacity: 1,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
        },
        '-=0.45'
      );
    }

    tl.to(
      progress,
      {
        value: 1,
        duration: 1.15,
        ease: ANIMATION.ease.smooth,
        onUpdate: () => {
          if (bar) bar.style.width = `${(progress.value * 100).toFixed(1)}%`;
        },
      },
      '-=0.2'
    );

    // Wait for fonts if available, without blocking forever
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    fontsReady.then(() => {
      if (progress.value < 0.85) {
        gsap.to(progress, {
          value: 1,
          duration: 0.35,
          ease: ANIMATION.ease.soft,
          overwrite: 'auto',
          onUpdate: () => {
            if (bar) bar.style.width = `${(progress.value * 100).toFixed(1)}%`;
          },
        });
      }
    });
  });
}
