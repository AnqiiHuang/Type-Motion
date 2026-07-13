/**
 * Section 3 — Variable Font Playground
 *
 * Left: Weight / Width / Spacing / Rotation sliders
 * Right: live "HELLO" preview driven by variable font axes
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';

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

/**
 * Initialize Variable Font Playground
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initFontPlayground(section) {
  const sample = section.querySelector('[data-playground-sample]');
  const controls = section.querySelector('.playground__controls');
  const preview = section.querySelector('.playground__preview');
  const inputs = section.querySelectorAll('[data-playground-slider]');
  const valueEls = section.querySelectorAll('[data-playground-value]');

  if (!sample || !inputs.length) return () => {};

  const reducedMotion = prefersReducedMotion();
  const duration = reducedMotion ? 0.01 : ANIMATION.duration.fast;
  const ease = ANIMATION.ease.out;
  const cleanups = [];

  // Live state — lerped via GSAP for smoothness
  const state = {
    weight: SLIDERS.weight.default,
    width: SLIDERS.width.default,
    spacing: SLIDERS.spacing.default,
    rotation: SLIDERS.rotation.default,
  };

  // Proxy object so gsap can tween numeric props
  const proxy = { ...state };

  function applyVisuals() {
    sample.style.fontVariationSettings =
      `'wght' ${proxy.weight}, 'wdth' ${proxy.width}`;
    sample.style.fontWeight = String(Math.round(proxy.weight));
    sample.style.fontStretch = `${proxy.width}%`;
    sample.style.letterSpacing = `${proxy.spacing}em`;
    gsap.set(sample, { rotation: proxy.rotation });
  }

  // Initial paint
  applyVisuals();

  /**
   * Smoothly tween proxy → target, updating sample every frame
   * @param {Partial<typeof state>} targets
   */
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

  // Sync value labels
  const valueMap = {};
  valueEls.forEach((el) => {
    valueMap[el.dataset.playgroundValue] = el;
  });

  function updateLabel(key, value) {
    const el = valueMap[key];
    const def = SLIDERS[key];
    if (el && def) el.textContent = def.format(value);
  }

  // Wire sliders
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

  // Prep entrance offsets
  if (controls) gsap.set(controls, { y: 20 });
  if (preview) gsap.set(preview, { opacity: 0 });

  cleanups.push(() => {
    entrance.kill();
    gsap.killTweensOf(proxy);
    gsap.killTweensOf(sample);
  });

  return () => cleanups.forEach((fn) => fn());
}
