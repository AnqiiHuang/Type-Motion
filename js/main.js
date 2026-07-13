/**
 * Type Motion — Main Entry
 *
 * Orchestrates global systems + section initialization.
 * Each section is lazy-loaded when it enters the viewport.
 */

import { registerGSAPPlugins, lazyInitSection } from './utils/animation.js';
import { initThemeSystem } from './theme.js';
import { initAudio } from './utils/audio.js';
import { initPointer } from './utils/pointer.js';
import { initTrail } from './utils/trail.js';
import { initCursorSystem } from './utils/cursor.js';
import { initProgressIndicator } from './utils/progress.js';
import { initSectionSnap } from './utils/snap.js';
import { initHero } from './sections/hero.js';
import { initMouseInteraction } from './sections/mouse-interaction.js';
import { initFontPlayground } from './sections/font-playground.js';
import { initWaveTypography } from './sections/wave-typography.js';
import { initTypographyPhysics } from './sections/typography-physics.js';
import { initPosterGenerator } from './sections/poster-generator.js';
import { initThemeSwitch } from './sections/theme-switch.js';
import { initAbout } from './sections/about.js';

/** Section registry — add new sections here as they are built */
const SECTIONS = [
  { selector: '#hero', init: initHero, eager: true },
  { selector: '#mouse-interaction', init: initMouseInteraction, eager: true },
  { selector: '#font-playground', init: initFontPlayground },
  { selector: '#wave-typography', init: initWaveTypography },
  { selector: '#typography-physics', init: initTypographyPhysics },
  { selector: '#poster-generator', init: initPosterGenerator },
  { selector: '#theme-switch', init: initThemeSwitch },
  { selector: '#about', init: initAbout },
];

function init() {
  registerGSAPPlugins();

  // Always start at the top on refresh / revisit so hero entrance can replay
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  const cleanups = [
    initThemeSystem(),
    initPointer(),
    initTrail(),
    initAudio(),
    initCursorSystem(),
  ];

  SECTIONS.forEach(({ selector, init: initSection, eager }) => {
    if (eager) {
      const el = document.querySelector(selector);
      if (el) {
        const cleanup = initSection(el);
        if (cleanup) cleanups.push(cleanup);
      }
    } else {
      cleanups.push(lazyInitSection(selector, initSection));
    }
  });

  cleanups.push(initProgressIndicator());
  // After section pins exist so snap points include pin spacers
  cleanups.push(initSectionSnap());

  // Refresh ScrollTrigger after fonts load; keep scroll pinned at top
  document.fonts.ready.then(() => {
    window.scrollTo(0, 0);
    ScrollTrigger.refresh();
  });


  return () => cleanups.forEach((fn) => fn && fn());
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
