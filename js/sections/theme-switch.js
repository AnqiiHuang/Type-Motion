/**
 * Section 7 — Theme Switch
 *
 * Large preview of the active theme + grid of theme options.
 * Quiet stage-complete cue after the visitor tries a theme.
 */

import { ANIMATION, EXPERIENCE } from '../config.js';
import { THEMES, getTheme } from '../theme.js';
import {
  setFeedbackLabel,
  markStageComplete,
  wait,
} from '../utils/feedback.js';

/**
 * Initialize Theme Switch section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initThemeSwitch(section) {
  const intro = section.querySelector('.theme__intro');
  const grid = section.querySelector('.theme__grid');
  const current = section.querySelector('[data-theme-label]');
  const hint = section.querySelector('.theme__hint');
  const eyebrow = section.querySelector('.theme__eyebrow');
  const cleanups = [];
  let completed = false;
  const initialTheme = getTheme();

  const active = getTheme();
  section.querySelectorAll('[data-theme-option]').forEach((el) => {
    const on = el.getAttribute('data-theme-option') === active;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  if (current) {
    const theme = THEMES.find((t) => t.id === active);
    current.textContent = theme?.label ?? active;
  }

  const onThemeChange = async (e) => {
    const id = e.detail?.theme;
    const theme = THEMES.find((t) => t.id === id);
    if (hint && theme) {
      gsap.fromTo(
        hint,
        { opacity: 0.35, y: 6 },
        {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.hover,
          ease: ANIMATION.ease.out,
        }
      );
      hint.textContent = theme.description;
    }
    if (current) {
      gsap.fromTo(
        current,
        { opacity: 0.4, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.click,
          ease: ANIMATION.ease.expo,
        }
      );
      current.textContent = theme?.label ?? id;
    }

    if (!completed && id && id !== initialTheme) {
      completed = true;
      markStageComplete('theme-switch');
      if (eyebrow) {
        await setFeedbackLabel(eyebrow, EXPERIENCE.feedback.stageComplete, {
          stage: false,
        });
        await wait(EXPERIENCE.feedbackHoldMs);
        await setFeedbackLabel(eyebrow, 'Theme', { stage: true });
      }
    }
  };

  window.addEventListener('themechange', onThemeChange);
  cleanups.push(() => window.removeEventListener('themechange', onThemeChange));

  if (hint) {
    const theme = THEMES.find((t) => t.id === active);
    hint.textContent = theme?.description ?? '';
  }

  if (intro) gsap.set(intro, { opacity: 0, y: 18 });
  if (grid) gsap.set(grid, { opacity: 0, y: 24 });

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    once: true,
    onEnter: () => {
      if (intro) {
        gsap.to(intro, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.slow,
          ease: ANIMATION.ease.expo,
        });
      }
      if (grid) {
        gsap.to(grid, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.slow,
          ease: ANIMATION.ease.expo,
          delay: 0.12,
        });
      }
    },
  });

  cleanups.push(() => entrance.kill());

  return () => cleanups.forEach((fn) => fn());
}
