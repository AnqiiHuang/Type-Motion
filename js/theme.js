/**
 * Global theme manager
 *
 * Themes sync via <html data-theme="..."> and CSS custom properties.
 */

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
const DEFAULT_THEME = 'minimal';

/**
 * @returns {string}
 */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
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
    // Clear session palette overrides so theme tokens win
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

    root.setAttribute('data-theme', theme.id);
    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
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
    duration: 0.22,
    ease: 'power2.inOut',
  })
    .add(() => apply())
    .to(veil, {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out',
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
 * Restore saved theme (or default) on boot
 */
export function initThemeSystem() {
  let saved = DEFAULT_THEME;
  try {
    saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  } catch {
    saved = DEFAULT_THEME;
  }

  if (!THEMES.some((t) => t.id === saved)) {
    saved = DEFAULT_THEME;
  }

  setTheme(saved, { animate: false });

  // Header + section buttons (event delegation)
  const onClick = (e) => {
    const btn = e.target.closest('[data-theme-option]');
    if (!btn) return;
    const id = btn.getAttribute('data-theme-option');
    if (id) setTheme(id);
  };

  document.addEventListener('click', onClick);

  return () => document.removeEventListener('click', onClick);
}
