/**
 * Section 4 — Wave Typography
 *
 * "BRAND DESIGN" letters undulate in a continuous sine wave.
 * Hover → amplitude rises. Click → ease back to baseline.
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';

const TEXT = 'BRAND DESIGN';

const WAVE = {
  /** Baseline amplitude (px) */
  baseAmp: 14,
  /** Hover / excited amplitude (px) */
  hotAmp: 42,
  /** Wave spatial frequency — radians per letter index */
  frequency: 0.55,
  /** Wave speed — radians per second */
  speed: 2.4,
  /** Secondary rotation amplitude (degrees) */
  rotateAmp: 4,
};

/**
 * Build letter / space spans from text
 * @param {HTMLElement} container
 * @param {string} text
 * @returns {HTMLElement[]} letter elements only
 */
function buildLetters(container, text) {
  container.textContent = '';
  const letters = [];

  [...text].forEach((char) => {
    if (char === ' ') {
      const space = document.createElement('span');
      space.className = 'wave__space';
      space.setAttribute('aria-hidden', 'true');
      container.appendChild(space);
      return;
    }

    const span = document.createElement('span');
    span.className = 'wave__letter';
    span.textContent = char;
    span.setAttribute('aria-hidden', 'true');
    container.appendChild(span);
    letters.push(span);
  });

  return letters;
}

/**
 * Initialize Wave Typography section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initWaveTypography(section) {
  const wordEl = section.querySelector('[data-wave-word]');
  const label = section.querySelector('.wave__label');
  if (!wordEl) return () => {};

  const letters = buildLetters(wordEl, TEXT);
  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  // Amplitude proxy — GSAP tweens this for smooth hover/click transitions
  const amp = { value: WAVE.baseAmp };
  let running = false;
  let rafId = null;
  let startTime = performance.now();
  let excited = false;

  // ── Entrance ────────────────────────────────────────────────────────────
  gsap.set(letters, { opacity: 0, y: 28 });
  if (label) gsap.set(label, { opacity: 0, y: 10 });

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
        stagger: 0.035,
        onComplete: () => {
          // Clear entrance y so wave owns transform
          gsap.set(letters, { clearProps: 'y' });
        },
      });
      if (label) {
        gsap.to(label, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
          delay: 0.25,
        });
      }
    },
  });

  // ── Wave loop ───────────────────────────────────────────────────────────
  function tick(now) {
    if (!running) return;

    const t = ((now - startTime) / 1000) * WAVE.speed;
    const amplitude = amp.value;

    letters.forEach((letter, i) => {
      const phase = t + i * WAVE.frequency;
      const y = Math.sin(phase) * amplitude;
      const rot = Math.sin(phase + Math.PI / 4) * WAVE.rotateAmp * (amplitude / WAVE.baseAmp);

      letter.style.transform = `translate3d(0, ${y}px, 0) rotate(${rot}deg)`;
    });

    rafId = requestAnimationFrame(tick);
  }

  function startWave() {
    if (running || reducedMotion) return;
    running = true;
    startTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stopWave() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function setAmplitude(target, duration = ANIMATION.duration.normal) {
    gsap.to(amp, {
      value: target,
      duration: reducedMotion ? 0.01 : duration,
      ease: ANIMATION.ease.out,
      overwrite: 'auto',
    });
  }

  // ── Interaction ─────────────────────────────────────────────────────────
  const onEnter = () => {
    if (excited) return;
    setAmplitude(WAVE.hotAmp, ANIMATION.duration.slow);
  };

  const onLeave = () => {
    if (excited) return;
    setAmplitude(WAVE.baseAmp, ANIMATION.duration.normal);
  };

  /** Click restores calm baseline wave */
  const onClick = () => {
    excited = false;
    setAmplitude(WAVE.baseAmp, ANIMATION.duration.slow);

    // Brief label feedback
    if (label) {
      gsap.fromTo(
        label,
        { opacity: 0.35 },
        { opacity: 1, duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out }
      );
    }
  };

  section.addEventListener('mouseenter', onEnter);
  section.addEventListener('mouseleave', onLeave);
  section.addEventListener('click', onClick);

  // Touch: first tap boosts, second restores
  const onTouch = (e) => {
    // Avoid double-firing with click on some devices
    e.preventDefault();
    if (!excited) {
      excited = true;
      setAmplitude(WAVE.hotAmp, ANIMATION.duration.slow);
    } else {
      onClick();
    }
  };
  section.addEventListener('touchend', onTouch, { passive: false });

  cleanups.push(() => {
    section.removeEventListener('mouseenter', onEnter);
    section.removeEventListener('mouseleave', onLeave);
    section.removeEventListener('click', onClick);
    section.removeEventListener('touchend', onTouch);
  });

  // Run only while in viewport
  const visibility = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onEnter: startWave,
    onEnterBack: startWave,
    onLeave: stopWave,
    onLeaveBack: stopWave,
  });

  // Reduced motion: static gentle offset, no loop
  if (reducedMotion) {
    letters.forEach((letter, i) => {
      const y = Math.sin(i * WAVE.frequency) * (WAVE.baseAmp * 0.4);
      letter.style.transform = `translate3d(0, ${y}px, 0)`;
    });
  } else {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      startWave();
    }
  }

  cleanups.push(() => {
    stopWave();
    entrance.kill();
    visibility.kill();
    gsap.killTweensOf(amp);
  });

  return () => cleanups.forEach((fn) => fn());
}
