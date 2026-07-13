/**
 * Subtle cursor feedback by interaction state.
 * Native CSS cursors + optional soft ring on hover (fine pointers only).
 */

/** @type {string} */
let current = 'default';
let ringEl = null;
let tracking = false;

function ensureRing() {
  if (ringEl) return ringEl;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
  ringEl = document.createElement('div');
  ringEl.className = 'cursor-ring';
  ringEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ringEl);
  return ringEl;
}

function onMove(e) {
  if (!ringEl || !tracking) return;
  ringEl.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
}

/**
 * @param {'default' | 'hover' | 'grab' | 'grabbing' | 'pointer' | 'text'} mode
 */
export function setCursor(mode) {
  if (current === mode) return;
  current = mode;
  document.documentElement.dataset.cursor = mode;

  const ring = ensureRing();
  if (!ring) return;

  if (mode === 'hover') {
    tracking = true;
    ring.classList.add('is-visible', 'is-hover');
  } else if (mode === 'grab' || mode === 'grabbing') {
    tracking = true;
    ring.classList.add('is-visible');
    ring.classList.toggle('is-grabbing', mode === 'grabbing');
    ring.classList.remove('is-hover');
  } else {
    tracking = false;
    ring.classList.remove('is-visible', 'is-hover', 'is-grabbing');
  }
}

export function resetCursor() {
  setCursor('default');
}

/**
 * @returns {Function} cleanup
 */
export function initCursorSystem() {
  document.documentElement.dataset.cursor = 'default';
  ensureRing();
  window.addEventListener('pointermove', onMove, { passive: true });

  const onOver = (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t?.closest) return;
    if (current === 'grab' || current === 'grabbing' || current === 'text' || current === 'hover') {
      return;
    }
    if (t.closest('button, a, [role="button"], .btn, input[type="range"], .theme__option')) {
      setCursor('pointer');
    }
  };

  const onOut = (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t?.closest) return;
    if (t.closest('button, a, [role="button"], .btn, input[type="range"], .theme__option')) {
      if (current === 'pointer') resetCursor();
    }
  };

  document.addEventListener('mouseover', onOver);
  document.addEventListener('mouseout', onOut);

  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('mouseover', onOver);
    document.removeEventListener('mouseout', onOut);
    ringEl?.remove();
    ringEl = null;
    delete document.documentElement.dataset.cursor;
  };
}
