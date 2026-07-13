/**
 * Section 1 — Landing Hero
 *
 * Concept opening → TYPE entrance → parallax → scroll exit
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { SESSION } from '../utils/session.js';

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
  const headerLabel = document.querySelector('.site-header__label');
  const headerActions = document.querySelector('.site-header__actions');

  if (!word) return () => {};

  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  if (concept) {
    concept.textContent = SESSION.openingLine;
  }

  // ── Concept Opening → TYPE ──────────────────────────────────────────────
  gsap.set(word, { opacity: 0, scale: 1.08 });
  if (concept) gsap.set(concept, { opacity: 0, y: 6 });

  const hold = reducedMotion ? 0.25 : ANIMATION.duration.opening * 0.85;
  const entranceTl = gsap.timeline({ delay: 0.15 });

  if (concept) {
    entranceTl
      .to(concept, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: ANIMATION.ease.out,
      })
      .to(concept, {
        opacity: 0,
        y: -10,
        duration: 0.65,
        ease: ANIMATION.ease.smooth,
        delay: hold,
      });
  } else {
    entranceTl.to({}, { duration: 0.2 });
  }

  entranceTl.to(
    word,
    {
      opacity: 1,
      scale: 1,
      duration: ANIMATION.duration.slow,
      ease: ANIMATION.ease.expo,
    },
    concept ? '-=0.2' : 0
  );

  // Show UI chrome after entrance
  entranceTl.call(
    () => {
      scrollHint?.classList.add('is-visible');
      headerLabel?.classList.add('is-visible');
      headerActions?.classList.add('is-visible');
    },
    null,
    '-=0.35'
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

  // ── Scroll transition ───────────────────────────────────────────────────
  const scrollTl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: '+=120%',
      pin: true,
      scrub: 1.2,
      anticipatePin: 1,
      onLeave: () => {
        scrollHint?.classList.remove('is-visible');
      },
      onEnterBack: () => {
        scrollHint?.classList.add('is-visible');
      },
    },
  });

  scrollTl
    .to(
      word,
      {
        scale: 0.35,
        opacity: 0.15,
        duration: 1,
        ease: ANIMATION.ease.inOut,
      },
      0
    )
    .to(
      bg,
      {
        opacity: 1,
        duration: 1,
        ease: ANIMATION.ease.inOut,
      },
      0
    )
    .to(
      word,
      {
        y: -60,
        duration: 1,
        ease: ANIMATION.ease.inOut,
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
