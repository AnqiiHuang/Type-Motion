/**
 * Section 5 — Typography Physics
 *
 * DROP → letters become Matter.js bodies (gravity, collide, bounce).
 * RESET → ease back to original layout.
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';

const WORD = 'PHYSICS';

const {
  Engine,
  Bodies,
  Composite,
  Runner,
  Body,
} = Matter;

/**
 * Split word into letter spans
 * @param {HTMLElement} container
 * @param {string} word
 * @returns {HTMLElement[]}
 */
function buildLetters(container, word) {
  container.textContent = '';
  return [...word].map((char) => {
    const span = document.createElement('span');
    span.className = 'physics__letter';
    span.textContent = char;
    span.setAttribute('aria-hidden', 'true');
    container.appendChild(span);
    return span;
  });
}

/**
 * Parse translate3d + rotate from a transform string
 * @param {string} transform
 */
function parseTransform(transform) {
  const translate = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(transform || '');
  const rotate = /rotate\(([-\d.]+)deg\)/.exec(transform || '');
  return {
    x: translate ? Number(translate[1]) : 0,
    y: translate ? Number(translate[2]) : 0,
    r: rotate ? Number(rotate[1]) : 0,
  };
}

/**
 * Initialize Typography Physics section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initTypographyPhysics(section) {
  const stage = section.querySelector('[data-physics-stage]');
  const wordEl = section.querySelector('[data-physics-word]');
  const button = section.querySelector('[data-physics-toggle]');
  const label = section.querySelector('.physics__label');
  const actions = section.querySelector('.physics__actions');

  if (!stage || !wordEl || !button) return () => {};

  const letters = buildLetters(wordEl, WORD);
  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  /** @type {'idle' | 'dropping' | 'resetting'} */
  let mode = 'idle';
  /** @type {Matter.Engine | null} */
  let engine = null;
  /** @type {Matter.Runner | null} */
  let runner = null;
  /** @type {Array<{ body: Matter.Body, el: HTMLElement, w: number, h: number }>} */
  let letterBodies = [];
  let rafId = null;
  let syncing = false;

  /** @type {Array<{ x: number, y: number, w: number, h: number }>} */
  let restLayout = [];

  function measureRestLayout() {
    const stageRect = stage.getBoundingClientRect();
    restLayout = letters.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - stageRect.left + r.width / 2,
        y: r.top - stageRect.top + r.height / 2,
        w: r.width,
        h: r.height,
      };
    });
  }

  function createWorld() {
    destroyWorld();

    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const thickness = 80;

    engine = Engine.create({
      gravity: { x: 0, y: reducedMotion ? 0.35 : 1 },
    });

    const ground = Bodies.rectangle(w / 2, h + thickness / 2 - 2, w + 200, thickness, {
      isStatic: true,
      friction: 0.85,
    });
    const ceiling = Bodies.rectangle(w / 2, -thickness / 2, w + 200, thickness, {
      isStatic: true,
    });
    const left = Bodies.rectangle(-thickness / 2, h / 2, thickness, h + 200, {
      isStatic: true,
    });
    const right = Bodies.rectangle(w + thickness / 2, h / 2, thickness, h + 200, {
      isStatic: true,
    });

    Composite.add(engine.world, [ground, ceiling, left, right]);

    letterBodies = letters.map((el, i) => {
      const layout = restLayout[i];
      const body = Bodies.rectangle(layout.x, layout.y, layout.w * 0.92, layout.h * 0.85, {
        restitution: 0.55,
        friction: 0.25,
        frictionAir: 0.02,
        density: 0.002,
        chamfer: { radius: 2 },
      });

      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 2.5,
        y: Math.random() * 0.5,
      });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);

      return { body, el, w: layout.w, h: layout.h };
    });

    Composite.add(engine.world, letterBodies.map((item) => item.body));

    runner = Runner.create();
    Runner.run(runner, engine);
  }

  function destroyWorld() {
    stopSync();
    if (runner) {
      Runner.stop(runner);
      runner = null;
    }
    if (engine) {
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      engine = null;
    }
    letterBodies = [];
  }

  function startSync() {
    if (syncing) return;
    syncing = true;

    const sync = () => {
      if (!syncing) return;

      letterBodies.forEach(({ body, el, w, h }) => {
        const x = body.position.x - w / 2;
        const y = body.position.y - h / 2;
        const deg = (body.angle * 180) / Math.PI;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${deg}deg)`;
      });

      rafId = requestAnimationFrame(sync);
    };

    rafId = requestAnimationFrame(sync);
  }

  function stopSync() {
    syncing = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function placeLettersAbsolute() {
    wordEl.classList.add('is-dropping');
    letters.forEach((el, i) => {
      const layout = restLayout[i];
      el.classList.add('is-body');
      el.style.width = `${layout.w}px`;
      el.style.height = `${layout.h}px`;
      el.style.lineHeight = `${layout.h}px`;
      el.style.textAlign = 'center';
      el.style.transform =
        `translate3d(${layout.x - layout.w / 2}px, ${layout.y - layout.h / 2}px, 0)`;
    });
  }

  function restoreFlexLayout() {
    letters.forEach((el) => {
      gsap.killTweensOf(el);
      el.classList.remove('is-body');
      el.style.width = '';
      el.style.height = '';
      el.style.lineHeight = '';
      el.style.textAlign = '';
      el.style.transform = '';
    });
    wordEl.classList.remove('is-dropping');
    mode = 'idle';
    button.textContent = 'Drop';
    button.setAttribute('aria-pressed', 'false');
  }

  function drop() {
    if (mode !== 'idle') return;

    measureRestLayout();
    placeLettersAbsolute();
    createWorld();
    startSync();

    mode = 'dropping';
    button.textContent = 'Reset';
    button.setAttribute('aria-pressed', 'true');
  }

  function reset() {
    if (mode !== 'dropping') return;

    mode = 'resetting';
    destroyWorld();

    let completed = 0;

    letters.forEach((el, i) => {
      const layout = restLayout[i];
      const current = parseTransform(el.style.transform);
      const proxy = { x: current.x, y: current.y, r: current.r };
      const targetX = layout.x - layout.w / 2;
      const targetY = layout.y - layout.h / 2;

      gsap.to(proxy, {
        x: targetX,
        y: targetY,
        r: 0,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.expo,
        delay: i * 0.03,
        onUpdate: () => {
          el.style.transform =
            `translate3d(${proxy.x}px, ${proxy.y}px, 0) rotate(${proxy.r}deg)`;
        },
        onComplete: () => {
          completed += 1;
          if (completed === letters.length) {
            restoreFlexLayout();
          }
        },
      });
    });
  }

  function toggle() {
    if (mode === 'idle') drop();
    else if (mode === 'dropping') reset();
  }

  button.addEventListener('click', toggle);
  cleanups.push(() => button.removeEventListener('click', toggle));

  // Pause simulation when off-screen
  const visibility = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onLeave: () => {
      if (runner && mode === 'dropping') Runner.stop(runner);
      stopSync();
    },
    onLeaveBack: () => {
      if (runner && mode === 'dropping') Runner.stop(runner);
      stopSync();
    },
    onEnter: () => {
      if (runner && engine && mode === 'dropping') {
        Runner.run(runner, engine);
        startSync();
      }
    },
    onEnterBack: () => {
      if (runner && engine && mode === 'dropping') {
        Runner.run(runner, engine);
        startSync();
      }
    },
  });

  // Resize mid-drop → hard reset to keep bounds correct
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (mode === 'idle') return;
      destroyWorld();
      restoreFlexLayout();
    }, 150);
  };
  window.addEventListener('resize', onResize, { passive: true });
  cleanups.push(() => {
    window.removeEventListener('resize', onResize);
    clearTimeout(resizeTimer);
  });

  // ── Entrance ────────────────────────────────────────────────────────────
  gsap.set(letters, { opacity: 0, y: 24 });
  if (label) gsap.set(label, { opacity: 0, y: 8 });
  if (actions) gsap.set(actions, { opacity: 0, y: 12 });

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
        stagger: 0.05,
        onComplete: () => gsap.set(letters, { clearProps: 'transform' }),
      });
      if (label) {
        gsap.to(label, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
          delay: 0.15,
        });
      }
      if (actions) {
        gsap.to(actions, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
          delay: 0.3,
        });
      }
    },
  });

  cleanups.push(() => {
    destroyWorld();
    entrance.kill();
    visibility.kill();
  });

  return () => cleanups.forEach((fn) => fn());
}
