// SFX disintesis langsung dengan WebAudio (tanpa file audio → bundle tetap kecil).
let ctx = null, master = null, noiseBuf = null;
let muted = false;

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.32;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* audio tidak tersedia */ }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.32;
}
export function isMuted() { return muted; }

function ready() { return ctx && ctx.state === 'running' && !muted; }

function tone(freq, dur, { type = 'square', slide = 0, vol = 0.2, delay = 0, attack = 0.005 } = {}) {
  if (!ready()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * Math.pow(2, slide)), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.2, freq = 1200, q = 0.8, type = 'lowpass', sweep = 0, delay = 0 } = {}) {
  if (!ready()) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * Math.pow(2, sweep)), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
}

const semi = (n) => Math.pow(2, n / 12);

export const sfx = {
  click() { tone(660, 0.05, { vol: 0.1 }); },
  move() { tone(240, 0.03, { vol: 0.05, type: 'triangle' }); },
  rotate() { tone(420, 0.06, { vol: 0.07, slide: 0.4, type: 'triangle' }); },
  land() { noise(0.14, { vol: 0.22, freq: 2200, sweep: -1.5 }); },
  hardDrop() { noise(0.2, { vol: 0.32, freq: 1400, sweep: -2 }); tone(110, 0.14, { type: 'sine', slide: -1, vol: 0.25 }); },
  tilt(dir) { noise(0.38, { vol: 0.18, freq: dir > 0 ? 500 : 700, type: 'bandpass', q: 1.5, sweep: dir > 0 ? 1.2 : -0.6 }); },
  tiltFail() { tone(150, 0.08, { vol: 0.08, type: 'square', slide: -0.3 }); },
  clear(chain) {
    const base = 523.25 * semi(Math.min(chain - 1, 8) * 2);
    [0, 4, 7, 12].forEach((n, k) => tone(base * semi(n), 0.16, { vol: 0.12, type: 'square', delay: k * 0.045 }));
    noise(0.3, { vol: 0.12, freq: 4000, type: 'highpass', delay: 0.02 });
  },
  levelUp() { [0, 5, 9, 12, 17].forEach((n, k) => tone(392 * semi(n), 0.12, { vol: 0.1, type: 'triangle', delay: k * 0.07 })); },
  achievement() { [12, 16, 19, 24].forEach((n, k) => tone(392 * semi(n), 0.14, { vol: 0.09, type: 'sine', delay: k * 0.06 })); },
  heartbeat() { tone(70, 0.1, { type: 'sine', vol: 0.3, slide: -0.4 }); tone(62, 0.1, { type: 'sine', vol: 0.22, slide: -0.4, delay: 0.16 }); },
  gameOver() { [0, -3, -6, -12].forEach((n, k) => tone(330 * semi(n), 0.28, { vol: 0.13, type: 'square', delay: k * 0.16 })); },
  explode() {
    noise(0.7, { vol: 0.5, freq: 900, sweep: -3 });
    tone(90, 0.5, { type: 'sine', vol: 0.4, slide: -1.5 });
    tone(55, 0.6, { type: 'triangle', vol: 0.25, slide: -1, delay: 0.05 });
  },
  warn() { [0, 0.18, 0.36].forEach((d) => tone(880, 0.09, { vol: 0.1, type: 'square', delay: d })); },
  wind(dir) { noise(2.5, { vol: 0.14, freq: dir > 0 ? 400 : 600, type: 'bandpass', q: 0.7, sweep: 0.8 }); },
  quake() { noise(0.8, { vol: 0.35, freq: 200, sweep: -1 }); tone(50, 0.7, { type: 'sine', vol: 0.3, slide: -0.5 }); },
};
