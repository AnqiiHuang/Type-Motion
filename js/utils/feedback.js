/**
 * Lightweight completion feedback helpers.
 * Colors come only from existing theme tokens via CSS classes.
 */

import { ANIMATION, EXPERIENCE } from '../config.js';

/**
 * Crossfade a label element to new copy.
 * @param {HTMLElement | null} el
 * @param {string} text
 * @param {{ stage?: boolean, duration?: number }} [opts]
 */
export function setFeedbackLabel(el, text, opts = {}) {
  if (!el) return Promise.resolve();

  const { stage = true, duration = ANIMATION.duration.hover } = opts;

  return new Promise((resolve) => {
    gsap.killTweensOf(el);
    gsap.to(el, {
      opacity: 0,
      y: -4,
      duration,
      ease: ANIMATION.ease.soft,
      onComplete: () => {
        el.textContent = text;
        el.classList.toggle('is-stage', Boolean(text) && stage);
        el.classList.toggle('is-feedback', Boolean(text) && !stage);
        if (!text) {
          resolve();
          return;
        }
        gsap.fromTo(
          el,
          { opacity: 0, y: 6 },
          {
            opacity: stage ? 0.92 : 0.88,
            y: 0,
            duration: ANIMATION.duration.click,
            ease: ANIMATION.ease.out,
            onComplete: resolve,
          }
        );
      },
    });
  });
}

/**
 * Brief affirmative flash on a section cue element.
 * @param {HTMLElement | null} el
 * @param {string} text
 * @param {number} [holdMs]
 */
export async function flashFeedback(el, text, holdMs = EXPERIENCE.feedbackHoldMs) {
  if (!el) return;
  await setFeedbackLabel(el, text, { stage: false });
  await wait(holdMs);
}

/**
 * @param {number} ms
 */
export function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Show the global scroll hint (homepage + section 2 continue cue).
 * @param {string} [copy]
 */
export function showContinueHint(copy = 'Scroll') {
  const hint = document.querySelector('.scroll-hint');
  const text = hint?.querySelector('.scroll-hint__text');
  if (!hint) return;

  if (text) text.textContent = copy;
  hint.classList.add('is-visible');
  hint.classList.remove('is-continue');
  gsap.set(hint, { opacity: 1, clearProps: 'opacity' });
}

/**
 * Hide global scroll hint (hero Scroll cue).
 */
export function hideContinueHint() {
  const hint = document.querySelector('.scroll-hint');
  const text = hint?.querySelector('.scroll-hint__text');
  if (text) gsap.set(text, { y: 0 });
  hint?.classList.remove('is-visible', 'is-continue');
}

/**
 * Lightweight stage completion tracker (tutorial + 5 chapters = 6).
 */
const completed = new Set();

/**
 * @param {string} stageId
 * @returns {boolean} true if newly completed
 */
export function markStageComplete(stageId) {
  if (completed.has(stageId)) return false;
  completed.add(stageId);
  window.dispatchEvent(
    new CustomEvent('stagecomplete', {
      detail: {
        id: stageId,
        count: completed.size,
        total: 6,
      },
    })
  );
  return true;
}

export function getStageProgress() {
  return { count: completed.size, total: 6, ids: [...completed] };
}

export function resetStageProgress() {
  completed.clear();
}
