// Soundtrack chiptune ORISINAL untuk SandTilt (komposisi sendiri, bebas lisensi).
// Membuat WAV mentah lalu (lewat ffmpeg) MP3 di assets/music:
//   game.mp3  — loop saat bermain (132 BPM, 16 bar, A minor)
//   title.mp3 — loop menu (96 BPM, 8 bar, lebih tenang)
// Pemakaian: node tools/compose-music.mjs
// Loop dibuat mulus: ekor nada di akhir dibungkus ke awal buffer.

import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 32000;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'music');

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = (name) => { const m = /^([A-G]#?)(\d)$/.exec(name); return 12 * (+m[2] + 1) + NOTE[m[1]]; };
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = {
  Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], C: ['C', 'E', 'G'], G: ['G', 'B', 'D'],
  Dm: ['D', 'F', 'A'], E: ['E', 'G#', 'B'],
};

// Melodi: 8 langkah (nada 1/8) per bar. '~' = tahan nada sebelumnya, '-' = diam.
const MELODY_A = [
  'A4 ~ C5 ~ E5 ~ D5 C5', 'A4 ~ ~ ~ G4 A4 C5 ~', 'G4 ~ E4 ~ G4 ~ C5 B4', 'D5 ~ ~ ~ B4 ~ G4 ~',
  'A4 ~ C5 ~ E5 ~ A5 G5', 'F5 ~ E5 ~ D5 ~ C5 ~', 'D5 ~ F5 ~ E5 D5 C5 B4', 'B4 ~ ~ ~ G#4 ~ B4 ~',
];
const MELODY_B = [
  'E5 ~ A5 ~ G5 ~ E5 ~', 'F5 ~ E5 ~ C5 ~ A4 ~', 'E5 ~ G5 ~ C6 ~ B5 G5', 'D5 ~ ~ ~ ~ ~ - -',
  'C5 B4 A4 ~ E5 ~ A4 ~', 'F5 E5 D5 ~ C5 ~ A4 ~', 'D5 ~ E5 ~ F5 ~ G#5 ~', 'B5 ~ ~ ~ G#5 ~ E5 ~',
];
const PROG = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'];

function makeRng(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

function render({ bpm, bars, chords, melody, layers }) {
  const beat = 60 / bpm, step8 = beat / 2, step16 = beat / 4;
  const len = Math.round(bars * 4 * beat * SR);
  const buf = new Float32Array(len);
  const add = (i, v) => { buf[((i % len) + len) % len] += v; };
  const rnd = makeRng(1234);

  // nada bergelombang: 'pulse' (duty) atau 'tri'
  function tone(t0, dur, freq, { wave = 'pulse', duty = 0.5, vol = 0.1, vib = 0, rel = 0.04 } = {}) {
    const start = Math.round(t0 * SR), n = Math.round((dur + rel) * SR);
    let ph = 0;
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      const f = freq * (vib && t > 0.12 ? 1 + vib * Math.sin(2 * Math.PI * 5.5 * t) : 1);
      ph = (ph + f / SR) % 1;
      const s = wave === 'tri' ? 2 * Math.abs(2 * ph - 1) - 1 : (ph < duty ? 1 : -1);
      let env = Math.min(1, t / 0.004);                       // attack
      env *= 0.65 + 0.35 * Math.exp(-t / 0.07);                // decay ke sustain
      if (t > dur) env *= Math.max(0, 1 - (t - dur) / rel);    // release
      add(start + k, s * env * vol);
    }
  }
  function kick(t0, vol = 0.5) {
    const start = Math.round(t0 * SR), n = Math.round(0.16 * SR); let ph = 0;
    for (let k = 0; k < n; k++) { const t = k / SR; const f = 45 + 95 * Math.exp(-t / 0.03); ph += f / SR; add(start + k, Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.06) * vol); }
  }
  function snare(t0, vol = 0.22) {
    const start = Math.round(t0 * SR), n = Math.round(0.14 * SR); let ph = 0;
    for (let k = 0; k < n; k++) { const t = k / SR; ph += 185 / SR; add(start + k, ((rnd() * 2 - 1) * 0.8 + Math.sin(2 * Math.PI * ph) * 0.4) * Math.exp(-t / 0.045) * vol); }
  }
  function hat(t0, vol = 0.07) {
    const start = Math.round(t0 * SR), n = Math.round(0.035 * SR); let prev = 0;
    for (let k = 0; k < n; k++) { const t = k / SR; const x = rnd() * 2 - 1; add(start + k, (x - prev) * 0.5 * Math.exp(-t / 0.01) * vol); prev = x; }
  }

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const ch = CHORDS[chords[bar % chords.length]];
    const root = midi(ch[0] + '2');
    const tones = ch.map((nm) => { let m = midi(nm + '4'); while (m < root + 24) m += 12; return m; });

    if (layers.bass) {
      const pat = layers.bassPattern || [0, 0, 7, 0, 12, 0, 7, 0];
      pat.forEach((iv, s) => { if (iv !== null) tone(t0 + s * step8, step8 * 0.8, hz(root + iv), { wave: 'tri', vol: 0.3, rel: 0.02 }); });
    }
    if (layers.arp) {
      const steps = layers.arpStep === 8 ? 8 : 16, dt = steps === 8 ? step8 : step16;
      const seq = [tones[0], tones[1], tones[2], tones[0] + 12];
      for (let s = 0; s < steps; s++) tone(t0 + s * dt, dt * 0.7, hz(seq[s % 4]), { duty: 0.125, vol: layers.arpVol || 0.05, rel: 0.02 });
    }
    if (layers.drums) {
      for (let s = 0; s < 8; s++) hat(t0 + s * step8, s % 2 ? 0.05 : 0.08);
      kick(t0); kick(t0 + 2 * beat);
      if (bar % 4 === 3) kick(t0 + 3.5 * beat, 0.35);
      snare(t0 + beat); snare(t0 + 3 * beat);
    } else if (layers.softHat) {
      for (let s = 0; s < 4; s++) hat(t0 + s * beat, 0.04);
    }
    if (melody) {
      const steps = melody[bar % melody.length].split(/\s+/);
      for (let s = 0; s < steps.length; s++) {
        const nm = steps[s];
        if (nm === '~' || nm === '-') continue;
        let len8 = 1;
        while (s + len8 < steps.length && steps[s + len8] === '~') len8++;
        const dur = len8 * step8 * (layers.leadSlow ? 2 : 1) * 0.92;
        const at = t0 + s * step8 * (layers.leadSlow ? 2 : 1);
        tone(at, dur, hz(midi(nm) + (layers.leadShift || 0)), { duty: bar >= 8 ? 0.25 : 0.5, vol: layers.leadVol || 0.12, vib: len8 > 1 ? 0.012 : 0 });
        // gema tipis (echo) satu ketukan 3/16 kemudian
        tone(at + step16 * 3, dur * 0.7, hz(midi(nm) + (layers.leadShift || 0)), { duty: 0.25, vol: (layers.leadVol || 0.12) * 0.25 });
      }
    }
  }

  // normalisasi
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const g = 0.89 / (peak || 1);
  for (let i = 0; i < len; i++) buf[i] *= g;
  return buf;
}

function wav(buf) {
  const n = buf.length, out = Buffer.alloc(44 + n * 2);
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * 2, 4); out.write('WAVE', 8);
  out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf[i] * 32767))), 44 + i * 2);
  return out;
}

function encode(name, buf) {
  const tmp = join(tmpdir(), `sandtilt-${name}.wav`);
  writeFileSync(tmp, wav(buf));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', '112k', join(OUT, `${name}.mp3`)]);
  console.log(`${name}.mp3: ${(buf.length / SR).toFixed(3)} dtk (panjang loop)`);
  return buf.length / SR;
}

mkdirSync(OUT, { recursive: true });
const loops = {};
loops.game = encode('game', render({
  bpm: 132, bars: 16, chords: PROG, melody: [...MELODY_A, ...MELODY_B],
  layers: { bass: true, arp: true, drums: true, leadVol: 0.12 },
}));
loops.title = encode('title', render({
  bpm: 96, bars: 8, chords: PROG, melody: MELODY_A.map((b) => b.split(' ').slice(0, 4).join(' ')),
  layers: { bass: true, bassPattern: [0, null, null, null, 7, null, null, null], arp: true, arpStep: 8, arpVol: 0.06, softHat: true, leadSlow: true, leadVol: 0.09, leadShift: -12 },
}));
// panjang loop dipakai audio.js untuk loopEnd yang presisi
writeFileSync(join(OUT, 'loops.json'), JSON.stringify(loops, null, 2) + '\n');
