/**
 * Section 1 — Landing Hero
 *
 * TYPE entrance → subtitle + scroll cue →
 * scrubbed scale / fade exit (no abrupt cut)
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { SESSION } from '../utils/session.js';

/** @type {null | (() => void)} */
let replayHeroFn = null;

/**
 * Replay hero entrance after a soft restart.
 */
export function resetHero() {
  replayHeroFn?.();
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
    span.className = 'hero__letter';
    span.textContent = char;
    span.setAttribute('aria-hidden', 'true');
    container.appendChild(span);
    return span;
  });
}

/**
 * Initialize Hero section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initHero(section) {
  const word = section.querySelector('[data-hero-word]');
  const concept = section.querySelector('[data-hero-concept]');
  const subtitle = section.querySelector('[data-hero-subtitle]');
  const bg = section.querySelector('.hero__bg');
  const scrollHint = document.querySelector(
    '.scroll-hint:not(.scroll-hint--section)'
  );
  const hintText = scrollHint?.querySelector('.scroll-hint__text');
  const headerLabel = document.querySelector('.site-header__label');
  const headerActions = document.querySelector('.site-header__actions');

  if (!word) return () => {};

  let letters = buildLetters(word, word.textContent?.trim() || 'TYPE');
  const reducedMotion = prefersReducedMotion();
  const cleanups = [];
  /** @type {gsap.core.Timeline | null} */
  let entranceTl = null;
  /** @type {gsap.core.Timeline | null} */
  let scrollTl = null;
  /** @type {ScrollTrigger | null} */
  let hintTrigger = null;

  if (concept) {
    concept.textContent = SESSION.openingLine;
  }
  if (hintText) hintText.textContent = 'Scroll to Start';

  headerLabel?.classList.add('is-visible');
  headerActions?.classList.add('is-visible');

  function killEntrance() {
    entranceTl?.kill();
    entranceTl = null;
  }

  function playEntrance({ fromLoader = false } = {}) {
    killEntrance();

    letters = buildLetters(word, 'TYPE');
    gsap.set(letters, { opacity: 0, scale: 1.08, y: 12 });
    if (concept) gsap.set(concept, { opacity: 0, y: 6 });
    if (subtitle) gsap.set(subtitle, { opacity: 0, y: 10 });
    gsap.set(word, { clearProps: 'x,y,scale,opacity' });

    const hold = reducedMotion ? 0.15 : Math.max(0.7, ANIMATION.duration.opening * 0.85);
    entranceTl = gsap.timeline({ delay: fromLoader ? 0.05 : 0.12 });

    if (concept && !fromLoader) {
      entranceTl
        .to(concept, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.slow,
          ease: ANIMATION.ease.out,
        })
        .to(concept, {
          opacity: 0,
          y: -10,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.smooth,
          delay: hold,
        });
    } else if (concept) {
      gsap.set(concept, { opacity: 0 });
      entranceTl.to({}, { duration: 0.05 });
    }

    entranceTl.to(
      letters,
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: ANIMATION.duration.slow,
        ease: ANIMATION.ease.expo,
        stagger: 0.045,
      },
      concept && !fromLoader ? '-=0.12' : 0
    );

    if (subtitle) {
      entranceTl.to(
        subtitle,
        {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
        },
        '-=0.35'
      );
    }

    entranceTl.call(
      () => {
        if (hintText) hintText.textContent = 'Scroll to Start';
        scrollHint?.classList.add('is-visible');
        gsap.set(scrollHint, { opacity: 1, clearProps: 'opacity' });
      },
      null,
      '-=0.15'
    );
  }

  // Defer first entrance until loader resolves (main.js dispatches)
  const onReady = () => playEntrance({ fromLoader: true });
  window.addEventListener('typemotion:ready', onReady, { once: true });
  cleanups.push(() => window.removeEventListener('typemotion:ready', onReady));

  // ── Mouse parallax ──────────────────────────────────────────────────────
  if (!reducedMotion) {
    const strength = ANIMATION.parallax.strength * (0.9 + (SESSION.tempo - 1) * 0.4);
    const duration = ANIMATION.parallax.duration / SESSION.tempo;

    const xTo = gsap.quickTo(word, 'x', { duration, ease: ANIMATION.ease.soft });
    const yTo = gsap.quickTo(word, 'y', { duration, ease: ANIMATION.ease.soft });

    const onMouseMove = (e) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const deltaX = (e.clientX - centerX) / centerX;
      const deltaY = (e.clientY - centerY) / centerY;

      xTo(deltaX * strength);
      yTo(deltaY * strength * 0.6);
    };

    window.addEventListener('pointermove', onMouseMove, { passive: true });
    cleanups.push(() => window.removeEventListener('pointermove', onMouseMove));
  }

  // ── Scroll exit — scale + fade (continuous, no cut) ─────────────────────
  scrollTl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: '+=75%',
      pin: true,
      scrub: ANIMATION.duration.scroll,
      anticipatePin: 1,
      onLeave: () => {
        scrollHint?.classList.remove('is-visible');
      },
      onEnterBack: () => {
        if (hintText) hintText.textContent = 'Scroll to Start';
        scrollHint?.classList.add('is-visible');
      },
    },
  });

  scrollTl.fromTo(
    word,
    {
      opacity: 1,
      scale: 1,
      y: 0,
    },
    {
      opacity: 0,
      scale: 0.72,
      y: -48,
      duration: 1,
      ease: 'none',
      immediateRender: false,
    },
    0
  );

  if (subtitle) {
    scrollTl.fromTo(
      subtitle,
      { opacity: 1, y: 0 },
      {
        opacity: 0,
        y: -24,
        duration: 0.7,
        ease: 'none',
        immediateRender: false,
      },
      0
    );
  }

  scrollTl.fromTo(
    bg,
    { opacity: 0 },
    {
      opacity: 1,
      duration: 1,
      ease: 'none',
      immediateRender: false,
    },
    0
  );

  hintTrigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=12%',
    scrub: true,
    onUpdate: (self) => {
      if (scrollHint) {
        gsap.set(scrollHint, { opacity: 1 - self.progress });
      }
    },
  });

  replayHeroFn = () => {
    gsap.set(word, { clearProps: 'opacity,scale,x,y,transform' });
    if (subtitle) gsap.set(subtitle, { clearProps: 'opacity,y,transform' });
    if (bg) gsap.set(bg, { opacity: 0 });
    playEntrance({ fromLoader: true });
  };

  cleanups.push(() => {
    killEntrance();
    scrollTl?.scrollTrigger?.kill();
    scrollTl?.kill();
    hintTrigger?.kill();
    replayHeroFn = null;
  });

  return () => cleanups.forEach((fn) => fn());
}
