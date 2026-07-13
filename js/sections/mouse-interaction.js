/**
 * Section 2 — Interactive Typography Experience
 *
 * Flow: Intro → Explore (move / click / hold / wheel / key / touch)
 *      → Climax (scatter + reform) → Ending → Replay
 *
 * Motion model: delayed targets (wave) → spring (inertia + damping)
 *              → velocity stretch + idle breath → soft settle
 */

import { ANIMATION, EXPERIENCE } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { getPointer } from '../utils/pointer.js';
import { sound } from '../utils/audio.js';

const WORD = 'DESIGN';

const INFLUENCE_RADIUS = 260;

/** Spring feel — heavy type, soft settle, slight overshoot */
const SPRING = {
  stiffness: 0.078,
  damping: 0.76,
  /** How fast delayed targets catch the live target (≈20ms wave per letter) */
  waveBase: 0.32,
  waveStep: 0.048,
  /** Settle damping when near rest */
  settleDamping: 0.9,
};

const EFFECT = {
  scale: 1.28,
  rotate: 14,
  y: -22,
  pull: 0.055,
  weight: 720,
  restWeight: 400,
  shadow: 28,
  /** Extra stretch driven by mouse speed */
  velStretch: 0.22,
  velSkew: 16,
  velRotate: 8,
};

/** Idle breath — barely perceptible */
const IDLE = {
  float: 2.4,
  scale: 0.012,
  rotate: 0.6,
  period: 0.00105,
};

/** @typedef {'intro' | 'explore' | 'climax' | 'ending'} Phase */

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
 * @param {HTMLElement} section
 * @returns {Function}
 */
export function initMouseInteraction(section) {
  const wordEl = section.querySelector('[data-mouse-word]');
  const label = section.querySelector('.mouse__label');
  const ending = section.querySelector('[data-mouse-ending]');
  const endingTitle = section.querySelector('[data-ending-title]');
  const replayBtn = section.querySelector('[data-mouse-replay]');

  if (!wordEl) return () => {};

  if (endingTitle) endingTitle.textContent = EXPERIENCE.endingTitle;
  if (replayBtn) replayBtn.textContent = EXPERIENCE.endingCta;

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
  let cursorPressed = false;
  /** @type {Array<{ x: number, y: number }>} */
  let centers = [];

  // Custom cursor — fine pointer only
  /** @type {HTMLElement | null} */
  let cursorEl = null;
  const finePointer =
    !reducedMotion &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
    cursorEl = document.createElement('div');
    cursorEl.className = 'mouse__cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    section.appendChild(cursorEl);
  }

  function refreshCenters() {
    centers = letters.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  }

  /**
   * Per-letter spring state
   * d* = delayed targets (wave), v* = velocities (inertia)
   */
  const letterState = letters.map((_, i) => createLetterState(i));

  function createLetterState(i) {
    return {
      // delayed targets
      dtx: 0,
      dty: 0,
      dtr: 0,
      dts: 1,
      dsk: 0,
      dweight: EFFECT.restWeight,
      // live targets
      tx: 0,
      ty: 0,
      tr: 0,
      ts: 1,
      skew: 0,
      weight: EFFECT.restWeight,
      // current
      x: 0,
      y: 0,
      r: 0,
      s: 1,
      sk: 0,
      // velocities
      vx: 0,
      vy: 0,
      vr: 0,
      vs: 0,
      vsk: 0,
      // wave catch rate — letter 0 nearly immediate, +~20ms lag each
      wave: Math.max(0.06, SPRING.waveBase - i * SPRING.waveStep),
      phase: i * 0.85,
    };
  }

  function syncLetterStateArray() {
    while (letterState.length < letters.length) {
      letterState.push(createLetterState(letterState.length));
    }
    letterState.length = letters.length;
    letterState.forEach((st, i) => {
      st.wave = Math.max(0.06, SPRING.waveBase - i * SPRING.waveStep);
      st.phase = i * 0.85;
    });
  }

  function noteInteract() {
    lastInteractAt = performance.now();
    idleEndingArmed = false;
  }

  // ── Entrance ────────────────────────────────────────────────────────────
  gsap.set(letters, { opacity: 0, y: 36, scale: 0.94 });
  if (label) gsap.set(label, { opacity: 0, y: 10 });
  if (ending) gsap.set(ending, { autoAlpha: 0, pointerEvents: 'none' });

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 65%',
    once: true,
    onEnter: () => startIntro(),
  });

  function startIntro() {
    phase = 'intro';
    gsap.to(letters, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: ANIMATION.duration.slow,
      ease: ANIMATION.ease.expo,
      stagger: 0.07,
      onComplete: () => {
        gsap.set(letters, { clearProps: 'transform' });
        enterExplore();
      },
    });
    if (label) {
      label.textContent = 'Move';
      gsap.to(label, {
        opacity: 1,
        y: 0,
        duration: ANIMATION.duration.normal,
        ease: ANIMATION.ease.out,
        delay: 0.35,
      });
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
   * Critically-damped-ish spring step toward delayed target.
   * @param {ReturnType<typeof createLetterState>} st
   */
  function springStep(st) {
    const nearRest =
      Math.abs(st.dtx) < 0.4 &&
      Math.abs(st.dty) < 0.4 &&
      Math.abs(st.vx) < 0.15 &&
      Math.abs(st.vy) < 0.15;

    const damp = nearRest ? SPRING.settleDamping : SPRING.damping;
    const k = SPRING.stiffness;

    st.vx = (st.vx + (st.dtx - st.x) * k) * damp;
    st.vy = (st.vy + (st.dty - st.y) * k) * damp;
    st.vr = (st.vr + (st.dtr - st.r) * k) * damp;
    st.vs = (st.vs + (st.dts - st.s) * k * 1.1) * damp;
    st.vsk = (st.vsk + (st.dsk - st.sk) * k) * damp;

    st.x += st.vx;
    st.y += st.vy;
    st.r += st.vr;
    st.s += st.vs;
    st.sk += st.vsk;

    // Kill micro jitter
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

    // Soft custom cursor
    if (cursorEl && phase === 'explore') {
      const targetNear = cursorNear;
      cursorScale = lerp(cursorScale, cursorPressed ? 0.72 : 1 + targetNear * 0.55, 0.18);
      cursorEl.style.transform =
        `translate3d(${mouseX.toFixed(1)}px, ${mouseY.toFixed(1)}px, 0) scale(${cursorScale.toFixed(3)})`;
      cursorEl.style.opacity = hasPointer ? '1' : '0';
      section.classList.toggle('has-custom-cursor', hasPointer);
    } else if (cursorEl) {
      cursorEl.style.opacity = '0';
      section.classList.remove('has-custom-cursor');
    }

    // Motion blur from velocity — restrained
    if (phase === 'explore' && !reducedMotion) {
      const targetBlur = Math.min(pointer.speed * 0.09, 3.2);
      blurAmount = lerp(blurAmount, hasPointer ? targetBlur : 0, 0.12);
      wordEl.style.filter = blurAmount > 0.18 ? `blur(${blurAmount.toFixed(2)}px)` : 'none';
    }

    if (phase === 'explore' && !reducedMotion && !burstLock) {
      frame += 1;
      if (frame % 3 === 0 || centers.length !== letters.length) {
        refreshCenters();
      }

      let nearLetter = false;
      let maxInfluence = 0;
      const t = now * IDLE.period;

      // Idle soft-ending: after interaction settles for idleMs
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

      letters.forEach((el, i) => {
        const st = letterState[i];
        if (!st) return;

        const center = centers[i] || { x: 0, y: 0 };
        const dx = mouseX - center.x;
        const dy = mouseY - center.y;
        const dist = Math.hypot(dx, dy);

        const influence = hasPointer
          ? smoothstep(1 - dist / INFLUENCE_RADIUS)
          : 0;

        if (influence > 0.02) nearLetter = true;
        if (influence > maxInfluence) maxInfluence = influence;

        // Idle breath — always on, fades under strong influence
        const breathMix = 1 - influence * 0.85;
        const breathY = Math.sin(t * 1.15 + st.phase) * IDLE.float * breathMix;
        const breathX = Math.cos(t * 0.72 + st.phase * 1.1) * IDLE.float * 0.35 * breathMix;
        const breathS = 1 + Math.sin(t * 0.95 + st.phase * 0.8) * IDLE.scale * breathMix;
        const breathR = Math.sin(t * 0.65 + st.phase) * IDLE.rotate * breathMix;

        // Proximity deformation — stronger when close
        const amp = influence;
        let tx = breathX;
        let ty = breathY + EFFECT.y * amp;
        let tr = breathR + EFFECT.rotate * amp * (dx >= 0 ? 1 : -1);
        let ts = breathS * (1 + (EFFECT.scale - 1) * amp);
        let sk = 0;
        let weight =
          EFFECT.restWeight + (EFFECT.weight - EFFECT.restWeight) * amp;

        // Velocity stretch — fast motion elongates / skews
        if (amp > 0.04 && velEase > 0.05) {
          const dir = pointer.vx >= 0 ? 1 : -1;
          sk += EFFECT.velSkew * velEase * amp * dir;
          ts *= 1 + EFFECT.velStretch * velEase * amp;
          tr += EFFECT.velRotate * velEase * amp * -dir;
          ty += pointer.vy * 0.08 * velEase * amp;
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
          addEnergy(EXPERIENCE.energy.hold * 0.016, { interact: true });
        }

        // Wheel morph
        weight = lerp(weight, wheelMorph.weight, 0.35);
        ts *= wheelMorph.size;

        // Soft magnetic pull toward pointer
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

        // Wave: delayed targets trail behind live targets
        const catchRate = st.wave;
        st.dtx = lerp(st.dtx, st.tx, catchRate);
        st.dty = lerp(st.dty, st.ty, catchRate);
        st.dtr = lerp(st.dtr, st.tr, catchRate);
        st.dts = lerp(st.dts, st.ts, catchRate);
        st.dsk = lerp(st.dsk, st.skew, catchRate);
        st.dweight = lerp(st.dweight, st.weight, catchRate * 0.9);

        springStep(st);

        el.style.transform =
          `translate3d(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px, 0) ` +
          `rotate(${st.r.toFixed(2)}deg) skewX(${st.sk.toFixed(2)}deg) scale(${st.s.toFixed(3)})`;
        el.style.fontWeight = String(Math.round(st.dweight));

        const shadowBlur = EFFECT.shadow * amp;
        el.style.textShadow =
          amp > 0.02
            ? `0 ${(10 * amp).toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(0,0,0,${(0.2 * amp).toFixed(3)})`
            : 'none';
      });

      cursorNear = maxInfluence;
      wordEl.style.letterSpacing = `${wheelMorph.tracking}em`;

      if (hasPointer && nearLetter) {
        // Passive proximity energy — does not reset idle timer
        addEnergy(EXPERIENCE.energy.move, { interact: false });
        if (pointer.speed > 6) {
          noteInteract();
          if (pointer.speed > 8 && now - lastTickSound > 140) {
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
        st.vx = st.vy = st.vr = st.vs = st.vsk = 0;
        st.ts = st.dts = st.s = 1;
        st.weight = st.dweight = EFFECT.restWeight;
      }
      el.style.transform = '';
      el.style.fontWeight = String(EFFECT.restWeight);
      el.style.textShadow = 'none';
      el.style.filter = '';
      el.style.opacity = '';
      el.style.webkitTextStroke = '';
      el.style.color = '';
      el.classList.remove('is-outline');
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

  // ── Soft idle ending (no climax) ────────────────────────────────────────
  function beginSoftEnding() {
    if (phase !== 'explore' || climaxDone) return;
    phase = 'climax'; // lock further energy / explore transforms
    endHold();
    hasPointer = false;
    wordEl.style.filter = 'none';
    setLabel('');

    // Seed GSAP from spring state so settle continues the motion (no snap)
    letters.forEach((el, i) => {
      const st = letterState[i];
      if (!st) return;
      gsap.set(el, {
        x: st.x,
        y: st.y,
        rotation: st.r,
        skewX: st.sk,
        scale: st.s,
        fontWeight: Math.round(st.dweight),
      });
      st.vx = st.vy = st.vr = st.vs = st.vsk = 0;
      el.style.textShadow = 'none';
    });

    const settle = gsap.timeline({
      onComplete: () => showEnding(false),
    });

    letters.forEach((el, i) => {
      settle.to(
        el,
        {
          x: 0,
          y: 0,
          rotation: 0,
          skewX: 0,
          scale: 1,
          fontWeight: EFFECT.restWeight,
          duration: 1.25,
          ease: 'power3.out',
        },
        i * 0.045
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
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - clientX;
      const dy = cy - clientY;
      const dist = Math.max(40, Math.hypot(dx, dy));
      const force = Math.min(140, 4800 / dist);
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.45;
      const ox = Math.cos(angle) * force;
      const oy = Math.sin(angle) * force;
      const rot = (Math.random() - 0.5) * 56;

      gsap.fromTo(
        el,
        {
          x: ox,
          y: oy,
          rotation: rot,
          scale: 1.18 + Math.random() * 0.22,
        },
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          duration: 0.95,
          ease: ANIMATION.ease.softSpring,
          delay: i * 0.028,
          onComplete: () => {
            const st = letterState[i];
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

  // ── Climax (WOW — once) ─────────────────────────────────────────────────
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

    // Hand spring transforms to GSAP without a snap
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
      st.vx = st.vy = st.vr = st.vs = st.vsk = 0;
    });

    const tl = gsap.timeline({
      onComplete: () => {
        section.classList.remove('is-climax');
        wordEl.classList.remove('is-exploding');
        showEnding(true);
      },
    });

    // Flash
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

    // Outline + scatter outward with staggered wave
    letters.forEach((el, i) => {
      const angle =
        (i / letters.length) * Math.PI * 2 -
        Math.PI / 2 +
        (Math.random() - 0.5) * 0.35;
      const dist = 180 + Math.random() * 220;
      const spin = (Math.random() > 0.5 ? 1 : -1) * (220 + Math.random() * 280);

      el.classList.add('is-outline');

      tl.to(
        el,
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rotation: spin,
          skewX: 0,
          scale: 0.2 + Math.random() * 0.45,
          opacity: 0.08,
          filter: 'blur(3px)',
          duration: 1.15,
          ease: 'power3.in',
        },
        i * 0.045
      );
    });

    // Brief hold in the void
    tl.to({}, { duration: 0.35 });

    // Reform as MOTION — slow, springy, wave-in
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
        from: 'center',
      },
    });

    // Soft settle pause before ending
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
        ? EXPERIENCE.endingTitle
        : EXPERIENCE.idleEndingTitle;
    }
    if (replayBtn) {
      replayBtn.textContent = EXPERIENCE.endingCta;
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

    letters = buildLetters(wordEl, WORD);
    syncLetterStateArray();
    wordEl.setAttribute('aria-label', WORD);
    resetLetterStyles();

    gsap.set(wordEl, { opacity: 1, scale: 1, filter: 'none', y: 0 });
    gsap.set(letters, { opacity: 0, y: 28, scale: 0.96 });

    gsap.to(letters, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: ANIMATION.duration.slow,
      ease: ANIMATION.ease.expo,
      stagger: 0.055,
      onComplete: () => {
        gsap.set(letters, { clearProps: 'transform' });
        enterExplore();
      },
    });
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
    cursorEl?.remove();
  });

  return () => cleanups.forEach((fn) => fn());
}
