/**
 * Shared pointer / touch state with velocity for motion blur & trails.
 */

const state = {
  x: 0,
  y: 0,
  px: 0,
  py: 0,
  vx: 0,
  vy: 0,
  speed: 0,
  down: false,
  active: false,
  isTouch: false,
};

let rafId = null;
let running = false;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(state));
}

function tick() {
  if (!running) return;

  // Velocity decay (inertia feel for blur / stretch)
  state.vx *= 0.88;
  state.vy *= 0.88;
  state.speed = Math.hypot(state.vx, state.vy);

  if (state.speed < 0.05 && !state.down) {
    state.vx = 0;
    state.vy = 0;
    state.speed = 0;
  }

  notify();
  rafId = requestAnimationFrame(tick);
}

function onMove(x, y) {
  const dx = x - state.x;
  const dy = y - state.y;
  state.px = state.x;
  state.py = state.y;
  state.x = x;
  state.y = y;
  // EMA blend — smoother velocity for stretch / blur
  state.vx = state.vx * 0.35 + dx * 0.65;
  state.vy = state.vy * 0.35 + dy * 0.65;
  state.speed = Math.hypot(state.vx, state.vy);
  state.active = true;
}

/**
 * @returns {typeof state}
 */
export function getPointer() {
  return state;
}

/**
 * Subscribe to pointer frame updates
 * @param {(s: typeof state) => void} fn
 * @returns {Function} unsubscribe
 */
export function onPointerFrame(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Boot global pointer tracking
 * @returns {Function} cleanup
 */
export function initPointer() {
  running = true;
  rafId = requestAnimationFrame(tick);

  const onPointerMove = (e) => {
    state.isTouch = e.pointerType === 'touch';
    onMove(e.clientX, e.clientY);
  };

  const onPointerDown = (e) => {
    state.down = true;
    state.isTouch = e.pointerType === 'touch';
    onMove(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    state.down = false;
  };

  const onLeave = () => {
    state.active = false;
    state.down = false;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  document.addEventListener('mouseleave', onLeave);

  return () => {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    document.removeEventListener('mouseleave', onLeave);
    listeners.clear();
  };
}
