/**
 * Type Motion — Main Entry
 *
 * Orchestrates section initialization.
 * Each section is lazy-loaded when it enters the viewport.
 */

import { registerGSAPPlugins, lazyInitSection } from './utils/animation.js';
import { initThemeSystem } from './theme.js';
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
  { selector: '#mouse-interaction', init: initMouseInteraction },
  { selector: '#font-playground', init: initFontPlayground },
  { selector: '#wave-typography', init: initWaveTypography },
  { selector: '#typography-physics', init: initTypographyPhysics },
  { selector: '#poster-generator', init: initPosterGenerator },
  { selector: '#theme-switch', init: initThemeSwitch },
  { selector: '#about', init: initAbout },
];

function init() {
  registerGSAPPlugins();
  const cleanups = [initThemeSystem()];

  SECTIONS.forEach(({ selector, init, eager }) => {
    if (eager) {
      const el = document.querySelector(selector);
      if (el) {
        const cleanup = init(el);
        if (cleanup) cleanups.push(cleanup);
      }
    } else {
      cleanups.push(lazyInitSection(selector, init));
    }
  });

  // Refresh ScrollTrigger after fonts load
  document.fonts.ready.then(() => ScrollTrigger.refresh());

  return () => cleanups.forEach((fn) => fn());
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
