/**
 * Section 1 — Landing Hero
 *
 * Interactions:
 *  - Mouse move → text follows with smooth lag
 *  - Scroll down → text scales down, background gradient fades in
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';

/**
 * Initialize Hero section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initHero(section) {
  const word = section.querySelector('[data-hero-word]');
  const bg = section.querySelector('.hero__bg');
  const scrollHint = document.querySelector('.scroll-hint');
  const headerLabel = document.querySelector('.site-header__label');
  const headerThemes = document.querySelector('.site-header__themes');

  if (!word) return () => {};

  const reducedMotion = prefersReducedMotion();
  const cleanups = [];

  // ── Entrance animation ──────────────────────────────────────────────────
  gsap.set(word, { opacity: 0, scale: 1.08 });

  const entranceTl = gsap.timeline({ delay: 0.2 });
  entranceTl.to(word, {
    opacity: 1,
    scale: 1,
    duration: ANIMATION.duration.slow,
    ease: ANIMATION.ease.expo,
  });

  // Show UI chrome after entrance
  entranceTl.call(() => {
    scrollHint?.classList.add('is-visible');
    headerLabel?.classList.add('is-visible');
    headerThemes?.classList.add('is-visible');
  }, null, '-=0.4');

  // ── Mouse parallax ──────────────────────────────────────────────────────
  if (!reducedMotion) {
    const { strength, duration } = ANIMATION.parallax;

    const xTo = gsap.quickTo(word, 'x', { duration, ease: ANIMATION.ease.out });
    const yTo = gsap.quickTo(word, 'y', { duration, ease: ANIMATION.ease.out });

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
    .to(word, {
      scale: 0.35,
      opacity: 0.15,
      duration: 1,
      ease: ANIMATION.ease.inOut,
    }, 0)
    .to(bg, {
      opacity: 1,
      duration: 1,
      ease: ANIMATION.ease.inOut,
    }, 0)
    .to(word, {
      y: -60,
      duration: 1,
      ease: ANIMATION.ease.inOut,
    }, 0);

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
