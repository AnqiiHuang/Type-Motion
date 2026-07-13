/**
 * Subtle mouse / touch trail — faint particles, never dominant.
 */

import { getPointer, onPointerFrame } from './pointer.js';
import { prefersReducedMotion } from './animation.js';

const MAX_PARTICLES = 28;

/**
 * @returns {Function} cleanup
 */
export function initTrail() {
  if (prefersReducedMotion()) return () => {};

  const canvas = document.createElement('canvas');
  canvas.className = 'motion-trail';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    canvas.remove();
    return () => {};
  }

  /** @type {Array<{ x: number, y: number, life: number, size: number }>} */
  const particles = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let lastSpawn = 0;
  let visible = true;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);

  const unsub = onPointerFrame((p) => {
    if (!visible || !p.active) {
      // Still fade existing particles
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].life -= 0.04;
        if (particles[i].life <= 0) particles.splice(i, 1);
      }
      draw();
      return;
    }

    const now = performance.now();
    if (p.speed > 1.2 && now - lastSpawn > 16) {
      lastSpawn = now;
      if (particles.length < MAX_PARTICLES) {
        particles.push({
          x: p.x,
          y: p.y,
          life: 1,
          size: 1.2 + Math.min(p.speed * 0.08, 2.5),
        });
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life -= 0.035;
      if (pt.life <= 0) particles.splice(i, 1);
    }

    draw();
  });

  function draw() {
    ctx.clearRect(0, 0, w, h);
    if (!particles.length) return;

    const rgb = getComputedStyle(document.documentElement)
      .getPropertyValue('--trail-rgb')
      .trim() || '0, 0, 0';

    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const alpha = pt.life * 0.22;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hide trail over dense UI sections if needed later
  const onVisibility = () => {
    visible = !document.hidden;
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    unsub();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    particles.length = 0;
    canvas.remove();
  };
}
