/**
 * Section 4 — Wave Typography
 *
 * Ambient wave = flow. Primary: drag letters to pull the current apart /
 * reconnect. Secondary: hover intensifies, click calms.
 */

import { ANIMATION, EXPERIENCE, isCoarsePointer } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { SESSION } from '../utils/session.js';
import { setCursor, resetCursor } from '../utils/cursor.js';
import {
  setFeedbackLabel,
  markStageComplete,
  wait,
} from '../utils/feedback.js';

const TEXT = 'BRAND DESIGN';

const WAVE = {
  baseAmp: 14,
  hotAmp: 42,
  frequency: 0.55,
  speed: 2.4,
  rotateAmp: 4,
  /** Max upward travel (px) so letters stay below the tip label */
  maxUp: 16,
};

/**
 * @param {HTMLElement} container
 * @param {string} text
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
      dragX: 0,
      dragY: 0,
      targetX: 0,
      targetY: 0,
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
  const maxUp = WAVE.maxUp;

  const amp = { value: baseAmp };
  let running = false;
  let rafId = null;
  let startTime = performance.now();
  let excited = false;
  let dragging = false;
  let dragIndex = -1;
  let dragTravel = 0;
  let completed = false;
  let startX = 0;
  let startY = 0;

  const waveHint = isCoarsePointer()
    ? 'Drag to pull the current · Touch to calm'
    : 'Drag to pull the current · Click to calm';

  if (label) {
    label.textContent = waveHint;
  }

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

  function tick(now) {
    if (!running) return;

    const t = ((now - startTime) / 1000) * speed;
    const amplitude = amp.value;
    const ampNorm = amplitude / baseAmp;

    letters.forEach((letter, i) => {
      const p = personalities[i];
      // Ease drag offsets back toward rest (reconnect)
      p.dragX += (p.targetX - p.dragX) * 0.12;
      p.dragY += (p.targetY - p.dragY) * 0.12;
      if (!dragging || dragIndex !== i) {
        p.targetX *= 0.94;
        p.targetY *= 0.94;
      }

      const phase = t * p.speedScale + i * freq + p.phaseOffset;
      // Bias motion downward; clamp upward so letters never cross the tip label
      const waveY = Math.sin(phase) * amplitude * p.ampScale;
      const y = Math.max(-maxUp, waveY * 0.55 + Math.max(0, waveY) * 0.45 + p.dragY);
      const x = p.dragX;
      const rot =
        Math.sin(phase + Math.PI / 4) * rotAmp * p.rotateScale * ampNorm * 0.85 +
        p.dragX * 0.08;

      const crest = (Math.sin(phase) + 1) * 0.5;
      const weight = 400 + crest * 180 * p.weightPulse * Math.min(1.4, ampNorm);
      const stretch = 1 + Math.abs(p.dragX) * 0.0015;

      letter.style.transform =
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) ` +
        `rotate(${rot.toFixed(2)}deg) scaleX(${stretch.toFixed(3)})`;
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

  async function completeStage() {
    if (completed) return;
    completed = true;
    markStageComplete('wave-typography');
    if (label) {
      await setFeedbackLabel(label, EXPERIENCE.feedback.nice, { stage: false });
      await wait(EXPERIENCE.feedbackHoldMs);
      await setFeedbackLabel(label, waveHint, {
        stage: true,
      });
    }
  }

  const nearestLetter = (x, y) => {
    let best = -1;
    let bestDist = 80;
    letters.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  const onPointerDown = (e) => {
    const i = nearestLetter(e.clientX, e.clientY);
    if (i < 0) return;
    dragging = true;
    dragIndex = i;
    dragTravel = 0;
    startX = e.clientX;
    startY = e.clientY;
    setCursor('grabbing');
    wordEl.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || dragIndex < 0) {
      if (nearestLetter(e.clientX, e.clientY) >= 0) setCursor('grab');
      return;
    }
    const p = personalities[dragIndex];
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    p.targetX = dx * 0.85;
    p.targetY = Math.max(-maxUp, dy * 0.55);
    dragTravel = Math.hypot(dx, dy);

    // Neighbors ripple with the current
    letters.forEach((_, i) => {
      if (i === dragIndex) return;
      const falloff = 1 / (1 + Math.abs(i - dragIndex) * 0.55);
      personalities[i].targetX = dx * 0.35 * falloff;
      personalities[i].targetY = Math.max(-maxUp * 0.6, dy * 0.25 * falloff);
    });

    setAmplitude(hotAmp * 0.85, ANIMATION.duration.hover);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    const travel = dragTravel;
    dragging = false;
    dragIndex = -1;
    resetCursor();
    setAmplitude(baseAmp, ANIMATION.duration.reset);
    if (travel > 100) completeStage();
  };

  const onEnter = () => {
    if (excited || dragging) return;
    setAmplitude(hotAmp, ANIMATION.duration.slow);
  };

  const onLeave = () => {
    if (excited || dragging) return;
    setAmplitude(baseAmp, ANIMATION.duration.normal);
    resetCursor();
  };

  const onClick = () => {
    if (dragTravel > 12) return;
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

  wordEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  section.addEventListener('mouseenter', onEnter);
  section.addEventListener('mouseleave', onLeave);
  section.addEventListener('click', onClick);

  cleanups.push(() => {
    wordEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    section.removeEventListener('mouseenter', onEnter);
    section.removeEventListener('mouseleave', onLeave);
    section.removeEventListener('click', onClick);
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
    if (rect.top < window.innerHeight && rect.bottom > 0) startWave();
  }

  cleanups.push(() => {
    stopWave();
    entrance.kill();
    visibility.kill();
    gsap.killTweensOf(amp);
  });

  return () => cleanups.forEach((fn) => fn());
}
