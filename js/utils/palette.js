/**
 * Random coordinated palette — applied once per page load.
 * Soft, portfolio-safe colors (no neon glare).
 */

import { PALETTES } from '../config.js';

const STORAGE_KEY = 'type-motion-palette';

/**
 * Pick a random palette (optionally avoid last used)
 * @returns {typeof PALETTES[number]}
 */
export function pickPalette() {
  let lastId = null;
  try {
    lastId = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  const pool = PALETTES.filter((p) => p.id !== lastId);
  const list = pool.length ? pool : PALETTES;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Apply palette CSS variables to :root
 * @param {typeof PALETTES[number]} palette
 */
export function applyPalette(palette) {
  const root = document.documentElement;
  root.style.setProperty('--color-bg', palette.bg);
  root.style.setProperty('--color-bg-alt', palette.bgAlt);
  root.style.setProperty('--color-text', palette.text);
  root.style.setProperty('--color-text-muted', palette.muted);
  root.style.setProperty('--color-accent', palette.accent);
  root.style.setProperty('--color-surface', palette.bg);
  root.style.setProperty('--color-border', `color-mix(in srgb, ${palette.text} 12%, transparent)`);
  root.style.setProperty('--hero-grad-1', palette.bg);
  root.style.setProperty('--hero-grad-2', palette.bgAlt);
  root.style.setProperty('--hero-grad-3', palette.bgAlt);
  root.style.setProperty('--hero-grad-4', palette.accent);
  root.style.setProperty('--trail-rgb', palette.trail);
  root.dataset.palette = palette.id;

  // Dark palettes need dark color-scheme for form controls
  const isDark = luminance(palette.bg) < 0.35;
  root.style.colorScheme = isDark ? 'dark' : 'light';

  try {
    sessionStorage.setItem(STORAGE_KEY, palette.id);
  } catch {
    // ignore
  }

  window.dispatchEvent(
    new CustomEvent('palettechange', { detail: { palette } })
  );

  return palette;
}

/**
 * Relative luminance (0–1) for hex colors
 * @param {string} hex
 */
function luminance(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Boot palette system
 * @returns {{ palette: typeof PALETTES[number], cleanup: Function }}
 */
export function initPalette() {
  const palette = applyPalette(pickPalette());
  return {
    palette,
    cleanup: () => {},
  };
}
