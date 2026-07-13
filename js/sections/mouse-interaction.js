/**
 * Section 2 — Interactive Typography Experience
 *
 * Flow: Intro → Explore (move / click / hold / wheel / key / touch)
 *      → Climax (scatter + reform) → Ending → Replay
 *
 * Energy accumulates slowly so the chapter cannot end in a few seconds.
 */

import { ANIMATION, EXPERIENCE } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { getPointer } from '../utils/pointer.js';
import { sound } from '../utils/audio.js';

const WORD = 'DESIGN';

const INFLUENCE_RADIUS = 200;

const EFFECT = {
  scale: 1.22,
  rotate: 10,
  y: -16,
  weight: 700,
  restWeight: 400,
  shadow: 24,
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
  let frame = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;
  /** @type {Array<{ x: number, y: number }>} */
  let centers = [];

  function refreshCenters() {
    centers = letters.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  }

  // Per-letter spring targets (inertia layer)
  const letterState = letters.map(() => ({
    tx: 0,
    ty: 0,
    tr: 0,
    ts: 1,
    skew: 0,
    weight: EFFECT.restWeight,
    // current (lerped)
    x: 0,
    y: 0,
    r: 0,
    s: 1,
    sk: 0,
  }));

  function syncLetterStateArray() {
    while (letterState.length < letters.length) {
      letterState.push({
        tx: 0, ty: 0, tr: 0, ts: 1, skew: 0,
        weight: EFFECT.restWeight,
        x: 0, y: 0, r: 0, s: 1, sk: 0,
      });
    }
    letterState.length = letters.length;
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
        // Clear GSAP y/scale so rAF owns transforms
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
      duration: 0.25,
      ease: ANIMATION.ease.soft,
      onComplete: () => {
        label.textContent = text;
        gsap.to(label, {
          opacity: 0.85,
          y: 0,
          duration: 0.45,
          ease: ANIMATION.ease.out,
        });
      },
    });
  }

  function addEnergy(amount) {
    if (phase !== 'explore' || climaxDone) return;
    energy = Math.min(1, energy + amount);
    updateEnergyUI();

    const elapsed = performance.now() - exploreStartedAt;
    if (energy >= EXPERIENCE.climaxEnergy && elapsed >= EXPERIENCE.minExploreMs) {
      triggerClimax();
    } else if (energy > 0.55 && energy < 0.7) {
      // Soft buildup cue once
      if (!section.dataset.buildup) {
        section.dataset.buildup = '1';
        setLabel('Keep going');
      }
    }
  }

  function updateEnergyUI() {
    section.style.setProperty('--experience-energy', String(energy));
  }

  // ── Main loop ───────────────────────────────────────────────────────────
  function applyEffects() {
    if (!active) return;

    const pointer = getPointer();
    const mouseX = pointer.x;
    const mouseY = pointer.y;

    // Motion blur from velocity
    if (phase === 'explore' && !reducedMotion) {
      const targetBlur = Math.min(pointer.speed * 0.12, 4.5);
      blurAmount = lerp(blurAmount, hasPointer ? targetBlur : 0, 0.15);
      wordEl.style.filter = blurAmount > 0.15 ? `blur(${blurAmount}px)` : 'none';
    }

    if (phase === 'explore' && !reducedMotion && !burstLock) {
      // Refresh letter centers every few frames (layout thrash avoidance)
      frame += 1;
      if (frame % 3 === 0 || centers.length !== letters.length) {
        refreshCenters();
      }

      let nearLetter = false;

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

        // Base proximity targets
        let tx = 0;
        let ty = EFFECT.y * influence;
        let tr = EFFECT.rotate * influence * (dx >= 0 ? 1 : -1);
        let ts = 1 + (EFFECT.scale - 1) * influence;
        let sk = 0;
        let weight = EFFECT.restWeight + (EFFECT.weight - EFFECT.restWeight) * influence;

        // Long-press melt / stretch
        if (holdActive) {
          const holdT = Math.min(1, (performance.now() - holdStart) / 1400);
          const melt = holdT * holdT;
          sk = lerp(0, 18 * (i % 2 === 0 ? 1 : -1), melt);
          ty += melt * 28;
          ts = lerp(ts, 1.05 + melt * 0.55, melt);
          tr += melt * 8 * (i - letters.length / 2);
          weight = lerp(weight, 200, melt);
          addEnergy(EXPERIENCE.energy.hold * 0.016);
        }

        // Wheel morph overlay
        weight = lerp(weight, wheelMorph.weight, 0.35);
        ts *= wheelMorph.size;

        // Soft follow offset toward pointer when close
        if (influence > 0.05) {
          tx += dx * 0.04 * influence;
          ty += dy * 0.03 * influence;
        }

        st.tx = tx;
        st.ty = ty;
        st.tr = tr;
        st.ts = ts;
        st.skew = sk;
        st.weight = weight;

        // Inertia spring toward targets
        const ease = 0.14;
        st.x = lerp(st.x, st.tx, ease);
        st.y = lerp(st.y, st.ty, ease);
        st.r = lerp(st.r, st.tr, ease);
        st.s = lerp(st.s, st.ts, ease);
        st.sk = lerp(st.sk, st.skew, ease * 0.8);

        el.style.transform =
          `translate3d(${st.x.toFixed(2)}px, ${st.y.toFixed(2)}px, 0) ` +
          `rotate(${st.r.toFixed(2)}deg) skewX(${st.sk.toFixed(2)}deg) scale(${st.s.toFixed(3)})`;
        el.style.fontWeight = String(Math.round(st.weight));

        const shadowBlur = EFFECT.shadow * influence;
        el.style.textShadow = influence > 0.02
          ? `0 ${8 * influence}px ${shadowBlur}px rgba(0,0,0,${0.18 * influence})`
          : 'none';
      });

      wordEl.style.letterSpacing = `${wheelMorph.tracking}em`;

      if (hasPointer && nearLetter) {
        addEnergy(EXPERIENCE.energy.move);
        const now = performance.now();
        if (pointer.speed > 8 && now - lastTickSound > 120) {
          lastTickSound = now;
          sound.tick();
        }
      }
    }

    rafId = requestAnimationFrame(applyEffects);
  }

  function startLoop() {
    if (active) return;
    if (reducedMotion && phase === 'explore') {
      // Quiet path: no continuous loop; interactions still add energy
      return;
    }
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
        st.tx = st.ty = st.tr = st.sk = st.x = st.y = st.r = st.sk = 0;
        st.ts = st.s = 1;
        st.weight = EFFECT.restWeight;
      }
      el.style.transform = '';
      el.style.fontWeight = String(EFFECT.restWeight);
      el.style.textShadow = 'none';
      el.style.filter = '';
      el.style.opacity = '';
    });
    wordEl.style.filter = 'none';
    wordEl.style.letterSpacing = '';
    wheelMorph = { weight: 400, size: 1, tracking: -0.03 };
    blurAmount = 0;
    hasPointer = false;
    holdActive = false;
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
        { opacity: 1, duration: 0.35, stagger: 0.03, ease: ANIMATION.ease.out }
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
      const force = Math.min(120, 4200 / dist);
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.4;
      const ox = Math.cos(angle) * force;
      const oy = Math.sin(angle) * force;
      const rot = (Math.random() - 0.5) * 48;

      gsap.fromTo(
        el,
        {
          x: ox,
          y: oy,
          rotation: rot,
          scale: 1.15 + Math.random() * 0.2,
        },
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.softSpring,
          delay: i * 0.02,
          onComplete: () => {
            const st = letterState[i];
            if (st) {
              st.x = st.y = st.r = 0;
              st.s = 1;
            }
            gsap.set(el, { clearProps: 'transform' });
            pending -= 1;
            if (pending <= 0) burstLock = false;
          },
        }
      );
    });
  }

  // ── Wheel: morph weight / size / tracking ───────────────────────────────
  function onWheel(e) {
    if (phase !== 'explore') return;

    const dir = Math.sign(e.deltaY) || Math.sign(e.deltaX);
    wheelMorph.weight = Math.max(150, Math.min(900, wheelMorph.weight + dir * 28));
    wheelMorph.size = Math.max(0.82, Math.min(1.28, wheelMorph.size + dir * 0.018));
    wheelMorph.tracking = Math.max(-0.08, Math.min(0.22, wheelMorph.tracking + dir * 0.008));

    addEnergy(EXPERIENCE.energy.wheel);
    sound.soft();

    // Ease morph back toward rest after idle
    gsap.killTweensOf(wheelMorph);
    gsap.to(wheelMorph, {
      weight: 400,
      size: 1,
      tracking: -0.03,
      duration: 2.4,
      ease: ANIMATION.ease.smooth,
      delay: 0.6,
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
          duration: 0.7,
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

    holdRaf = window.setTimeout(() => {
      if (phase !== 'explore') return;
      holdActive = true;
      setLabel('Hold');
      sound.soft();
    }, EXPERIENCE.holdMs);
  }

  function endHold() {
    if (holdRaf) {
      clearTimeout(holdRaf);
      holdRaf = null;
    }
    if (holdActive) {
      holdActive = false;
      setLabel('Move · Click · Hold · Scroll');
      // Spring recovery
      letters.forEach((el, i) => {
        const st = letterState[i];
        if (!st) return;
        gsap.to(st, {
          sk: 0,
          skew: 0,
          duration: 0.9,
          ease: ANIMATION.ease.softSpring,
        });
      });
    }
  }

  // ── Climax (WOW) ────────────────────────────────────────────────────────
  function triggerClimax() {
    if (climaxDone || phase !== 'explore') return;
    climaxDone = true;
    phase = 'climax';
    endHold();
    hasPointer = false;
    wordEl.style.filter = 'none';

    setLabel('');
    sound.whoosh();

    // Flash invert
    section.classList.add('is-climax');

    const tl = gsap.timeline({
      onComplete: () => {
        section.classList.remove('is-climax');
        showEnding();
      },
    });

    // Scatter outward
    letters.forEach((el, i) => {
      const angle = (i / letters.length) * Math.PI * 2 - Math.PI / 2;
      const dist = 140 + Math.random() * 180;
      tl.to(
        el,
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          rotation: (Math.random() - 0.5) * 360,
          scale: 0.35 + Math.random() * 0.4,
          opacity: 0.15,
          duration: 0.85,
          ease: 'power3.in',
        },
        0
      );
    });

    // Reform as MOTION
    tl.add(() => {
      gsap.killTweensOf(letters);
      letters = buildLetters(wordEl, EXPERIENCE.climaxWord);
      syncLetterStateArray();
      wordEl.setAttribute('aria-label', EXPERIENCE.climaxWord);
      gsap.set(letters, {
        opacity: 0,
        scale: 0.4,
        y: 40,
        rotation: () => (Math.random() - 0.5) * 40,
      });
    });

    tl.to(letters, {
      opacity: 1,
      scale: 1,
      y: 0,
      rotation: 0,
      duration: ANIMATION.duration.climax,
      ease: ANIMATION.ease.softSpring,
      stagger: 0.06,
    });

    // Brief accent pulse on section
    tl.fromTo(
      section,
      { '--climax-flash': 0.35 },
      {
        '--climax-flash': 0,
        duration: 1.1,
        ease: ANIMATION.ease.out,
      },
      '<'
    );
  }

  // ── Ending ──────────────────────────────────────────────────────────────
  function showEnding() {
    phase = 'ending';
    stopLoop();

    gsap.to(wordEl, {
      opacity: 0.18,
      scale: 0.92,
      filter: 'blur(2px)',
      duration: ANIMATION.duration.ending,
      ease: ANIMATION.ease.smooth,
    });

    if (label) {
      gsap.to(label, { opacity: 0, duration: 0.4 });
    }

    if (ending) {
      ending.setAttribute('aria-hidden', 'false');
      gsap.set(ending, { pointerEvents: 'auto' });
      gsap.to(ending, {
        autoAlpha: 1,
        duration: ANIMATION.duration.normal,
        ease: ANIMATION.ease.out,
        delay: 0.25,
      });
    }

    sound.soft();
  }

  function replay() {
    if (phase !== 'ending') return;

    sound.pop();
    delete section.dataset.buildup;
    energy = 0;
    updateEnergyUI();

    if (ending) {
      ending.setAttribute('aria-hidden', 'true');
      gsap.to(ending, {
        autoAlpha: 0,
        duration: 0.4,
        ease: ANIMATION.ease.soft,
        onComplete: () => gsap.set(ending, { pointerEvents: 'none' }),
      });
    }

    letters = buildLetters(wordEl, WORD);
    syncLetterStateArray();
    wordEl.setAttribute('aria-label', WORD);
    resetLetterStyles();

    gsap.set(wordEl, { opacity: 1, scale: 1, filter: 'none' });
    gsap.set(letters, { opacity: 0, y: 28, scale: 0.96 });

    gsap.to(letters, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: ANIMATION.duration.slow,
      ease: ANIMATION.ease.expo,
      stagger: 0.05,
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
    // Ignore after drag / scroll gesture
    if (moved > 14) return;

    // Treat short press as click burst (avoid after long hold)
    if (!wasHold && heldFor < 500) {
      onClickBurst(e.clientX, e.clientY);
    }
  };

  // Visibility — run only in view
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

  // Pin lightly so the chapter can breathe (not a forced wait)
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

  // Kick intro if already visible
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
  });

  return () => cleanups.forEach((fn) => fn());
}
