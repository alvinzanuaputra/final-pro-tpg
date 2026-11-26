import { W, H, BLOCK, MAT_STONE, MAT_GUN } from './config.js';

// Tutorial interaktif untuk pemain baru (±1,5 menit). Pemain belajar dengan mencoba langsung:
// setiap langkah menampilkan petunjuk singkat dan baru lanjut setelah aksinya dilakukan.
//   1 GERAK     geser kiri/kanan, putar, putar balik piece yang melayang (semua tombol wajib dicoba)
//   2 JATUH     turun pelan + jatuh instan → piece hancur jadi pasir
//   3 JEMBATAN  papan disiapkan: jembatan merah bercelah, isi celahnya dengan piece merah
//   4 MIRING    papan disiapkan: pasir merah belum sampai dinding kanan, tahan miring ke kanan
//   5 BATU      lubang dalam di antara dua pilar. Game memperagakan balok PASIR rontok ke lubang,
//               lalu pemain menjatuhkan balok BATU: tetap utuh di atas lubang dan jadi jembatan
//   6 MESIU     tumpukan batu yang dialiri mesiu di sebelah celah; jembatan merah di-clear →
//               mesiu menyala → tumpukan batu meledak
// Selama tutorial: tanpa event, garis bahaya, naik level, prestasi, dan skor tidak dikirim.

const RED = 1, YELLOW = 2, GREEN = 3;
const BASE_Y = H - 3 * BLOCK;   // 3 baris blok paling bawah: alas bergaris (kuning/hijau)
const LAYER_Y = BASE_Y - BLOCK; // satu baris blok di atas alas: lapisan pelajaran
// Celah jembatan (langkah 3 & 6) dalam butir: dua blok di tengah-kanan.
const GAP_X0 = 48, GAP_X1 = 64;
// Lubang langkah BATU: dua blok, diapit pilar batu satu blok di kiri & kanan, sedalam papan.
const PIT_X0 = 32, PIT_X1 = 48;
// Tumpukan batu + mesiu langkah MESIU: 4 blok lebar, 4 blok tinggi di kiri.
const MOUND_W = 32, MOUND_H = 4 * BLOCK;
const FAIL_WAIT = 2.2;          // detik tanpa clear setelah percobaan → papan disiapkan ulang

const STEPS = ['move', 'drop', 'bridge', 'tilt', 'stone', 'gun'];
// Langkah yang selesai lewat clear setelah pemain menjatuhkan piece (gagal → coba lagi).
const PLACE_STEPS = new Set(['bridge', 'stone', 'gun']);
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
    on('clear', () => { if (this.key === 'tilt' || (PLACE_STEPS.has(this.key) && this.phase !== 'demo')) this.succeed(); });
    on('tiltStart', (dir) => { this.tilted = true; if (dir > 0) this.use('tiltR'); });
  }

  get key() { return STEPS[this.step]; }

  start() {
    this.active = true;
    this.retries = 0;
    this.go(0);
  }

  stop() { this.active = false; }

  // retry: langkah yang sama disiapkan ulang setelah gagal (peragaan BATU tidak diulang).
  go(step, retry = false) {
    this.step = step;
    this.done = false;     // langkah selesai, sedang menampilkan "BAGUS!"
    this.wait = 0;
    this.fail = 0;         // > 0: hitung mundur sebelum papan disiapkan ulang
    this.retry = retry;    // tampilkan "COBA LAGI"
    this.tilted = false;
    this.used = new Set();  // aksi yang sudah dicoba di langkah ini
    this.phase = '';       // langkah BATU: 'demo' (peragaan pasir) → 'watch' (pasir rontok) → 'try'
    this.timer = 0;
    this.setup();
  }

  setup() {
    const g = this.game, r = g.rules;
    r.events = false; r.danger = false; r.level = false; r.controls = true;
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
        this.fill(bridgeBoard);
        r.spawn = false; r.fall = 0.55;
        g.spawnSpec({ type: 'I', color: RED });
        break;
      case 'tilt':
        // lapisan merah berhenti 2 blok sebelum dinding kanan; setelah longsor masih ada celah di kanan
        this.fill((x, y) => (y >= BASE_Y ? stripe(x) : y >= LAYER_Y && x < W - 2 * BLOCK ? RED : 0));
        r.spawn = false;
        g.piece = null;
        break;
      case 'stone':
        this.fill(pitBoard);
        r.spawn = false;
        if (this.retry) this.startTry();
        else {
          // peragaan: balok PASIR kuning melayang di atas lubang, sebentar lagi dijatuhkan otomatis.
          // Kuning, bukan merah: saat baru mendarat balok masih utuh dan bisa sesaat menyambung jembatan merah.
          this.phase = 'demo';
          this.timer = 1.2;
          r.controls = false; r.fall = 0;
          g.spawnSpec({ type: 'I', color: YELLOW });
        }
        break;
      case 'gun':
        this.fill(moundBoard);
        r.spawn = false; r.fall = 0.55;
        g.spawnSpec({ type: 'I', color: RED });
        break;
    }
  }

  // giliran pemain di langkah BATU: balok batu merah di atas lubang
  startTry() {
    const r = this.game.rules, s = this.game.sand;
    // sisa pasir peragaan di atas pilar dibuang (yang sudah rontok ke lubang tetap terlihat),
    // supaya batu mendarat langsung di pilar dan menyentuh lapisan merah
    for (let i = 0; i < LAYER_Y * W; i++) { s.cells[i] = 0; s.mat[i] = 0; }
    this.game.dirty = true;
    this.phase = 'try';
    r.controls = true; r.fall = 0.55;
    this.game.spawnSpec({ type: 'I', color: RED, mat: MAT_STONE });
  }

  // Isi ulang papan: fn(x, y) → warna (0 = kosong) atau [warna, material].
  fill(fn) {
    const s = this.game.sand, rng = this.game.rng;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const v = fn(x, y);
        s.cells[i] = Array.isArray(v) ? v[0] : v;
        s.mat[i] = Array.isArray(v) ? v[1] : 0;
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
    // peragaan BATU: pasir sudah mendarat, beri waktu melihatnya rontok ke lubang
    else if (this.phase === 'demo') { this.phase = 'watch'; this.timer = 2.2; }
    // piece pemain sudah mendarat: tunggu sebentar, kalau tidak terjadi clear berarti gagal
    else if (PLACE_STEPS.has(this.key)) this.fail = FAIL_WAIT;
  }

  succeed() {
    if (this.done) return;
    this.done = true;
    this.fail = 0;
    this.retry = false;
    this.wait = this.key === 'gun' ? 2.4 : PLACE_STEPS.has(this.key) || this.key === 'tilt' ? 1.8 : 1.0;   // beri waktu melihat clear/ledakan
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
    // peragaan BATU: jatuhkan balok pasir otomatis, lalu tunggu sampai rontok, baru giliran pemain
    if (this.phase === 'demo' && g.piece) {
      this.timer -= dt;
      if (this.timer <= 0) g.hardDrop();
      return;
    }
    if (this.phase === 'watch') {
      this.timer -= dt;
      if (this.timer <= 0) this.startTry();
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
        this.go(this.step, true);
      }
    }
  }

  // Data untuk renderer (panel samping + penanda di papan).
  view(touch) {
    const k = this.key;
    const T = (k === 'stone' && (this.phase === 'demo' || this.phase === 'watch')) ? TEXT[`stone_${this.phase}`] : TEXT[k];
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
    // contoh tekstur material di samping judul
    if (k === 'stone') v.mat = { mat: this.phase === 'try' || this.done ? MAT_STONE : 0, color: RED };
    if (k === 'gun') v.mat = { mat: MAT_GUN, color: YELLOW };
    if (this.done) return v;
    const above = LAYER_Y - 2 * BLOCK;
    if (k === 'bridge') v.mark = { walls: true, arrowX: (GAP_X0 + GAP_X1) / 2, arrowY: above };
    if (k === 'tilt') v.mark = { walls: true, push: 1, arrowY: LAYER_Y - 5 };
    if (k === 'stone') v.mark = { walls: this.phase === 'try', arrowX: (PIT_X0 + PIT_X1) / 2, arrowY: above };
    if (k === 'gun') {
      v.mark = { walls: true, arrowX: (GAP_X0 + GAP_X1) / 2, arrowY: above,
        box: { x: 0, y: LAYER_Y - MOUND_H, w: MOUND_W, h: MOUND_H } };
    }
    return v;
  }
}

// alas bergaris: kuning & hijau bergantian per blok, jadi tidak pernah membentuk jembatan
function stripe(x) { return ((x / BLOCK) | 0) % 2 ? GREEN : YELLOW; }

// Langkah JEMBATAN: alas + lapisan merah dengan celah hijau.
function bridgeBoard(x, y) {
  if (y >= BASE_Y) return stripe(x);
  if (y >= LAYER_Y) return x >= GAP_X0 && x < GAP_X1 ? GREEN : RED;
  return 0;
}

// Langkah BATU: lubang sampai dasar papan, diapit pilar batu hijau (dinding lubang tidak longsor).
function pitBoard(x, y) {
  if (y < LAYER_Y) return 0;
  if (x >= PIT_X0 && x < PIT_X1) return 0;
  if ((x >= PIT_X0 - BLOCK && x < PIT_X0) || (x >= PIT_X1 && x < PIT_X1 + BLOCK)) return [GREEN, MAT_STONE];
  return y >= BASE_Y ? stripe(x) : RED;
}

// Langkah MESIU: papan jembatan + tumpukan batu di kiri. Dasar tumpukan & dua urat vertikal = mesiu
// (kuning), menempel ke lapisan merah → saat merah di-clear, api merambat ke seluruh mesiu dan
// ledakannya (radius 7 butir) menghancurkan hampir seluruh tumpukan batu.
function moundBoard(x, y) {
  const top = LAYER_Y - MOUND_H;
  if (x >= MOUND_W || y < top || y >= LAYER_Y) return bridgeBoard(x, y);
  if (y >= LAYER_Y - BLOCK || (x >= 6 && x < 12) || (x >= 20 && x < 26)) return [YELLOW, MAT_GUN];
  return [((x >> 3) + (y >> 3)) % 2 ? YELLOW : GREEN, MAT_STONE];
}

// Teks per langkah. keys: baris petunjuk tombol (lihat Renderer.keyHints): 'TEKS' | { k, a } | angka jarak.
// a = aksi yang harus dicoba; tombol yang aksinya sudah dicoba digambar pudar.
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
  tilt: {
    title: 'MIRING',
    body: 'PASIR BELUM SAMPAI DINDING KANAN. TAHAN MIRING KE KANAN!',
    keys: [['TAHAN', { k: 'E', a: 'tiltR' }]],
    touch: [['TAHAN', { k: 'R', a: 'tiltR' }]],
    good: 'MIRING ADA BATASNYA, PAKAI SEPERLUNYA.',
  },
  stone_demo: {
    title: 'PASIR...',
    body: 'LIHAT: BALOK PASIR DIJATUHKAN DI ATAS LUBANG.',
  },
  stone_watch: {
    title: 'PASIR...',
    body: 'PASIR RONTOK KE LUBANG. JEMBATAN GAGAL!',
  },
  stone: {
    title: 'BATU',
    body: 'BATU KAKU, TIDAK RONTOK. JATUHKAN DI ATAS LUBANG!',
    good: 'BATU TETAP UTUH DAN JADI JEMBATAN!',
  },
  gun: {
    title: 'MESIU',
    body: 'BINTIK API = MESIU. KENA CLEAR, MELEDAK, BATU PUN HANCUR. ISI CELAHNYA, LALU LIHAT KOTAK KIRI!',
    good: 'BOOM! LEDAKAN = SKOR TAMBAHAN.',
  },
};
