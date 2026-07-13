/**
 * Section 2 — Tutorial
 *
 * Flow: Opening → Move → Click×2 → Hold → Drag → Complete → Replay
 * Progressive disclosure: only the current gesture is available.
 * Letter physics / variable-font response matches the previous installation feel.
 */

import { ANIMATION, EXPERIENCE } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { getPointer } from '../utils/pointer.js';
import { sound } from '../utils/audio.js';
import { SESSION } from '../utils/session.js';
import {
  setFeedbackLabel,
  wait,
  showContinueHint,
  hideContinueHint,
  markStageComplete,
} from '../utils/feedback.js';

const WORD = 'DESIGN';

/** @typedef {'intro' | 'move' | 'click' | 'hold' | 'drag' | 'complete'} Phase */

const SPRING = {
  stiffness: 0.078,
  damping: 0.76,
  settleDamping: 0.9,
};

const EFFECT = {
  scale: 1.28,
  rotate: 14,
  y: -22,
  pull: 0.055,
  weight: 720,
  restWeight: 400,
  stretch: 1.12,
  restStretch: 1,
  tracking: 0.06,
  restTracking: 0,
  opsz: 28,
  restOpsz: 14,
  shadow: 28,
  velStretch: 0.22,
  velSkew: 16,
  velRotate: 8,
};

const IDLE = {
  float: 2.4,
  scale: 0.012,
  rotate: 0.6,
};

function layerCatch(ms) {
  return Math.max(0.045, 0.42 - ms * 0.00135);
}

const LAYER = {
  scale: layerCatch(ANIMATION.layers.scale),
  rotate: layerCatch(ANIMATION.layers.rotate),
  weight: layerCatch(ANIMATION.layers.weight),
  tracking: layerCatch(ANIMATION.layers.tracking),
  blur: layerCatch(ANIMATION.layers.blur),
};

const STAGE_ORDER = ['move', 'click', 'hold', 'drag', 'complete'];

function letterRand(i, salt = 1) {
  const x = Math.sin(i * 12.9898 + salt * 78.233 + SESSION.tempo * 40) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * @param {HTMLElement} container
 * @param {string} word
 * @returns {HTMLElement[]}
 */
function buildLetters(container, word) {
  container.textContent = '';
  return [...word].map((char) => {
    const span = document.createElement('span');
    span.className = 'mouse__letter';
    span.textContent = char;
    span.setAttribute('aria-hidden', 'true');
    container.appendChild(span);
    return span;
  });
}

function createLetterState(i, total = 6) {
  const r1 = letterRand(i, 1);
  const r2 = letterRand(i, 2);
  const r3 = letterRand(i, 3);
  const r4 = letterRand(i, 4);
  const r5 = letterRand(i, 5);
  const traits = /** @type {const} */ (['weight', 'stretch', 'track', 'baseline']);
  const trait = traits[Math.floor(r5 * traits.length)];
  const orderIndex = SESSION.waveDir === 1 ? i : total - 1 - i;

  return {
    dtx: 0,
    dty: 0,
    dtr: 0,
    dts: 1,
    dsk: 0,
    dweight: EFFECT.restWeight,
    dstretch: EFFECT.restStretch,
    dtrack: EFFECT.restTracking,
    dopsz: EFFECT.restOpsz,
    dblur: 0,
    tx: 0,
    ty: 0,
    tr: 0,
    ts: 1,
    skew: 0,
    weight: EFFECT.restWeight,
    stretch: EFFECT.restStretch,
    track: EFFECT.restTracking,
    opsz: EFFECT.restOpsz,
    blur: 0,
    x: 0,
    y: 0,
    r: 0,
    s: 1,
    sk: 0,
    stretchCur: 1,
    vx: 0,
    vy: 0,
    vr: 0,
    vs: 0,
    vsk: 0,
    vstretch: 0,
    mass: 0.72 + r1 * 0.55,
    stiffness: SPRING.stiffness * SESSION.springK * (0.78 + r2 * 0.48),
    damping: SPRING.damping * SESSION.springDamp * (0.92 + r3 * 0.12),
    floatSpeed: 0.75 + r4 * 0.55,
    floatAmp: 0.65 + r1 * 0.7,
    rotateAmp: 0.55 + r2 * 0.9,
    scaleAmp: 0.72 + r3 * 0.56,
    inertia: 0.82 + r4 * 0.36,
    wave: Math.max(
      0.055,
      (SESSION.waveBase - orderIndex * SESSION.waveStep) * (0.85 + r5 * 0.3)
    ),
    phase: i * 0.85 + r1 * 2.4,
    trait,
    outlineBias: 0.55 + r3 * 0.4,
  };
}

/** @type {null | (() => void)} */
let resetMouseInteractionFn = null;

/**
 * Restore section 2 to its pre-intro state (used by About → Restart).
 */
export function resetMouseInteraction() {
  resetMouseInteractionFn?.();
}

/**
 * @param {HTMLElement} section
 * @returns {Function}
 */
export function initMouseInteraction(section) {
  const wordEl = section.querySelector('[data-mouse-word]');
  const label = section.querySelector('[data-mouse-label]') || section.querySelector('.mouse__label');
  const openingEl = section.querySelector('[data-mouse-opening]');
  const openingText = section.querySelector('[data-opening-text]');
  const ending = section.querySelector('[data-mouse-ending]');
  const endingTitle = section.querySelector('[data-ending-title]');
  const replayBtn = section.querySelector('[data-mouse-replay]');

  if (!wordEl) return () => {};

  if (openingText) openingText.textContent = SESSION.openingLine;
  if (endingTitle) endingTitle.textContent = SESSION.endingLine;
  if (replayBtn) {
    replayBtn.textContent = SESSION.endingCta || EXPERIENCE.endingCta;
    replayBtn.hidden = true;
    replayBtn.classList.remove('is-visible');
  }

  let letters = buildLetters(wordEl, WORD);
  /** @type {ReturnType<typeof createLetterState>[]} */
  let letterState = letters.map((_, i) => createLetterState(i, letters.length));

  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  /** @type {Phase} */
  let phase = 'intro';
  let stageStartedAt = 0;
  let active = false;
  let rafId = null;
  let frame = 0;
  let blurAmount = 0;
  let transitioning = false;
  let moveTravel = 0;
  let lastMoveX = 0;
  let lastMoveY = 0;
  let moveTracking = false;
  let clickCount = 0;
  let clickDone = false;
  let holding = false;
  let holdStart = 0;
  let holdProgress = 0;
  let holdReady = false;
  let holdComplete = false;
  let releasePrompted = false;
  let holdOriginX = 0;
  let holdOriginY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragTravel = 0;
  let dragStartedAt = 0;
  let dragReady = false;
  let dragReleasePrompted = false;
  let pointerIsDown = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  /** @type {Array<{ x: number, y: number }>} */
  let centers = [];

  const influenceRadius = SESSION.influenceRadius;
  /** Closer radius for Move progress — explore freely before advancing */
  const progressRadius = influenceRadius * 0.62;
  const idlePeriod = SESSION.idlePeriod;

  if (ending) gsap.set(ending, { autoAlpha: 0, pointerEvents: 'none' });

  function refreshCenters() {
    centers = letters.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  }

  function updateJourneyProgress(sub = 0) {
    section.dataset.phase = phase;
    const idx = STAGE_ORDER.indexOf(phase);
    if (idx < 0) {
      section.style.setProperty('--journey-progress', '0');
      return;
    }
    const base = idx / STAGE_ORDER.length;
    const span = 1 / STAGE_ORDER.length;
    const progress = clamp(base + span * clamp(sub, 0, 1), 0, 1);
    section.style.setProperty('--journey-progress', String(progress));
  }

  function setLabel(text, stage = true) {
    return setFeedbackLabel(label, text, { stage });
  }

  function captureToGsap() {
    letters.forEach((el, i) => {
      const st = letterState[i];
      if (!st) return;
      const sx = st.s * st.stretchCur;
      const sy = st.s / Math.max(0.85, Math.sqrt(st.stretchCur));
      gsap.set(el, {
        x: st.x,
        y: st.y,
        rotation: st.r,
        skewX: st.sk,
        scaleX: sx,
        scaleY: sy,
        fontWeight: Math.round(st.dweight),
      });
      st.vx = st.vy = st.vr = st.vs = st.vsk = st.vstretch = 0;
    });
  }

  function settleLetters(duration = ANIMATION.duration.reset) {
    return new Promise((resolve) => {
      let pending = letters.length;
      if (!pending) {
        resolve();
        return;
      }

      captureToGsap();
      wordEl.style.filter = 'none';

      letters.forEach((el, i) => {
        const st = letterState[i];
        gsap.killTweensOf(el);
        gsap.to(el, {
          x: 0,
          y: 0,
          rotation: 0,
          skewX: 0,
          scaleX: 1,
          scaleY: 1,
          fontWeight: EFFECT.restWeight,
          opacity: 1,
          filter: 'blur(0px)',
          duration,
          ease: ANIMATION.ease.settle,
          onComplete: () => {
            if (st) {
              st.tx = st.ty = st.tr = st.skew = 0;
              st.dtx = st.dty = st.dtr = st.dsk = 0;
              st.x = st.y = st.r = st.sk = 0;
              st.vx = st.vy = st.vr = st.vs = st.vsk = st.vstretch = 0;
              st.ts = st.dts = st.s = 1;
              st.stretch = st.dstretch = st.stretchCur = EFFECT.restStretch;
              st.track = st.dtrack = EFFECT.restTracking;
              st.opsz = st.dopsz = EFFECT.restOpsz;
              st.blur = st.dblur = 0;
              st.weight = st.dweight = EFFECT.restWeight;
            }
            gsap.set(el, { clearProps: 'transform,filter' });
            el.style.fontWeight = String(EFFECT.restWeight);
            el.style.fontVariationSettings = '';
            el.style.letterSpacing = '';
            el.style.filter = '';
            el.style.textShadow = 'none';
            el.classList.remove('is-soft-outline', 'is-outline');
            el.style.removeProperty('--outline-mix');
            pending -= 1;
            if (pending <= 0) resolve();
          },
        });
      });
    });
  }

  // ── Stages ──────────────────────────────────────────────────────────────

  function enterMove() {
    phase = 'move';
    stageStartedAt = performance.now();
    transitioning = false;
    moveTravel = 0;
    moveTracking = false;
    updateJourneyProgress();
    setLabel(EXPERIENCE.stages.move);
    refreshCenters();
    startLoop();

    if (reducedMotion) {
      window.setTimeout(() => {
        if (phase === 'move') completeMove();
      }, EXPERIENCE.moveMinMs);
    }
  }

  async function completeMove() {
    if (phase !== 'move' || transitioning) return;
    transitioning = true;
    sound.soft();
    await setLabel(EXPERIENCE.stages.moveDone, false);
    await wait(EXPERIENCE.feedbackHoldMs);
    await enterClick();
  }

  async function enterClick() {
    transitioning = true;
    phase = 'click';
    clickCount = 0;
    clickDone = false;
    stageStartedAt = performance.now();
    updateJourneyProgress();
    await settleLetters(ANIMATION.duration.reset);
    await setLabel(EXPERIENCE.stages.click);
    transitioning = false;
    refreshCenters();

    if (reducedMotion) {
      window.setTimeout(async () => {
        if (phase !== 'click' || clickDone) return;
        const r = section.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        await playClickReaction(cx, cy);
        if (phase === 'click' && !clickDone) {
          await wait(400);
          await playClickReaction(cx + 40, cy - 20);
        }
      }, 600);
    }
  }

  async function playClickReaction(clientX, clientY) {
    if (phase !== 'click' || clickDone || transitioning) return;
    transitioning = true;
    sound.pop();
    refreshCenters();

    const needed = EXPERIENCE.clicksRequired || 2;
    const nextCount = clickCount + 1;

    if (reducedMotion) {
      clickCount = nextCount;
      await wait(EXPERIENCE.clickSettleMs * 0.4);
      if (clickCount >= needed) {
        clickDone = true;
        await setLabel(EXPERIENCE.stages.clickDone, false);
        await wait(EXPERIENCE.feedbackHoldMs);
        await enterHold();
      } else {
        await setLabel(EXPERIENCE.stages.clickDone, false);
        await wait(EXPERIENCE.feedbackHoldMs);
        await setLabel(EXPERIENCE.stages.clickAgain);
        transitioning = false;
        updateJourneyProgress(clickCount / needed);
      }
      return;
    }

    captureToGsap();

    const wordRect = wordEl.getBoundingClientRect();
    const wordCx = wordRect.left + wordRect.width / 2;
    const wordCy = wordRect.top + wordRect.height / 2;
    const halfW = Math.max(wordRect.width * 0.5, 1);
    const halfH = Math.max(wordRect.height * 0.5, 1);
    const nx = clamp((clientX - wordCx) / halfW, -1.4, 1.4);
    const ny = clamp((clientY - wordCy) / halfH, -1.6, 1.6);
    const radial = Math.hypot(nx, ny);

    // Nearest letter — local impact epicenter
    let hitIndex = 0;
    let hitDist = Infinity;
    centers.forEach((c, i) => {
      const d = Math.hypot(c.x - clientX, c.y - clientY);
      if (d < hitDist) {
        hitDist = d;
        hitIndex = i;
      }
    });

    // Position picks the deformation language (not click count)
    /** @type {'burst' | 'shoveLeft' | 'shoveRight' | 'crush' | 'lift' | 'twist'} */
    let mode;
    if (radial < 0.32) {
      mode = 'burst';
    } else if (Math.abs(nx) > Math.abs(ny) * 1.05) {
      mode = nx < 0 ? 'shoveRight' : 'shoveLeft';
    } else if (ny < -0.15) {
      mode = 'crush';
    } else if (ny > 0.2) {
      mode = 'lift';
    } else {
      mode = 'twist';
    }

    await new Promise((resolve) => {
      let pending = letters.length;
      letters.forEach((el, i) => {
        const st = letterState[i];
        const c = centers[i] || { x: wordCx, y: wordCy };
        const dx = c.x - clientX;
        const dy = c.y - clientY;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const mid = i - (letters.length - 1) / 2;
        const near = 1 - clamp(dist / 480, 0, 1);
        const hitNear = 1 - clamp(Math.abs(i - hitIndex) / 3.2, 0, 1);
        const force = 0.45 + near * 0.7 + hitNear * 0.35;
        const delay = clamp(dist / 780, 0, 0.2) + Math.abs(i - hitIndex) * 0.018;

        let x = 0;
        let y = 0;
        let rot = 0;
        let scaleX = 1;
        let scaleY = 1;
        let weight = EFFECT.restWeight;
        let skewX = 0;

        if (mode === 'burst') {
          // Center hit — radial explode + inflate
          x = ux * (36 + near * 70) * force;
          y = uy * (30 + near * 56) * force;
          rot = (i - hitIndex) * 14 * force + ux * 18;
          scaleX = 1.1 + near * 0.45;
          scaleY = 1.1 + near * 0.45;
          weight = lerp(280, 860, near);
        } else if (mode === 'shoveLeft') {
          // Click on the right — shove letters left, shear
          x = -(22 + near * 64) * force + mid * 2;
          y = Math.sin((i + 1) * 0.9) * 18 * force - near * 8;
          rot = -(10 + near * 26) * force;
          scaleX = 1.05 + near * 0.2;
          scaleY = 0.92 - near * 0.08;
          skewX = -(10 + near * 22) * force;
          weight = lerp(300, 720, near);
        } else if (mode === 'shoveRight') {
          // Click on the left — shove letters right, opposite shear
          x = (22 + near * 64) * force + mid * 2;
          y = Math.cos((i + 1) * 0.9) * 18 * force - near * 8;
          rot = (10 + near * 26) * force;
          scaleX = 1.05 + near * 0.2;
          scaleY = 0.92 - near * 0.08;
          skewX = (10 + near * 22) * force;
          weight = lerp(300, 720, near);
        } else if (mode === 'crush') {
          // Click above — squash down, heavy, wide
          x = mid * 8 * force + ux * 12 * near;
          y = (20 + near * 52) * force;
          rot = mid * 6 + ux * 10;
          scaleX = 1.12 + near * 0.38;
          scaleY = lerp(1, 0.55, near * force);
          weight = lerp(520, 200, near);
          skewX = mid * 3;
        } else if (mode === 'lift') {
          // Click below — spring upward, tall & light
          x = ux * 16 * force + mid * 4;
          y = -(30 + near * 64) * force;
          rot = mid * 10 + (letterRand(i, 31 + hitIndex) - 0.5) * 22;
          scaleX = 0.88 - near * 0.06;
          scaleY = 1.2 + near * 0.4;
          weight = lerp(340, 800, near);
          skewX = -mid * 2;
        } else {
          // Edge / diagonal — corkscrew twist from impact letter
          const side = i < hitIndex ? -1 : i > hitIndex ? 1 : 0;
          x = side * (14 + hitNear * 40) * force + ux * 10;
          y = uy * (12 + near * 28) * force - hitNear * 16;
          rot = side * (18 + hitNear * 36) * force + mid * 4;
          scaleX = 1 + hitNear * 0.35;
          scaleY = 1 + near * 0.15;
          skewX = side * (14 + hitNear * 20);
          weight = lerp(360, 780, hitNear);
        }

        gsap.to(el, {
          x,
          y,
          rotation: rot,
          skewX,
          scaleX,
          scaleY,
          fontWeight: weight,
          duration: 0.4 + near * 0.14,
          ease: ANIMATION.ease.softSpring,
          delay,
          onComplete: () => {
            gsap.to(el, {
              x: 0,
              y: 0,
              rotation: 0,
              skewX: 0,
              scaleX: 1,
              scaleY: 1,
              fontWeight: EFFECT.restWeight,
              duration: 0.75 + (1 - near) * 0.25,
              ease: ANIMATION.ease.settle,
              onComplete: () => {
                if (st) {
                  st.x = st.y = st.r = st.sk = 0;
                  st.s = 1;
                  st.vx = st.vy = st.vr = st.vs = st.vsk = 0;
                  st.dtx = st.dty = st.dtr = st.dsk = 0;
                  st.dts = 1;
                  st.dweight = EFFECT.restWeight;
                }
                gsap.set(el, { clearProps: 'transform' });
                el.style.fontWeight = String(EFFECT.restWeight);
                pending -= 1;
                if (pending <= 0) resolve();
              },
            });
          },
        });
      });
    });

    clickCount = nextCount;
    updateJourneyProgress(clickCount / needed);
    await wait(EXPERIENCE.clickSettleMs * 0.3);
    await setLabel(EXPERIENCE.stages.clickDone, false);
    await wait(EXPERIENCE.feedbackHoldMs);

    if (clickCount >= needed) {
      clickDone = true;
      await enterHold();
    } else {
      await settleLetters(ANIMATION.duration.hover);
      await setLabel(EXPERIENCE.stages.clickAgain);
      transitioning = false;
      refreshCenters();
    }
  }

  async function enterHold() {
    transitioning = true;
    phase = 'hold';
    holding = false;
    holdProgress = 0;
    holdReady = false;
    holdComplete = false;
    releasePrompted = false;
    stageStartedAt = performance.now();
    updateJourneyProgress();
    await settleLetters(ANIMATION.duration.reset);
    await setLabel(EXPERIENCE.stages.hold);
    transitioning = false;
    refreshCenters();

    if (reducedMotion) {
      window.setTimeout(() => {
        if (phase === 'hold') completeHold();
      }, EXPERIENCE.holdMinMs);
    }
  }

  async function completeHold() {
    if (phase !== 'hold' || holdComplete || transitioning) return;
    holdComplete = true;
    transitioning = true;
    holding = false;
    sound.whoosh();
    await explodeFromHold();
    await settleLetters(ANIMATION.duration.reset);
    await setLabel(EXPERIENCE.stages.holdDone, false);
    await wait(EXPERIENCE.feedbackHoldMs);
    await enterDrag();
  }

  /**
   * Burst letters outward from the hold point, then settle into drag.
   */
  function explodeFromHold() {
    return new Promise((resolve) => {
      if (!letters.length) {
        resolve();
        return;
      }

      if (reducedMotion) {
        resolve();
        return;
      }

      captureToGsap();
      refreshCenters();

      const originX = holdOriginX;
      const originY = holdOriginY;
      let pending = letters.length;

      letters.forEach((el, i) => {
        const st = letterState[i];
        const c = centers[i] || { x: originX, y: originY };
        const dx = c.x - originX;
        const dy = c.y - originY;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const mid = i - (letters.length - 1) / 2;
        const scatter = 0.7 + letterRand(i, 71) * 0.9;
        const burst = (90 + letterRand(i, 72) * 160) * scatter;
        const lift = 30 + letterRand(i, 73) * 70;
        const spin = mid * 28 + (letterRand(i, 74) - 0.5) * 70;
        const delay = Math.abs(mid) * 0.02 + letterRand(i, 75) * 0.04;

        gsap.killTweensOf(el);
        gsap.to(el, {
          x: (st?.x || 0) + ux * burst + mid * 18,
          y: (st?.y || 0) + uy * burst * 0.85 + lift,
          rotation: (st?.r || 0) + spin,
          skewX: mid * 10 + (letterRand(i, 76) - 0.5) * 16,
          scaleX: 1.2 + letterRand(i, 77) * 0.55,
          scaleY: 0.65 + letterRand(i, 78) * 0.35,
          opacity: 0.2 + letterRand(i, 79) * 0.35,
          filter: `blur(${(2 + letterRand(i, 80) * 5).toFixed(1)}px)`,
          duration: 0.48,
          delay,
          ease: 'power3.out',
          onComplete: () => {
            pending -= 1;
            if (pending <= 0) resolve();
          },
        });
      });
    });
  }

  async function enterDrag() {
    transitioning = true;
    phase = 'drag';
    dragging = false;
    dragTravel = 0;
    dragReady = false;
    dragReleasePrompted = false;
    pointerIsDown = false;
    stageStartedAt = performance.now();
    updateJourneyProgress();
    await settleLetters(ANIMATION.duration.reset);
    await setLabel(EXPERIENCE.stages.drag);
    transitioning = false;
    refreshCenters();

    if (reducedMotion) {
      window.setTimeout(() => {
        if (phase === 'drag') completeDrag();
      }, EXPERIENCE.dragMinMs);
    }
  }

  async function completeDrag() {
    if (phase !== 'drag' || transitioning) return;
    transitioning = true;
    dragging = false;
    sound.whoosh();
    await settleLetters(ANIMATION.duration.reset);
    await setLabel(EXPERIENCE.stages.dragDone, false);
    await wait(EXPERIENCE.feedbackHoldMs);
    enterComplete();
  }

  function enterComplete() {
    phase = 'complete';
    updateJourneyProgress(1);
    markStageComplete('tutorial');
    transitioning = false;
    stopLoop();

    if (label) {
      gsap.to(label, { opacity: 0, duration: 0.25, ease: ANIMATION.ease.soft });
    }

    gsap.to(wordEl, {
      opacity: 0.12,
      scale: 0.94,
      filter: 'blur(3px)',
      duration: 0.4,
      ease: ANIMATION.ease.smooth,
    });

    if (endingTitle) endingTitle.textContent = SESSION.endingLine;
    if (ending) {
      ending.setAttribute('aria-hidden', 'false');
      gsap.set(ending, { pointerEvents: 'auto' });
      gsap.fromTo(
        ending,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          ease: ANIMATION.ease.out,
        }
      );
    }

    window.setTimeout(() => {
      if (phase !== 'complete') return;
      if (replayBtn) {
        replayBtn.hidden = false;
        replayBtn.classList.add('is-visible');
      }
      showContinueHint('Scroll');
    }, EXPERIENCE.endingHoldMs);
  }

  function resetLetterStyles() {
    letters.forEach((el, i) => {
      const st = letterState[i];
      if (st) {
        st.tx = st.ty = st.tr = st.skew = 0;
        st.dtx = st.dty = st.dtr = st.dsk = 0;
        st.x = st.y = st.r = st.sk = 0;
        st.vx = st.vy = st.vr = st.vs = st.vsk = st.vstretch = 0;
        st.ts = st.dts = st.s = 1;
        st.stretch = st.dstretch = st.stretchCur = EFFECT.restStretch;
        st.track = st.dtrack = EFFECT.restTracking;
        st.opsz = st.dopsz = EFFECT.restOpsz;
        st.blur = st.dblur = 0;
        st.weight = st.dweight = EFFECT.restWeight;
      }
      el.style.transform = '';
      el.style.fontWeight = String(EFFECT.restWeight);
      el.style.fontVariationSettings = '';
      el.style.letterSpacing = '';
      el.style.textShadow = 'none';
      el.style.filter = '';
      el.style.opacity = '';
      el.style.removeProperty('--outline-mix');
      el.classList.remove('is-outline', 'is-soft-outline');
    });
    wordEl.style.filter = 'none';
    blurAmount = 0;
  }

  function clearInteractionFlags() {
    moveTravel = 0;
    moveTracking = false;
    clickCount = 0;
    clickDone = false;
    holding = false;
    holdProgress = 0;
    holdReady = false;
    holdComplete = false;
    releasePrompted = false;
    dragging = false;
    dragTravel = 0;
    dragReady = false;
    dragReleasePrompted = false;
    transitioning = false;
    pointerIsDown = false;
  }

  /**
   * Hard reset to first-visit intro state (opening ready, journey cleared).
   */
  function resetToInitial() {
    stopLoop();
    hideContinueHint();
    clearInteractionFlags();
    phase = 'intro';

    const targets = [wordEl, label, openingEl, ending, replayBtn, ...letters].filter(
      Boolean
    );
    gsap.killTweensOf(targets);

    if (ending) {
      ending.setAttribute('aria-hidden', 'true');
      gsap.set(ending, { autoAlpha: 0, pointerEvents: 'none', y: 0 });
    }

    if (replayBtn) {
      replayBtn.hidden = true;
      replayBtn.classList.remove('is-visible');
      gsap.set(replayBtn, { clearProps: 'opacity,visibility,transform' });
    }

    if (openingText) openingText.textContent = SESSION.openingLine;
    if (openingEl) {
      openingEl.setAttribute('aria-hidden', 'true');
      gsap.set(openingEl, { opacity: 0, visibility: 'hidden', y: 0 });
    }

    letters = buildLetters(wordEl, WORD);
    letterState = letters.map((_, i) => createLetterState(i, letters.length));
    wordEl.setAttribute('aria-label', WORD);
    resetLetterStyles();
    gsap.set(wordEl, { clearProps: 'opacity,scale,filter,transform' });
    gsap.set(letters, { clearProps: 'opacity,transform,filter' });

    if (label) {
      label.textContent = '';
      label.classList.remove('is-stage', 'is-feedback');
      gsap.set(label, { opacity: 0, y: 0 });
    }

    updateJourneyProgress();
  }

  function rearmEntrance() {
    entrance.kill();
    entrance = ScrollTrigger.create({
      trigger: section,
      start: 'top 65%',
      once: true,
      onEnter: startIntro,
    });
  }

  function replay() {
    if (phase !== 'complete') return;
    sound.pop();
    hideContinueHint();
    clearInteractionFlags();

    if (ending) {
      ending.setAttribute('aria-hidden', 'true');
      gsap.to(ending, {
        autoAlpha: 0,
        y: -8,
        duration: 0.35,
        ease: ANIMATION.ease.soft,
        onComplete: () => gsap.set(ending, { pointerEvents: 'none', y: 0 }),
      });
    }

    if (replayBtn) {
      replayBtn.hidden = true;
      replayBtn.classList.remove('is-visible');
      gsap.set(replayBtn, { clearProps: 'opacity,visibility,transform' });
    }

    if (openingText && openingEl) {
      openingText.textContent = SESSION.openingLine;
      gsap.set(openingEl, { opacity: 1, visibility: 'visible', y: 0 });
    }

    letters = buildLetters(wordEl, WORD);
    letterState = letters.map((_, i) => createLetterState(i, letters.length));
    wordEl.setAttribute('aria-label', WORD);
    resetLetterStyles();

    gsap.set(wordEl, { opacity: 1, scale: 1, filter: 'none', y: 0 });
    gsap.set(letters, { opacity: 0, y: 24 });
    if (label) gsap.set(label, { opacity: 0, y: 8 });

    const hold = reducedMotion ? 0.15 : 0.75;
    const tl = gsap.timeline({ onComplete: () => enterMove() });

    if (openingEl) {
      tl.to(openingEl, {
        opacity: 0,
        duration: ANIMATION.duration.hover,
        ease: ANIMATION.ease.soft,
        delay: hold,
        onComplete: () => {
          openingEl.style.visibility = 'hidden';
        },
      });
    } else {
      tl.to({}, { duration: hold * 0.4 });
    }

    tl.to(
      letters,
      {
        opacity: 1,
        y: 0,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.expo,
        stagger: 0.04,
      },
      openingEl ? '-=0.05' : 0
    );
  }

  // ── Spring / paint ──────────────────────────────────────────────────────

  function springStep(st) {
    const nearRest =
      Math.abs(st.dtx) < 0.4 &&
      Math.abs(st.dty) < 0.4 &&
      Math.abs(st.vx) < 0.15 &&
      Math.abs(st.vy) < 0.15;

    const damp = nearRest ? SPRING.settleDamping * SESSION.springDamp : st.damping;
    const k = st.stiffness / st.mass;
    const mom = clamp(0.88 + (st.inertia - 1) * 0.06, 0.82, 0.96);

    st.vx = (st.vx * mom + (st.dtx - st.x) * k) * damp;
    st.vy = (st.vy * mom + (st.dty - st.y) * k) * damp;
    st.vr = (st.vr * mom + (st.dtr - st.r) * k) * damp;
    st.vs = (st.vs * mom + (st.dts - st.s) * k * 1.1) * damp;
    st.vsk = (st.vsk * mom + (st.dsk - st.sk) * k) * damp;
    st.vstretch =
      (st.vstretch * mom + (st.dstretch - st.stretchCur) * k * 0.95) * damp;

    st.x += st.vx;
    st.y += st.vy;
    st.r += st.vr;
    st.s += st.vs;
    st.sk += st.vsk;
    st.stretchCur += st.vstretch;

    if (Math.abs(st.vx) < 0.001) st.vx = 0;
    if (Math.abs(st.vy) < 0.001) st.vy = 0;
  }

  function paintLetter(el, st, amp) {
    const sx = st.s * st.stretchCur;
    const sy = st.s / Math.max(0.85, Math.sqrt(st.stretchCur));

    el.style.transform =
      `translate3d(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px, 0) ` +
      `rotate(${st.r.toFixed(2)}deg) skewX(${st.sk.toFixed(2)}deg) ` +
      `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;

    el.style.fontWeight = String(Math.round(st.dweight));
    el.style.fontVariationSettings = `'opsz' ${st.dopsz.toFixed(1)}`;
    el.style.letterSpacing = `${st.dtrack.toFixed(4)}em`;
    el.style.filter = st.dblur > 0.15 ? `blur(${st.dblur.toFixed(2)}px)` : 'none';

    const outlineT = smoothstep((amp - 0.55 * st.outlineBias) / 0.35);
    if (outlineT > 0.08 && (phase === 'move' || phase === 'drag')) {
      el.classList.add('is-soft-outline');
      el.style.setProperty('--outline-mix', outlineT.toFixed(3));
    } else {
      el.classList.remove('is-soft-outline');
      el.style.removeProperty('--outline-mix');
    }

    const shadowBlur = EFFECT.shadow * amp;
    el.style.textShadow =
      amp > 0.02
        ? `0 ${(10 * amp).toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(0,0,0,${(0.2 * amp).toFixed(3)})`
        : 'none';
  }

  function catchLayers(st) {
    const wave = st.wave;
    st.dtx = lerp(st.dtx, st.tx, wave * LAYER.scale);
    st.dty = lerp(st.dty, st.ty, wave * LAYER.scale);
    st.dts = lerp(st.dts, st.ts, wave * LAYER.scale);
    st.dtr = lerp(st.dtr, st.tr, wave * LAYER.rotate);
    st.dsk = lerp(st.dsk, st.skew, wave * LAYER.rotate);
    st.dweight = lerp(st.dweight, st.weight, wave * LAYER.weight);
    st.dstretch = lerp(st.dstretch, st.stretch, wave * LAYER.weight);
    st.dtrack = lerp(st.dtrack, st.track, wave * LAYER.tracking);
    st.dopsz = lerp(st.dopsz, st.opsz, wave * LAYER.tracking);
    st.dblur = lerp(st.dblur, st.blur, wave * LAYER.blur);
  }

  // ── Physics loop ────────────────────────────────────────────────────────

  function applyEffects() {
    if (!active) return;

    const pointer = getPointer();
    const mouseX = pointer.x;
    const mouseY = pointer.y;
    const hasPointer = pointer.active;
    const now = performance.now();
    const velNorm = clamp(pointer.speed / 38, 0, 1);
    const velEase = smoothstep(velNorm);
    const interactive =
      phase === 'move' || phase === 'click' || phase === 'hold' || phase === 'drag';

    if (phase === 'move' && !reducedMotion) {
      const targetBlur =
        Math.min(pointer.speed * 0.08, 2.8) * SESSION.hoverIntensity;
      blurAmount = lerp(blurAmount, hasPointer ? targetBlur : 0, LAYER.blur);
      wordEl.style.filter =
        blurAmount > 0.18 ? `blur(${blurAmount.toFixed(2)}px)` : 'none';
    }

    if (interactive && !reducedMotion && !transitioning) {
      frame += 1;
      if (frame % 3 === 0 || centers.length !== letters.length) {
        refreshCenters();
      }

      const t = now * idlePeriod;
      const intensity = SESSION.hoverIntensity;
      const rotRange = SESSION.rotateRange;
      const scaleRange = SESSION.scaleRange;
      const velScale = SESSION.velStretch;

      if (phase === 'move' && hasPointer) {
        if (!moveTracking) {
          lastMoveX = mouseX;
          lastMoveY = mouseY;
          moveTracking = true;
        } else {
          const step = Math.hypot(mouseX - lastMoveX, mouseY - lastMoveY);
          lastMoveX = mouseX;
          lastMoveY = mouseY;

          let near = false;
          for (let i = 0; i < centers.length; i++) {
            const c = centers[i];
            if (Math.hypot(mouseX - c.x, mouseY - c.y) < progressRadius) {
              near = true;
              break;
            }
          }
          // Cap per-frame credit so slow exploration counts more fairly
          if (near && step > 0.4 && step < 56) {
            moveTravel += step;
            if (pointer.speed > 8 && frame % 10 === 0) sound.tick();
          }
        }

        const elapsed = now - stageStartedAt;
        const sub = clamp(moveTravel / EXPERIENCE.moveDistance, 0, 1);
        updateJourneyProgress(sub);

        if (
          moveTravel >= EXPERIENCE.moveDistance &&
          elapsed >= EXPERIENCE.moveMinMs
        ) {
          completeMove();
          rafId = requestAnimationFrame(applyEffects);
          return;
        }
      }

      if (phase === 'hold' && holding) {
        holdProgress = Math.min(1, (now - holdStart) / EXPERIENCE.holdMinMs);
        updateJourneyProgress(holdProgress);
        if (holdProgress >= 1 && !holdReady) {
          holdReady = true;
          if (!releasePrompted) {
            releasePrompted = true;
            setLabel(EXPERIENCE.stages.release);
          }
        }
      }

      if (phase === 'drag' && dragging) {
        const step = Math.hypot(mouseX - lastMoveX, mouseY - lastMoveY);
        lastMoveX = mouseX;
        lastMoveY = mouseY;
        if (step < 100) dragTravel += step;

        if (
          !dragReady &&
          dragTravel >= EXPERIENCE.dragDistance &&
          now - dragStartedAt >= EXPERIENCE.dragMinMs
        ) {
          dragReady = true;
          if (!dragReleasePrompted) {
            dragReleasePrompted = true;
            setLabel(EXPERIENCE.stages.dragRelease);
          }
        }

        updateJourneyProgress(
          clamp(dragTravel / EXPERIENCE.dragDistance, 0, 0.95)
        );
      }

      letters.forEach((el, i) => {
        const st = letterState[i];
        if (!st) return;

        const center = centers[i] || { x: 0, y: 0 };
        const dx = mouseX - center.x;
        const dy = mouseY - center.y;
        const dist = Math.hypot(dx, dy);
        const influence =
          hasPointer && (phase === 'move' || phase === 'hold' || phase === 'drag')
            ? smoothstep(1 - dist / influenceRadius)
            : 0;

        const breathMix = phase === 'move' ? 1 - influence * 0.85 : 0.35;
        const ft = t * st.floatSpeed;
        const breathY =
          Math.sin(ft * 1.15 + st.phase) *
          IDLE.float *
          SESSION.idleFloat *
          st.floatAmp *
          breathMix;
        const breathX =
          Math.cos(ft * 0.72 + st.phase * 1.1) *
          IDLE.float *
          0.35 *
          st.floatAmp *
          breathMix;
        const breathS =
          1 +
          Math.sin(ft * 0.95 + st.phase * 0.8) *
            IDLE.scale *
            st.scaleAmp *
            breathMix;
        const breathR =
          Math.sin(ft * 0.65 + st.phase) *
          IDLE.rotate *
          st.rotateAmp *
          breathMix;

        let tx = breathX;
        let ty = breathY;
        let tr = breathR;
        let ts = breathS;
        let sk = 0;
        let weight = EFFECT.restWeight;
        let stretch = EFFECT.restStretch;
        let track = EFFECT.restTracking;
        let opsz = EFFECT.restOpsz;
        let letterBlur = 0;
        let amp = 0;

        if (phase === 'move') {
          amp = influence * intensity;
          ty = breathY + EFFECT.y * amp * st.floatAmp;
          tr =
            breathR +
            EFFECT.rotate * rotRange * amp * st.rotateAmp * (dx >= 0 ? 1 : -1);
          ts =
            breathS *
            (1 + (EFFECT.scale - 1) * scaleRange * amp * st.scaleAmp);
          weight =
            EFFECT.restWeight + (EFFECT.weight - EFFECT.restWeight) * amp;

          if (amp > 0.04) {
            if (st.trait === 'weight') {
              weight = lerp(weight, EFFECT.weight + 80, amp * 0.55);
            } else if (st.trait === 'stretch') {
              stretch = lerp(
                EFFECT.restStretch,
                amp > 0.5 ? EFFECT.stretch : 0.88,
                amp
              );
            } else if (st.trait === 'track') {
              track = EFFECT.tracking * amp * (i % 2 === 0 ? 1 : 0.6);
            } else {
              ty -= 10 * amp * st.floatAmp;
            }
          }

          stretch = lerp(stretch, EFFECT.stretch, amp * 0.35);
          track = lerp(track, EFFECT.tracking * 0.7, amp * 0.45);
          opsz = lerp(EFFECT.restOpsz, EFFECT.opsz, amp);
          letterBlur = amp * 1.0 * (1 - st.outlineBias * 0.3);

          if (amp > 0.04 && velEase > 0.05) {
            const dir = pointer.vx >= 0 ? 1 : -1;
            sk += EFFECT.velSkew * velEase * amp * dir * velScale;
            ts *= 1 + EFFECT.velStretch * velEase * amp * velScale;
            tr += EFFECT.velRotate * velEase * amp * -dir * rotRange;
          }

          if (amp > 0.05) {
            tx += dx * EFFECT.pull * amp;
            ty += dy * EFFECT.pull * 0.7 * amp;
          }
        }

        if (phase === 'click') {
          tx = breathX * 0.4;
          ty = breathY * 0.4;
          tr = breathR * 0.4;
          ts = lerp(1, breathS, 0.4);
        }

        if (phase === 'hold') {
          const melt = holding ? holdProgress * holdProgress : 0;
          const mid = i - (letters.length - 1) / 2;
          const hdx = center.x - holdOriginX;
          const hdy = center.y - holdOriginY;
          const hdist = Math.hypot(hdx, hdy) || 1;
          const hx = hdx / hdist;
          const hy = hdy / hdist;
          const local =
            holding
              ? smoothstep(1 - hdist / (influenceRadius * 1.35))
              : 0;
          const strength = melt * (0.35 + local * 0.85);

          // Direction of hold vs word center picks a melt personality
          const wordRectX = centers.length
            ? centers.reduce((s, c) => s + c.x, 0) / centers.length
            : holdOriginX;
          const wordRectY = centers.length
            ? centers.reduce((s, c) => s + c.y, 0) / centers.length
            : holdOriginY;
          const ox = clamp((holdOriginX - wordRectX) / 180, -1, 1);
          const oy = clamp((holdOriginY - wordRectY) / 100, -1, 1);

          tx = breathX * (1 - strength * 0.7) + hx * 10 * strength;
          // Pull away from press, with gravity bias from press height
          ty =
            breathY * (1 - strength) +
            strength * (14 + local * 28) * (oy < -0.2 ? 1.35 : oy > 0.25 ? 0.55 : 1) +
            hy * 8 * strength;
          tr =
            breathR +
            strength * (mid * 5 + hx * 14 + ox * 10);
          ts = lerp(breathS, 1.02 + strength * (0.35 + local * 0.4), strength);
          sk =
            strength *
            (12 * (i % 2 === 0 ? 1 : -1) + ox * 10 + hx * 8);
          weight = lerp(EFFECT.restWeight, lerp(220, 140, local), strength);
          stretch = lerp(
            EFFECT.restStretch,
            1.15 + local * 0.35 + Math.abs(ox) * 0.12,
            strength
          );
          track = strength * (0.04 + local * 0.08);
          opsz = lerp(EFFECT.restOpsz, EFFECT.opsz, strength);
          letterBlur = strength * (0.4 + local * 0.7);
          amp = strength;
        }

        if (phase === 'drag') {
          if (dragging) {
            const pullX = (mouseX - dragStartX) / st.mass;
            const pullY = (mouseY - dragStartY) / st.mass;
            const mid = i - (letters.length - 1) / 2;
            const lag = 0.55 + st.mass * 0.35;

            tx = pullX * lag + mid * pullX * 0.04;
            ty = pullY * lag + Math.abs(mid) * pullY * 0.03;
            tr = pullX * 0.04 * st.rotateAmp + pointer.vx * 0.12;
            ts = 1 + Math.min(0.35, Math.hypot(pullX, pullY) * 0.0012);
            sk = pointer.vx * 0.35 * st.inertia;
            stretch = 1 + clamp(Math.abs(pullX) * 0.0008, 0, 0.25);
            weight = lerp(
              EFFECT.restWeight,
              650,
              clamp(Math.hypot(pullX, pullY) / 280, 0, 1)
            );
            track = clamp(Math.hypot(pullX, pullY) * 0.00015, 0, 0.1);
            opsz = lerp(
              EFFECT.restOpsz,
              EFFECT.opsz,
              clamp(Math.hypot(pullX, pullY) / 220, 0, 1)
            );
            amp = clamp(Math.hypot(pullX, pullY) / 220, 0, 1);
          } else {
            tx = breathX * 0.5;
            ty = breathY * 0.5;
            tr = breathR * 0.5;
            ts = lerp(1, breathS, 0.5);
          }
        }

        st.tx = tx;
        st.ty = ty;
        st.tr = tr;
        st.ts = ts;
        st.skew = sk;
        st.weight = weight;
        st.stretch = stretch;
        st.track = track;
        st.opsz = opsz;
        st.blur = letterBlur;

        catchLayers(st);
        springStep(st);
        paintLetter(el, st, amp);
      });
    }

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

  // ── Pointer ─────────────────────────────────────────────────────────────

  const onPointerDown = (e) => {
    if (transitioning) return;
    pointerIsDown = true;
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;

    if (phase === 'hold' && !holdComplete) {
      holding = true;
      holdStart = performance.now();
      holdProgress = 0;
      holdReady = false;
      releasePrompted = false;
      holdOriginX = e.clientX;
      holdOriginY = e.clientY;
      refreshCenters();
      setLabel(EXPERIENCE.stages.holding);
    }

    if (phase === 'drag') {
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartedAt = performance.now();
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      if (!dragReady) {
        dragTravel = Math.max(dragTravel, 0);
        setLabel(EXPERIENCE.stages.dragging);
      }
      sound.soft();
    }
  };

  const onPointerUp = (e) => {
    const wasDown = pointerIsDown;
    const ready = holdReady;
    const wasDragging = dragging;
    const dragOk = dragReady;
    pointerIsDown = false;

    if (!wasDown || transitioning) return;

    if (phase === 'click' && !clickDone) {
      const moved = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      if (moved <= 12) {
        playClickReaction(e.clientX, e.clientY);
      }
      return;
    }

    if (phase === 'hold' && holding) {
      holding = false;
      if (ready) {
        completeHold();
      } else {
        holdProgress = 0;
        holdReady = false;
        releasePrompted = false;
        updateJourneyProgress(0);
        setLabel(EXPERIENCE.stages.hold);
        settleLetters(ANIMATION.duration.hover);
      }
      return;
    }

    if (phase === 'drag' && wasDragging) {
      dragging = false;
      if (dragOk) {
        completeDrag();
      } else {
        setLabel(EXPERIENCE.stages.drag);
        settleLetters(ANIMATION.duration.hover);
      }
    }
  };

  section.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  const onPointerMoveHold = (e) => {
    if (phase === 'hold' && holding) {
      holdOriginX = e.clientX;
      holdOriginY = e.clientY;
    }
  };
  window.addEventListener('pointermove', onPointerMoveHold, { passive: true });
  replayBtn?.addEventListener('click', replay);
  cleanups.push(() => {
    section.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointermove', onPointerMoveHold);
    replayBtn?.removeEventListener('click', replay);
  });

  // ── Intro ───────────────────────────────────────────────────────────────

  function startIntro() {
    if (phase !== 'intro') return;
    const tl = gsap.timeline({
      onComplete: () => enterMove(),
    });

    if (openingEl) {
      gsap.set(openingEl, { opacity: 0, visibility: 'visible' });
      tl.to(openingEl, {
        opacity: 1,
        duration: ANIMATION.duration.normal,
        ease: ANIMATION.ease.out,
      }).to(openingEl, {
        opacity: 0,
        duration: ANIMATION.duration.hover,
        ease: ANIMATION.ease.soft,
        delay: (EXPERIENCE.openingHoldMs / 1000) * 0.6,
        onComplete: () => {
          openingEl.style.visibility = 'hidden';
        },
      });
    }

    gsap.set(letters, { opacity: 0, y: 20 });
    tl.to(
      letters,
      {
        opacity: 1,
        y: 0,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.expo,
        stagger: 0.04,
      },
      openingEl ? '-=0.1' : 0
    );
  }

  let entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: startIntro,
  });

  const visibility = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onEnter: () => {
      if (phase !== 'intro') startLoop();
    },
    onEnterBack: () => {
      if (phase !== 'intro') startLoop();
    },
    onLeave: stopLoop,
    onLeaveBack: stopLoop,
  });

  const pin = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=90%',
    pin: true,
    anticipatePin: 1,
  });

  const hintFade = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=90%',
    onLeave: () => hideContinueHint(),
    onEnterBack: () => {
      if (phase === 'complete') showContinueHint('Scroll');
    },
  });

  const onResize = () => refreshCenters();
  window.addEventListener('resize', onResize, { passive: true });

  resetMouseInteractionFn = () => {
    resetToInitial();
    rearmEntrance();
  };

  cleanups.push(() => {
    stopLoop();
    entrance.kill();
    visibility.kill();
    pin.kill();
    hintFade.kill();
    window.removeEventListener('resize', onResize);
    if (resetMouseInteractionFn) resetMouseInteractionFn = null;
  });

  return () => cleanups.forEach((fn) => fn());
}
