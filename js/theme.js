/**
 * Global theme manager
 *
 * Themes sync via <html data-theme="..."> and CSS custom properties.
 * Each page load picks one of the five themes at random.
 */

import { ANIMATION } from './config.js';

export const THEMES = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Quiet white space. Precision without decoration.',
  },
  {
    id: 'brutalism',
    label: 'Brutalism',
    description: 'Raw structure. Heavy type. Hard edges.',
  },
  {
    id: 'cyber',
    label: 'Cyber',
    description: 'Signal green on deep black. Monospace clarity.',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    description: 'Charcoal, gold, and serif restraint.',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Print hierarchy. Measured contrast.',
  },
];

const STORAGE_KEY = 'type-motion-theme';
const LAST_KEY = 'type-motion-theme-last';
const DEFAULT_THEME = 'minimal';

/** Theme chosen at boot — restored on soft restart */
let bootThemeId = DEFAULT_THEME;

/**
 * @returns {string}
 */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
}

/**
 * Theme selected when the page first booted.
 * @returns {string}
 */
export function getBootTheme() {
  return bootThemeId;
}

/**
 * Pick a random theme id, preferring not to repeat the last visit.
 * @returns {string}
 */
export function pickRandomTheme() {
  let lastId = null;
  try {
    lastId = sessionStorage.getItem(LAST_KEY);
  } catch {
    // ignore
  }

  const pool = THEMES.filter((t) => t.id !== lastId);
  const list = pool.length ? pool : THEMES;
  return list[Math.floor(Math.random() * list.length)].id;
}

/**
 * Apply theme to the whole document
 * @param {string} themeId
 * @param {{ animate?: boolean }} [options]
 */
export function setTheme(themeId, options = {}) {
  const { animate = true } = options;
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  const prev = getTheme();

  if (prev === theme.id && root.hasAttribute('data-theme')) {
    syncControls(theme.id);
    return theme.id;
  }

  const apply = () => {
    // Clear any leftover inline overrides so theme CSS tokens win
    [
      '--color-bg',
      '--color-bg-alt',
      '--color-text',
      '--color-text-muted',
      '--color-accent',
      '--color-surface',
      '--color-border',
      '--hero-grad-1',
      '--hero-grad-2',
      '--hero-grad-3',
      '--hero-grad-4',
      '--trail-rgb',
    ].forEach((prop) => root.style.removeProperty(prop));
    delete root.dataset.palette;
    root.style.removeProperty('color-scheme');

    root.setAttribute('data-theme', theme.id);
    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
      sessionStorage.setItem(LAST_KEY, theme.id);
    } catch {
      // private mode / blocked storage
    }
    syncControls(theme.id);
    window.dispatchEvent(
      new CustomEvent('themechange', { detail: { theme: theme.id, label: theme.label } })
    );
  };

  if (!animate || typeof gsap === 'undefined') {
    apply();
    return theme.id;
  }

  // Soft veil — brief fade of a full-page overlay for polish
  let veil = document.querySelector('.theme-veil');
  if (!veil) {
    veil = document.createElement('div');
    veil.className = 'theme-veil';
    veil.setAttribute('aria-hidden', 'true');
    Object.assign(veil.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '200',
      pointerEvents: 'none',
      background: 'var(--color-bg)',
      opacity: '0',
    });
    document.body.appendChild(veil);
  }

  const tl = gsap.timeline();
  tl.to(veil, {
    opacity: 0.55,
    duration: ANIMATION.duration.hover,
    ease: ANIMATION.ease.smooth,
  })
    .add(() => apply())
    .to(veil, {
      opacity: 0,
      duration: ANIMATION.duration.scroll,
      ease: ANIMATION.ease.soft,
    });

  return theme.id;
}

/**
 * Sync all theme UI controls to the active id
 * @param {string} themeId
 */
function syncControls(themeId) {
  document.querySelectorAll('[data-theme-option]').forEach((el) => {
    const active = el.getAttribute('data-theme-option') === themeId;
    el.classList.toggle('is-active', active);
    if (el.tagName === 'BUTTON') {
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  });

  document.querySelectorAll('[data-theme-label]').forEach((el) => {
    const theme = THEMES.find((t) => t.id === themeId);
    el.textContent = theme?.label ?? themeId;
  });
}

/**
 * Boot theme system — random theme from the five on every load
 */
export function initThemeSystem() {
  const initial = pickRandomTheme();
  bootThemeId = initial;
  setTheme(initial, { animate: false });

  const menu = document.querySelector('[data-theme-menu]');
  const toggle = document.querySelector('[data-theme-toggle]');

  const setMenuOpen = (open) => {
    if (!menu || !toggle) return;
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const onClick = (e) => {
    const option = e.target.closest('[data-theme-option]');
    if (option && menu?.contains(option)) {
      const id = option.getAttribute('data-theme-option');
      if (id) setTheme(id);
      setMenuOpen(false);
      return;
    }

    // Section theme grid (outside header menu)
    if (option) {
      const id = option.getAttribute('data-theme-option');
      if (id) setTheme(id);
      return;
    }

    if (toggle && (e.target === toggle || toggle.contains(e.target))) {
      setMenuOpen(!menu.classList.contains('is-open'));
      return;
    }

    if (menu?.classList.contains('is-open') && !menu.contains(e.target)) {
      setMenuOpen(false);
    }
  };

  const onKeydown = (e) => {
    if (e.key === 'Escape') setMenuOpen(false);
  };

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);

  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeydown);
  };
}
