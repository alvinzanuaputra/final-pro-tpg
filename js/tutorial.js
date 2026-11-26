import { W, H, BLOCK } from './config.js';

// Tutorial interaktif untuk pemain baru (±1 menit). Pemain belajar dengan mencoba langsung:
// setiap langkah menampilkan petunjuk singkat dan baru lanjut setelah aksinya dilakukan.
//   1 GERAK     geser + putar piece yang melayang
//   2 JATUH     jatuhkan piece → hancur jadi pasir
//   3 JEMBATAN  papan disiapkan: jembatan merah berlubang, isi lubangnya dengan piece merah
//   4 MIRING    papan disiapkan: pasir merah belum sampai dinding kanan, tahan miring ke kanan
// Selama tutorial: tanpa event, garis bahaya, naik level, prestasi, dan skor tidak dikirim.

const RED = 1, YELLOW = 2, GREEN = 3;
const BASE_Y = H - 3 * BLOCK;   // 3 baris blok paling bawah: alas bergaris (kuning/hijau)
const LAYER_Y = BASE_Y - BLOCK; // satu baris blok di atas alas: lapisan pelajaran
// Lubang jembatan (langkah 3) dalam butir: dua blok di tengah-kanan.
const GAP_X0 = 48, GAP_X1 = 64;
const FAIL_WAIT = 2.2;          // detik tanpa clear setelah percobaan → papan disiapkan ulang

const STEPS = ['move', 'drop', 'bridge', 'tilt'];

export class Tutorial {
  constructor(game, events, onFinish) {
    this.game = game;
    this.onFinish = onFinish;
    this.active = false;
    const on = (name, fn) => events.on(name, (d) => { if (this.active) fn(d); });
    on('move', () => { this.moved = true; this.check(); });
    on('rotate', () => { this.rotated = true; this.check(); });
    on('land', () => this.onLand());
    on('clear', () => { if (this.key === 'bridge' || this.key === 'tilt') this.succeed(); });
    on('tiltStart', () => { this.tilted = true; });
  }

  get key() { return STEPS[this.step]; }

  start() {
    this.active = true;
    this.retries = 0;
    this.go(0);
  }

  stop() { this.active = false; }

  go(step) {
    this.step = step;
    this.done = false;     // langkah selesai, sedang menampilkan "BAGUS!"
    this.wait = 0;
    this.fail = 0;         // > 0: hitung mundur sebelum papan disiapkan ulang
    this.retry = false;    // tampilkan "COBA LAGI"
    this.moved = this.rotated = this.tilted = false;
    this.setup();
  }

  setup() {
    const g = this.game, r = g.rules;
    r.events = false; r.danger = false; r.level = false;
    g.event = null;
    g.tilt.meter = 1;
    switch (this.key) {
      case 'move':
        this.fill(() => 0);
        r.spawn = true; r.fall = 0;
        g.spawnSpec({ type: 'T', color: YELLOW });
        break;
      case 'drop':
        r.spawn = true; r.fall = 0.5;
        break;
      case 'bridge':
        this.fill((x, y) => (y >= BASE_Y ? stripe(x) : y >= LAYER_Y ? (x >= GAP_X0 && x < GAP_X1 ? GREEN : RED) : 0));
        r.spawn = false; r.fall = 0.55;
        g.spawnSpec({ type: 'I', color: RED });
        break;
      case 'tilt':
        // lapisan merah berhenti 2 blok sebelum dinding kanan; setelah longsor masih ada celah di kanan
        this.fill((x, y) => (y >= BASE_Y ? stripe(x) : y >= LAYER_Y && x < W - 2 * BLOCK ? RED : 0));
        r.spawn = false;
        g.piece = null;
        break;
    }
  }

  // Isi ulang papan: fn(x, y) → warna (0 = kosong). Semua butir pasir biasa.
  fill(fn) {
    const s = this.game.sand, rng = this.game.rng;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        s.cells[i] = fn(x, y);
        s.mat[i] = 0;
        s.shade[i] = (rng() * 4) | 0;
      }
    }
    this.game.clearing = null;
    this.game.chain = 0;
    this.game.dirty = true;
  }

  check() {
    if (this.key === 'move' && this.moved && this.rotated) this.succeed();
  }

  onLand() {
    if (this.key === 'drop') this.succeed();
    // piece merah sudah mendarat: tunggu sebentar, kalau tidak terjadi clear berarti gagal
    else if (this.key === 'bridge') this.fail = FAIL_WAIT;
  }

  succeed() {
    if (this.done) return;
    this.done = true;
    this.fail = 0;
    this.retry = false;
    this.wait = this.key === 'bridge' || this.key === 'tilt' ? 1.6 : 1.0;   // beri waktu melihat clear
    if (this.key === 'move') this.game.rules.fall = 0.5;   // piece yang sama langsung jatuh di langkah berikutnya
  }

  // Dipanggil sekali per tick simulasi.
  update(dt) {
    if (!this.active) return;
    const g = this.game;
    if (this.done) {
      if (g.clearing) return;                 // tunggu kedipan clear selesai
      this.wait -= dt;
      if (this.wait > 0) return;
      if (this.step + 1 < STEPS.length) this.go(this.step + 1);
      else { this.active = false; this.onFinish(); }
      return;
    }
    // Langkah miring gagal: sudah dicoba, meter dilepas cukup lama, tetapi belum ada clear.
    if (this.key === 'tilt' && this.tilted && !g.tilt.active && !g.clearing) {
      this.fail = this.fail > 0 ? this.fail : FAIL_WAIT;
    }
    if (this.fail > 0 && !g.clearing) {
      if (this.key === 'tilt' && g.tilt.active) { this.fail = 0; return; }
      this.fail -= dt;
      if (this.fail <= 0) {
        this.retries++;
        const step = this.step;
        this.go(step);
        this.retry = true;
      }
    }
  }

  // Data untuk renderer (panel samping + penanda di papan).
  view(touch) {
    const k = this.key;
    const T = TEXT[k];
    const v = {
      n: this.step + 1, total: STEPS.length, key: k,
      title: this.done ? 'BAGUS!' : T.title,
      body: this.done ? T.good : this.retry ? `COBA LAGI! ${T.body}` : T.body,
      keys: this.done ? [] : (touch ? T.touch : T.keys) || [],
      good: this.done, retry: this.retry && !this.done,
    };
    if (!this.done && k === 'bridge') v.mark = { walls: true, arrowX: (GAP_X0 + GAP_X1) / 2, arrowY: LAYER_Y - 2 * BLOCK };
    if (!this.done && k === 'tilt') v.mark = { walls: true, push: 1, arrowY: LAYER_Y - 5 };
    return v;
  }
}

// alas bergaris: kuning & hijau bergantian per blok, jadi tidak pernah membentuk jembatan
function stripe(x) { return ((x / BLOCK) | 0) % 2 ? GREEN : YELLOW; }

// Teks per langkah. keys: baris petunjuk tombol (lihat Renderer.keyHints): 'TEKS' | { k } | angka jarak.
const TEXT = {
  move: {
    title: 'GERAK',
    body: 'GESER DAN PUTAR BALOK.',
    keys: [[{ k: 'left' }, { k: 'right' }, 'GESER'], [{ k: 'up' }, 'PUTAR']],
    touch: [[{ k: 'left' }, { k: 'right' }, 'GESER'], [{ k: 'A' }, 'PUTAR']],
    good: 'MUDAH, KAN?',
  },
  drop: {
    title: 'JATUHKAN',
    body: 'BALOK YANG MENDARAT HANCUR JADI PASIR.',
    keys: [[{ k: 'space', w: 25 }, 'JATUH'], [{ k: 'down' }, 'PELAN']],
    touch: [[{ k: 'up' }, 'JATUH'], [{ k: 'down' }, 'PELAN']],
    good: 'JADI PASIR!',
  },
  bridge: {
    title: 'JEMBATAN',
    body: 'SAMBUNG SATU WARNA DARI DINDING KIRI KE KANAN. ISI CELAH DI BAWAH PANAH!',
    good: 'JEMBATAN HILANG = SKOR!',
  },
  tilt: {
    title: 'MIRING',
    body: 'PASIR BELUM SAMPAI DINDING KANAN. TAHAN MIRING KE KANAN!',
    keys: [['TAHAN', { k: 'E' }]],
    touch: [['TAHAN', { k: 'R' }]],
    good: 'MIRING ADA BATASNYA, PAKAI SEPERLUNYA.',
  },
};
