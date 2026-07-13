/**
 * Section 2 — Interactive Typography Journey
 *
 * Flow: Opening → Move → Click → Hold → Drag → Release → WOW → Ending → Replay
 *
 * Progressive disclosure: only the current gesture is available.
 * Feels like an interactive installation, not a playground.
 */

import { ANIMATION, EXPERIENCE } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { getPointer } from '../utils/pointer.js';
import { sound } from '../utils/audio.js';
import { SESSION } from '../utils/session.js';

const WORD = 'DESIGN';

/** @typedef {'intro' | 'move' | 'click' | 'hold' | 'drag' | 'release' | 'wow' | 'ending'} Phase */

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

/** Stage order for progress UI */
const STAGE_ORDER = ['move', 'click', 'hold', 'drag', 'release', 'wow', 'ending'];

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

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * @param {number} i
 * @param {number} salt
 */
function letterRand(i, salt = 1) {
  const x = Math.sin(i * 12.9898 + salt * 78.233 + SESSION.tempo * 40) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * @param {number} i
 * @param {number} total
 */
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
    /** Drag offset from pointer */
    grabOx: 0,
    grabOy: 0,
  };
}

/**
 * @param {HTMLElement} section
 * @returns {Function}
 */
export function initMouseInteraction(section) {
  const wordEl = section.querySelector('[data-mouse-word]');
  const label = section.querySelector('[data-mouse-label]') || section.querySelector('.mouse__label');
  const ending = section.querySelector('[data-mouse-ending]');
  const endingTitle = section.querySelector('[data-ending-title]');
  const replayBtn = section.querySelector('[data-mouse-replay]');
  const openingEl = section.querySelector('[data-mouse-opening]');
  const openingText = section.querySelector('[data-opening-text]');

  if (!wordEl) return () => {};

  if (openingText) openingText.textContent = SESSION.openingLine;
  if (endingTitle) endingTitle.textContent = SESSION.endingLine;
  if (replayBtn) {
    replayBtn.textContent = SESSION.endingCta;
    replayBtn.hidden = true;
    replayBtn.classList.remove('is-visible');
  }

  let letters = buildLetters(wordEl, WORD);
  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  /** @type {Phase} */
  let phase = 'intro';
  let stageStartedAt = 0;
  let active = false;
  let rafId = null;
  let hasPointer = false;
  let frame = 0;
  let blurAmount = 0;
  let wowDone = false;
  let transitioning = false;

  // Move stage
  let moveTravel = 0;
  let lastMoveX = 0;
  let lastMoveY = 0;
  let moveTracking = false;

  // Click stage
  let clickDone = false;

  // Hold stage
  let holding = false;
  let holdStart = 0;
  let holdProgress = 0;
  let holdComplete = false;

  // Drag stage
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragTravel = 0;
  let dragStartedAt = 0;
  let dragReady = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let pointerIsDown = false;

  // Cursor
  let cursorNear = 0;
  let cursorScale = 1;
  let cursorRing = 1;
  let cursorRot = 0;
  let cursorPressed = false;
  /** @type {Array<{ x: number, y: number }>} */
  let centers = [];

  const influenceRadius = SESSION.influenceRadius;
  const idlePeriod = SESSION.idlePeriod;

  /** @type {HTMLElement | null} */
  let cursorEl = null;
  /** @type {HTMLElement | null} */
  let cursorRingEl = null;
  /** @type {HTMLElement | null} */
  let cursorGlowEl = null;

  const finePointer =
    !reducedMotion &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (finePointer) {
    cursorEl = document.createElement('div');
    cursorEl.className = 'mouse__cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    cursorEl.innerHTML =
      '<span class="mouse__cursor-glow"></span>' +
      '<span class="mouse__cursor-ring"></span>' +
      '<span class="mouse__cursor-dot"></span>';
    section.appendChild(cursorEl);
    cursorRingEl = cursorEl.querySelector('.mouse__cursor-ring');
    cursorGlowEl = cursorEl.querySelector('.mouse__cursor-glow');
  }

  /** @type {ReturnType<typeof createLetterState>[]} */
  const letterState = letters.map((_, i) => createLetterState(i, letters.length));

  function refreshCenters() {
    centers = letters.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  }

  function syncLetterStateArray() {
    while (letterState.length < letters.length) {
      letterState.push(createLetterState(letterState.length, letters.length));
    }
    letterState.length = letters.length;
    letterState.forEach((_, i) => {
      Object.assign(letterState[i], createLetterState(i, letters.length));
    });
  }

  /**
   * @param {number} [sub=0] — 0–1 progress within the current stage
   */
  function updateJourneyProgress(sub = 0) {
    const idx = STAGE_ORDER.indexOf(phase);
    if (idx < 0) {
      section.style.setProperty('--journey-progress', '0');
      section.dataset.phase = phase;
      return;
    }
    const base = idx / STAGE_ORDER.length;
    const span = 1 / STAGE_ORDER.length;
    const progress = clamp(base + span * clamp(sub, 0, 1), 0, 1);
    section.style.setProperty('--journey-progress', String(progress));
    section.dataset.phase = phase;
  }

  function setLabel(text, { stage = true } = {}) {
    if (!label) return;
    gsap.killTweensOf(label);
    gsap.to(label, {
      opacity: 0,
      y: -6,
      duration: 0.32,
      ease: ANIMATION.ease.soft,
      onComplete: () => {
        label.textContent = text;
        label.classList.toggle('is-stage', Boolean(text) && stage);
        if (!text) return;
        gsap.fromTo(
          label,
          { opacity: 0, y: 8 },
          {
            opacity: stage ? 0.92 : 0.88,
            y: 0,
            duration: 0.55,
            ease: ANIMATION.ease.out,
          }
        );
      },
    });
  }

  /**
   * Soft settle all letters toward rest pose via GSAP, then sync spring state.
   * @param {number} [duration=0.9]
   * @returns {Promise<void>}
   */
  function settleLetters(duration = 0.9) {
    return new Promise((resolve) => {
      let pending = letters.length;
      if (pending === 0) {
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

  /**
   * Capture current spring values into GSAP props for timeline handoff.
   */
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

  // ── Stage transitions ───────────────────────────────────────────────────

  function enterMove() {
    phase = 'move';
    stageStartedAt = performance.now();
    transitioning = false;
    moveTravel = 0;
    moveTracking = false;
    wowDone = false;
    updateJourneyProgress();
    // Label already shown during intro; reinforce without flicker if present
    if (label && label.textContent !== EXPERIENCE.stages.move) {
      setLabel(EXPERIENCE.stages.move);
    } else if (label) {
      label.classList.add('is-stage');
      gsap.to(label, { opacity: 0.92, y: 0, duration: 0.4, ease: ANIMATION.ease.out });
    }
    refreshCenters();
    startLoop();

    if (reducedMotion) {
      window.setTimeout(() => {
        if (phase === 'move') enterClick();
      }, EXPERIENCE.moveMinMs * 0.6);
    }
  }

  async function enterClick() {
    if (phase !== 'move' || transitioning) return;
    transitioning = true;
    phase = 'click';
    clickDone = false;
    stageStartedAt = performance.now();
    updateJourneyProgress();
    sound.soft();

    await settleLetters(0.75);
    setLabel(EXPERIENCE.stages.click);
    transitioning = false;
    refreshCenters();

    if (reducedMotion) {
      window.setTimeout(() => {
        if (phase === 'click' && !clickDone) playClickReaction(section.getBoundingClientRect().left + section.clientWidth / 2, section.getBoundingClientRect().top + section.clientHeight / 2);
      }, 800);
    }
  }

  async function enterHold() {
    if (phase !== 'click' || transitioning) return;
    transitioning = true;
    phase = 'hold';
    holding = false;
    holdProgress = 0;
    holdComplete = false;
    cursorPressed = false;
    stageStartedAt = performance.now();
    updateJourneyProgress();
    sound.soft();

    await settleLetters(EXPERIENCE.holdSettleMs / 1000);
    setLabel(EXPERIENCE.stages.hold);
    transitioning = false;
    refreshCenters();

    if (reducedMotion) {
      window.setTimeout(() => {
        if (phase === 'hold') enterDrag();
      }, EXPERIENCE.holdMinMs + EXPERIENCE.holdSettleMs);
    }
  }

  async function enterDrag() {
    if (phase !== 'hold' || transitioning) return;

    transitioning = true;
    phase = 'drag';
    dragging = false;
    dragTravel = 0;
    dragReady = false;
    pointerIsDown = false;
    stageStartedAt = performance.now();
    updateJourneyProgress();
    sound.soft();

    await settleLetters(0.65);
    setLabel(EXPERIENCE.stages.drag);
    transitioning = false;
    refreshCenters();

    if (reducedMotion) {
      window.setTimeout(() => {
        if (phase === 'drag') enterRelease();
      }, EXPERIENCE.dragMinMs);
    }
  }

  function enterRelease() {
    if (phase !== 'drag' || transitioning) return;
    transitioning = true;
    phase = 'release';
    dragging = false;
    cursorPressed = false;
    stageStartedAt = performance.now();
    updateJourneyProgress();
    setLabel('');
    sound.soft();

    captureToGsap();

    const tl = gsap.timeline({
      onComplete: () => {
        letters.forEach((el, i) => {
          const st = letterState[i];
          if (st) {
            st.x = st.y = st.r = st.sk = 0;
            st.s = 1;
            st.stretchCur = 1;
            st.dtx = st.dty = st.dtr = st.dsk = 0;
            st.dts = 1;
            st.dweight = EFFECT.restWeight;
            st.dstretch = EFFECT.restStretch;
            st.vx = st.vy = st.vr = st.vs = st.vsk = st.vstretch = 0;
          }
          gsap.set(el, { clearProps: 'transform,filter' });
          el.style.fontWeight = String(EFFECT.restWeight);
          el.style.filter = '';
          el.classList.remove('is-soft-outline', 'is-outline');
        });
        transitioning = false;
        enterWow();
      },
    });

    letters.forEach((el, i) => {
      const order = SESSION.waveDir === 1 ? i : letters.length - 1 - i;
      const st = letterState[i];
      tl.to(
        el,
        {
          x: 0,
          y: 0,
          rotation: 0,
          skewX: 0,
          scaleX: 1,
          scaleY: 1,
          fontWeight: EFFECT.restWeight,
          filter: 'blur(0px)',
          opacity: 1,
          duration: EXPERIENCE.releaseMs / 1000,
          ease: ANIMATION.ease.settle,
        },
        order * 0.07
      );
      if (st) {
        tl.to(
          st,
          {
            dweight: EFFECT.restWeight,
            dstretch: EFFECT.restStretch,
            dtrack: EFFECT.restTracking,
            duration: EXPERIENCE.releaseMs / 1000,
            ease: ANIMATION.ease.settle,
          },
          order * 0.07
        );
      }
    });
  }

  function enterWow() {
    if (wowDone || phase === 'wow' || phase === 'ending') return;
    wowDone = true;
    phase = 'wow';
    transitioning = true;
    hasPointer = false;
    stageStartedAt = performance.now();
    updateJourneyProgress();
    setLabel('');
    wordEl.style.filter = 'none';
    wordEl.classList.add('is-exploding');
    section.classList.add('is-climax');
    sound.whoosh();

    letters.forEach((el, i) => {
      const st = letterState[i];
      if (!st) return;
      gsap.set(el, {
        x: st.x,
        y: st.y,
        rotation: st.r,
        skewX: st.sk,
        scale: st.s,
        opacity: 1,
      });
      el.style.textShadow = 'none';
      el.classList.remove('is-soft-outline');
      st.vx = st.vy = st.vr = st.vs = st.vsk = 0;
    });

    const tl = gsap.timeline({
      onComplete: () => {
        section.classList.remove('is-climax');
        wordEl.classList.remove('is-exploding');
        transitioning = false;
        enterEnding();
      },
    });

    tl.fromTo(
      section,
      { '--climax-flash': 0.38 },
      {
        '--climax-flash': 0,
        duration: 1.5,
        ease: ANIMATION.ease.out,
      },
      0
    );

    letters.forEach((el, i) => {
      const angle =
        (i / letters.length) * Math.PI * 2 -
        Math.PI / 2 +
        (letterRand(i, 12) - 0.5) * 0.35;
      const dist = 170 + letterRand(i, 13) * 200;
      const spin =
        (letterRand(i, 14) > 0.5 ? 1 : -1) * (200 + letterRand(i, 15) * 260);
      const order = SESSION.waveDir === 1 ? i : letters.length - 1 - i;

      el.classList.add('is-outline');

      tl.to(
        el,
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rotation: spin,
          skewX: 0,
          scale: 0.22 + letterRand(i, 16) * 0.4,
          opacity: 0.1,
          filter: 'blur(2.5px)',
          duration: 1.1,
          ease: 'power3.in',
        },
        order * 0.045
      );
    });

    tl.to({}, { duration: 0.3 });

    tl.add(() => {
      gsap.killTweensOf(letters);
      letters = buildLetters(wordEl, EXPERIENCE.climaxWord);
      syncLetterStateArray();
      wordEl.setAttribute('aria-label', EXPERIENCE.climaxWord);
      gsap.set(letters, {
        opacity: 0,
        scale: 0.28,
        y: 48,
        x: () => (Math.random() - 0.5) * 70,
        rotation: () => (Math.random() - 0.5) * 50,
        filter: 'blur(4px)',
      });
    });

    tl.to(letters, {
      opacity: 1,
      scale: 1,
      y: 0,
      x: 0,
      rotation: 0,
      filter: 'blur(0px)',
      duration: ANIMATION.duration.climax,
      ease: ANIMATION.ease.softSpring,
      stagger: {
        each: 0.075,
        from: SESSION.staggerFrom === 'edges' ? 'edges' : 'center',
      },
    });

    tl.to({}, { duration: 0.7 });
  }

  function enterEnding() {
    phase = 'ending';
    stopLoop();
    transitioning = false;
    updateJourneyProgress();
    if (cursorEl) cursorEl.style.opacity = '0';
    section.classList.remove('has-custom-cursor');

    if (endingTitle) endingTitle.textContent = SESSION.endingLine;
    if (replayBtn) {
      replayBtn.hidden = true;
      replayBtn.classList.remove('is-visible');
      replayBtn.textContent = SESSION.endingCta;
    }

    if (label) {
      label.classList.remove('is-stage');
      gsap.to(label, { opacity: 0, duration: 0.4 });
    }

    gsap.to(wordEl, {
      opacity: 0.12,
      scale: 0.92,
      filter: 'blur(4px)',
      duration: ANIMATION.duration.ending,
      ease: ANIMATION.ease.smooth,
    });

    if (ending) {
      ending.setAttribute('aria-hidden', 'false');
      gsap.set(ending, { pointerEvents: 'auto' });
      gsap.fromTo(
        ending,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
          delay: 0.25,
        }
      );
    }

    // Quiet hold, then reveal Replay
    window.setTimeout(() => {
      if (phase !== 'ending' || !replayBtn) return;
      replayBtn.hidden = false;
      replayBtn.classList.add('is-visible');
    }, EXPERIENCE.endingHoldMs);

    sound.soft();
  }

  // ── Click reaction ──────────────────────────────────────────────────────

  function playClickReaction(clientX, clientY) {
    if (phase !== 'click' || clickDone || transitioning) return;
    clickDone = true;
    transitioning = true;
    sound.pop();
    setLabel('');

    if (reducedMotion) {
      gsap.fromTo(
        letters,
        { opacity: 0.5 },
        {
          opacity: 1,
          duration: 0.45,
          stagger: 0.04,
          ease: ANIMATION.ease.out,
          onComplete: () => {
            transitioning = false;
            window.setTimeout(() => enterHold(), EXPERIENCE.clickSettleMs * 0.5);
          },
        }
      );
      return;
    }

    captureToGsap();
    let pending = letters.length;

    letters.forEach((el, i) => {
      const st = letterState[i];
      const mid = i - (letters.length - 1) / 2;
      const waveY = Math.sin(i * 0.9) * 36;
      const rot = mid * 9 + (letterRand(i, 20) - 0.5) * 18;
      const scale = 1.18 + letterRand(i, 21) * 0.28;
      const weight = 200 + letterRand(i, 22) * 700;
      const delay = Math.abs(mid) * 0.045;

      gsap.to(el, {
        x: mid * 14,
        y: waveY - 18,
        rotation: rot,
        scale,
        fontWeight: weight,
        duration: 0.45,
        ease: ANIMATION.ease.softSpring,
        delay,
        onComplete: () => {
          gsap.to(el, {
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            fontWeight: EFFECT.restWeight,
            duration: 0.85,
            ease: ANIMATION.ease.settle,
            onComplete: () => {
              if (st) {
                st.x = st.y = st.r = 0;
                st.s = 1;
                st.vx = st.vy = st.vr = st.vs = 0;
                st.dtx = st.dty = st.dtr = 0;
                st.dts = 1;
                st.dweight = EFFECT.restWeight;
              }
              gsap.set(el, { clearProps: 'transform' });
              el.style.fontWeight = String(EFFECT.restWeight);
              pending -= 1;
              if (pending <= 0) {
                transitioning = false;
                window.setTimeout(() => {
                  if (phase === 'click') enterHold();
                }, EXPERIENCE.clickSettleMs * 0.35);
              }
            },
          });
        },
      });
    });
  }

  // ── Spring step ─────────────────────────────────────────────────────────

  /**
   * @param {ReturnType<typeof createLetterState>} st
   */
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

  /**
   * Apply visual styles from spring state.
   * @param {HTMLElement} el
   * @param {ReturnType<typeof createLetterState>} st
   * @param {number} amp
   */
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

  /**
   * Layered catch toward live targets.
   * @param {ReturnType<typeof createLetterState>} st
   */
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

  // ── Main loop ───────────────────────────────────────────────────────────

  function applyEffects() {
    if (!active) return;

    const pointer = getPointer();
    const mouseX = pointer.x;
    const mouseY = pointer.y;
    const now = performance.now();
    const velNorm = clamp(pointer.speed / 38, 0, 1);
    const velEase = smoothstep(velNorm);
    const interactive =
      phase === 'move' || phase === 'click' || phase === 'hold' || phase === 'drag';

    // Custom cursor
    if (cursorEl && interactive) {
      cursorScale = lerp(cursorScale, cursorPressed ? 0.68 : 1 + cursorNear * 0.55, 0.16);
      cursorRing = lerp(cursorRing, 1 + cursorNear * 1.2 + velEase * 0.2, 0.12);
      const targetRot =
        pointer.speed > 0.8
          ? Math.atan2(pointer.vy, pointer.vx) * (180 / Math.PI)
          : cursorRot;
      cursorRot = lerp(cursorRot, targetRot, 0.08);

      cursorEl.style.transform =
        `translate3d(${mouseX.toFixed(1)}px, ${mouseY.toFixed(1)}px, 0) ` +
        `rotate(${cursorRot.toFixed(2)}deg) scale(${cursorScale.toFixed(3)})`;
      cursorEl.style.opacity = hasPointer ? '1' : '0';
      cursorEl.classList.toggle('is-near', cursorNear > 0.12);
      cursorEl.classList.toggle('is-pressed', cursorPressed);
      if (cursorRingEl) cursorRingEl.style.transform = `scale(${cursorRing.toFixed(3)})`;
      if (cursorGlowEl) {
        cursorGlowEl.style.opacity = String((0.08 + cursorNear * 0.2).toFixed(3));
      }
      section.classList.toggle('has-custom-cursor', hasPointer);
    } else if (cursorEl) {
      cursorEl.style.opacity = '0';
      section.classList.remove('has-custom-cursor');
    }

    // Soft word blur only during move/drag
    if ((phase === 'move' || phase === 'drag') && !reducedMotion) {
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

      let maxInfluence = 0;
      const t = now * idlePeriod;
      const intensity = SESSION.hoverIntensity;
      const rotRange = SESSION.rotateRange;
      const scaleRange = SESSION.scaleRange;
      const velScale = SESSION.velStretch;

      // Move progress: accumulate travel near type
      if (phase === 'move' && hasPointer) {
        if (!moveTracking) {
          lastMoveX = mouseX;
          lastMoveY = mouseY;
          moveTracking = true;
        } else {
          const step = Math.hypot(mouseX - lastMoveX, mouseY - lastMoveY);
          lastMoveX = mouseX;
          lastMoveY = mouseY;

          // Only count travel when near letters
          let near = false;
          for (let i = 0; i < centers.length; i++) {
            const c = centers[i];
            if (Math.hypot(mouseX - c.x, mouseY - c.y) < influenceRadius) {
              near = true;
              break;
            }
          }
          if (near && step < 80) {
            moveTravel += step;
            if (pointer.speed > 8 && frame % 10 === 0) sound.tick();
          }
        }

        const elapsed = now - stageStartedAt;
        if (
          moveTravel >= EXPERIENCE.moveDistance &&
          elapsed >= EXPERIENCE.moveMinMs
        ) {
          enterClick();
          rafId = requestAnimationFrame(applyEffects);
          return;
        }

        updateJourneyProgress(
          clamp(moveTravel / EXPERIENCE.moveDistance, 0, 0.95)
        );
      }

      // Hold progress
      if (phase === 'hold' && holding) {
        holdProgress = Math.min(
          1,
          (now - holdStart) / EXPERIENCE.holdMinMs
        );
        if (holdProgress >= 1) holdComplete = true;
        updateJourneyProgress(holdProgress);
      }

      // Drag travel
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
          hasPointer && (phase === 'move' || phase === 'drag' || phase === 'hold')
            ? smoothstep(1 - dist / influenceRadius)
            : 0;

        if (influence > maxInfluence) maxInfluence = influence;

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

        // ── MOVE: explore type ──
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

        // ── CLICK: quiet rest while waiting ──
        if (phase === 'click') {
          tx = breathX * 0.4;
          ty = breathY * 0.4;
          tr = breathR * 0.4;
          ts = lerp(1, breathS, 0.4);
        }

        // ── HOLD: melt / stretch / distort ──
        if (phase === 'hold') {
          const melt = holding ? holdProgress * holdProgress : 0;
          const mid = i - (letters.length - 1) / 2;

          tx = breathX * (1 - melt * 0.7);
          ty = breathY * (1 - melt) + melt * (22 + Math.abs(mid) * 6);
          tr = breathR + melt * mid * 7;
          ts = lerp(breathS, 1.05 + melt * 0.55, melt);
          sk = melt * 16 * (i % 2 === 0 ? 1 : -1);
          weight = lerp(EFFECT.restWeight, 180, melt);
          stretch = lerp(EFFECT.restStretch, 1.35, melt);
          track = melt * 0.08;
          opsz = lerp(EFFECT.restOpsz, EFFECT.opsz, melt);
          letterBlur = melt * 0.8;
          amp = melt;
        }

        // ── DRAG: weight, elastic, inertia ──
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
            weight = lerp(EFFECT.restWeight, 650, clamp(Math.hypot(pullX, pullY) / 280, 0, 1));
            track = clamp(Math.hypot(pullX, pullY) * 0.00015, 0, 0.1);
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

      cursorNear = maxInfluence;
    } else if (
      !reducedMotion &&
      !transitioning &&
      (phase === 'release' || phase === 'wow')
    ) {
      // Still tick springs lightly if needed — mostly GSAP driven
    }

    rafId = requestAnimationFrame(applyEffects);
  }

  function startLoop() {
    if (active) return;
    if (reducedMotion) return;
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
      el.style.webkitTextStroke = '';
      el.style.color = '';
      el.style.removeProperty('--outline-mix');
      el.classList.remove('is-outline', 'is-soft-outline');
    });
    wordEl.style.filter = 'none';
    wordEl.style.letterSpacing = '';
    wordEl.classList.remove('is-exploding');
    blurAmount = 0;
    hasPointer = false;
    holding = false;
    dragging = false;
    cursorNear = 0;
    cursorPressed = false;
  }

  // ── Opening ─────────────────────────────────────────────────────────────

  function startIntro() {
    phase = 'intro';
    updateJourneyProgress();

    const hold = reducedMotion ? 0.2 : EXPERIENCE.openingHoldMs / 1000;
    const tl = gsap.timeline({ onComplete: () => enterMove() });

    if (openingEl) {
      gsap.set(openingEl, { autoAlpha: 1 });
      tl.to(openingEl, {
        autoAlpha: 0,
        y: -8,
        duration: 0.65,
        ease: ANIMATION.ease.smooth,
        delay: hold,
      });
    } else {
      tl.to({}, { duration: hold * 0.3 });
    }

    const staggerEach = 0.065;
    const from =
      SESSION.staggerFrom === 'start'
        ? SESSION.waveDir === 1
          ? 'start'
          : 'end'
        : SESSION.staggerFrom === 'end'
          ? SESSION.waveDir === 1
            ? 'end'
            : 'start'
          : SESSION.staggerFrom;

    tl.to(
      letters,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.expo,
        stagger: { each: staggerEach, from },
        onComplete: () => {
          gsap.set(letters, { clearProps: 'transform' });
        },
      },
      openingEl ? '-=0.25' : 0
    );

    if (label) {
      label.textContent = EXPERIENCE.stages.move;
      label.classList.add('is-stage');
      tl.to(
        label,
        {
          opacity: 0.92,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
        },
        '-=0.5'
      );
    }
  }

  // ── Replay ──────────────────────────────────────────────────────────────

  function replay() {
    if (phase !== 'ending') return;
    sound.pop();

    moveTravel = 0;
    moveTracking = false;
    clickDone = false;
    holding = false;
    holdProgress = 0;
    holdComplete = false;
    dragging = false;
    dragTravel = 0;
    dragReady = false;
    wowDone = false;
    transitioning = false;
    pointerIsDown = false;

    if (ending) {
      ending.setAttribute('aria-hidden', 'true');
      gsap.to(ending, {
        autoAlpha: 0,
        y: -8,
        duration: 0.4,
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
      const lines = [
        'Move the Type',
        'Typography in Motion',
        'Every Letter Reacts',
      ];
      openingText.textContent = lines[Math.floor(Math.random() * lines.length)];
      gsap.set(openingEl, { autoAlpha: 1, y: 0 });
    }

    letters = buildLetters(wordEl, WORD);
    syncLetterStateArray();
    wordEl.setAttribute('aria-label', WORD);
    resetLetterStyles();

    gsap.set(wordEl, { opacity: 1, scale: 1, filter: 'none', y: 0 });
    gsap.set(letters, { opacity: 0, y: 28, scale: 0.96 });
    if (label) gsap.set(label, { opacity: 0, y: 10, xPercent: -50 });

    const hold = reducedMotion ? 0.15 : 0.9;
    const tl = gsap.timeline({ onComplete: () => enterMove() });

    if (openingEl) {
      tl.to(openingEl, {
        autoAlpha: 0,
        y: -6,
        duration: 0.5,
        ease: ANIMATION.ease.smooth,
        delay: hold,
      });
    }

    tl.to(
      letters,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.expo,
        stagger: 0.055,
        onComplete: () => {
          gsap.set(letters, { clearProps: 'transform' });
        },
      },
      openingEl ? '-=0.2' : 0
    );

    if (label) {
      label.textContent = EXPERIENCE.stages.move;
      label.classList.add('is-stage');
      tl.to(
        label,
        {
          opacity: 0.92,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
        },
        '-=0.45'
      );
    }
  }

  // ── Pointer handlers ────────────────────────────────────────────────────

  const onPointerMove = (e) => {
    if (
      phase !== 'move' &&
      phase !== 'click' &&
      phase !== 'hold' &&
      phase !== 'drag'
    ) {
      return;
    }
    hasPointer = true;

    // Drag starts when moved enough while down
    if (phase === 'drag' && pointerIsDown && !dragging && !transitioning) {
      const moved = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      if (moved > 10) {
        dragging = true;
        cursorPressed = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartedAt = performance.now();
        lastMoveX = e.clientX;
        lastMoveY = e.clientY;
        dragTravel = 0;
        sound.soft();
      }
    }
  };

  const onPointerLeave = () => {
    hasPointer = false;
    if (phase === 'hold' && holding) {
      // Cancel incomplete hold — restore
      holding = false;
      cursorPressed = false;
      holdProgress = 0;
    }
    if (phase === 'drag' && dragging) {
      // Keep inertia via springs returning toward breath
      if (dragReady) {
        enterRelease();
      } else {
        dragging = false;
        cursorPressed = false;
        pointerIsDown = false;
      }
    }
  };

  const onPointerDown = (e) => {
    if (transitioning) return;
    if (phase !== 'click' && phase !== 'hold' && phase !== 'drag') return;

    pointerIsDown = true;
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
    cursorPressed = true;

    if (phase === 'hold') {
      holding = true;
      holdStart = performance.now();
      holdProgress = 0;
      holdComplete = false;
      sound.soft();
    }

    if (phase === 'drag') {
      // Wait for move to begin drag (avoids click-as-drag)
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
    }
  };

  const onPointerUp = (e) => {
    const wasHolding = holding;
    const wasDragging = dragging;
    const heldLongEnough = holdComplete;
    const ready = dragReady;

    pointerIsDown = false;
    cursorPressed = false;

    if (phase === 'hold' && wasHolding) {
      holding = false;
      if (heldLongEnough) {
        holdComplete = false;
        sound.soft();
        enterDrag();
      } else {
        // Incomplete — soft restore via springs, stay on Hold
        holdProgress = 0;
      }
      return;
    }

    if (phase === 'drag' && wasDragging) {
      dragging = false;
      if (ready) {
        enterRelease();
      }
      return;
    }

    if (phase === 'click') {
      const moved = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      if (moved <= 12) {
        playClickReaction(e.clientX, e.clientY);
      }
    }
  };

  // ── Init ────────────────────────────────────────────────────────────────

  gsap.set(letters, { opacity: 0, y: 36, scale: 0.94 });
  if (label) gsap.set(label, { opacity: 0, y: 10, xPercent: -50, left: '50%' });
  if (ending) gsap.set(ending, { autoAlpha: 0, pointerEvents: 'none' });
  if (openingEl) gsap.set(openingEl, { autoAlpha: 1 });
  updateJourneyProgress();

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: () => startIntro(),
  });

  const visibility = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onEnter: () => {
      if (
        phase === 'move' ||
        phase === 'click' ||
        phase === 'hold' ||
        phase === 'drag'
      ) {
        startLoop();
      }
    },
    onEnterBack: () => {
      if (
        phase === 'move' ||
        phase === 'click' ||
        phase === 'hold' ||
        phase === 'drag'
      ) {
        startLoop();
      }
    },
    onLeave: () => stopLoop(),
    onLeaveBack: () => stopLoop(),
  });

  const pin = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=90%',
    pin: true,
    pinSpacing: true,
    anticipatePin: 1,
  });

  section.addEventListener('pointermove', onPointerMove, { passive: true });
  section.addEventListener('pointerleave', onPointerLeave);
  section.addEventListener('pointerdown', onPointerDown, { passive: true });
  section.addEventListener('pointerup', onPointerUp, { passive: true });
  section.addEventListener('pointercancel', onPointerUp, { passive: true });
  replayBtn?.addEventListener('click', replay);

  const rect = section.getBoundingClientRect();
  if (rect.top < window.innerHeight * 0.65 && rect.bottom > 0) {
    startIntro();
  }

  cleanups.push(() => {
    section.removeEventListener('pointermove', onPointerMove);
    section.removeEventListener('pointerleave', onPointerLeave);
    section.removeEventListener('pointerdown', onPointerDown);
    section.removeEventListener('pointerup', onPointerUp);
    section.removeEventListener('pointercancel', onPointerUp);
    replayBtn?.removeEventListener('click', replay);
    stopLoop();
    entrance.kill();
    visibility.kill();
    pin.kill();
    gsap.killTweensOf(letters);
    gsap.killTweensOf(wordEl);
    if (ending) gsap.killTweensOf(ending);
    if (label) gsap.killTweensOf(label);
    if (openingEl) gsap.killTweensOf(openingEl);
    cursorEl?.remove();
  });

  return () => cleanups.forEach((fn) => fn());
}
