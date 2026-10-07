/** Tiny synthesized sound set (no audio files). */
let ctx: AudioContext | null = null;
let enabled = true;
export const setSoundEnabled = (on: boolean) => { enabled = on; };

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Creating an AudioContext takes tens of milliseconds on phones. Do it on the first touch,
 * outside any move, instead of in the middle of the first move or the final one.
 */
export function warmUpAudio(): void {
  const once = () => {
    window.removeEventListener('pointerdown', once, true);
    window.removeEventListener('keydown', once, true);
    setTimeout(() => { const a = ac(); if (a) noise(a, 0.07); }, 0);
  };
  window.addEventListener('pointerdown', once, true);
  window.addEventListener('keydown', once, true);
}

const noiseCache = new Map<number, AudioBuffer>();
/** Decaying white noise, generated once per length. */
function noise(a: AudioContext, dur: number): AudioBuffer {
  let buf = noiseCache.get(dur);
  if (buf && buf.sampleRate === a.sampleRate) return buf;
  const len = Math.floor(a.sampleRate * dur);
  buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  noiseCache.set(dur, buf);
  return buf;
}

/** Short filtered noise burst: a wooden "tock". */
function knock(gain: number, freq: number, dur = 0.07) {
  const a = ac();
  if (!a) return;
  const buf = noise(a, dur);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.4;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

function tone(freqs: number[], dur: number, gain = 0.08, type: OscillatorType = 'sine', gap = 0.06) {
  const a = ac();
  if (!a) return;
  freqs.forEach((fq, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = fq;
    const t0 = a.currentTime + i * gap;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  });
}

const later = (f: () => void) => () => { setTimeout(f, 0); };

/** Each sound is played in its own task so it never delays drawing the board. */
export const sound = {
  move: later(() => knock(0.9, 1100)),
  capture: later(() => { knock(1.2, 700, 0.09); knock(0.5, 1800, 0.05); }),
  check: later(() => { knock(1, 700, 0.08); tone([988, 1318], 0.16, 0.06, 'square', 0.05); }),
  card: later(() => tone([660, 880, 1320], 0.35, 0.06, 'triangle', 0.05)),
  pick: later(() => tone([520, 780], 0.25, 0.07, 'triangle', 0.07)),
  notify: later(() => tone([880, 660], 0.22, 0.07, 'sine', 0.1)),
  win: later(() => tone([523, 659, 784, 1046], 0.5, 0.08, 'triangle', 0.09)),
  lose: later(() => tone([440, 370, 294], 0.5, 0.07, 'sine', 0.12)),
  success: later(() => tone([784, 988, 1318], 0.45, 0.07, 'triangle', 0.07)),
  error: later(() => tone([220, 196], 0.18, 0.06, 'square', 0.08)),
};

/** Short vibration on supporting phones. */
export function haptic(kind: 'tap' | 'move' | 'capture' | 'win' | 'error'): void {
  if (!enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const pattern = { tap: 8, move: 12, capture: [10, 30, 18], win: [20, 40, 20, 40, 40], error: [30, 40, 30] }[kind];
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}
