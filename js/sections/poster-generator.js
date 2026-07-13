/**
 * Section 6 — Random Poster Generator
 *
 * Curated layout systems + restrained palettes produce
 * design-aware typography posters (not random chaos).
 * Export via Canvas → PNG.
 */

import { ANIMATION, EXPERIENCE } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';
import { setCursor, resetCursor } from '../utils/cursor.js';
import {
  setFeedbackLabel,
  markStageComplete,
  wait,
} from '../utils/feedback.js';

/** Export resolution (CSS display scales via container) */
const POSTER_W = 900;
const POSTER_H = 1200;
/** Max editable title characters */
const TITLE_MAX = 16;

/**
 * Normalize a CSS color token for comparison (hex / rgb → lowercase hex key).
 * @param {string} value
 * @returns {string}
 */
function colorKey(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    return `#${h}`;
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const toHex = (n) => Number(n).toString(16).padStart(2, '0');
    return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
  }
  return v;
}

/**
 * Build palette variants from the active theme CSS tokens.
 * Poster backgrounds never reuse the page `--color-bg` — pick from the
 * other colors in the same theme so the canvas reads against the section.
 */
function getThemePalettes() {
  const styles = getComputedStyle(document.documentElement);
  const read = (prop, fallback) =>
    styles.getPropertyValue(prop).trim() || fallback;

  const pageBg = read('--color-bg', '#ffffff');
  const alt = read('--color-bg-alt', '#f5f5f5');
  const fg = read('--color-text', '#0a0a0a');
  const muted = read('--color-text-muted', '#888888');
  const accent = read('--color-accent', fg);
  const surface = read('--color-surface', alt);
  const pageKey = colorKey(pageBg);

  // Other theme colors — exclude page background (and near-duplicates)
  const bgPool = [];
  const seen = new Set();
  for (const c of [alt, surface, fg, accent, muted]) {
    const key = colorKey(c);
    if (!key || key === pageKey || seen.has(key)) continue;
    seen.add(key);
    bgPool.push(c);
  }

  if (!bgPool.length) {
    bgPool.push(colorKey(alt) !== pageKey ? alt : fg);
  }

  return bgPool.map((posterBg) => {
    const bgKey = colorKey(posterBg);
    const ink = bgKey === colorKey(fg) ? pageBg : fg;
    let mark = accent;
    if (colorKey(mark) === bgKey || colorKey(mark) === colorKey(ink)) {
      mark = bgKey === colorKey(fg) ? muted : accent === fg ? pageBg : fg;
    }
    const secondary = colorKey(alt) === bgKey ? pageBg : alt;

    return {
      bg: posterBg,
      fg: ink,
      muted: colorKey(muted) === bgKey ? ink : muted,
      accent: mark,
      alt: secondary,
    };
  });
}

const TITLES = [
  'TYPE', 'FORM', 'SPACE', 'RHYTHM', 'SIGNAL',
  'MOTION', 'FRAME', 'VOID', 'EDGE', 'PULSE',
  'GRAVITY', 'SILENCE', 'FOCUS', 'SCALE',
  'FIELD', 'MARK', 'AXIS', 'GRID',
];

const SUBTITLES = [
  'Visual Language', 'Editorial Study', 'Studio Experiment',
  'Type Laboratory', 'Composition No.', 'Spatial Design',
  'Letterform Study', 'Graphic System', 'Print Study',
  'Formal Inquiry', 'Typography Series',
];

const METAS = [
  'Vol. 01', 'Vol. 02', 'Vol. 03', 'Edition A', 'Edition B',
  'Series 01', 'Series 02', 'Archive', 'Studio', '2026',
];

/** Layout systems — intentional compositions */
const LAYOUTS = [
  'monument', 'editorial', 'stacked', 'corner', 'diagonal',
  'band', 'split', 'frame', 'baseline', 'columns',
];

/**
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * @param {number} min
 * @param {number} max
 */
function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * @param {number} min
 * @param {number} max
 */
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

/**
 * Build a design-aware poster spec
 * @param {{ title?: string }} [overrides]
 */
function createPosterSpec(overrides = {}) {
  const palettes = getThemePalettes();
  const palette = pick(palettes);
  const layout = pick(LAYOUTS);
  const title = (overrides.title || pick(TITLES)).toUpperCase().slice(0, TITLE_MAX);
  const subtitle = pick(SUBTITLES);
  const meta = pick(METAS);
  const number = String(randInt(1, 48)).padStart(2, '0');
  const index = String(randInt(1, 12)).padStart(2, '0');

  // Accent usage only on palettes that include one, and only sometimes
  const useAccent = palette.accent !== palette.fg && Math.random() > 0.55;

  return {
    palette,
    layout,
    title: title || 'TYPE',
    subtitle,
    meta: subtitle.includes('No.') ? `${subtitle} ${number}` : `${meta}  ·  ${number}`,
    index,
    grainSeed: randInt(1, 2147483646),
    useAccent,
    // Shared design tokens per generation
    margin: rand(0.08, 0.14),
    titleWeight: pick([500, 600, 700, 800]),
    titleTracking: rand(-0.06, -0.02),
    subTracking: rand(0.12, 0.28),
    rotation: layout === 'diagonal' ? rand(-14, -6) : (Math.random() > 0.75 ? rand(-6, 6) : 0),
    showRule: Math.random() > 0.35,
    showIndex: Math.random() > 0.4,
  };
}

/**
 * Draw poster onto canvas
 * @param {HTMLCanvasElement} canvas
 * @param {ReturnType<typeof createPosterSpec>} spec
 * @param {{ showCaret?: boolean }} [options]
 */
function drawPoster(canvas, spec, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const showCaret = Boolean(options.showCaret);
  const w = POSTER_W;
  const h = POSTER_H;
  const dpr = 1; // fixed export size; CSS scales display

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { palette, layout, meta, useAccent, margin } = spec;
  const m = w * margin;
  const accent = useAccent ? palette.accent : palette.fg;

  // Background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle paper grain (very light) — seeded so live edits stay stable
  drawGrain(ctx, w, h, palette.fg, 0.03, spec.grainSeed);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.fg;

  switch (layout) {
    case 'monument':
      drawMonument(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'editorial':
      drawEditorial(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'stacked':
      drawStacked(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'corner':
      drawCorner(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'diagonal':
      drawDiagonal(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'band':
      drawBand(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'split':
      drawSplit(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'frame':
      drawFrame(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'baseline':
      drawBaseline(ctx, w, h, m, spec, accent, showCaret);
      break;
    case 'columns':
      drawColumns(ctx, w, h, m, spec, accent, showCaret);
      break;
    default:
      drawMonument(ctx, w, h, m, spec, accent, showCaret);
  }

  // Quiet footer meta — always present for finish
  const fonts = getPosterFonts();
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.font = `400 ${Math.round(w * 0.018)}px ${fonts.primary}`;
  ctx.letterSpacing = `${w * 0.004}px`;
  ctx.textAlign = 'left';
  ctx.fillText('TYPE MOTION', m, h - m * 0.55);
  ctx.textAlign = 'right';
  ctx.fillText(meta.replace(/^.*?·\s*/, '').trim() || '01', w - m, h - m * 0.55);
  ctx.restore();
}

/**
 * Active theme typefaces for canvas drawing
 * @returns {{ display: string, primary: string }}
 */
function getPosterFonts() {
  const styles = getComputedStyle(document.documentElement);
  const display = styles.getPropertyValue('--font-display').trim() || 'Inter, sans-serif';
  const primary = styles.getPropertyValue('--font-primary').trim() || 'Inter, sans-serif';
  return { display, primary };
}

/**
 * Shrink title until it fits the available width (theme fonts vary a lot)
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {{ weight: number|string, family: string, maxSize: number, maxWidth: number, letterSpacingPx?: number, minSize?: number }} opts
 */
function fitFontSize(ctx, text, opts) {
  const {
    weight,
    family,
    maxSize,
    maxWidth,
    letterSpacingPx = 0,
    minSize = 28,
  } = opts;
  let size = Math.round(maxSize);
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.letterSpacing = `${letterSpacingPx}px`;
    if (ctx.measureText(text || ' ').width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

/**
 * Deterministic PRNG so grain does not flicker while editing
 * @param {number} seed
 */
function createSeededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function drawGrain(ctx, w, h, color, alpha, seed = 1) {
  const random = createSeededRandom(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const step = 6;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (random() > 0.82) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.restore();
}

/**
 * Blinking text caret after the editable title
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} baselineY
 * @param {number} fontSize
 * @param {string} color
 */
function drawCaret(ctx, x, baselineY, fontSize, color) {
  const top = baselineY - fontSize * 0.82;
  const bottom = baselineY + fontSize * 0.12;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.035));
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.restore();
}

function drawRule(ctx, x1, y, x2, color, weight = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** Rough relative luminance for contrast picks */
function hexLuminance(hex) {
  const h = String(hex || '#000000').replace('#', '');
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Prefer fg/bg/accent that reads on a filled surface */
function inkOn(surface, palette, preferred) {
  const candidates = [preferred, palette.fg, palette.bg, palette.accent].filter(Boolean);
  const s = hexLuminance(surface);
  let best = candidates[0];
  let bestDiff = -1;
  for (const c of candidates) {
    const diff = Math.abs(hexLuminance(c) - s);
    if (diff > bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return best;
}

/** Centered monumental title */
function drawMonument(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, titleTracking, subTracking, showRule } = spec;
  const fonts = getPosterFonts();
  const trackingPx = w * titleTracking;
  const maxTitle = Math.round(w * 0.2);
  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: maxTitle,
    maxWidth: w - m * 2,
    letterSpacingPx: trackingPx,
  });

  // Keep title / rule / subtitle separated by actual type size
  const cy = h * 0.42;
  const ruleY = cy + fontSize * 0.28;
  const subY = ruleY + Math.max(h * 0.035, fontSize * 0.22);
  const subSize = Math.round(Math.min(w * 0.028, fontSize * 0.18));

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = `${trackingPx}px`;
  ctx.fillText(title, w / 2, cy);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, w / 2 + tw / 2 + Math.max(6, fontSize * 0.04), cy, fontSize, accent);
  }
  ctx.restore();

  if (showRule) {
    drawRule(ctx, w / 2 - w * 0.08, ruleY, w / 2 + w * 0.08, palette.muted, 1);
  }

  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.font = `500 ${subSize}px ${fonts.primary}`;
  ctx.letterSpacing = `${w * subTracking * 0.01}px`;
  ctx.fillText(subtitle.toUpperCase(), w / 2, subY);
  ctx.restore();

  if (spec.showIndex) {
    ctx.save();
    ctx.fillStyle = palette.muted;
    ctx.textAlign = 'left';
    ctx.font = `400 ${Math.round(w * 0.02)}px ${fonts.primary}`;
    ctx.letterSpacing = '0px';
    ctx.fillText(spec.index || '01', m, m + w * 0.02);
    ctx.restore();
  }
}

/** Asymmetric editorial — large left title, small right meta */
function drawEditorial(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, showRule } = spec;
  const fonts = getPosterFonts();
  const titleMaxWidth = w * 0.58;
  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: Math.round(w * 0.16),
    maxWidth: titleMaxWidth,
  });
  const titleY = h * 0.36;
  const ruleY = titleY + fontSize * 0.32;
  const subY = ruleY + Math.max(h * 0.05, fontSize * 0.28);
  const subSize = Math.round(Math.min(w * 0.032, fontSize * 0.22));

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  ctx.fillText(title, m, titleY);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, m + tw + Math.max(6, fontSize * 0.04), titleY, fontSize, accent);
  }
  ctx.restore();

  if (showRule) {
    drawRule(ctx, m, ruleY, w - m, palette.fg, 1.5);
  }

  ctx.save();
  ctx.fillStyle = palette.fg;
  ctx.textAlign = 'left';
  ctx.font = `400 ${subSize}px ${fonts.primary}`;
  ctx.fillText(subtitle, m, subY);
  ctx.restore();

  // Side caption block — stay clear of the title column
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'right';
  ctx.font = `400 ${Math.round(w * 0.02)}px ${fonts.primary}`;
  const lines = ['COMPOSITION', 'STUDY', 'SYSTEM'];
  lines.forEach((line, i) => {
    ctx.fillText(line, w - m, m + w * 0.04 + i * w * 0.035);
  });
  ctx.restore();
}

/** Vertical stacked hierarchy with generous leading */
function drawStacked(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, showRule } = spec;
  const fonts = getPosterFonts();
  const chars = title.split('');
  const count = Math.max(chars.length, 1);
  const startY = h * 0.2;
  const endY = h * 0.68;
  const step = (endY - startY) / count;
  const fontSize = Math.round(Math.min(w * 0.12, step * 0.72));

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, w / 2, startY + i * step);
  });
  if (showCaret) {
    const caretY = startY + count * step;
    drawCaret(ctx, w / 2, caretY, fontSize * 0.7, accent);
  }
  ctx.restore();

  const stackBottom = startY + (count - 1) * step;
  const ruleY = stackBottom + Math.max(h * 0.04, fontSize * 0.45);
  const subY = ruleY + Math.max(h * 0.04, fontSize * 0.35);
  const subSize = Math.round(Math.min(w * 0.024, fontSize * 0.28));

  if (showRule) {
    drawRule(ctx, w * 0.35, ruleY, w * 0.65, palette.muted);
  }

  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.font = `500 ${subSize}px ${fonts.primary}`;
  ctx.letterSpacing = `${w * 0.006}px`;
  ctx.fillText(subtitle.toUpperCase(), w / 2, subY);
  ctx.restore();
}

/** Corner-weighted with open field */
function drawCorner(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, showRule, showIndex, index } = spec;
  const fonts = getPosterFonts();
  const subSize = Math.round(w * 0.026);
  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: Math.round(w * 0.14),
    maxWidth: w - m * 2,
  });

  // Build from the footer up so title + subtitle never collide
  const footerY = h - m * 0.55;
  const subY = footerY - Math.max(m * 0.55, subSize * 2.2);
  const titleY = subY - Math.max(fontSize * 0.3, subSize * 1.6);

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  ctx.fillText(title, m, titleY);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, m + tw + Math.max(6, fontSize * 0.04), titleY, fontSize, accent);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'left';
  ctx.font = `400 ${subSize}px ${fonts.primary}`;
  ctx.fillText(subtitle, m, subY);
  ctx.restore();

  if (showRule) {
    drawRule(ctx, m, m + w * 0.02, m + w * 0.2, palette.fg, 2);
  }

  if (showIndex) {
    const indexSize = fitFontSize(ctx, index || '01', {
      weight: 600,
      family: fonts.display,
      maxSize: Math.round(w * 0.08),
      maxWidth: w * 0.28,
      minSize: 36,
    });
    ctx.save();
    ctx.fillStyle = palette.fg;
    ctx.textAlign = 'right';
    ctx.font = `600 ${indexSize}px ${fonts.display}`;
    ctx.fillText(index || '01', w - m, m + indexSize);
    ctx.restore();
  }
}

/** Soft diagonal title — controlled rotation */
function drawDiagonal(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, rotation, showRule } = spec;
  const fonts = getPosterFonts();
  const angle = (Math.abs(rotation) * Math.PI) / 180;
  const maxWidth = (w - m * 2) * Math.cos(angle) * 0.92;
  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: Math.round(w * 0.18),
    maxWidth: Math.max(maxWidth, w * 0.45),
  });

  ctx.save();
  ctx.translate(w / 2, h * 0.42);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  ctx.fillText(title, 0, 0);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, tw / 2 + Math.max(6, fontSize * 0.04), 0, fontSize, accent);
  }
  ctx.restore();

  const band = fontSize * 0.55 + Math.sin(angle) * (w * 0.25);
  const ruleY = h * 0.42 + band + h * 0.06;
  const subY = ruleY + Math.max(h * 0.045, fontSize * 0.22);
  const subSize = Math.round(Math.min(w * 0.026, fontSize * 0.2));

  if (showRule) {
    drawRule(ctx, m, ruleY, w - m, palette.muted);
  }

  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.font = `500 ${subSize}px ${fonts.primary}`;
  ctx.letterSpacing = `${w * 0.008}px`;
  ctx.fillText(subtitle.toUpperCase(), w / 2, subY);
  ctx.restore();
}

/** Horizontal band — title locked in a mid-field strip */
function drawBand(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, showIndex, index } = spec;
  const fonts = getPosterFonts();
  const bandH = h * 0.22;
  const bandY = h * 0.38;
  const bandFill = palette.alt || palette.fg;
  const titleColor = inkOn(bandFill, palette, accent);

  ctx.save();
  ctx.fillStyle = bandFill;
  ctx.globalAlpha = palette.alt ? 1 : 0.08;
  ctx.fillRect(0, bandY, w, bandH);
  ctx.restore();

  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: Math.round(w * 0.14),
    maxWidth: w - m * 2,
  });
  const titleY = bandY + bandH * 0.62;

  ctx.save();
  ctx.fillStyle = titleColor;
  ctx.textAlign = 'center';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  ctx.fillText(title, w / 2, titleY);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, w / 2 + tw / 2 + Math.max(6, fontSize * 0.04), titleY, fontSize, titleColor);
  }
  ctx.restore();

  const subSize = Math.round(w * 0.024);
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.font = `500 ${subSize}px ${fonts.primary}`;
  ctx.letterSpacing = `${w * 0.008}px`;
  ctx.fillText(subtitle.toUpperCase(), w / 2, bandY + bandH + h * 0.05);
  ctx.restore();

  if (showIndex) {
    ctx.save();
    ctx.fillStyle = palette.muted;
    ctx.textAlign = 'left';
    ctx.font = `400 ${Math.round(w * 0.02)}px ${fonts.primary}`;
    ctx.fillText(index || '01', m, m + w * 0.02);
    ctx.restore();
  }
}

/** Vertical split field — title on the open half */
function drawSplit(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, showRule, showIndex, index } = spec;
  const fonts = getPosterFonts();
  const splitX = w * 0.42;
  const panelFill = palette.alt || palette.fg;
  const panelInk = inkOn(panelFill, palette, palette.fg);

  ctx.save();
  ctx.fillStyle = panelFill;
  ctx.globalAlpha = palette.alt ? 1 : 0.1;
  ctx.fillRect(0, 0, splitX, h);
  ctx.restore();

  if (showRule) {
    ctx.save();
    ctx.strokeStyle = palette.fg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(splitX, m);
    ctx.lineTo(splitX, h - m * 1.4);
    ctx.stroke();
    ctx.restore();
  }

  const titleMaxWidth = w - splitX - m * 1.4;
  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: Math.round(w * 0.13),
    maxWidth: titleMaxWidth,
  });
  const titleX = splitX + m * 0.7;
  const titleY = h * 0.42;

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  ctx.fillText(title, titleX, titleY);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, titleX + tw + Math.max(6, fontSize * 0.04), titleY, fontSize, accent);
  }
  ctx.restore();

  const subSize = Math.round(Math.min(w * 0.028, fontSize * 0.22));
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'left';
  ctx.font = `400 ${subSize}px ${fonts.primary}`;
  ctx.fillText(subtitle, titleX, titleY + fontSize * 0.55);
  ctx.restore();

  if (showIndex) {
    ctx.save();
    ctx.fillStyle = panelInk;
    ctx.textAlign = 'left';
    ctx.font = `600 ${Math.round(w * 0.045)}px ${fonts.display}`;
    ctx.fillText(index || '01', m, m + w * 0.05);
    ctx.restore();
  }
}

/** Thin framed title block */
function drawFrame(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, showRule } = spec;
  const fonts = getPosterFonts();
  const inset = m * 1.15;
  const boxW = w - inset * 2;
  const boxH = h * 0.34;
  const boxY = h * 0.3;

  if (showRule) {
    ctx.save();
    ctx.strokeStyle = palette.fg;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inset, boxY, boxW, boxH);
    ctx.restore();
  }

  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: Math.round(w * 0.15),
    maxWidth: boxW - m * 1.2,
  });
  const titleY = boxY + boxH * 0.58;

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  ctx.fillText(title, w / 2, titleY);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, w / 2 + tw / 2 + Math.max(6, fontSize * 0.04), titleY, fontSize, accent);
  }
  ctx.restore();

  const subSize = Math.round(w * 0.024);
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.font = `500 ${subSize}px ${fonts.primary}`;
  ctx.letterSpacing = `${w * 0.01}px`;
  ctx.fillText(subtitle.toUpperCase(), w / 2, boxY + boxH + h * 0.055);
  ctx.restore();
}

/** Title resting on a strong baseline */
function drawBaseline(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, showIndex, index } = spec;
  const fonts = getPosterFonts();
  const baseY = h * 0.58;
  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: Math.round(w * 0.17),
    maxWidth: w - m * 2,
  });

  drawRule(ctx, m, baseY, w - m, palette.fg, 2);

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  ctx.fillText(title, m, baseY - fontSize * 0.12);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, m + tw + Math.max(6, fontSize * 0.04), baseY - fontSize * 0.12, fontSize, accent);
  }
  ctx.restore();

  const subSize = Math.round(w * 0.026);
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'left';
  ctx.font = `400 ${subSize}px ${fonts.primary}`;
  ctx.fillText(subtitle, m, baseY + Math.max(h * 0.045, subSize * 2));
  ctx.restore();

  if (showIndex) {
    ctx.save();
    ctx.fillStyle = palette.muted;
    ctx.textAlign = 'right';
    ctx.font = `400 ${Math.round(w * 0.02)}px ${fonts.primary}`;
    ctx.fillText(index || '01', w - m, m + w * 0.02);
    ctx.restore();
  }
}

/** Two-column editorial grid */
function drawColumns(ctx, w, h, m, spec, accent, showCaret = false) {
  const { palette, title, subtitle, titleWeight, showRule, showIndex, index, meta } = spec;
  const fonts = getPosterFonts();
  const colGap = m * 0.6;
  const colW = (w - m * 2 - colGap) / 2;
  const leftX = m;
  const rightX = m + colW + colGap;

  if (showRule) {
    ctx.save();
    ctx.strokeStyle = palette.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m + colW + colGap / 2, m);
    ctx.lineTo(m + colW + colGap / 2, h - m * 1.4);
    ctx.stroke();
    ctx.restore();
  }

  const fontSize = fitFontSize(ctx, title, {
    weight: titleWeight,
    family: fonts.display,
    maxSize: Math.round(w * 0.12),
    maxWidth: colW,
  });

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.font = `${titleWeight} ${fontSize}px ${fonts.display}`;
  ctx.letterSpacing = '0px';
  ctx.fillText(title, leftX, h * 0.36);
  if (showCaret) {
    const tw = ctx.measureText(title || ' ').width;
    drawCaret(ctx, leftX + tw + Math.max(6, fontSize * 0.04), h * 0.36, fontSize, accent);
  }
  ctx.restore();

  drawRule(ctx, leftX, h * 0.36 + fontSize * 0.28, leftX + colW * 0.55, palette.fg, 1.5);

  const subSize = Math.round(w * 0.026);
  ctx.save();
  ctx.fillStyle = palette.fg;
  ctx.textAlign = 'left';
  ctx.font = `400 ${subSize}px ${fonts.primary}`;
  ctx.fillText(subtitle, leftX, h * 0.36 + fontSize * 0.55);
  ctx.restore();

  const metaSize = Math.round(w * 0.022);
  const lines = [
    'TYPE MOTION',
    'COMPOSITION',
    meta?.split('·')[0]?.trim() || 'STUDIO',
    showIndex ? `NO. ${index || '01'}` : 'PRINT',
  ];
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'left';
  ctx.font = `400 ${metaSize}px ${fonts.primary}`;
  ctx.letterSpacing = `${w * 0.004}px`;
  lines.forEach((line, i) => {
    ctx.fillText(line.toUpperCase(), rightX, h * 0.28 + i * metaSize * 2.1);
  });
  ctx.restore();
}

/**
 * Initialize Poster Generator section
 * @param {HTMLElement} section
 * @returns {Function} cleanup
 */
export function initPosterGenerator(section) {
  const canvas = section.querySelector('[data-poster-canvas]');
  const frame = section.querySelector('.poster__frame');
  const label = section.querySelector('.poster__label');
  const actions = section.querySelector('.poster__actions');
  const generateBtn = section.querySelector('[data-poster-generate]');
  const downloadBtn = section.querySelector('[data-poster-download]');

  if (!canvas || !generateBtn || !downloadBtn) return () => {};

  const reducedMotion = prefersReducedMotion();
  const cleanups = [];
  let hasPoster = false;
  let inView = false;
  let editing = false;
  let caretVisible = true;
  let caretTimer = null;
  let customTitle = '';
  /** @type {ReturnType<typeof createPosterSpec> | null} */
  let currentSpec = null;
  let completed = false;
  let redrawTimer = null;

  if (label) {
    label.textContent = 'Click the poster to edit · Type to set the title';
  }

  function stopCaretBlink() {
    if (caretTimer != null) {
      clearInterval(caretTimer);
      caretTimer = null;
    }
    caretVisible = false;
  }

  function startCaretBlink() {
    stopCaretBlink();
    caretVisible = true;
    if (reducedMotion) return;
    caretTimer = window.setInterval(() => {
      caretVisible = !caretVisible;
      if (currentSpec && editing) {
        drawPoster(canvas, currentSpec, { showCaret: caretVisible });
      }
    }, 530);
  }

  function setEditing(next) {
    if (editing === next) {
      if (next) {
        caretVisible = true;
        if (currentSpec) drawPoster(canvas, currentSpec, { showCaret: true });
        startCaretBlink();
      }
      return;
    }
    editing = next;
    frame?.classList.toggle('is-editing', editing);
    if (editing) {
      if (!customTitle && currentSpec?.title) {
        customTitle = currentSpec.title;
      }
      setCursor('text');
      caretVisible = true;
      if (currentSpec) drawPoster(canvas, currentSpec, { showCaret: true });
      startCaretBlink();
    } else {
      stopCaretBlink();
      if (currentSpec) drawPoster(canvas, currentSpec, { showCaret: false });
    }
  }

  function renderPoster(spec, { animate = true, showCaret = editing && caretVisible } = {}) {
    currentSpec = spec;
    drawPoster(canvas, spec, { showCaret });
    hasPoster = true;
    downloadBtn.disabled = false;

    if (animate && !reducedMotion && frame) {
      gsap.fromTo(
        frame,
        { scale: 0.985 },
        {
          scale: 1,
          duration: ANIMATION.duration.click,
          ease: ANIMATION.ease.out,
        }
      );
    }
  }

  function renderNewPoster({ animate = true } = {}) {
    const spec = createPosterSpec(customTitle ? { title: customTitle } : {});
    renderPoster(spec, { animate, showCaret: editing && caretVisible });
    maybeComplete();
  }

  function liveRedraw() {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(() => {
      if (!currentSpec) {
        renderNewPoster({ animate: false });
        return;
      }
      const next = {
        ...currentSpec,
        title: (customTitle || currentSpec.title).toUpperCase().slice(0, TITLE_MAX) || 'TYPE',
      };
      caretVisible = true;
      renderPoster(next, { animate: false, showCaret: editing });
      if (editing) startCaretBlink();
    }, 40);
  }

  function downloadPoster() {
    if (!hasPoster || !currentSpec) return;

    // Export without the editing caret
    drawPoster(canvas, currentSpec, { showCaret: false });

    const link = document.createElement('a');
    link.download = `type-motion-poster-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    if (editing) {
      caretVisible = true;
      drawPoster(canvas, currentSpec, { showCaret: true });
      startCaretBlink();
    }
  }

  async function maybeComplete() {
    if (completed) return;
    if (customTitle.length < 2) return;
    completed = true;
    markStageComplete('poster-generator');
    if (label) {
      await setFeedbackLabel(label, EXPERIENCE.feedback.unlocked, { stage: false });
      await wait(EXPERIENCE.feedbackHoldMs);
      await setFeedbackLabel(label, 'Click the poster to edit · Type to set the title', {
        stage: true,
      });
    }
  }

  const onKeyDown = (e) => {
    if (!inView) return;
    const tag = /** @type {HTMLElement} */ (e.target)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      setEditing(true);
      customTitle = customTitle.slice(0, -1);
      liveRedraw();
      setCursor('text');
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      renderNewPoster({ animate: true });
      return;
    }

    if (e.key === 'Escape') {
      setEditing(false);
      return;
    }

    if (e.key.length === 1 && /[a-z0-9 ]/i.test(e.key)) {
      e.preventDefault();
      setEditing(true);
      if (customTitle.length >= TITLE_MAX) return;
      customTitle += e.key;
      liveRedraw();
      setCursor('text');
      if (customTitle.length >= 2) maybeComplete();
    }
  };

  const onFrameClick = (e) => {
    e.preventDefault();
    setEditing(true);
    setCursor('text');
  };

  const onDocumentPointerDown = (e) => {
    if (!editing) return;
    const target = /** @type {Node} */ (e.target);
    if (frame?.contains(target)) return;
    if (generateBtn.contains(target) || downloadBtn.contains(target)) return;
    setEditing(false);
  };

  const onSectionEnter = () => setCursor('text');
  const onSectionLeave = () => {
    resetCursor();
    setEditing(false);
  };

  const onGenerate = () => renderNewPoster({ animate: true });
  const onThemeChange = () => {
    if (!currentSpec) return;
    const nextPalette = pick(getThemePalettes());
    currentSpec = {
      ...currentSpec,
      palette: nextPalette,
      useAccent: nextPalette.accent !== nextPalette.fg && currentSpec.useAccent,
    };
    drawPoster(canvas, currentSpec, { showCaret: editing && caretVisible });
  };

  generateBtn.addEventListener('click', onGenerate);
  downloadBtn.addEventListener('click', downloadPoster);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('themechange', onThemeChange);
  frame?.addEventListener('click', onFrameClick);
  document.addEventListener('pointerdown', onDocumentPointerDown);
  section.addEventListener('mouseenter', onSectionEnter);
  section.addEventListener('mouseleave', onSectionLeave);

  cleanups.push(() => {
    generateBtn.removeEventListener('click', onGenerate);
    downloadBtn.removeEventListener('click', downloadPoster);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('themechange', onThemeChange);
    frame?.removeEventListener('click', onFrameClick);
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    section.removeEventListener('mouseenter', onSectionEnter);
    section.removeEventListener('mouseleave', onSectionLeave);
    clearTimeout(redrawTimer);
    stopCaretBlink();
  });

  if (label) gsap.set(label, { opacity: 0, y: 8 });
  if (frame) gsap.set(frame, { opacity: 0, y: 20 });
  if (actions) gsap.set(actions, { opacity: 0, y: 12 });

  const entrance = ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    once: true,
    onEnter: () => {
      renderNewPoster({ animate: false });

      if (label) {
        gsap.to(label, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
        });
      }
      if (frame) {
        gsap.to(frame, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.slow,
          ease: ANIMATION.ease.expo,
          delay: 0.1,
        });
      }
      if (actions) {
        gsap.to(actions, {
          opacity: 1,
          y: 0,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
          delay: 0.25,
        });
      }
    },
  });

  const visibility = ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    end: 'bottom 30%',
    onEnter: () => {
      inView = true;
    },
    onEnterBack: () => {
      inView = true;
    },
    onLeave: () => {
      inView = false;
      setEditing(false);
      resetCursor();
    },
    onLeaveBack: () => {
      inView = false;
      setEditing(false);
      resetCursor();
    },
  });

  cleanups.push(() => {
    entrance.kill();
    visibility.kill();
  });

  return () => cleanups.forEach((fn) => fn());
}
