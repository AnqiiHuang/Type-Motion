/**
 * Section 6 — Random Poster Generator
 *
 * Curated layout systems + restrained palettes produce
 * design-aware typography posters (not random chaos).
 * Export via Canvas → PNG.
 */

import { ANIMATION } from '../config.js';
import { prefersReducedMotion } from '../utils/animation.js';

/** Export resolution (CSS display scales via container) */
const POSTER_W = 900;
const POSTER_H = 1200;

/** Restrained palettes — premium, mostly monochrome */
const PALETTES = [
  { bg: '#ffffff', fg: '#0a0a0a', muted: '#888888', accent: '#0a0a0a' },
  { bg: '#0a0a0a', fg: '#f5f5f5', muted: '#888888', accent: '#f5f5f5' },
  { bg: '#f4f4f4', fg: '#111111', muted: '#777777', accent: '#111111' },
  { bg: '#111111', fg: '#eaeaea', muted: '#7a7a7a', accent: '#eaeaea' },
  { bg: '#ffffff', fg: '#0a0a0a', muted: '#999999', accent: '#c45c26' }, // rare warm accent
  { bg: '#0c0c0c', fg: '#f0f0f0', muted: '#8a8a8a', accent: '#d4af37' }, // rare gold accent
];

const TITLES = [
  'TYPE', 'FORM', 'SPACE', 'RHYTHM', 'SIGNAL',
  'MOTION', 'FRAME', 'VOID', 'EDGE', 'PULSE',
  'GRAVITY', 'SILENCE', 'FOCUS', 'SCALE',
];

const SUBTITLES = [
  'Visual Language', 'Editorial Study', 'Studio Experiment',
  'Type Laboratory', 'Composition No.', 'Spatial Design',
  'Letterform Study', 'Graphic System', 'Print Study',
];

const METAS = [
  'Vol. 01', 'Vol. 02', 'Vol. 03', 'Edition A', 'Edition B',
  'Series 01', 'Series 02', 'Archive', 'Studio', '2026',
];

/** Layout systems — intentional compositions */
const LAYOUTS = ['monument', 'editorial', 'stacked', 'corner', 'diagonal'];

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
 */
function createPosterSpec() {
  const palette = pick(PALETTES);
  const layout = pick(LAYOUTS);
  const title = pick(TITLES);
  const subtitle = pick(SUBTITLES);
  const meta = pick(METAS);
  const number = String(randInt(1, 48)).padStart(2, '0');

  // Accent usage only on palettes that include one, and only sometimes
  const useAccent = palette.accent !== palette.fg && Math.random() > 0.55;

  return {
    palette,
    layout,
    title,
    subtitle,
    meta: subtitle.includes('No.') ? `${subtitle} ${number}` : `${meta}  ·  ${number}`,
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
 */
function drawPoster(canvas, spec) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = POSTER_W;
  const h = POSTER_H;
  const dpr = 1; // fixed export size; CSS scales display

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { palette, layout, title, subtitle, meta, useAccent, margin } = spec;
  const m = w * margin;
  const accent = useAccent ? palette.accent : palette.fg;

  // Background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle paper grain (very light)
  drawGrain(ctx, w, h, palette.fg, 0.03);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.fg;

  switch (layout) {
    case 'monument':
      drawMonument(ctx, w, h, m, spec, accent);
      break;
    case 'editorial':
      drawEditorial(ctx, w, h, m, spec, accent);
      break;
    case 'stacked':
      drawStacked(ctx, w, h, m, spec, accent);
      break;
    case 'corner':
      drawCorner(ctx, w, h, m, spec, accent);
      break;
    case 'diagonal':
      drawDiagonal(ctx, w, h, m, spec, accent);
      break;
    default:
      drawMonument(ctx, w, h, m, spec, accent);
  }

  // Quiet footer meta — always present for finish
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.font = `400 ${Math.round(w * 0.018)}px Inter, sans-serif`;
  ctx.letterSpacing = `${w * 0.004}px`;
  ctx.textAlign = 'left';
  ctx.fillText('TYPE MOTION', m, h - m * 0.55);
  ctx.textAlign = 'right';
  ctx.fillText(meta.replace(/^.*?·\s*/, '').trim() || '01', w - m, h - m * 0.55);
  ctx.restore();
}

function drawGrain(ctx, w, h, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const step = 6;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (Math.random() > 0.82) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
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

/** Centered monumental title */
function drawMonument(ctx, w, h, m, spec, accent) {
  const { palette, title, subtitle, titleWeight, titleTracking, subTracking, showRule } = spec;

  // Optical vertical center slightly above true center
  const cy = h * 0.46;

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.font = `${titleWeight} ${Math.round(w * 0.22)}px Inter, sans-serif`;
  ctx.letterSpacing = `${w * titleTracking}px`;
  ctx.fillText(title, w / 2, cy);
  ctx.restore();

  if (showRule) {
    drawRule(ctx, w / 2 - w * 0.08, cy + h * 0.04, w / 2 + w * 0.08, palette.muted, 1);
  }

  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.font = `500 ${Math.round(w * 0.028)}px Inter, sans-serif`;
  ctx.letterSpacing = `${w * subTracking * 0.01}px`;
  ctx.fillText(subtitle.toUpperCase(), w / 2, cy + h * 0.08);
  ctx.restore();

  if (spec.showIndex) {
    ctx.save();
    ctx.fillStyle = palette.muted;
    ctx.textAlign = 'left';
    ctx.font = `400 ${Math.round(w * 0.02)}px Inter, sans-serif`;
    ctx.fillText('01', m, m + w * 0.02);
    ctx.restore();
  }
}

/** Asymmetric editorial — large left title, small right meta */
function drawEditorial(ctx, w, h, m, spec, accent) {
  const { palette, title, subtitle, titleWeight, showRule } = spec;

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.font = `${titleWeight} ${Math.round(w * 0.18)}px Inter, sans-serif`;
  ctx.fillText(title, m, h * 0.38);
  ctx.restore();

  if (showRule) {
    drawRule(ctx, m, h * 0.44, w - m, palette.fg, 1.5);
  }

  ctx.save();
  ctx.fillStyle = palette.fg;
  ctx.textAlign = 'left';
  ctx.font = `400 ${Math.round(w * 0.032)}px Inter, sans-serif`;
  ctx.fillText(subtitle, m, h * 0.52);
  ctx.restore();

  // Side caption block
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'right';
  ctx.font = `400 ${Math.round(w * 0.02)}px Inter, sans-serif`;
  const lines = ['COMPOSITION', 'STUDY', 'SYSTEM'];
  lines.forEach((line, i) => {
    ctx.fillText(line, w - m, m + w * 0.04 + i * w * 0.035);
  });
  ctx.restore();
}

/** Vertical stacked hierarchy with generous leading */
function drawStacked(ctx, w, h, m, spec, accent) {
  const { palette, title, subtitle, titleWeight, showRule } = spec;
  const chars = title.split('');
  const startY = h * 0.22;
  const step = Math.min((h * 0.5) / chars.length, w * 0.14);

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.font = `${titleWeight} ${Math.round(w * 0.14)}px Inter, sans-serif`;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, w / 2, startY + i * step);
  });
  ctx.restore();

  if (showRule) {
    drawRule(ctx, w * 0.35, startY + chars.length * step + h * 0.02, w * 0.65, palette.muted);
  }

  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.font = `500 ${Math.round(w * 0.024)}px Inter, sans-serif`;
  ctx.letterSpacing = `${w * 0.006}px`;
  ctx.fillText(subtitle.toUpperCase(), w / 2, startY + chars.length * step + h * 0.07);
  ctx.restore();
}

/** Corner-weighted with open field */
function drawCorner(ctx, w, h, m, spec, accent) {
  const { palette, title, subtitle, titleWeight, showRule, showIndex } = spec;

  ctx.save();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.font = `${titleWeight} ${Math.round(w * 0.16)}px Inter, sans-serif`;
  ctx.fillText(title, m, h - m * 1.4);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'left';
  ctx.font = `400 ${Math.round(w * 0.026)}px Inter, sans-serif`;
  ctx.fillText(subtitle, m, h - m * 0.95);
  ctx.restore();

  if (showRule) {
    drawRule(ctx, m, m + w * 0.02, m + w * 0.2, palette.fg, 2);
  }

  if (showIndex) {
    ctx.save();
    ctx.fillStyle = palette.fg;
    ctx.textAlign = 'right';
    ctx.font = `600 ${Math.round(w * 0.08)}px Inter, sans-serif`;
    ctx.fillText(String(randInt(1, 12)).padStart(2, '0'), w - m, m + w * 0.08);
    ctx.restore();
  }
}

/** Soft diagonal title — controlled rotation */
function drawDiagonal(ctx, w, h, m, spec, accent) {
  const { palette, title, subtitle, titleWeight, rotation, showRule } = spec;

  ctx.save();
  ctx.translate(w / 2, h * 0.45);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.font = `${titleWeight} ${Math.round(w * 0.2)}px Inter, sans-serif`;
  ctx.fillText(title, 0, 0);
  ctx.restore();

  if (showRule) {
    drawRule(ctx, m, h * 0.68, w - m, palette.muted);
  }

  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.font = `500 ${Math.round(w * 0.026)}px Inter, sans-serif`;
  ctx.letterSpacing = `${w * 0.008}px`;
  ctx.fillText(subtitle.toUpperCase(), w / 2, h * 0.74);
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

  function renderNewPoster({ animate = true } = {}) {
    const spec = createPosterSpec();
    drawPoster(canvas, spec);
    hasPoster = true;
    downloadBtn.disabled = false;

    if (animate && !reducedMotion && frame) {
      gsap.fromTo(
        frame,
        { scale: 0.985 },
        {
          scale: 1,
          duration: ANIMATION.duration.normal,
          ease: ANIMATION.ease.out,
        }
      );
    }
  }

  function downloadPoster() {
    if (!hasPoster) return;

    const link = document.createElement('a');
    link.download = `type-motion-poster-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  generateBtn.addEventListener('click', renderNewPoster);
  downloadBtn.addEventListener('click', downloadPoster);
  cleanups.push(() => {
    generateBtn.removeEventListener('click', renderNewPoster);
    downloadBtn.removeEventListener('click', downloadPoster);
  });

  // ── Entrance + first poster ─────────────────────────────────────────────
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

  cleanups.push(() => entrance.kill());

  return () => cleanups.forEach((fn) => fn());
}
