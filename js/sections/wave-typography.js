/**
 * Section 4 — Wave Typography
 *
 * Per-letter organisms undulate with session-seeded tempo & direction.
 * Hover intensifies. Click restores calm.
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { SESSION } from '../utils/session.js';

const TEXT = 'BRAND DESIGN';

const WAVE = {
  baseAmp: 14,
  hotAmp: 42,
  frequency: 0.55,
  speed: 2.4,
  rotateAmp: 4,
};

/**
 * @param {HTMLElement} container
 * @param {string} text
 * @returns {{ letters: HTMLElement[], personalities: object[] }}
 */
function buildLetters(container, text) {
  container.textContent = '';
  const letters = [];
  const personalities = [];
  let letterIndex = 0;

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

    const seed = Math.sin(letterIndex * 19.19 + SESSION.tempo * 11) * 43758.5453;
    const r = seed - Math.floor(seed);
    personalities.push({
      ampScale: 0.75 + r * 0.5,
      speedScale: 0.82 + (1 - r) * 0.4,
      rotateScale: 0.6 + r * 0.8,
      phaseOffset: r * Math.PI * 2,
      weightPulse: 0.35 + r * 0.4,
    });
    letterIndex += 1;
  });

  return { letters, personalities };
}

/**
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initWaveTypography(section) {
  const wordEl = section.querySelector('[data-wave-word]');
  const label = section.querySelector('.wave__label');
  if (!wordEl) return () => {};

  const { letters, personalities } = buildLetters(wordEl, TEXT);
  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  const speed = WAVE.speed * SESSION.tempo;
  const freq = WAVE.frequency * SESSION.waveDir;
  const rotAmp = WAVE.rotateAmp * SESSION.rotateRange;
  const hotAmp = WAVE.hotAmp * SESSION.hoverIntensity;
  const baseAmp = WAVE.baseAmp * SESSION.idleFloat;

  const amp = { value: baseAmp };
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
        stagger: {
          each: 0.035,
          from: SESSION.waveDir === 1 ? 'start' : 'end',
        },
        onComplete: () => {
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

    const t = ((now - startTime) / 1000) * speed;
    const amplitude = amp.value;
    const ampNorm = amplitude / baseAmp;

    letters.forEach((letter, i) => {
      const p = personalities[i];
      const phase = t * p.speedScale + i * freq + p.phaseOffset;
      const y = Math.sin(phase) * amplitude * p.ampScale;
      const rot =
        Math.sin(phase + Math.PI / 4) * rotAmp * p.rotateScale * ampNorm;

      // Typography layer — weight breathes slightly with the wave crest
      const crest = (Math.sin(phase) + 1) * 0.5;
      const weight = 400 + crest * 180 * p.weightPulse * Math.min(1.4, ampNorm);

      letter.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
      letter.style.fontWeight = String(Math.round(weight));
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
    setAmplitude(hotAmp, ANIMATION.duration.slow);
  };

  const onLeave = () => {
    if (excited) return;
    setAmplitude(baseAmp, ANIMATION.duration.normal);
  };

  const onClick = () => {
    excited = false;
    setAmplitude(baseAmp, ANIMATION.duration.slow);

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

  const onTouch = (e) => {
    e.preventDefault();
    if (!excited) {
      excited = true;
      setAmplitude(hotAmp, ANIMATION.duration.slow);
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

  const visibility = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onEnter: startWave,
    onEnterBack: startWave,
    onLeave: stopWave,
    onLeaveBack: stopWave,
  });

  if (reducedMotion) {
    letters.forEach((letter, i) => {
      const y = Math.sin(i * Math.abs(freq)) * (baseAmp * 0.4);
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
