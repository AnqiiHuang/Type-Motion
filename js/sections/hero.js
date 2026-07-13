/**
 * Section 1 — Landing Hero
 *
 * Concept opening → TYPE entrance → parallax →
 * scroll exit with restrained stretch / disperse / morph
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { SESSION } from '../utils/session.js';

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
  const bg = section.querySelector('.hero__bg');
  const scrollHint = document.querySelector('.scroll-hint');
  const hintText = scrollHint?.querySelector('.scroll-hint__text');
  const headerLabel = document.querySelector('.site-header__label');
  const headerActions = document.querySelector('.site-header__actions');

  if (!word) return () => {};

  const letters = buildLetters(word, word.textContent?.trim() || 'TYPE');
  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  if (concept) {
    concept.textContent = SESSION.openingLine;
  }
  if (hintText) hintText.textContent = 'Scroll';

  // Top bar is available immediately on load / refresh
  headerLabel?.classList.add('is-visible');
  headerActions?.classList.add('is-visible');

  // ── Concept Opening → TYPE ──────────────────────────────────────────────
  gsap.set(letters, { opacity: 0, scale: 1.06, y: 8 });
  if (concept) gsap.set(concept, { opacity: 0, y: 6 });

  const hold = reducedMotion ? 0.25 : Math.max(0.9, ANIMATION.duration.opening * 0.95);
  const entranceTl = gsap.timeline({ delay: 0.15 });

  if (concept) {
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
  } else {
    entranceTl.to({}, { duration: 0.2 });
  }

  entranceTl.to(
    letters,
    {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: ANIMATION.duration.slow,
      ease: ANIMATION.ease.expo,
      stagger: 0.04,
    },
    concept ? '-=0.15' : 0
  );

  // Scroll cue after entrance
  entranceTl.call(
    () => {
      scrollHint?.classList.add('is-visible');
    },
    null,
    '-=0.25'
  );

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

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    cleanups.push(() => window.removeEventListener('mousemove', onMouseMove));
  }

  // ── Scroll transition — fade + soft stretch / disperse / morph ──────────
  const mid = (letters.length - 1) / 2;
  const scrollTl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: '+=70%',
      pin: true,
      scrub: ANIMATION.duration.scroll,
      anticipatePin: 1,
      onLeave: () => {
        scrollHint?.classList.remove('is-visible');
      },
      onEnterBack: () => {
        if (hintText) hintText.textContent = 'Scroll';
        scrollHint?.classList.add('is-visible');
      },
    },
  });

  letters.forEach((letter, i) => {
    const dir = i - mid;
    scrollTl.fromTo(
      letter,
      {
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        skewX: 0,
      },
      {
        opacity: 0,
        scaleX: 1.12 + Math.abs(dir) * 0.04,
        scaleY: 0.92,
        x: dir * 18,
        y: Math.abs(dir) * -6,
        skewX: dir * 2.5,
        duration: 1,
        ease: 'none',
        immediateRender: false,
      },
      0
    );
  });

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

  // Fade out scroll hint on scroll start
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=10%',
    scrub: true,
    onUpdate: (self) => {
      if (scrollHint) {
        gsap.set(scrollHint, { opacity: 1 - self.progress });
      }
    },
  });

  cleanups.push(() => {
    entranceTl.kill();
    scrollTl.scrollTrigger?.kill();
    scrollTl.kill();
  });

  return () => cleanups.forEach((fn) => fn());
}
