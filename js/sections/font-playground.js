/**
 * Section 3 — Variable Font Playground
 *
 * Desktop: hover near the sample → axes respond (weight / width / scale).
 * Mobile:  finger drag across type + optional subtle device tilt.
 * Secondary: sliders for precise control.
 */

import { ANIMATION, EXPERIENCE, isCoarsePointer } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { setCursor, resetCursor } from '../utils/cursor.js';
import { createOrientationReader } from '../utils/orientation.js';
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

const HINT_DESKTOP = 'Drag across the type · Fine-tune with sliders';
const HINT_MOBILE = 'Drag across the type · Fine-tune with sliders';

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
  const sliders = section.querySelector('.playground__sliders');
  const inputs = section.querySelectorAll('[data-playground-slider]');
  const valueEls = section.querySelectorAll('[data-playground-value]');
  const cue = section.querySelector('[data-section-cue]') || section.querySelector('.playground__eyebrow');
  const hint = section.querySelector('[data-playground-hint]') || section.querySelector('.playground__hint');

  if (!sample || !inputs.length) return () => {};

  const reducedMotion = prefersReducedMotion();
  const duration = reducedMotion ? 0.01 : ANIMATION.duration.hover;
  const ease = ANIMATION.ease.out;
  const cleanups = [];
  let completed = false;
  let hoverTravel = 0;
  let lastX = 0;
  let lastY = 0;
  let sliderTouches = 0;
  let dragging = false;
  const travelNeeded =
    Math.min(window.innerWidth, window.innerHeight) < 700 ? 90 : 180;
  const isCoarse = isCoarsePointer();

  if (hint) {
    hint.textContent = isCoarse ? HINT_MOBILE : HINT_DESKTOP;
  }

  const state = {
    weight: SLIDERS.weight.default,
    width: SLIDERS.width.default,
    spacing: SLIDERS.spacing.default,
    rotation: SLIDERS.rotation.default,
  };

  const proxy = { ...state };
  const hoverBoost = { weight: 0, width: 0, scale: 1, x: 0, y: 0 };
  const gyro = { x: 0, y: 0, rot: 0 };
  const orientation = createOrientationReader();
  /** Max gyro contribution — keep barely perceptible */
  const GYRO_PX = 4;
  const GYRO_ROT = 1.2;

  function applyVisuals() {
    const w = proxy.weight + hoverBoost.weight;
    const wd = proxy.width + hoverBoost.width;
    // Weight uses the real VF axis via font-weight.
    // Width uses scaleX — font-stretch/`wdth` is unreliable here once
    // font-weight is applied, so geometric scale keeps the control honest.
    sample.style.fontFamily = "'Roboto Flex', sans-serif";
    sample.style.fontVariationSettings = 'normal';
    sample.style.fontOpticalSizing = 'none';
    sample.style.fontWeight = String(Math.round(w));
    sample.style.fontStretch = '100%';
    sample.style.letterSpacing = `${proxy.spacing}em`;
    gsap.set(sample, {
      x: hoverBoost.x + gyro.x,
      y: hoverBoost.y + gyro.y,
      rotation: proxy.rotation + gyro.rot,
      scaleX: hoverBoost.scale * (wd / 100),
      scaleY: hoverBoost.scale,
    });
  }

  applyVisuals();

  // Re-apply once the variable font face is ready
  if (document.fonts?.load) {
    document.fonts
      .load("500 64px 'Roboto Flex'")
      .then(() => applyVisuals())
      .catch(() => {});
  }

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
      sliderTouches += 1;
      // Touch / coarse pointers: sliding counts as interaction
      if (isCoarse && sliderTouches >= 2) completeStage();
    };

    input.addEventListener('input', onInput);
    cleanups.push(() => input.removeEventListener('input', onInput));
  });

  /**
   * Map pointer position relative to the sample into VF boosts.
   * @param {number} clientX
   * @param {number} clientY
   * @param {{ follow?: boolean }} [opts]
   */
  function respondAt(clientX, clientY, opts = {}) {
    if (reducedMotion) return;
    const rect = sample.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (clientX - cx) / (rect.width * 0.5);
    const dy = (clientY - cy) / (rect.height * 0.5);
    const dist = Math.min(1, Math.hypot(dx, dy));
    const proximity = responseCurve(1 - dist);

    if (lastX || lastY) {
      hoverTravel += Math.hypot(clientX - lastX, clientY - lastY);
    }
    lastX = clientX;
    lastY = clientY;

    const follow = Boolean(opts.follow);
    gsap.to(hoverBoost, {
      weight: proximity * 360,
      width: proximity * 36 * (dx >= 0 ? 1 : -1),
      scale: 1 + proximity * 0.12,
      x: follow ? clamp(dx, -1, 1) * 10 * proximity : 0,
      y: follow ? clamp(dy, -1, 1) * 8 * proximity : 0,
      duration: ANIMATION.duration.hover,
      ease: ANIMATION.ease.soft,
      overwrite: 'auto',
      onUpdate: applyVisuals,
    });

    if (!completed && hoverTravel > travelNeeded && proximity > 0.2) {
      completeStage();
    }
  }

  function settleBoost() {
    lastX = 0;
    lastY = 0;
    gsap.to(hoverBoost, {
      weight: 0,
      width: 0,
      scale: 1,
      x: 0,
      y: 0,
      duration: ANIMATION.duration.reset,
      ease: ANIMATION.ease.out,
      overwrite: 'auto',
      onUpdate: applyVisuals,
    });
  }

  // ── Desktop: hover response ─────────────────────────────────────────────
  const onPreviewMove = (e) => {
    if (isCoarse) return;
    respondAt(e.clientX, e.clientY);
    setCursor('hover');
  };

  const onPreviewLeave = () => {
    if (isCoarse) return;
    resetCursor();
    settleBoost();
  };

  // ── Mobile: finger drag (no hover dependency) ───────────────────────────
  const onPreviewDown = (e) => {
    if (!isCoarse) return;
    if (e.target.closest('.playground__slider, input, label')) return;
    dragging = true;
    orientation.request();
    try {
      preview?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    respondAt(e.clientX, e.clientY, { follow: true });
  };

  const onPreviewDrag = (e) => {
    if (!isCoarse || !dragging) return;
    respondAt(e.clientX, e.clientY, { follow: true });
  };

  const onPreviewUp = (e) => {
    if (!isCoarse) return;
    dragging = false;
    try {
      preview?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    settleBoost();
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
    if (isCoarse) {
      preview.addEventListener('pointerdown', onPreviewDown, { passive: true });
      preview.addEventListener('pointermove', onPreviewDrag, { passive: true });
      preview.addEventListener('pointerup', onPreviewUp, { passive: true });
      preview.addEventListener('pointercancel', onPreviewUp, { passive: true });
      cleanups.push(() => {
        preview.removeEventListener('pointerdown', onPreviewDown);
        preview.removeEventListener('pointermove', onPreviewDrag);
        preview.removeEventListener('pointerup', onPreviewUp);
        preview.removeEventListener('pointercancel', onPreviewUp);
      });
    } else {
      preview.addEventListener('pointermove', onPreviewMove, { passive: true });
      preview.addEventListener('pointerleave', onPreviewLeave);
      cleanups.push(() => {
        preview.removeEventListener('pointermove', onPreviewMove);
        preview.removeEventListener('pointerleave', onPreviewLeave);
      });
    }
  }

  // Subtle gyro — only on coarse devices, fails closed
  let gyroRaf = 0;
  if (isCoarse && !reducedMotion) {
    const tickGyro = () => {
      const o = orientation.sample();
      gyro.x = o.x * GYRO_PX;
      gyro.y = o.y * GYRO_PX;
      gyro.rot = o.x * GYRO_ROT;
      applyVisuals();
      gyroRaf = requestAnimationFrame(tickGyro);
    };
    // Start after first gesture requests permission; still tick at rest (zeros)
    gyroRaf = requestAnimationFrame(tickGyro);
    // Opportunistic enable (non-iOS often works without gesture)
    orientation.request();
    cleanups.push(() => {
      cancelAnimationFrame(gyroRaf);
      orientation.destroy();
    });
  } else {
    cleanups.push(() => orientation.destroy());
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
      if (sliders) {
        gsap.to(sliders, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.slow,
          ease: ANIMATION.ease.expo,
          delay: 0.18,
        });
      }
    },
  });

  if (controls) gsap.set(controls, { y: 20 });
  if (preview) gsap.set(preview, { opacity: 0 });
  if (sliders) gsap.set(sliders, { y: 16, opacity: 0 });

  resetFontPlaygroundFn = () => {
    completed = false;
    hoverTravel = 0;
    sliderTouches = 0;
    lastX = 0;
    lastY = 0;
    dragging = false;
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
    hoverBoost.x = 0;
    hoverBoost.y = 0;
    gyro.x = 0;
    gyro.y = 0;
    gyro.rot = 0;
    gsap.killTweensOf(proxy);
    gsap.killTweensOf(hoverBoost);
    applyVisuals();
    if (cue) {
      cue.textContent = 'Variable Font';
      cue.classList.add('is-stage');
      cue.classList.remove('is-feedback');
      gsap.set(cue, { clearProps: 'opacity,transform' });
    }
    if (hint) {
      hint.textContent = isCoarse ? HINT_MOBILE : HINT_DESKTOP;
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

/**
 * @param {number} v
 * @param {number} min
 * @param {number} max
 */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
