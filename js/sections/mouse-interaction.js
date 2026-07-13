/**
 * Section 2 — Interactive Typography Experience
 *
 * Flow: Concept Opening → Explore → Climax → Ending → Replay
 *
 * Polish model:
 *  - Each letter = independent organism (mass, tempo, float, trait)
 *  - Session seed = subtle visit-to-visit variation
 *  - Layered response = scale → rotate → weight → tracking → blur
 *  - Typography axes participate (weight, stretch, tracking, baseline, outline)
 *  - Soft spring physics (inertia + damping + mass)
 */

import { ANIMATION, EXPERIENCE } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { getPointer } from '../utils/pointer.js';
import { sound } from '../utils/audio.js';
import { SESSION } from '../utils/session.js';

const WORD = 'DESIGN';

/** Base spring — session multiplies per visit */
const SPRING = {
  stiffness: 0.078,
  damping: 0.76,
  settleDamping: 0.9,
};

/** Base effect amplitudes — session + letter multiply */
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

/** Layer catch-rate from ms delays (higher = snappier) */
function layerCatch(ms) {
  // ~60fps frames to catch up; tighter for earlier layers
  return Math.max(0.045, 0.42 - ms * 0.00135);
}

const LAYER = {
  scale: layerCatch(ANIMATION.layers.scale),
  rotate: layerCatch(ANIMATION.layers.rotate),
  weight: layerCatch(ANIMATION.layers.weight),
  tracking: layerCatch(ANIMATION.layers.tracking),
  blur: layerCatch(ANIMATION.layers.blur),
};

/** @typedef {'intro' | 'explore' | 'climax' | 'ending'} Phase */
/** @typedef {'weight' | 'stretch' | 'track' | 'baseline'} LetterTrait */

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
 * Stable-ish hash from index + session for personality (not pure Math.random each rebuild)
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

  /** @type {LetterTrait} */
  const traits = ['weight', 'stretch', 'track', 'baseline'];
  const trait = traits[Math.floor(r5 * traits.length)];

  // Stagger index respects session wave direction
  const orderIndex = SESSION.waveDir === 1 ? i : total - 1 - i;

  return {
    // delayed targets (layered)
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
    // live targets
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
    // current (springed)
    x: 0,
    y: 0,
    r: 0,
    s: 1,
    sk: 0,
    stretchCur: 1,
    // velocities
    vx: 0,
    vy: 0,
    vr: 0,
    vs: 0,
    vsk: 0,
    vstretch: 0,
    // ── Personality (independent organism) ──
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
    /** Soft outline affinity — some letters go outline sooner */
    outlineBias: 0.55 + r3 * 0.4,
  };
}

/**
 * @param {HTMLElement} section
 * @returns {Function}
 */
export function initMouseInteraction(section) {
  const wordEl = section.querySelector('[data-mouse-word]');
  const label = section.querySelector('.mouse__label');
  const ending = section.querySelector('[data-mouse-ending]');
  const endingTitle = section.querySelector('[data-ending-title]');
  const replayBtn = section.querySelector('[data-mouse-replay]');
  const openingEl = section.querySelector('[data-mouse-opening]');
  const openingText = section.querySelector('[data-opening-text]');

  if (!wordEl) return () => {};

  if (openingText) openingText.textContent = SESSION.openingLine;
  if (endingTitle) endingTitle.textContent = SESSION.endingLine;
  if (replayBtn) replayBtn.textContent = SESSION.endingCta;

  let letters = buildLetters(wordEl, WORD);
  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  /** @type {Phase} */
  let phase = 'intro';
  let energy = 0;
  let exploreStartedAt = 0;
  let lastInteractAt = 0;
  let active = false;
  let rafId = null;
  let hasPointer = false;
  let holdActive = false;
  let holdStart = 0;
  let holdRaf = null;
  let lastTickSound = 0;
  let wheelMorph = { weight: 400, size: 1, tracking: -0.03 };
  let blurAmount = 0;
  let climaxDone = false;
  let burstLock = false;
  let idleEndingArmed = false;
  let frame = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let cursorNear = 0;
  let cursorScale = 1;
  let cursorRing = 1;
  let cursorRot = 0;
  let cursorPressed = false;
  /** @type {Array<{ x: number, y: number }>} */
  let centers = [];

  const influenceRadius = SESSION.influenceRadius;
  const idlePeriod = SESSION.idlePeriod;

  // Custom cursor — fine pointer only
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

  function refreshCenters() {
    centers = letters.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  }

  /** @type {ReturnType<typeof createLetterState>[]} */
  const letterState = letters.map((_, i) => createLetterState(i, letters.length));

  function syncLetterStateArray() {
    while (letterState.length < letters.length) {
      letterState.push(createLetterState(letterState.length, letters.length));
    }
    letterState.length = letters.length;
    letterState.forEach((_, i) => {
      Object.assign(letterState[i], createLetterState(i, letters.length));
    });
  }

  function noteInteract() {
    lastInteractAt = performance.now();
    idleEndingArmed = false;
  }

  // ── Entrance / Concept Opening ──────────────────────────────────────────
  gsap.set(letters, { opacity: 0, y: 36, scale: 0.94 });
  if (label) gsap.set(label, { opacity: 0, y: 10 });
  if (ending) gsap.set(ending, { autoAlpha: 0, pointerEvents: 'none' });
  if (openingEl) gsap.set(openingEl, { autoAlpha: 1 });

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: () => startIntro(),
  });

  function startIntro() {
    phase = 'intro';

    const hold = reducedMotion ? 0.2 : EXPERIENCE.openingHoldMs / 1000;

    const tl = gsap.timeline({
      onComplete: () => enterExplore(),
    });

    // Concept line holds, then soft exit
    if (openingEl) {
      gsap.set(openingEl, { autoAlpha: 1 });
      tl.to(openingEl, {
        autoAlpha: 0,
        y: -8,
        duration: 0.7,
        ease: ANIMATION.ease.smooth,
        delay: hold,
      });
    } else {
      tl.to({}, { duration: hold * 0.3 });
    }

    // Letters awaken with session stagger direction
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
      label.textContent = 'Move';
      tl.to(
        label,
        {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
        },
        '-=0.55'
      );
    }
  }

  function enterExplore() {
    phase = 'explore';
    climaxDone = false;
    energy = 0;
    exploreStartedAt = performance.now();
    lastInteractAt = exploreStartedAt;
    idleEndingArmed = false;
    setLabel(reducedMotion ? 'Click' : 'Move · Click · Hold · Scroll');
    refreshCenters();
    startLoop();
    updateEnergyUI();

    if (reducedMotion) {
      window.setTimeout(() => {
        if (phase === 'explore' && energy < 0.4) addEnergy(0.45);
      }, EXPERIENCE.minExploreMs);
    }
  }

  function setLabel(text) {
    if (!label) return;
    gsap.killTweensOf(label);
    gsap.to(label, {
      opacity: 0,
      y: -6,
      duration: 0.28,
      ease: ANIMATION.ease.soft,
      onComplete: () => {
        label.textContent = text;
        if (!text) return;
        gsap.to(label, {
          opacity: 0.85,
          y: 0,
          duration: 0.5,
          ease: ANIMATION.ease.out,
        });
      },
    });
  }

  /**
   * @param {number} amount
   * @param {{ interact?: boolean }} [opts]
   */
  function addEnergy(amount, opts = {}) {
    if (phase !== 'explore' || climaxDone) return;
    energy = Math.min(1, energy + amount);
    updateEnergyUI();
    if (opts.interact !== false) noteInteract();

    const elapsed = performance.now() - exploreStartedAt;
    if (energy >= EXPERIENCE.climaxEnergy && elapsed >= EXPERIENCE.minExploreMs) {
      triggerClimax();
    } else if (energy > 0.55 && energy < 0.7 && !section.dataset.buildup) {
      section.dataset.buildup = '1';
      setLabel('Keep going');
    }
  }

  function updateEnergyUI() {
    section.style.setProperty('--experience-energy', String(energy));
  }

  /**
   * Mass-aware spring — heavier letters respond slower, carry more inertia.
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
    // Momentum retention — must stay < 1 so settle never amplifies
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

  // ── Main loop ───────────────────────────────────────────────────────────
  function applyEffects() {
    if (!active) return;

    const pointer = getPointer();
    const mouseX = pointer.x;
    const mouseY = pointer.y;
    const now = performance.now();
    const velNorm = clamp(pointer.speed / 38, 0, 1);
    const velEase = smoothstep(velNorm);

    // Soft custom cursor — scale, ring, gentle rotate, whisper glow
    if (cursorEl && phase === 'explore') {
      const targetNear = cursorNear;
      cursorScale = lerp(
        cursorScale,
        cursorPressed ? 0.7 : 1 + targetNear * 0.62,
        0.16
      );
      cursorRing = lerp(cursorRing, 1 + targetNear * 1.35 + velEase * 0.25, 0.12);
      const targetRot = pointer.speed > 0.8 ? Math.atan2(pointer.vy, pointer.vx) * (180 / Math.PI) : cursorRot;
      cursorRot = lerp(cursorRot, targetRot, 0.08);

      cursorEl.style.transform =
        `translate3d(${mouseX.toFixed(1)}px, ${mouseY.toFixed(1)}px, 0) ` +
        `rotate(${cursorRot.toFixed(2)}deg) scale(${cursorScale.toFixed(3)})`;
      cursorEl.style.opacity = hasPointer ? '1' : '0';
      cursorEl.classList.toggle('is-near', targetNear > 0.12);
      cursorEl.classList.toggle('is-pressed', cursorPressed);

      if (cursorRingEl) {
        cursorRingEl.style.transform = `scale(${cursorRing.toFixed(3)})`;
      }
      if (cursorGlowEl) {
        cursorGlowEl.style.opacity = String((0.08 + targetNear * 0.22).toFixed(3));
      }
      section.classList.toggle('has-custom-cursor', hasPointer);
    } else if (cursorEl) {
      cursorEl.style.opacity = '0';
      section.classList.remove('has-custom-cursor');
    }

    // Word-level motion blur (late layer)
    if (phase === 'explore' && !reducedMotion) {
      const targetBlur = Math.min(pointer.speed * 0.09, 3.2) * SESSION.hoverIntensity;
      blurAmount = lerp(blurAmount, hasPointer ? targetBlur : 0, LAYER.blur);
      wordEl.style.filter = blurAmount > 0.18 ? `blur(${blurAmount.toFixed(2)}px)` : 'none';
    }

    if (phase === 'explore' && !reducedMotion && !burstLock) {
      frame += 1;
      if (frame % 3 === 0 || centers.length !== letters.length) {
        refreshCenters();
      }

      let nearLetter = false;
      let maxInfluence = 0;
      const t = now * idlePeriod;

      if (
        !climaxDone &&
        energy >= EXPERIENCE.idleEndingMinEnergy &&
        now - lastInteractAt >= EXPERIENCE.idleEndingMs &&
        !idleEndingArmed
      ) {
        idleEndingArmed = true;
        beginSoftEnding();
        rafId = requestAnimationFrame(applyEffects);
        return;
      }

      const intensity = SESSION.hoverIntensity;
      const rotRange = SESSION.rotateRange;
      const scaleRange = SESSION.scaleRange;
      const velScale = SESSION.velStretch;

      letters.forEach((el, i) => {
        const st = letterState[i];
        if (!st) return;

        const center = centers[i] || { x: 0, y: 0 };
        const dx = mouseX - center.x;
        const dy = mouseY - center.y;
        const dist = Math.hypot(dx, dy);

        const influence = hasPointer
          ? smoothstep(1 - dist / influenceRadius)
          : 0;

        if (influence > 0.02) nearLetter = true;
        if (influence > maxInfluence) maxInfluence = influence;

        // Idle breath — per-letter tempo & amplitude
        const breathMix = 1 - influence * 0.85;
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

        const amp = influence * intensity;

        // ── Live targets (all computed; layers delay catch-up) ──
        let tx = breathX;
        let ty = breathY + EFFECT.y * amp * st.floatAmp;
        let tr = breathR + EFFECT.rotate * rotRange * amp * st.rotateAmp * (dx >= 0 ? 1 : -1);
        let ts = breathS * (1 + (EFFECT.scale - 1) * scaleRange * amp * st.scaleAmp);
        let sk = 0;
        let weight =
          EFFECT.restWeight + (EFFECT.weight - EFFECT.restWeight) * amp;
        let stretch = EFFECT.restStretch;
        let track = EFFECT.restTracking;
        let opsz = EFFECT.restOpsz;
        let letterBlur = 0;

        // Trait emphasis — each letter leads with a different typographic voice
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
            // baseline
            ty -= 10 * amp * st.floatAmp;
          }
        }

        // Shared typography participation (restrained)
        stretch = lerp(stretch, EFFECT.stretch, amp * 0.35);
        track = lerp(track, EFFECT.tracking * 0.7, amp * 0.45);
        opsz = lerp(EFFECT.restOpsz, EFFECT.opsz, amp);
        letterBlur = amp * 1.1 * (1 - st.outlineBias * 0.3);

        // Velocity stretch
        if (amp > 0.04 && velEase > 0.05) {
          const dir = pointer.vx >= 0 ? 1 : -1;
          sk += EFFECT.velSkew * velEase * amp * dir * velScale;
          ts *= 1 + EFFECT.velStretch * velEase * amp * velScale;
          tr += EFFECT.velRotate * velEase * amp * -dir * rotRange;
          ty += pointer.vy * 0.08 * velEase * amp;
          stretch *= 1 + velEase * amp * 0.08;
        }

        // Long-press melt
        if (holdActive) {
          const holdT = Math.min(1, (now - holdStart) / 1400);
          const melt = holdT * holdT;
          sk = lerp(sk, 18 * (i % 2 === 0 ? 1 : -1), melt);
          ty += melt * 28;
          ts = lerp(ts, 1.05 + melt * 0.55, melt);
          tr += melt * 8 * (i - letters.length / 2);
          weight = lerp(weight, 200, melt);
          stretch = lerp(stretch, 1.2, melt * 0.6);
          addEnergy(EXPERIENCE.energy.hold * 0.016, { interact: true });
        }

        // Wheel morph
        weight = lerp(weight, wheelMorph.weight, 0.35);
        ts *= wheelMorph.size;

        // Soft magnetic pull
        if (amp > 0.05) {
          tx += dx * EFFECT.pull * amp;
          ty += dy * EFFECT.pull * 0.7 * amp;
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

        // ── Layered catch: properties awaken in sequence ──
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

        springStep(st);

        const sx = st.s * st.stretchCur;
        const sy = st.s / Math.max(0.85, Math.sqrt(st.stretchCur));

        el.style.transform =
          `translate3d(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px, 0) ` +
          `rotate(${st.r.toFixed(2)}deg) skewX(${st.sk.toFixed(2)}deg) ` +
          `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;

        el.style.fontWeight = String(Math.round(st.dweight));
        el.style.fontVariationSettings = `'opsz' ${st.dopsz.toFixed(1)}`;
        el.style.letterSpacing = `${st.dtrack.toFixed(4)}em`;
        el.style.filter =
          st.dblur > 0.15 ? `blur(${st.dblur.toFixed(2)}px)` : 'none';

        // Outline emerges late in the influence curve — readability first
        const outlineT = smoothstep((amp - 0.55 * st.outlineBias) / 0.35);
        if (outlineT > 0.08) {
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
      });

      cursorNear = maxInfluence;
      wordEl.style.letterSpacing = `${wheelMorph.tracking.toFixed(4)}em`;

      if (hasPointer && nearLetter) {
        addEnergy(EXPERIENCE.energy.move, { interact: false });
        if (pointer.speed > 6) {
          noteInteract();
          if (pointer.speed > 8 && now - lastTickSound > 160) {
            lastTickSound = now;
            sound.tick();
          }
        }
      }
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
    wheelMorph = { weight: 400, size: 1, tracking: -0.03 };
    blurAmount = 0;
    hasPointer = false;
    holdActive = false;
    cursorNear = 0;
    cursorPressed = false;
  }

  // ── Soft idle ending ────────────────────────────────────────────────────
  function beginSoftEnding() {
    if (phase !== 'explore' || climaxDone) return;
    phase = 'climax';
    endHold();
    hasPointer = false;
    wordEl.style.filter = 'none';
    setLabel('');

    letters.forEach((el, i) => {
      const st = letterState[i];
      if (!st) return;
      gsap.set(el, {
        x: st.x,
        y: st.y,
        rotation: st.r,
        skewX: st.sk,
        scaleX: st.s * st.stretchCur,
        scaleY: st.s / Math.max(0.85, Math.sqrt(st.stretchCur)),
        fontWeight: Math.round(st.dweight),
      });
      st.vx = st.vy = st.vr = st.vs = st.vsk = st.vstretch = 0;
      el.style.textShadow = 'none';
      el.classList.remove('is-soft-outline');
    });

    const settle = gsap.timeline({
      onComplete: () => showEnding(false),
    });

    letters.forEach((el, i) => {
      const order = SESSION.waveDir === 1 ? i : letters.length - 1 - i;
      settle.to(
        el,
        {
          x: 0,
          y: 0,
          rotation: 0,
          skewX: 0,
          scaleX: 1,
          scaleY: 1,
          fontWeight: EFFECT.restWeight,
          letterSpacing: '0em',
          filter: 'blur(0px)',
          duration: 1.25,
          ease: ANIMATION.ease.settle,
        },
        order * 0.05
      );
    });

    settle.to(
      wordEl,
      {
        opacity: 0,
        filter: 'blur(6px)',
        scale: 0.96,
        duration: 1.4,
        ease: ANIMATION.ease.smooth,
      },
      '+=0.4'
    );

    sound.soft();
  }

  // ── Click: scatter / pop ────────────────────────────────────────────────
  function onClickBurst(clientX, clientY) {
    if (phase !== 'explore' || burstLock) return;

    sound.pop();
    addEnergy(EXPERIENCE.energy.click);

    if (reducedMotion) {
      gsap.fromTo(
        letters,
        { opacity: 0.55 },
        { opacity: 1, duration: 0.4, stagger: 0.03, ease: ANIMATION.ease.out }
      );
      return;
    }

    burstLock = true;
    let pending = letters.length;

    letters.forEach((el, i) => {
      const st = letterState[i];
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - clientX;
      const dy = cy - clientY;
      const dist = Math.max(40, Math.hypot(dx, dy));
      const mass = st?.mass ?? 1;
      const force = Math.min(140, 4800 / dist) / mass;
      const angle = Math.atan2(dy, dx) + (letterRand(i, 9) - 0.5) * 0.45;
      const ox = Math.cos(angle) * force;
      const oy = Math.sin(angle) * force;
      const rot = (letterRand(i, 10) - 0.5) * 56 * SESSION.rotateRange;
      const delay =
        (SESSION.waveDir === 1 ? i : letters.length - 1 - i) * 0.03;

      gsap.fromTo(
        el,
        {
          x: ox,
          y: oy,
          rotation: rot,
          scale: 1.18 + letterRand(i, 11) * 0.22,
        },
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          duration: 0.85 + mass * 0.2,
          ease: ANIMATION.ease.softSpring,
          delay,
          onComplete: () => {
            if (st) {
              st.x = st.y = st.r = 0;
              st.s = 1;
              st.vx = st.vy = st.vr = st.vs = 0;
              st.dtx = st.dty = st.dtr = 0;
              st.dts = 1;
            }
            gsap.set(el, { clearProps: 'transform' });
            pending -= 1;
            if (pending <= 0) burstLock = false;
          },
        }
      );
    });
  }

  // ── Wheel ───────────────────────────────────────────────────────────────
  function onWheel(e) {
    if (phase !== 'explore') return;

    const dir = Math.sign(e.deltaY) || Math.sign(e.deltaX);
    wheelMorph.weight = clamp(wheelMorph.weight + dir * 28, 150, 900);
    wheelMorph.size = clamp(wheelMorph.size + dir * 0.018, 0.82, 1.28);
    wheelMorph.tracking = clamp(wheelMorph.tracking + dir * 0.008, -0.08, 0.22);

    addEnergy(EXPERIENCE.energy.wheel);
    sound.soft();

    gsap.killTweensOf(wheelMorph);
    gsap.to(wheelMorph, {
      weight: 400,
      size: 1,
      tracking: -0.03,
      duration: 2.6,
      ease: ANIMATION.ease.smooth,
      delay: 0.7,
    });
  }

  // ── Keyboard ────────────────────────────────────────────────────────────
  function onKey(e) {
    if (phase !== 'explore') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1) return;

    const ch = e.key.toUpperCase();
    const idx = letters.findIndex((el) => el.textContent === ch);
    const targets = idx >= 0 ? [letters[idx]] : letters;

    sound.tick();
    addEnergy(EXPERIENCE.energy.key);

    targets.forEach((el, i) => {
      gsap.fromTo(
        el,
        { scale: 1.45, y: -28, rotation: (Math.random() - 0.5) * 20 },
        {
          scale: 1,
          y: 0,
          rotation: 0,
          duration: 0.75,
          ease: ANIMATION.ease.spring,
          delay: i * 0.03,
          onComplete: () => gsap.set(el, { clearProps: 'transform' }),
        }
      );
    });
  }

  // ── Long press ──────────────────────────────────────────────────────────
  function beginHold() {
    if (phase !== 'explore') return;
    holdStart = performance.now();
    holdActive = false;
    cursorPressed = true;

    holdRaf = window.setTimeout(() => {
      if (phase !== 'explore') return;
      holdActive = true;
      setLabel('Hold');
      sound.soft();
      noteInteract();
    }, EXPERIENCE.holdMs);
  }

  function endHold() {
    cursorPressed = false;
    if (holdRaf) {
      clearTimeout(holdRaf);
      holdRaf = null;
    }
    if (holdActive) {
      holdActive = false;
      if (phase === 'explore') setLabel('Move · Click · Hold · Scroll');
      letters.forEach((_, i) => {
        const st = letterState[i];
        if (!st) return;
        gsap.to(st, {
          dsk: 0,
          skew: 0,
          duration: 1,
          ease: ANIMATION.ease.softSpring,
        });
      });
    }
  }

  // ── Climax ──────────────────────────────────────────────────────────────
  function triggerClimax() {
    if (climaxDone || phase !== 'explore') return;
    climaxDone = true;
    phase = 'climax';
    endHold();
    hasPointer = false;
    wordEl.style.filter = 'none';
    wordEl.classList.add('is-exploding');

    setLabel('');
    sound.whoosh();
    section.classList.add('is-climax');

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
        showEnding(true);
      },
    });

    tl.fromTo(
      section,
      { '--climax-flash': 0.42 },
      {
        '--climax-flash': 0,
        duration: 1.6,
        ease: ANIMATION.ease.out,
      },
      0
    );

    letters.forEach((el, i) => {
      const angle =
        (i / letters.length) * Math.PI * 2 -
        Math.PI / 2 +
        (letterRand(i, 12) - 0.5) * 0.35;
      const dist = 180 + letterRand(i, 13) * 220;
      const spin =
        (letterRand(i, 14) > 0.5 ? 1 : -1) * (220 + letterRand(i, 15) * 280);
      const order = SESSION.waveDir === 1 ? i : letters.length - 1 - i;

      el.classList.add('is-outline');

      tl.to(
        el,
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rotation: spin,
          skewX: 0,
          scale: 0.2 + letterRand(i, 16) * 0.45,
          opacity: 0.08,
          filter: 'blur(3px)',
          duration: 1.15,
          ease: 'power3.in',
        },
        order * 0.045
      );
    });

    tl.to({}, { duration: 0.35 });

    tl.add(() => {
      gsap.killTweensOf(letters);
      letters = buildLetters(wordEl, EXPERIENCE.climaxWord);
      syncLetterStateArray();
      wordEl.setAttribute('aria-label', EXPERIENCE.climaxWord);
      gsap.set(letters, {
        opacity: 0,
        scale: 0.25,
        y: 56,
        x: () => (Math.random() - 0.5) * 80,
        rotation: () => (Math.random() - 0.5) * 60,
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
        each: 0.08,
        from: SESSION.staggerFrom === 'edges' ? 'edges' : 'center',
      },
    });

    tl.to({}, { duration: 0.85 });
  }

  // ── Ending ──────────────────────────────────────────────────────────────
  /**
   * @param {boolean} afterClimax
   */
  function showEnding(afterClimax) {
    phase = 'ending';
    stopLoop();
    if (cursorEl) cursorEl.style.opacity = '0';
    section.classList.remove('has-custom-cursor');

    if (endingTitle) {
      endingTitle.textContent = afterClimax
        ? SESSION.endingLine
        : SESSION.idleEndingLine;
    }
    if (replayBtn) {
      replayBtn.textContent = SESSION.endingCta;
    }

    const fadeWord = afterClimax
      ? {
          opacity: 0.14,
          scale: 0.9,
          filter: 'blur(3px)',
          duration: ANIMATION.duration.ending,
        }
      : {
          opacity: 0,
          scale: 0.94,
          filter: 'blur(8px)',
          duration: 0.2,
        };

    gsap.to(wordEl, {
      ...fadeWord,
      ease: ANIMATION.ease.smooth,
    });

    if (label) {
      gsap.to(label, { opacity: 0, duration: 0.4 });
    }

    if (ending) {
      ending.setAttribute('aria-hidden', 'false');
      gsap.set(ending, { pointerEvents: 'auto' });
      gsap.fromTo(
        ending,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
          delay: afterClimax ? 0.35 : 0.15,
        }
      );
    }

    sound.soft();
  }

  function replay() {
    if (phase !== 'ending') return;

    sound.pop();
    delete section.dataset.buildup;
    energy = 0;
    climaxDone = false;
    idleEndingArmed = false;
    updateEnergyUI();

    if (ending) {
      ending.setAttribute('aria-hidden', 'true');
      gsap.to(ending, {
        autoAlpha: 0,
        y: -8,
        duration: 0.45,
        ease: ANIMATION.ease.soft,
        onComplete: () => gsap.set(ending, { pointerEvents: 'none', y: 0 }),
      });
    }

    // Fresh opening line on replay — still from the same pool language
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

    const hold = reducedMotion ? 0.15 : 1.1;
    const tl = gsap.timeline({
      onComplete: () => enterExplore(),
    });

    if (openingEl) {
      tl.to(openingEl, {
        autoAlpha: 0,
        y: -6,
        duration: 0.55,
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
  }

  // ── Pointer / touch bindings ────────────────────────────────────────────
  const onPointerMove = (e) => {
    if (phase !== 'explore') return;
    hasPointer = true;
    if (e.pointerType === 'touch') {
      addEnergy(EXPERIENCE.energy.touch);
    }
  };

  const onPointerLeave = () => {
    hasPointer = false;
    endHold();
  };

  const onPointerDown = (e) => {
    if (phase !== 'explore') return;
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
    beginHold();
  };

  const onPointerUp = (e) => {
    const wasHold = holdActive;
    const heldFor = performance.now() - holdStart;
    endHold();

    if (phase !== 'explore') return;

    const moved = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
    if (moved > 14) return;

    if (!wasHold && heldFor < 500) {
      onClickBurst(e.clientX, e.clientY);
    }
  };

  const visibility = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onEnter: () => {
      if (phase === 'explore') startLoop();
    },
    onEnterBack: () => {
      if (phase === 'explore') startLoop();
    },
    onLeave: () => {
      stopLoop();
      endHold();
    },
    onLeaveBack: () => {
      stopLoop();
      endHold();
    },
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
  section.addEventListener('pointercancel', endHold, { passive: true });
  section.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('keydown', onKey);
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
    section.removeEventListener('pointercancel', endHold);
    section.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey);
    replayBtn?.removeEventListener('click', replay);
    endHold();
    stopLoop();
    entrance.kill();
    visibility.kill();
    pin.kill();
    gsap.killTweensOf(letters);
    gsap.killTweensOf(wheelMorph);
    gsap.killTweensOf(wordEl);
    if (ending) gsap.killTweensOf(ending);
    if (label) gsap.killTweensOf(label);
    if (openingEl) gsap.killTweensOf(openingEl);
    cursorEl?.remove();
  });

  return () => cleanups.forEach((fn) => fn());
}
