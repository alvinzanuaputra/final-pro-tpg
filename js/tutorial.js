import { W, H, BLOCK, MAT_STONE, MAT_GUN } from './config.js';

// Tutorial interaktif untuk pemain baru (±1 menit). Pemain belajar dengan mencoba langsung:
// setiap langkah menampilkan petunjuk singkat dan baru lanjut setelah aksinya dilakukan.
//   1 GERAK     geser + putar piece yang melayang
//   2 JATUH     jatuhkan piece → hancur jadi pasir
//   3 JEMBATAN  papan disiapkan: jembatan merah berlubang, isi lubangnya dengan piece merah
//   4 MIRING    papan disiapkan: pasir merah belum sampai dinding kanan, tahan miring ke kanan
//   5 MESIU     jembatan berlubang lagi, kali ini piecenya mesiu merah → ikut clear lalu meledak
//   6 BATU      jembatan berlubang, piece batu merah (O) → kaku, tidak longsor, tetap ikut jembatan warnanya
// Selama tutorial: tanpa event, garis bahaya, naik level, prestasi, dan skor tidak dikirim.

const RED = 1, YELLOW = 2, GREEN = 3;
const BASE_Y = H - 3 * BLOCK;   // 3 baris blok paling bawah: alas bergaris (kuning/hijau)
const LAYER_Y = BASE_Y - BLOCK; // satu baris blok di atas alas: lapisan pelajaran
// Lubang jembatan (langkah 3) dalam butir: dua blok di tengah-kanan.
const GAP_X0 = 48, GAP_X1 = 64;
const FAIL_WAIT = 2.2;          // detik tanpa clear setelah percobaan → papan disiapkan ulang

const STEPS = ['move', 'drop', 'bridge', 'tilt', 'gun', 'stone'];
// Langkah dengan papan jembatan berlubang (piece harus menutup celah, gagal → coba lagi).
const GAP_STEPS = { bridge: { type: 'I', mat: 0 }, gun: { type: 'I', mat: MAT_GUN }, stone: { type: 'O', mat: MAT_STONE } };
// Langkah pengenalan tombol: SEMUA tombol ini harus dicoba dulu (tombol yang sudah dipakai ditampilkan pudar).
const REQUIRED = { move: ['left', 'right', 'rotCW', 'rotCCW'], drop: ['soft', 'hard'] };

export class Tutorial {
  constructor(game, events, onFinish) {
    this.game = game;
    this.onFinish = onFinish;
    this.active = false;
    const on = (name, fn) => events.on(name, (d) => { if (this.active) fn(d); });
    on('move', (dx) => this.use(dx < 0 ? 'left' : 'right'));
    on('rotate', (dir) => this.use(dir > 0 ? 'rotCW' : 'rotCCW'));
    on('hardDrop', () => this.use('hard'));
    on('land', () => this.onLand());
    on('clear', () => { if (this.key === 'tilt' || GAP_STEPS[this.key]) this.succeed(); });
    on('tiltStart', (dir) => { this.tilted = true; if (dir > 0) this.use('tiltR'); });
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
    this.tilted = false;
    this.used = new Set();  // aksi yang sudah dicoba di langkah ini
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
      case 'gun':
      case 'stone':
        this.fill((x, y) => (y >= BASE_Y ? stripe(x) : y >= LAYER_Y ? (x >= GAP_X0 && x < GAP_X1 ? GREEN : RED) : 0));
        r.spawn = false; r.fall = 0.55;
        g.spawnSpec({ ...GAP_STEPS[this.key], color: RED });
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

  use(a) {
    if (this.done) return;
    this.used.add(a);
    if (this.key === 'move' && this.allUsed()) this.succeed();
  }

  allUsed() { return (REQUIRED[this.key] || []).every((a) => this.used.has(a)); }

  onLand() {
    // JATUHKAN selesai saat balok mendarat setelah TURUN PELAN dan JATUH sama-sama sudah dicoba
    if (this.key === 'drop' && this.allUsed()) this.succeed();
    // piece merah sudah mendarat: tunggu sebentar, kalau tidak terjadi clear berarti gagal
    else if (GAP_STEPS[this.key]) this.fail = FAIL_WAIT;
  }

  succeed() {
    if (this.done) return;
    this.done = true;
    this.fail = 0;
    this.retry = false;
    this.wait = this.key === 'gun' ? 2.2 : GAP_STEPS[this.key] || this.key === 'tilt' ? 1.6 : 1.0;   // beri waktu melihat clear/ledakan
    if (this.key === 'move') this.game.rules.fall = 0.5;   // piece yang sama langsung jatuh di langkah berikutnya
  }

  // Dipanggil sekali per tick simulasi.
  update(dt) {
    if (!this.active) return;
    const g = this.game;
    if (g.piece && g.piece.softCells > 0) this.used.add('soft');
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
      // tiap tombol diberi tanda done kalau aksinya sudah dicoba; teks baris ikut pudar kalau semua tombolnya done
      keys: this.done ? [] : ((touch ? T.touch : T.keys) || []).map((row) => {
        const parts = row.map((p) => (typeof p === 'object' && p.a ? { ...p, done: this.used.has(p.a) } : p));
        const acts = parts.filter((p) => typeof p === 'object' && p.a);
        return { parts, done: acts.length > 0 && acts.every((p) => p.done) };
      }),
      good: this.done, retry: this.retry && !this.done,
    };
    if (GAP_STEPS[k]) v.mat = { mat: GAP_STEPS[k].mat, color: RED };   // contoh tekstur di panel
    if (!this.done && GAP_STEPS[k]) v.mark = { walls: true, arrowX: (GAP_X0 + GAP_X1) / 2, arrowY: LAYER_Y - 2 * BLOCK };
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
    body: 'COBA SEMUA TOMBOL DI BAWAH.',
    keys: [[{ k: 'left', a: 'left' }, { k: 'right', a: 'right' }, 'GESER'], [{ k: 'up', a: 'rotCW' }, 'PUTAR'], [{ k: 'Z', a: 'rotCCW' }, 'BALIK']],
    touch: [[{ k: 'left', a: 'left' }, { k: 'right', a: 'right' }, 'GESER'], [{ k: 'A', a: 'rotCW' }, 'PUTAR'], [{ k: 'B', a: 'rotCCW' }, 'BALIK']],
    good: 'MUDAH, KAN?',
  },
  drop: {
    title: 'JATUHKAN',
    body: 'COBA TURUN PELAN DAN JATUH CEPAT. BALOK YANG MENDARAT JADI PASIR.',
    keys: [[{ k: 'down', a: 'soft' }, 'PELAN'], [{ k: 'space', w: 25, a: 'hard' }, 'JATUH']],
    touch: [[{ k: 'down', a: 'soft' }, 'PELAN'], [{ k: 'up', a: 'hard' }, 'JATUH']],
    good: 'JADI PASIR!',
  },
  bridge: {
    title: 'JEMBATAN',
    body: 'SAMBUNG SATU WARNA DARI DINDING KIRI KE KANAN. ISI CELAH DI BAWAH PANAH!',
    good: 'JEMBATAN HILANG = SKOR!',
  },
  gun: {
    title: 'MESIU',
    body: 'BALOK BERBINTIK API. KALAU KENA CLEAR, MELEDAK DAN MENGHANCURKAN SEKITARNYA. ISI CELAHNYA!',
    good: 'BOOM! LEDAKAN = SKOR TAMBAHAN.',
  },
  stone: {
    title: 'BATU',
    body: 'BERAT DAN KAKU, TIDAK LONGSOR. HANCUR LEWAT JEMBATAN WARNANYA ATAU LEDAKAN. ISI CELAHNYA!',
    good: 'BATU IKUT HILANG!',
  },
  tilt: {
    title: 'MIRING',
    body: 'PASIR BELUM SAMPAI DINDING KANAN. TAHAN MIRING KE KANAN!',
    keys: [['TAHAN', { k: 'E', a: 'tiltR' }]],
    touch: [['TAHAN', { k: 'R', a: 'tiltR' }]],
    good: 'MIRING ADA BATASNYA, PAKAI SEPERLUNYA.',
  },
};
