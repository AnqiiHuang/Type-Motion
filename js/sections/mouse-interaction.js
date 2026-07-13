/**
 * Section 2 — Mouse Interaction
 *
 * Each letter of "DESIGN" reacts independently to cursor proximity:
 * scale ↑, slight rotation, stronger shadow, heavier weight.
 * Leaves → eases back to rest.
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';

const WORD = 'DESIGN';

/** Proximity falloff radius in px */
const INFLUENCE_RADIUS = 180;

/** Max transforms at full influence */
const EFFECT = {
  scale: 1.28,
  rotate: 12,       // degrees
  y: -18,           // px lift
  weight: 700,
  restWeight: 400,
  shadow: 28,       // max blur px
};

/**
 * Split word into interactive letter spans
 * @param {HTMLElement} container
 * @param {string} word
 * @returns {HTMLElement[]}
 */
function buildLetters(container, word) {
  container.textContent = '';
  const letters = [];

  [...word].forEach((char) => {
    const span = document.createElement('span');
    span.className = 'mouse__letter';
    span.textContent = char;
    span.setAttribute('aria-hidden', 'true');
    container.appendChild(span);
    letters.push(span);
  });

  return letters;
}

/**
 * Smoothstep interpolation 0→1
 * @param {number} t
 */
function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Initialize Mouse Interaction section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initMouseInteraction(section) {
  const wordEl = section.querySelector('[data-mouse-word]');
  const label = section.querySelector('.mouse__label');
  if (!wordEl) return () => {};

  const letters = buildLetters(wordEl, WORD);
  const reducedMotion = prefersReducedMotion();
  const cleanups = [];
  let active = false;
  let rafId = null;
  let mouseX = 0;
  let mouseY = 0;
  let hasPointer = false;

  // Per-letter GSAP quickTo setters for buttery updates
  const letterAnimators = letters.map((letter) => ({
    el: letter,
    scale: gsap.quickTo(letter, 'scale', {
      duration: ANIMATION.duration.normal,
      ease: ANIMATION.ease.out,
    }),
    rotate: gsap.quickTo(letter, 'rotation', {
      duration: ANIMATION.duration.normal,
      ease: ANIMATION.ease.out,
    }),
    y: gsap.quickTo(letter, 'y', {
      duration: ANIMATION.duration.normal,
      ease: ANIMATION.ease.out,
    }),
    // CSS custom props for weight & shadow (can't quickTo fontWeight smoothly on all browsers)
    weightTween: null,
  }));

  // ── Entrance ────────────────────────────────────────────────────────────
  gsap.set(letters, { opacity: 0, y: 32 });
  if (label) gsap.set(label, { opacity: 0, y: 12 });

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    once: true,
    onEnter: () => {
      gsap.to(letters, {
        opacity: 1,
        y: 0,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.expo,
        stagger: 0.06,
      });
      if (label) {
        gsap.to(label, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
          delay: 0.3,
        });
      }
    },
  });

  // ── Proximity loop ──────────────────────────────────────────────────────
  function applyEffects() {
    if (!active || reducedMotion) return;

    letterAnimators.forEach(({ el, scale, rotate, y }) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const dist = Math.hypot(dx, dy);

      // Influence 1 at center → 0 at radius edge
      const influence = hasPointer
        ? smoothstep(1 - dist / INFLUENCE_RADIUS)
        : 0;

      scale(1 + (EFFECT.scale - 1) * influence);
      rotate(EFFECT.rotate * influence * (dx >= 0 ? 1 : -1));
      y(EFFECT.y * influence);

      const weight = Math.round(
        EFFECT.restWeight + (EFFECT.weight - EFFECT.restWeight) * influence
      );
      const shadowBlur = EFFECT.shadow * influence;
      const shadowY = 8 * influence;

      el.style.fontWeight = String(weight);
      el.style.textShadow = influence > 0.01
        ? `0 ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${0.22 * influence})`
        : 'none';
    });

    rafId = requestAnimationFrame(applyEffects);
  }

  function startLoop() {
    if (active || reducedMotion) return;
    active = true;
    rafId = requestAnimationFrame(applyEffects);
  }

  function stopLoop() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function resetLetters() {
    hasPointer = false;
    letterAnimators.forEach(({ el, scale, rotate, y }) => {
      scale(1);
      rotate(0);
      y(0);
      el.style.fontWeight = String(EFFECT.restWeight);
      el.style.textShadow = 'none';
    });
  }

  // Only track when section is in view
  const visibility = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onEnter: startLoop,
    onEnterBack: startLoop,
    onLeave: () => {
      stopLoop();
      resetLetters();
    },
    onLeaveBack: () => {
      stopLoop();
      resetLetters();
    },
  });

  const onMouseMove = (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    hasPointer = true;
  };

  const onMouseLeave = () => {
    resetLetters();
  };

  // Touch: tap a letter briefly for a soft pulse (no continuous hover)
  const onTouch = (e) => {
    if (reducedMotion) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    mouseX = touch.clientX;
    mouseY = touch.clientY;
    hasPointer = true;

    // Brief pulse then settle
    startLoop();
    window.setTimeout(() => resetLetters(), 600);
  };

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  section.addEventListener('mouseleave', onMouseLeave);
  section.addEventListener('touchstart', onTouch, { passive: true });

  cleanups.push(() => {
    window.removeEventListener('mousemove', onMouseMove);
    section.removeEventListener('mouseleave', onMouseLeave);
    section.removeEventListener('touchstart', onTouch);
    stopLoop();
    entrance.kill();
    visibility.kill();
  });

  // Kick off if already in view
  const rect = section.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    startLoop();
  }

  return () => cleanups.forEach((fn) => fn());
}
