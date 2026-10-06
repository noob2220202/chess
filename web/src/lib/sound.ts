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

/** Short filtered noise burst: a wooden "tock". */
function knock(gain: number, freq: number, dur = 0.07) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
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

export const sound = {
  move: () => knock(0.9, 1100),
  capture: () => { knock(1.2, 700, 0.09); knock(0.5, 1800, 0.05); },
  card: () => tone([660, 880, 1320], 0.35, 0.06, 'triangle', 0.05),
  pick: () => tone([520, 780], 0.25, 0.07, 'triangle', 0.07),
  notify: () => tone([880, 660], 0.22, 0.07, 'sine', 0.1),
  win: () => tone([523, 659, 784, 1046], 0.5, 0.08, 'triangle', 0.09),
  lose: () => tone([440, 370, 294], 0.5, 0.07, 'sine', 0.12),
  success: () => tone([784, 988, 1318], 0.45, 0.07, 'triangle', 0.07),
  error: () => tone([220, 196], 0.18, 0.06, 'square', 0.08),
};
