/**
 * Subtle Web Audio interaction sounds — very restrained.
 * Default: on. Mute button toggles.
 */

const STORAGE_KEY = 'type-motion-muted';

/** @type {AudioContext | null} */
let ctx = null;
let muted = false;
let unlocked = false;

/**
 * @returns {AudioContext | null}
 */
function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

async function unlock() {
  const audio = getCtx();
  if (!audio || unlocked) return;
  if (audio.state === 'suspended') {
    try {
      await audio.resume();
    } catch {
      return;
    }
  }
  unlocked = true;
}

/**
 * Soft tone burst
 * @param {{ freq?: number, dur?: number, type?: OscillatorType, gain?: number, slide?: number }} opts
 */
function tone({ freq = 440, dur = 0.06, type = 'sine', gain = 0.03, slide = 0 } = {}) {
  if (muted) return;
  const audio = getCtx();
  if (!audio || audio.state !== 'running') return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  const filter = audio.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + dur);
  }

  filter.type = 'lowpass';
  filter.frequency.value = 2400;

  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);

  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export const sound = {
  tick() {
    tone({ freq: 920, dur: 0.028, type: 'triangle', gain: 0.012 });
  },
  pop() {
    tone({ freq: 280, dur: 0.09, type: 'sine', gain: 0.022, slide: 260 });
  },
  whoosh() {
    if (muted) return;
    const audio = getCtx();
    if (!audio || audio.state !== 'running') return;

    const now = audio.currentTime;
    const bufferSize = audio.sampleRate * 0.48;
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const src = audio.createBufferSource();
    src.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.38);
    filter.Q.value = 0.55;

    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.038, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    src.connect(filter);
    filter.connect(g);
    g.connect(audio.destination);
    src.start(now);
    src.stop(now + 0.48);
  },
  soft() {
    tone({ freq: 480, dur: 0.055, type: 'sine', gain: 0.01 });
  },
};

/**
 * @returns {boolean}
 */
export function isMuted() {
  return muted;
}

/**
 * @param {boolean} value
 */
export function setMuted(value) {
  muted = Boolean(value);
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
  syncMuteUI();
  window.dispatchEvent(new CustomEvent('mutechange', { detail: { muted } }));
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

function syncMuteUI() {
  document.querySelectorAll('[data-mute-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.classList.toggle('is-muted', muted);
    btn.textContent = muted ? 'Sound' : 'Mute';
  });
}

/**
 * Init audio + mute chrome. Unlocks on first pointer gesture.
 * @returns {Function} cleanup
 */
export function initAudio() {
  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    muted = false;
  }

  syncMuteUI();

  const unlockOnce = () => {
    unlock();
  };

  const onMuteClick = (e) => {
    const btn = e.target.closest('[data-mute-toggle]');
    if (!btn) return;
    e.preventDefault();
    unlock();
    toggleMute();
  };

  window.addEventListener('pointerdown', unlockOnce, { once: true, passive: true });
  window.addEventListener('keydown', unlockOnce, { once: true });
  document.addEventListener('click', onMuteClick);

  return () => {
    document.removeEventListener('click', onMuteClick);
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
  };
}
