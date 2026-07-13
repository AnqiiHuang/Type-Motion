/**
 * Section 3 — Variable Font Playground
 *
 * Primary: hover near the sample → axes respond (weight / width / scale).
 * Secondary: sliders for precise control.
 */

import { ANIMATION, EXPERIENCE } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { setCursor, resetCursor } from '../utils/cursor.js';
import {
  setFeedbackLabel,
  markStageComplete,
  wait,
} from '../utils/feedback.js';

/** Slider definitions — maps to visual / font axes */
const SLIDERS = {
  weight: {
    key: 'weight',
    min: 100,
    max: 900,
    step: 1,
    default: 400,
    format: (v) => String(Math.round(v)),
  },
  width: {
    key: 'width',
    min: 50,
    max: 150,
    step: 1,
    default: 100,
    format: (v) => String(Math.round(v)),
  },
  spacing: {
    key: 'spacing',
    min: -0.08,
    max: 0.35,
    step: 0.001,
    default: 0,
    format: (v) => v.toFixed(3),
  },
  rotation: {
    key: 'rotation',
    min: -25,
    max: 25,
    step: 0.1,
    default: 0,
    format: (v) => `${Math.round(v)}°`,
  },
};

/** @type {null | (() => void)} */
let resetFontPlaygroundFn = null;

/**
 * Restore playground sliders / sample to defaults.
 */
export function resetFontPlayground() {
  resetFontPlaygroundFn?.();
}

/**
 * Soft start → stronger mid/late response for hover axes.
 * @param {number} t
 */
function responseCurve(t) {
  const x = Math.max(0, Math.min(1, t));
  const eased = x * x * (3 - 2 * x);
  return eased * Math.pow(x, 0.55) * (0.55 + 0.9 * x);
}

/**
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initFontPlayground(section) {
  const sample = section.querySelector('[data-playground-sample]');
  const controls = section.querySelector('.playground__controls');
  const preview = section.querySelector('.playground__preview');
  const inputs = section.querySelectorAll('[data-playground-slider]');
  const valueEls = section.querySelectorAll('[data-playground-value]');
  const cue = section.querySelector('[data-section-cue]') || section.querySelector('.playground__eyebrow');

  if (!sample || !inputs.length) return () => {};

  const reducedMotion = prefersReducedMotion();
  const duration = reducedMotion ? 0.01 : ANIMATION.duration.hover;
  const ease = ANIMATION.ease.out;
  const cleanups = [];
  let completed = false;
  let hoverTravel = 0;
  let lastX = 0;
  let lastY = 0;

  const state = {
    weight: SLIDERS.weight.default,
    width: SLIDERS.width.default,
    spacing: SLIDERS.spacing.default,
    rotation: SLIDERS.rotation.default,
  };

  const proxy = { ...state };
  const hoverBoost = { weight: 0, width: 0, scale: 1 };

  function applyVisuals() {
    const w = proxy.weight + hoverBoost.weight;
    const wd = proxy.width + hoverBoost.width;
    sample.style.fontVariationSettings = `'wght' ${w}, 'wdth' ${wd}`;
    sample.style.fontWeight = String(Math.round(w));
    sample.style.fontStretch = `${wd}%`;
    sample.style.letterSpacing = `${proxy.spacing}em`;
    gsap.set(sample, { rotation: proxy.rotation, scale: hoverBoost.scale });
  }

  applyVisuals();

  function animateTo(targets) {
    Object.assign(state, targets);
    gsap.to(proxy, {
      ...targets,
      duration,
      ease,
      overwrite: 'auto',
      onUpdate: applyVisuals,
    });
  }

  const valueMap = {};
  valueEls.forEach((el) => {
    valueMap[el.dataset.playgroundValue] = el;
  });

  function updateLabel(key, value) {
    const el = valueMap[key];
    const def = SLIDERS[key];
    if (el && def) el.textContent = def.format(value);
  }

  inputs.forEach((input) => {
    const key = input.dataset.playgroundSlider;
    const def = SLIDERS[key];
    if (!def) return;

    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(def.default);
    updateLabel(key, def.default);

    const onInput = () => {
      const raw = Number(input.value);
      updateLabel(key, raw);
      animateTo({ [key]: raw });
    };

    input.addEventListener('input', onInput);
    cleanups.push(() => input.removeEventListener('input', onInput));
  });

  // ── Primary: hover response on sample ───────────────────────────────────
  const onPreviewMove = (e) => {
    if (reducedMotion) return;
    const rect = sample.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width * 0.5);
    const dy = (e.clientY - cy) / (rect.height * 0.5);
    const dist = Math.min(1, Math.hypot(dx, dy));
    const proximity = responseCurve(1 - dist);

    if (lastX || lastY) {
      hoverTravel += Math.hypot(e.clientX - lastX, e.clientY - lastY);
    }
    lastX = e.clientX;
    lastY = e.clientY;

    gsap.to(hoverBoost, {
      weight: proximity * 360,
      width: proximity * 36 * (dx >= 0 ? 1 : -1),
      scale: 1 + proximity * 0.12,
      duration: ANIMATION.duration.hover,
      ease: ANIMATION.ease.soft,
      overwrite: 'auto',
      onUpdate: applyVisuals,
    });

    setCursor('hover');

    if (!completed && hoverTravel > 180 && proximity > 0.2) {
      completeStage();
    }
  };

  const onPreviewLeave = () => {
    lastX = 0;
    lastY = 0;
    resetCursor();
    gsap.to(hoverBoost, {
      weight: 0,
      width: 0,
      scale: 1,
      duration: ANIMATION.duration.reset,
      ease: ANIMATION.ease.out,
      overwrite: 'auto',
      onUpdate: applyVisuals,
    });
  };

  async function completeStage() {
    if (completed) return;
    completed = true;
    markStageComplete('font-playground');
    if (cue) {
      await setFeedbackLabel(cue, EXPERIENCE.feedback.great, { stage: false });
      await wait(EXPERIENCE.feedbackHoldMs);
      await setFeedbackLabel(cue, 'Variable Font', { stage: true });
    }
  }

  if (preview) {
    preview.addEventListener('pointermove', onPreviewMove, { passive: true });
    preview.addEventListener('pointerleave', onPreviewLeave);
    cleanups.push(() => {
      preview.removeEventListener('pointermove', onPreviewMove);
      preview.removeEventListener('pointerleave', onPreviewLeave);
    });
  }

  // ── Entrance ────────────────────────────────────────────────────────────
  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: () => {
      if (controls) {
        gsap.to(controls, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.slow,
          ease: ANIMATION.ease.expo,
        });
      }
      if (preview) {
        gsap.fromTo(
          preview,
          { opacity: 0, scale: 0.96 },
          {
            opacity: 1,
            scale: 1,
            duration: ANIMATION.duration.slow,
            ease: ANIMATION.ease.expo,
            delay: 0.1,
          }
        );
      }
    },
  });

  if (controls) gsap.set(controls, { y: 20 });
  if (preview) gsap.set(preview, { opacity: 0 });

  resetFontPlaygroundFn = () => {
    completed = false;
    hoverTravel = 0;
    lastX = 0;
    lastY = 0;
    Object.keys(SLIDERS).forEach((key) => {
      state[key] = SLIDERS[key].default;
      proxy[key] = SLIDERS[key].default;
      updateLabel(key, SLIDERS[key].default);
    });
    inputs.forEach((input) => {
      const key = input.dataset.playgroundSlider;
      const def = SLIDERS[key];
      if (def) input.value = String(def.default);
    });
    hoverBoost.weight = 0;
    hoverBoost.width = 0;
    hoverBoost.scale = 1;
    gsap.killTweensOf(proxy);
    gsap.killTweensOf(hoverBoost);
    applyVisuals();
    if (cue) {
      cue.textContent = 'Variable Font';
      cue.classList.add('is-stage');
      cue.classList.remove('is-feedback');
      gsap.set(cue, { clearProps: 'opacity,transform' });
    }
  };

  cleanups.push(() => {
    entrance.kill();
    gsap.killTweensOf(proxy);
    gsap.killTweensOf(hoverBoost);
    gsap.killTweensOf(sample);
    resetFontPlaygroundFn = null;
  });

  return () => cleanups.forEach((fn) => fn());
}
