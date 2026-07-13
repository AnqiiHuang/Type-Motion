/**
 * Natural-material interaction sounds — gallery quiet, not gamey.
 * Materials: paper · air · wood · fabric · glass
 * Levels stay very low; hover is nearly inaudible.
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
 * Soft filtered noise burst (paper / air / fabric)
 * @param {{ dur?: number, gain?: number, freq?: number, q?: number, type?: BiquadFilterType }} opts
 */
function noiseBurst({
  dur = 0.08,
  gain = 0.012,
  freq = 1800,
  q = 0.7,
  type = 'bandpass',
} = {}) {
  if (muted) return;
  const audio = getCtx();
  if (!audio || audio.state !== 'running') return;

  const now = audio.currentTime;
  const frames = Math.max(1, Math.floor(audio.sampleRate * dur));
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Soft envelope already in samples — less clicky
    const env = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }

  const src = audio.createBufferSource();
  src.buffer = buffer;

  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;

  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);
  src.start(now);
  src.stop(now + dur + 0.02);
}

/**
 * Quiet tonal body (wood / glass)
 * @param {{ freq?: number, dur?: number, type?: OscillatorType, gain?: number, slide?: number, lp?: number }} opts
 */
function tone({
  freq = 220,
  dur = 0.1,
  type = 'sine',
  gain = 0.02,
  slide = 0,
  lp = 1800,
} = {}) {
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
  filter.frequency.value = lp;

  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);

  osc.start(now);
  osc.stop(now + dur + 0.03);
}

export const sound = {
  /** Hover / proximity — paper rustle, almost inaudible */
  tick() {
    noiseBurst({
      dur: 0.045,
      gain: 0.006,
      freq: 2400 + Math.random() * 800,
      q: 0.45,
      type: 'bandpass',
    });
  },

  /** Click — soft wood tap + faint air */
  pop() {
    // Wood body
    tone({
      freq: 165 + Math.random() * 40,
      dur: 0.11,
      type: 'triangle',
      gain: 0.016,
      slide: -40,
      lp: 900,
    });
    // Paper edge
    noiseBurst({
      dur: 0.055,
      gain: 0.008,
      freq: 1200,
      q: 0.6,
      type: 'bandpass',
    });
  },

  /** WOW / climax — soft air wash, gallery-quiet */
  whoosh() {
    if (muted) return;
    const audio = getCtx();
    if (!audio || audio.state !== 'running') return;

    const now = audio.currentTime;
    const dur = 0.72;
    const frames = Math.floor(audio.sampleRate * dur);
    const buffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      const env = Math.sin(Math.PI * t) ** 1.4;
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = audio.createBufferSource();
    src.buffer = buffer;

    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.4;
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.42);
    filter.frequency.exponentialRampToValueAtTime(480, now + dur);

    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.028, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    // Soft glass undertone — barely there
    const osc = audio.createOscillator();
    const og = audio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + dur);
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.008, now + 0.1);
    og.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(audio.destination);
    osc.connect(og);
    og.connect(audio.destination);

    src.start(now);
    src.stop(now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  },

  /** Settle / wheel — fabric brush or soft glass */
  soft() {
    tone({
      freq: 420 + Math.random() * 60,
      dur: 0.14,
      type: 'sine',
      gain: 0.007,
      slide: -80,
      lp: 1400,
    });
    noiseBurst({
      dur: 0.07,
      gain: 0.004,
      freq: 900,
      q: 0.35,
      type: 'lowpass',
    });
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
  window.dispatchEvent(new CustomEvent('mutechange', { detail: { muted } }));
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

/**
 * Init audio. Unlocks on first pointer gesture.
 * @returns {Function} cleanup
 */
export function initAudio() {
  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    muted = false;
  }

  const unlockOnce = () => {
    unlock();
  };

  window.addEventListener('pointerdown', unlockOnce, { once: true, passive: true });
  window.addEventListener('keydown', unlockOnce, { once: true });

  return () => {
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
  };
}
