/* SandTilt — bundel otomatis dari js/*.js (JANGAN diedit langsung).
   Dibuat oleh: node tools/build-bundle.mjs
   Urutan module: config, util, sim, pieces, game, font, render, input, audio, achievements, leaderboard, tutorial, main */
(function () {
'use strict';
const __mod = {};

// ===================================================================== js/config.js
__mod["config"] = (function () {
// Semua angka yang bisa di-tuning ada di sini (lihat GDD bagian 4.3).

const BLOCK = 8;            // 1 blok tetromino = 8x8 butir
const COLS = 10;            // lebar papan dalam blok
const ROWS = 20;            // tinggi papan dalam blok
const W = COLS * BLOCK;     // 80 butir
const H = ROWS * BLOCK;     // 160 butir

// Material butir. Setiap piece punya warna (1..5) DAN material.
const MAT_SAND = 0;         // Pasir: longsor & ikut tilt
const MAT_STONE = 1;        // Batu: benda kaku. Satu kelompok batu bergerak sebagai satu blok, ikut kemiringan tanah, tidak terdorong gempa
const MAT_GUN = 2;          // Mesiu: seperti pasir, meledak kalau ikut/tersentuh clear

const CFG = {
  // Material (peluang per level ada di levelConfig di bawah)
  BLAST_RADIUS: 7,                 // radius ledakan per butir mesiu (dalam butir)

  TICK_HZ: 60,
  CONNECT_8: true,                 // clear dihitung dengan 8 arah (termasuk diagonal)
  CHECK_EVERY: 6,                  // cek jembatan tiap N tick selama pasir bergerak

  MOVE_STEP: BLOCK,                // geser kiri/kanan per 1 blok
  LOCK_DELAY: 0.2,                 // detik menempel sebelum piece hancur jadi pasir
  LOCK_RESETS: 8,
  SOFT_DROP_SPEED: 120,            // butir per detik saat soft drop

  CLEARS_PER_LEVEL: 5,             // level naik setiap N clear (bukan skor), seperti Tetris "fixed goal"
  FALL_OVERRIDE: 0,                // > 0: kecepatan jatuh tetap (detik/baris) di semua level; dipakai mode uji ?jatuh=
  BREATHER: 30,                    // detik kecepatan diturunkan 1 level saat warna baru masuk

  // Tilt: tahan Q/E selama meter masih ada.
  TILT_CAPACITY: 2.0,              // detik miring dari meter penuh
  TILT_REFILL: 4.0,                // detik untuk mengisi meter dari kosong ke penuh
  TILT_REFILL_DELAY: 0.4,          // jeda sebelum meter mulai terisi setelah dilepas
  TILT_MIN_START: 0.1,             // minimal isi meter untuk mulai miring

  // Event pengganggu
  EVENT_FIRST: [35, 50],           // detik sampai event pertama (acak di rentang ini)
  EVENT_WARN: 3,                   // detik peringatan sebelum event mulai
  QUAKE_DURATION: 1.6,
  QUAKE_JITTER: 0.35,
  QUAKE_SWAPS: 400,                // tukar butir acak per tick saat gempa (mengacak isi tumpukan)
  WIND_DURATION: 5,
  WIND_PUSH_EVERY: 0.45,
  FORCE_DURATION: 5,
  COUNTER_TIME: 1.5,               // detik menahan miring berlawanan saat Papan Miring → prestasi rahasia

  DANGER_Y: 2 * BLOCK,             // pasir di atas garis ini = bahaya
  DANGER_GRACE: 1.5,
  NEAR_MISS: BLOCK,                // prestasi NYARIS: clear saat pasir sampai ≤ 1 blok di bawah garis bahaya (atau lewat)

  CLEAR_FLASH: 0.3,                // durasi kedip + hitstop saat clear
  CLEAR_FLASH_PER_CHAIN: 0.04,
  MAX_CHAIN_MULT: 8,

  DAS: 0.15,
  ARR: 0.05,
};

// ------------------------------------------------------------ kesulitan per level
// Kurva bergerigi (GDD 4.2): tiap level ke-5 adalah level BOSS (event jauh lebih sering,
// kecepatan tidak ikut naik); level sesudahnya LEMBAH (kecepatan turun, event jarang).
// Setelah kecepatan mentok (level 27) yang terus naik pelan hanya event dan batu.
const FALL = [0.8, 0.72, 0.65, 0.58, 0.58, 0.55, 0.5, 0.455, 0.41, 0.41, 0.38, 0.35, 0.32,
  0.29, 0.29, 0.27, 0.25, 0.23, 0.21, 0.21, 0.2, 0.19, 0.18, 0.17, 0.17];   // detik per baris, level 1..25
const FALL_MIN = 0.15;
// Jeda antar event [min, maks] detik untuk level 1..20 (event pertama tetap EVENT_FIRST).
const EVENT_GAPS = [[45, 75], [45, 75], [45, 70], [40, 65], [20, 30], [60, 90], [40, 60], [40, 60], [40, 60],
  [18, 25], [60, 90], [35, 50], [35, 50], [35, 50], [15, 22], [60, 90], [30, 45], [30, 45], [30, 45], [12, 18]];

const isBossLevel = (level) => level % 5 === 0;
const isTroughLevel = (level) => level > 1 && level % 5 === 1;

function colorsForLevel(level) {
  if (level >= 12) return 5;
  if (level >= 4) return 4;
  return 3;
}

// Peluang piece batu (menghambat): mulai level 7, 5% di level 21 lalu +1% tiap 10 level, maks 10%.
function stoneChance(level) {
  if (level >= 21) return Math.min(0.10, 0.05 + Math.floor((level - 21) / 10) * 0.01);
  if (level >= 12) return 0.04;
  if (level >= 7) return 0.03;
  return 0;
}
// Peluang piece mesiu (membantu: ledakannya ikut menghapus pasir & batu).
function gunChance(level) {
  if (level >= 16) return 0.14;
  if (level >= 11) return 0.12;
  if (level >= 6) return 0.10;
  if (level >= 2) return 0.08;
  return 0;
}
function eventGap(level) {
  if (level <= 20) return EVENT_GAPS[level - 1];
  const k = Math.max(0, Math.floor((level - 26) / 5));   // makin rapat tiap 5 level setelah level 25
  const around = (mid, spread) => [mid - spread, mid + spread];
  if (isBossLevel(level)) return around(Math.max(9, 13 - k * 0.5), 3);
  if (isTroughLevel(level)) return around(Math.max(50, 75 - k * 2), 15);
  return around(Math.max(22, 34 - k), 6);
}

// Semua angka kesulitan untuk satu level. Peluang batu/mesiu = peluang NYATA per piece.
function levelConfig(level) {
  level = Math.max(1, Math.floor(level));
  const fall = CFG.FALL_OVERRIDE > 0 ? CFG.FALL_OVERRIDE
    : level <= FALL.length ? FALL[level - 1] : Math.max(FALL_MIN, FALL[FALL.length - 1] - (level - FALL.length) * 0.01);
  return {
    fall, colors: colorsForLevel(level), stone: stoneChance(level), gun: gunChance(level),
    eventGap: eventGap(level), boss: isBossLevel(level), trough: isTroughLevel(level),
  };
}

const STORAGE_PREFIX = 'sandtilt.';

return { BLOCK, COLS, ROWS, W, H, MAT_SAND, MAT_STONE, MAT_GUN, CFG, isBossLevel, isTroughLevel, colorsForLevel, levelConfig, STORAGE_PREFIX };
})();

// ===================================================================== js/util.js
__mod["util"] = (function () {
const { STORAGE_PREFIX } = __mod["config"];

// RNG ber-seed (mulberry32) supaya urutan piece bisa direproduksi.
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Event bus sederhana: logika game memancarkan event, render/audio/achievement mendengarkan.
class Emitter {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, []);
    this.map.get(name).push(fn);
  }
  emit(name, data) {
    const list = this.map.get(name);
    if (list) for (const fn of list) fn(data);
  }
}

// localStorage bisa melempar error (iframe, mode privat), jadi selalu dibungkus.
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* abaikan */ }
  },
};

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

return { makeRng, Emitter, store, clamp };
})();

// ===================================================================== js/sim.js
__mod["sim"] = (function () {
const { W, H, MAT_STONE, MAT_GUN } = __mod["config"];

// Simulasi pasir (cellular automata) + deteksi jembatan kiri-ke-kanan.
// cells[i]: 0 = kosong, 1..5 = id warna.
// mat[i]:   material butir (MAT_SAND / MAT_STONE / MAT_GUN). Setiap warna bisa berupa material apa pun.
// shade[i]: variasi 0..3 untuk tekstur.
class Sand {
  constructor(rng) {
    this.rng = rng;
    this.cells = new Uint8Array(W * H);
    this.mat = new Uint8Array(W * H);
    this.shade = new Uint8Array(W * H);
    this.visited = new Int32Array(W * H);
    this.queue = new Int32Array(W * H);
    this.stamp = 0;
    this.tick = 0;
  }

  reset() {
    this.cells.fill(0);
    this.mat.fill(0);
    this.shade.fill(0);
    this.tick = 0;
  }

  move(i, j) {
    const c = this.cells, m = this.mat, s = this.shade;
    c[j] = c[i]; m[j] = m[i]; s[j] = s[i];
    c[i] = 0; m[i] = 0;
  }

  swap(i, j) {
    const c = this.cells, m = this.mat, s = this.shade;
    let t = c[i]; c[i] = c[j]; c[j] = t;
    t = m[i]; m[i] = m[j]; m[j] = t;
    t = s[i]; s[i] = s[j]; s[j] = t;
  }

  // Batu sebagai benda kaku. Setiap kelompok batu yang saling menyentuh (4 arah) dihitung sebagai satu blok
  // dan bergerak utuh: jatuh lurus; kalau tertahan dan tanah miring, meluncur diagonal lalu ke samping.
  // Blok diproses dari bawah ke atas supaya yang di bawah bergerak lebih dulu. Mengembalikan jumlah blok yang bergerak.
  stepStones(tiltDir) {
    const c = this.cells, m = this.mat, s = this.shade, vis = this.visited, q = this.queue, rng = this.rng;
    const N = W * H;
    const st = ++this.stamp;
    const bodies = [];

    // 1. Kumpulkan kelompok batu (BFS 4 arah, lintas warna).
    for (let i = 0; i < N; i++) {
      if (c[i] === 0 || m[i] !== MAT_STONE || vis[i] === st) continue;
      let head = 0, tail = 1;
      q[0] = i; vis[i] = st;
      while (head < tail) {
        const j = q[head++];
        const x = j % W, y = (j - x) / W;
        for (let d = 0; d < 4; d++) {
          let k;
          if (d === 0) { if (x === 0) continue; k = j - 1; }
          else if (d === 1) { if (x === W - 1) continue; k = j + 1; }
          else if (d === 2) { if (y === 0) continue; k = j - W; }
          else { if (y === H - 1) continue; k = j + W; }
          if (c[k] !== 0 && m[k] === MAT_STONE && vis[k] !== st) { vis[k] = st; q[tail++] = k; }
        }
      }
      let bottom = 0;
      for (let k = 0; k < tail; k++) { const r = (q[k] - (q[k] % W)) / W; if (r > bottom) bottom = r; }
      bodies.push({ cells: q.slice(0, tail), bottom });
    }
    if (bodies.length === 0) return 0;
    bodies.sort((a, b) => b.bottom - a.bottom);

    // 2. Coba geser satu blok utuh. Semua sel tujuan harus kosong atau milik blok itu sendiri.
    const tryMove = (cells, dx, dy) => {
      const bs = ++this.stamp;
      for (let k = 0; k < cells.length; k++) vis[cells[k]] = bs;
      for (let k = 0; k < cells.length; k++) {
        const j = cells[k], x = j % W, y = (j - x) / W;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) return false;
        const t = j + dy * W + dx;
        if (c[t] !== 0 && vis[t] !== bs) return false;
      }
      const n = cells.length;
      const cv = new Uint8Array(n), mv = new Uint8Array(n), sv = new Uint8Array(n);
      for (let k = 0; k < n; k++) {
        const j = cells[k];
        cv[k] = c[j]; mv[k] = m[j]; sv[k] = s[j];
        c[j] = 0; m[j] = 0; s[j] = 0;
      }
      for (let k = 0; k < n; k++) {
        const t = cells[k] + dy * W + dx;
        c[t] = cv[k]; m[t] = mv[k]; s[t] = sv[k];
      }
      return true;
    };

    let moved = 0;
    for (const b of bodies) {
      if (tryMove(b.cells, 0, 1)) { moved++; continue; }
      if (tiltDir !== 0) {
        if (tryMove(b.cells, tiltDir, 1)) { moved++; continue; }
        if (rng() < 0.3 && tryMove(b.cells, tiltDir, 0)) { moved++; continue; }
      }
    }
    return moved;
  }

  // Satu langkah simulasi. tiltDir: -1 kiri, 0 normal, 1 kanan.
  // jitter: peluang butir yang diam bergeser acak ke samping (event gempa). Mengembalikan jumlah butir yang bergerak.
  step(tiltDir, jitter = 0) {
    const c = this.cells, m = this.mat, rng = this.rng;
    this.tick++;
    // Batu bergerak dulu sebagai blok kaku; pasir di sekitarnya dihitung setelahnya.
    let moved = this.stepStones(tiltDir);
    // Saat tilt, scan berlawanan arah tilt supaya butir yang bergeser tidak diproses dua kali.
    const ltr = tiltDir !== 0 ? tiltDir < 0 : (this.tick & 1) === 0;

    for (let y = H - 1; y >= 0; y--) {
      const row = y * W;
      const hasBelow = y < H - 1;
      const below = row + W;
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k;
        const i = row + x;
        // Batu ditangani stepStones; di sini hanya pasir dan mesiu.
        if (c[i] === 0 || m[i] === MAT_STONE) continue;

        // 1. Turun lurus
        if (hasBelow && c[below + x] === 0) { this.move(i, below + x); moved++; continue; }

        if (hasBelow) {
          // 2. Diagonal bawah
          let d1, d2;
          if (tiltDir !== 0) { d1 = tiltDir; d2 = 0; }
          else { d1 = rng() < 0.5 ? -1 : 1; d2 = -d1; }
          let nx = x + d1;
          if (nx >= 0 && nx < W && c[below + nx] === 0) { this.move(i, below + nx); moved++; continue; }
          if (d2 !== 0) {
            nx = x + d2;
            if (nx >= 0 && nx < W && c[below + nx] === 0) { this.move(i, below + nx); moved++; continue; }
          }
        }

        // 3. Saat tilt: meluncur ke samping
        if (tiltDir !== 0) {
          const nx = x + tiltDir;
          if (nx >= 0 && nx < W && c[row + nx] === 0 && rng() < 0.85) { this.move(i, row + nx); moved++; continue; }
        }

        // 4. Gempa: butir di permukaan bergoyang ke samping
        if (jitter > 0 && rng() < jitter) {
          const nx = x + (rng() < 0.5 ? -1 : 1);
          if (nx >= 0 && nx < W && c[row + nx] === 0) { this.move(i, row + nx); moved++; }
        }
      }
    }
    return moved;
  }

  // Gempa: tukar butir acak dengan tetangganya (radius 2), termasuk di dalam tumpukan.
  // Warna di tengah tumpukan teracak, sambungan bisa putus atau terbentuk. Batu tidak ikut.
  quakeMix(swaps) {
    const c = this.cells, m = this.mat, rng = this.rng, N = W * H;
    let done = 0;
    for (let k = 0; k < swaps; k++) {
      const i = (rng() * N) | 0;
      if (c[i] === 0 || m[i] === MAT_STONE) continue;
      const x = i % W, y = (i - x) / W;
      const nx = x + ((rng() * 5) | 0) - 2, ny = y + ((rng() * 5) | 0) - 2;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx;
      if (j === i || m[j] === MAT_STONE || (c[j] !== 0 && c[j] === c[i])) continue;
      this.swap(i, j);
      done++;
    }
    return done;
  }

  // BFS dari setiap butir di kolom paling kiri. Kelompok warna sama yang menyentuh kolom kanan = jembatan.
  // Material tidak berpengaruh: batu merah & mesiu merah ikut menyambung jembatan merah.
  findBridges(connect8) {
    const c = this.cells, vis = this.visited, q = this.queue;
    const st = ++this.stamp;
    const cells = [];
    const colors = [];
    let bridges = 0;

    for (let y = 0; y < H; y++) {
      const start = y * W;
      const col = c[start];
      if (col === 0 || vis[start] === st) continue;

      let head = 0, tail = 0;
      q[tail++] = start; vis[start] = st;
      let touchesRight = false;

      while (head < tail) {
        const i = q[head++];
        const x = i % W, yy = (i - x) / W;
        if (x === W - 1) touchesRight = true;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = yy + dy;
          if (ny < 0 || ny >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (!connect8 && dx !== 0 && dy !== 0) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= W) continue;
            const j = ny * W + nx;
            if (c[j] === col && vis[j] !== st) { vis[j] = st; q[tail++] = j; }
          }
        }
      }

      if (touchesRight) {
        bridges++;
        if (!colors.includes(col)) colors.push(col);
        for (let k = 0; k < tail; k++) cells.push(q[k]);
      }
    }
    return { bridges, cells, colors };
  }

  // Mesiu (warna apa pun) yang ikut di-clear atau bersentuhan dengan butir yang di-clear menyala,
  // api merambat ke semua mesiu yang tersambung, lalu meledak: semua butir dalam radius ikut hancur, termasuk batu.
  // Mengembalikan null kalau tidak ada mesiu yang menyala.
  explode(clearCells, radius) {
    const c = this.cells, m = this.mat, vis = this.visited, q = this.queue;
    let st = ++this.stamp;
    for (let k = 0; k < clearCells.length; k++) vis[clearCells[k]] = st;

    let tail = 0;
    const tryPush = (j) => { if (m[j] === MAT_GUN && c[j] !== 0 && vis[j] !== st) { vis[j] = st; q[tail++] = j; } };
    const spread = (i) => {
      const x = i % W, y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < W) tryPush(ny * W + nx);
        }
      }
    };
    for (let k = 0; k < clearCells.length; k++) {
      const i = clearCells[k];
      if (m[i] === MAT_GUN) q[tail++] = i;
      spread(i);
    }
    if (tail === 0) return null;
    for (let head = 0; head < tail; head++) spread(q[head]);
    const ignited = tail;

    st = ++this.stamp;
    for (let k = 0; k < clearCells.length; k++) vis[clearCells[k]] = st;
    const extra = [];
    const centers = [];
    const r2 = radius * radius;
    const stride = Math.max(1, Math.floor(ignited / 120));
    const every = Math.max(1, Math.floor(ignited / 6));
    for (let k = 0; k < ignited; k += stride) {
      const i = q[k], cx = i % W, cy = (i - cx) / W;
      if (centers.length < 6 && k % every < stride) centers.push([cx, cy]);
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= W) continue;
          const j = ny * W + nx;
          if (c[j] !== 0 && vis[j] !== st) { vis[j] = st; extra.push(j); }
        }
      }
    }
    let stones = 0;
    for (let k = 0; k < extra.length; k++) if (m[extra[k]] === MAT_STONE) stones++;
    for (let k = 0; k < clearCells.length; k++) if (m[clearCells[k]] === MAT_STONE) stones++;
    return { extra, centers, ignited, stones };
  }

  countMat(mt) {
    let n = 0;
    const c = this.cells, m = this.mat;
    for (let i = 0; i < c.length; i++) if (c[i] !== 0 && m[i] === mt) n++;
    return n;
  }

  anyAbove(yLimit) {
    const c = this.cells, end = yLimit * W;
    for (let i = 0; i < end; i++) if (c[i] !== 0) return true;
    return false;
  }

  isEmpty() {
    const c = this.cells;
    for (let i = 0; i < c.length; i++) if (c[i] !== 0) return false;
    return true;
  }

  count() {
    let n = 0;
    const c = this.cells;
    for (let i = 0; i < c.length; i++) if (c[i] !== 0) n++;
    return n;
  }
}


return { Sand };
})();

// ===================================================================== js/pieces.js
__mod["pieces"] = (function () {
// 7 tetromino standar. Koordinat blok di dalam kotak berukuran `size`.
const BASE = {
  I: { size: 4, blocks: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, blocks: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, blocks: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, blocks: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, blocks: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, blocks: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, blocks: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

const TYPES = Object.keys(BASE);

// Rotasi searah jarum jam: (x, y) -> (size-1-y, x). Dihitung sekali di awal.
const SHAPES = {};
for (const t of TYPES) {
  const { size, blocks } = BASE[t];
  const rots = [blocks];
  for (let r = 1; r < 4; r++) {
    rots.push(rots[r - 1].map(([x, y]) => [size - 1 - y, x]));
  }
  SHAPES[t] = { size, rots: t === 'O' ? [blocks, blocks, blocks, blocks] : rots };
}

// Sistem 7-bag: setiap 7 piece pasti berisi ketujuh bentuk.
class Bag {
  constructor(rng) { this.rng = rng; this.items = []; }
  next() {
    if (this.items.length === 0) {
      this.items = TYPES.slice();
      for (let i = this.items.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
      }
    }
    return this.items.pop();
  }
}

return { TYPES, SHAPES, Bag };
})();

// ===================================================================== js/game.js
__mod["game"] = (function () {
const { BLOCK, COLS, W, H, CFG, MAT_SAND, MAT_STONE, MAT_GUN, colorsForLevel, levelConfig } = __mod["config"];
const { makeRng } = __mod["util"];
const { Sand } = __mod["sim"];
const { SHAPES, Bag } = __mod["pieces"];

// Logika game murni: tidak menyentuh canvas, DOM, atau audio.
// Komunikasi ke luar lewat event (this.events.emit).
class Game {
  constructor(events) {
    this.events = events;
    this.reset(1);
  }

  reset(seed) {
    this.seed = seed >>> 0;
    // Aturan yang bisa dimatikan mode tutorial (lihat tutorial.js). Game normal: semua aktif.
    // fall: null = kecepatan level, 0 = piece melayang (tidak jatuh sendiri), > 0 = detik per baris.
    // controls: false = input pemain diabaikan (tutorial sedang memperagakan sesuatu).
    this.rules = { events: true, danger: true, level: true, spawn: true, fall: null, controls: true };
    this.rng = makeRng(this.seed);
    this.sand = new Sand(this.rng);
    this.bag = new Bag(this.rng);

    this.state = 'play';            // 'play' | 'over'
    this.time = 0;
    this.score = 0;
    this.level = 1;
    this.numColors = colorsForLevel(1);
    this.clears = 0;                // jumlah jembatan yang sudah di-clear
    this.chain = 0;
    this.bestChain = 0;
    this.grainsCleared = 0;
    this.piecesPlaced = 0;
    this.breather = 0;
    this.explosions = 0;
    this.lastSpecial = 0;

    this.tilt = { meter: 1, dir: 0, active: false, used: 0, cool: 0 };
    this.prevWant = 0;
    this.lastTiltAt = -99;
    this.buffer = [];               // aksi yang ditekan saat hitstop, diproses setelahnya

    this.event = null;              // { type: 'quake'|'wind'|'force', dir, phase: 'warn'|'active', t }
    this.eventTimer = this.randRange(CFG.EVENT_FIRST);
    this.eventsSurvived = 0;

    this.danger = 0;
    this.clearing = null;
    this.dirty = false;
    this.checkTimer = 0;

    this.piece = null;
    this.next = this.makeSpec();
    this.spawn();
  }

  randRange([a, b]) { return a + this.rng() * (b - a); }

  makeSpec() {
    const type = this.bag.next();
    const color = 1 + Math.floor(this.rng() * this.numColors);
    const roll = this.rng();
    // Material khusus muncul sesekali (tetap punya warna), tidak dua kali berturut-turut.
    // Karena aturan "tidak berturut-turut", peluang undian dinaikkan supaya peluang NYATA per piece
    // sama dengan tabel: kalau target total T, undian p = T / (1 − T).
    const { stone, gun } = levelConfig(this.level);
    const total = stone + gun;
    const k = total > 0 ? 1 / (1 - total) : 0;
    let mat = MAT_SAND;
    if (this.lastSpecial === MAT_SAND) {
      if (roll < gun * k) mat = MAT_GUN;
      else if (roll >= 1 - stone * k) mat = MAT_STONE;
    }
    this.lastSpecial = mat;
    return { type, color, mat };
  }

  // Ruang napas (warna baru masuk): kecepatan memakai level sebelumnya selama CFG.BREATHER detik.
  gravityInterval() {
    if (this.rules.fall) return this.rules.fall;
    return levelConfig(Math.max(1, this.level - (this.breather > 0 ? 1 : 0))).fall;
  }

  blocksOf(p, rot = p.rot) { return SHAPES[p.type].rots[rot]; }

  // Apakah piece di posisi (x, y, rot) menabrak dinding, lantai, atau pasir?
  collides(p, x, y, rot) {
    const c = this.sand.cells;
    for (const [bx, by] of this.blocksOf(p, rot)) {
      const cx = x + bx * BLOCK, cy = y + by * BLOCK;
      if (cx < 0 || cx + BLOCK > W || cy + BLOCK > H) return true;
      for (let yy = Math.max(0, cy); yy < cy + BLOCK; yy++) {
        const row = yy * W;
        for (let xx = cx; xx < cx + BLOCK; xx++) if (c[row + xx] !== 0) return true;
      }
    }
    return false;
  }

  // Munculkan piece tertentu (tutorial), menggantikan piece yang sedang jatuh.
  spawnSpec(spec) {
    this.next = { mat: MAT_SAND, ...spec };
    this.lastSpecial = MAT_SAND;
    this.piece = null;
    this.spawn();
  }

  spawn() {
    const spec = this.next;
    this.next = this.makeSpec();
    const size = SHAPES[spec.type].size;
    this.piece = {
      type: spec.type, color: spec.color, mat: spec.mat, rot: 0,
      x: Math.floor((COLS - size) / 2) * BLOCK,
      y: spec.type === 'I' ? -BLOCK : 0,
      fall: 0, lock: 0, lockResets: 0, softCells: 0,
    };
    if (this.collides(this.piece, this.piece.x, this.piece.y, 0)) {
      this.piece = null;
      this.gameOver('spawn');
    } else {
      this.events.emit('spawn', this.piece);
    }
  }

  // Y terendah yang bisa dicapai piece (untuk ghost & hard drop).
  dropY(p = this.piece) {
    let y = p.y;
    while (!this.collides(p, p.x, y + 1, p.rot)) y++;
    return y;
  }

  tryMove(dx) {
    const p = this.piece;
    if (!p || this.collides(p, p.x + dx, p.y, p.rot)) return false;
    p.x += dx;
    this.touchLock();
    this.events.emit('move', dx);
    return true;
  }

  tryRotate(dir) {
    const p = this.piece;
    if (!p) return false;
    const rot = (p.rot + (dir > 0 ? 1 : 3)) % 4;
    // Wall kick sederhana: geser kiri/kanan/atas sedikit kalau tabrakan.
    const kicks = [[0, 0], [-BLOCK, 0], [BLOCK, 0], [-2 * BLOCK, 0], [2 * BLOCK, 0], [0, -BLOCK / 2], [0, -BLOCK]];
    for (const [kx, ky] of kicks) {
      if (!this.collides(p, p.x + kx, p.y + ky, rot)) {
        p.x += kx; p.y += ky; p.rot = rot;
        this.touchLock();
        this.events.emit('rotate', dir);
        return true;
      }
    }
    return false;
  }

  touchLock() {
    const p = this.piece;
    if (p.lock > 0 && p.lockResets < CFG.LOCK_RESETS) { p.lock = 0; p.lockResets++; }
  }

  hardDrop() {
    const p = this.piece;
    if (!p) return;
    const y = this.dropY();
    const rows = Math.floor((y - p.y) / BLOCK);
    this.score += rows * 2;
    p.y = y;
    this.events.emit('hardDrop', { rows });
    this.lockPiece(true);
  }

  // Tilt pemain: aktif selama Q/E ditahan dan meter masih ada. want: -1 kiri, 0 lepas, 1 kanan.
  updateTilt(dt, want) {
    const t = this.tilt;
    const rising = want !== 0 && want !== this.prevWant;
    this.prevWant = want;
    if (rising) this.events.emit('tiltAttempt', want);

    const canRun = t.active ? t.meter > 0 : t.meter >= CFG.TILT_MIN_START;
    if (want !== 0 && canRun) {
      if (!t.active || t.dir !== want) {
        t.active = true;
        t.dir = want;
        t.used++;
        this.events.emit('tiltStart', want);
      }
      t.meter = Math.max(0, t.meter - dt / CFG.TILT_CAPACITY);
      t.cool = CFG.TILT_REFILL_DELAY;
      this.lastTiltAt = this.time;
      this.dirty = true;
      if (t.meter <= 0) { t.active = false; this.events.emit('tiltEnd', { empty: true }); }
      return;
    }
    if (t.active) { t.active = false; this.events.emit('tiltEnd', { empty: false }); }
    if (rising) this.events.emit('tiltFail');
    if (want === 0) {
      if (t.cool > 0) t.cool -= dt;
      else t.meter = Math.min(1, t.meter + dt / CFG.TILT_REFILL);
    }
  }

  // Arah miring efektif: tilt pemain digabung event "miring paksa". Melawan arah = saling meniadakan.
  effectiveTilt() {
    const p = this.tilt.active ? this.tilt.dir : 0;
    const e = this.event;
    const f = e && e.phase === 'active' && e.type === 'force' ? e.dir : 0;
    if (f !== 0 && p === -f) return 0;
    return f || p;
  }

  // Event pengganggu: peringatan dulu, lalu aktif beberapa detik.
  updateEvent(dt) {
    if (!this.rules.events) return;
    if (!this.event) {
      this.eventTimer -= dt;
      if (this.eventTimer > 0) return;
      const types = ['quake', 'wind', 'force'];
      const type = types[Math.floor(this.rng() * types.length)];
      this.event = { type, dir: this.rng() < 0.5 ? -1 : 1, phase: 'warn', t: CFG.EVENT_WARN, push: 0 };
      this.events.emit('eventWarn', this.event);
      return;
    }
    const e = this.event;
    e.t -= dt;
    if (e.phase === 'warn') {
      if (e.t <= 0) {
        e.phase = 'active';
        e.t = e.type === 'quake' ? CFG.QUAKE_DURATION : e.type === 'wind' ? CFG.WIND_DURATION : CFG.FORCE_DURATION;
        this.dirty = true;
        this.events.emit('eventStart', e);
      }
      return;
    }
    if (e.type === 'wind' && this.piece) {
      e.push += dt;
      if (e.push >= CFG.WIND_PUSH_EVERY) {
        e.push = 0;
        const p = this.piece;
        if (!this.collides(p, p.x + e.dir * CFG.MOVE_STEP, p.y, p.rot)) { p.x += e.dir * CFG.MOVE_STEP; this.events.emit('windPush', e.dir); }
      }
    }
    if (e.t <= 0) {
      this.events.emit('eventEnd', e);
      this.event = null;
      this.eventsSurvived++;
      this.eventTimer = this.randRange(levelConfig(this.level).eventGap);
    }
  }

  // Piece hancur jadi pasir.
  lockPiece(hard = false) {
    const p = this.piece;
    const c = this.sand.cells, s = this.sand.shade, m = this.sand.mat;
    let outOfTop = false;
    for (const [bx, by] of this.blocksOf(p)) {
      const cx = p.x + bx * BLOCK, cy = p.y + by * BLOCK;
      for (let yy = cy; yy < cy + BLOCK; yy++) {
        if (yy < 0) { outOfTop = true; continue; }
        const row = yy * W;
        for (let xx = cx; xx < cx + BLOCK; xx++) {
          c[row + xx] = p.color;
          m[row + xx] = p.mat;
          s[row + xx] = (this.rng() * 4) | 0;
        }
      }
    }
    this.score += Math.floor(p.softCells / BLOCK);
    this.piecesPlaced++;
    this.dirty = true;
    this.events.emit('land', { x: p.x, y: p.y, color: p.color, mat: p.mat, hard });
    this.piece = null;
    if (outOfTop) { this.gameOver('lockout'); return; }
    if (this.rules.spawn) this.spawn();
  }

  startClear(res) {
    // Mesiu yang tersentuh clear ikut meledak.
    const blast = this.sand.explode(res.cells, CFG.BLAST_RADIUS);
    if (blast) {
      if (blast.extra.length) res = { ...res, cells: res.cells.concat(blast.extra) };
      this.explosions++;
      this.events.emit('explode', { centers: blast.centers, grains: blast.extra.length, stones: blast.stones });
    }
    this.chain++;
    this.bestChain = Math.max(this.bestChain, this.chain);
    const grains = res.cells.length;
    const mLevel = 1 + 0.1 * (this.level - 1);
    const mChain = Math.min(this.chain, CFG.MAX_CHAIN_MULT);
    const mMulti = 1 + 0.5 * (res.bridges - 1);
    const points = Math.round(grains * mLevel * mChain * mMulti);
    this.score += points;
    this.grainsCleared += grains;
    this.clears += res.bridges;

    const dur = CFG.CLEAR_FLASH + CFG.CLEAR_FLASH_PER_CHAIN * (this.chain - 1);
    this.clearing = { cells: res.cells, t: dur, t0: dur };
    this.events.emit('clear', {
      points, grains, chain: this.chain, bridges: res.bridges, colors: res.colors,
      cells: res.cells, inDanger: this.sand.anyAbove(CFG.DANGER_Y + CFG.NEAR_MISS),
      sinceTilt: this.time - this.lastTiltAt,
    });

    const newLevel = 1 + Math.floor(this.clears / CFG.CLEARS_PER_LEVEL);
    if (newLevel > this.level && this.rules.level) {
      this.level = newLevel;
      const lc = levelConfig(newLevel);
      if (lc.colors > this.numColors) { this.numColors = lc.colors; this.breather = CFG.BREATHER; }
      // Hitung mundur event ikut jeda level baru: level boss langsung lebih rapat,
      // level lembah langsung lebih longgar (event yang sedang berjalan tidak diganggu).
      if (!this.event) {
        const next = this.randRange(lc.eventGap);
        if (lc.boss) this.eventTimer = Math.min(this.eventTimer, next);
        else if (lc.trough) this.eventTimer = Math.max(this.eventTimer, next);
      }
      this.events.emit('levelUp', { level: this.level, colors: this.numColors, boss: lc.boss, tiltsUsed: this.tilt.used });
    }
  }

  finishClear() {
    const c = this.sand.cells;
    const cl = this.clearing;
    // Simpan warna dulu supaya renderer bisa membuat partikel berwarna.
    const m = this.sand.mat;
    const colors = new Uint8Array(cl.cells.length);
    for (let k = 0; k < cl.cells.length; k++) {
      const i = cl.cells[k];
      colors[k] = c[i]; c[i] = 0; m[i] = 0;
    }
    this.clearing = null;
    this.dirty = true;
    this.events.emit('cleared', { cells: cl.cells, colors });
    if (this.sand.isEmpty()) this.events.emit('boardClear');
  }

  gameOver(reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.events.emit('gameOver', this.stats(reason));
  }

  stats(reason = '') {
    return {
      reason, score: this.score, level: this.level, clears: this.clears,
      bestChain: this.bestChain, grains: this.grainsCleared,
      pieces: this.piecesPlaced, duration: Math.round(this.time), seed: this.seed, explosions: this.explosions,
    };
  }

  // Satu tick simulasi (dt tetap = 1/60). input: { actions: string[], soft: boolean }
  update(dt, input) {
    if (this.state !== 'play') return;
    this.time += dt;

    if (this.breather > 0) this.breather -= dt;

    // Hitstop: selama kedip clear, piece & pasir berhenti.
    // Tombol yang ditekan disimpan dulu supaya tidak hilang.
    if (this.clearing) {
      if (input.actions.length) this.buffer.push(...input.actions);
      if (this.buffer.length > 8) this.buffer.splice(0, this.buffer.length - 8);
      this.clearing.t -= dt;
      if (this.clearing.t <= 0) this.finishClear();
      return;
    }

    let actions = input.actions;
    if (this.buffer.length) { actions = this.buffer.concat(actions); this.buffer = []; }
    if (!this.rules.controls) { actions = []; input = { actions, soft: false, tilt: 0 }; }

    this.updateTilt(dt, input.tilt || 0);
    this.updateEvent(dt);
    // Melawan Papan Miring: tahan tilt ke arah sebaliknya cukup lama → event 'counterForce' (prestasi rahasia).
    const ev = this.event;
    if (ev && ev.phase === 'active' && ev.type === 'force' && !ev.countered
        && this.tilt.active && this.tilt.dir === -ev.dir) {
      ev.counter = (ev.counter || 0) + dt;
      if (ev.counter >= CFG.COUNTER_TIME) { ev.countered = true; this.events.emit('counterForce'); }
    }

    for (const a of actions) {
      if (this.state !== 'play' || !this.piece) break;
      switch (a) {
        case 'left': this.tryMove(-CFG.MOVE_STEP); break;
        case 'right': this.tryMove(CFG.MOVE_STEP); break;
        case 'rotCW': this.tryRotate(1); break;
        case 'rotCCW': this.tryRotate(-1); break;
        case 'hardDrop': this.hardDrop(); break;
      }
    }
    if (this.state !== 'play') return;

    // Gravitasi piece
    const p = this.piece;
    if (p) {
      const normal = BLOCK / this.gravityInterval();
      const speed = input.soft ? Math.max(normal, CFG.SOFT_DROP_SPEED) : normal;
      // fall 0 (tutorial): piece melayang sampai pemain menurunkannya sendiri
      if (this.rules.fall !== 0 || input.soft) p.fall += speed * dt;
      while (p.fall >= 1) {
        p.fall -= 1;
        if (!this.collides(p, p.x, p.y + 1, p.rot)) {
          p.y++;
          if (input.soft) p.softCells++;
        } else { p.fall = 0; break; }
      }
      if (this.collides(p, p.x, p.y + 1, p.rot)) {
        p.lock += dt;
        if (p.lock >= CFG.LOCK_DELAY) this.lockPiece();
      } else p.lock = 0;
      if (this.state !== 'play') return;
    }

    // Simulasi pasir
    const e = this.event;
    const quaking = e && e.phase === 'active' && e.type === 'quake';
    const jitter = quaking ? CFG.QUAKE_JITTER : 0;
    if (quaking && this.sand.quakeMix(CFG.QUAKE_SWAPS) > 0) this.dirty = true;
    const moved = this.sand.step(this.effectiveTilt(), jitter);
    if (moved > 0) this.dirty = true;

    // Cek jembatan
    this.checkTimer++;
    if (this.dirty && (this.checkTimer >= CFG.CHECK_EVERY || moved === 0)) {
      this.checkTimer = 0;
      this.dirty = false;
      const res = this.sand.findBridges(CFG.CONNECT_8);
      if (res.bridges > 0) { this.startClear(res); return; }
    }
    // Pasir sudah diam dan tidak ada clear lagi → rangkaian chain selesai.
    if (!this.dirty && moved === 0 && this.chain > 0) {
      this.events.emit('chainEnd', this.chain);
      this.chain = 0;
    }

    // Garis bahaya
    if (this.rules.danger && this.sand.anyAbove(CFG.DANGER_Y)) {
      this.danger += dt;
      if (this.danger >= CFG.DANGER_GRACE) this.gameOver('danger');
    } else this.danger = 0;
  }
}

return { Game };
})();

// ===================================================================== js/font.js
__mod["font"] = (function () {
// Dua bitmap font buatan sendiri (tanpa file font eksternal):
// - BLOCK 3x5: huruf kotak besar, hanya untuk logo.
// - TEXT 5x7: teks UI, digambar langsung di resolusi layar supaya lebih kecil & mudah dibaca.

function compile(glyphs, w) {
  const out = {};
  for (const [ch, rows] of Object.entries(glyphs)) {
    const bits = rows.replace(/ /g, '');
    const pts = [];
    for (let i = 0; i < bits.length; i++) if (bits[i] === '1') pts.push(i % w, (i / w) | 0);
    out[ch] = pts;
  }
  return out;
}

// ---------------------------------------------------------------- 3x5
const BLOCK = compile({
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  ' ': '000000000000000',
}, 3);

function drawBlockText(ctx, str, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  str = String(str).toUpperCase();
  for (let n = 0; n < str.length; n++) {
    const pts = BLOCK[str[n]] || BLOCK[' '];
    const ox = x + n * 4 * scale;
    for (let k = 0; k < pts.length; k += 2) ctx.fillRect(ox + pts[k] * scale, y + pts[k + 1] * scale, scale, scale);
  }
}
function blockTextWidth(str, scale = 1) { return (str.length * 4 - 1) * scale; }

// ---------------------------------------------------------------- 5x7
const TEXT = compile({
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111', 3: '11111 00010 00100 00010 00001 10001 01110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000', '.': '00000 00000 00000 00000 00000 01100 01100',
  ',': '00000 00000 00000 00000 01100 00100 01000', ':': '00000 01100 01100 00000 01100 01100 00000',
  '!': '00100 00100 00100 00100 00100 00000 00100', '?': '01110 10001 00001 00010 00100 00000 00100',
  '-': '00000 00000 00000 11111 00000 00000 00000', '+': '00000 00100 00100 11111 00100 00100 00000',
  '/': '00001 00010 00010 00100 01000 01000 10000', '#': '01010 01010 11111 01010 11111 01010 01010',
  '(': '00010 00100 01000 01000 01000 00100 00010', ')': '01000 00100 00010 00010 00010 00100 01000',
  "'": '00100 00100 01000 00000 00000 00000 00000', '%': '11001 11010 00010 00100 01000 01011 10011',
  '>': '01000 00100 00010 00001 00010 00100 01000', '<': '00010 00100 01000 10000 01000 00100 00010',
  '_': '00000 00000 00000 00000 00000 00000 11111', '=': '00000 00000 11111 00000 11111 00000 00000',
  '^': '00100 01010 10001 00000 00000 00000 00000', '~': '00000 00000 01000 10101 00010 00000 00000',
}, 5);

const GLYPH_W = 5, GLYPH_H = 7, ADVANCE = 6;

function textWidthPx(str, px) { return str.length === 0 ? 0 : (str.length * ADVANCE - 1) * px; }

// Gambar teks 5x7. x, y dalam piksel layar; px = ukuran satu titik glyph.
function drawText(ctx, str, x, y, color, px, align = 'left') {
  str = String(str).toUpperCase();
  if (align === 'center') x -= Math.floor(textWidthPx(str, px) / 2);
  else if (align === 'right') x -= textWidthPx(str, px);
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = color;
  for (let n = 0; n < str.length; n++) {
    const pts = TEXT[str[n]] || TEXT['?'];
    const ox = x + n * ADVANCE * px;
    for (let k = 0; k < pts.length; k += 2) ctx.fillRect(ox + pts[k] * px, y + pts[k + 1] * px, px, px);
  }
}

return { drawBlockText, blockTextWidth, GLYPH_W, GLYPH_H, ADVANCE, textWidthPx, drawText };
})();

// ===================================================================== js/render.js
__mod["render"] = (function () {
const { W, H, BLOCK, CFG, MAT_STONE, MAT_GUN, isBossLevel } = __mod["config"];
const { SHAPES } = __mod["pieces"];
const { drawText, textWidthPx, drawBlockText, blockTextWidth } = __mod["font"];

// Gambar pixel art (papan, pasir, kotak UI) di kanvas kecil 160x176 lalu diperbesar dengan skala bulat.
// Teks digambar terpisah langsung di resolusi layar dengan font 5x7 → lebih kecil & mudah dibaca.
const LW = 160, LH = 176;
const BX = 6, BY = 10;   // posisi papan
const PX = 94;           // posisi panel samping

const PALETTES = {
  default: {
    bg: '#14121f', boardA: '#1b192b', boardB: '#1f1c31', frame: '#4a4470', text: '#ece8f5',
    dim: '#8a84a8', accent: '#f2c14e', danger: '#ff4d5e', shadow: '#0b0a12',
    sand: ['#e8505b', '#f2c14e', '#3fbf8f', '#4c8bf5', '#b45ce0'],
    speck: '#ffb04a',                                    // bintik mesiu
    boss: '#ff4d5e',                                     // angka LEVEL saat level boss
  },
  retro: {
    bg: '#0d170d', boardA: '#132213', boardB: '#162716', frame: '#3f6f3f', text: '#c8f5b0',
    dim: '#5f9a5a', accent: '#e8ff9a', danger: '#f0ff70', shadow: '#081008',
    sand: ['#f0ffd8', '#a9e47c', '#6fbd4f', '#3f8a32', '#d2d36a'],
    speck: '#ffff9a', boss: '#ff8a5c',
  },
  // ---- tema tambahan (gratis / hadiah prestasi, lihat THEMES di main.js) ----
  senja: {
    bg: '#1e1220', boardA: '#2a1826', boardB: '#2f1b2b', frame: '#7a4a5e', text: '#ffe9d6',
    dim: '#c08a8a', accent: '#ffb347', danger: '#ff4d4d', shadow: '#120a12',
    sand: ['#ff6b5a', '#ffc15e', '#e8dcae', '#5fb8a8', '#9a6fd0'],
    speck: '#fff0a0', overlay: '18,10,16', boss: '#ff4d6d',
  },
  neon: {
    bg: '#05050a', boardA: '#0a0a14', boardB: '#0d0d1a', frame: '#2f2f5a', text: '#f0f6ff',
    dim: '#7a86b8', accent: '#39ff88', danger: '#ff2e6e', shadow: '#000000',
    sand: ['#ff3ea5', '#ffe53b', '#39ff88', '#2ee6ff', '#a46bff'],
    speck: '#ffffff', overlay: '0,0,4', boss: '#ff2e6e',
  },
  kertas: {   // tema terang
    bg: '#efe6d2', boardA: '#e6dcc4', boardB: '#e0d5ba', frame: '#a8977a', text: '#3b3046',
    dim: '#7d6f82', accent: '#d9573b', danger: '#c8283c', shadow: '#fbf6ea',
    sand: ['#e0685a', '#e8b04a', '#5aa77f', '#5a86c8', '#9a72c2'],
    speck: '#5a3a1a', overlay: '239,230,210', boss: '#2456c8',   // biru: aksen tema ini sudah merah
  },
  kontras: {  // warna Okabe-Ito: tetap bisa dibedakan oleh penderita buta warna
    bg: '#000000', boardA: '#0b0b0b', boardB: '#141414', frame: '#5a5a5a', text: '#ffffff',
    dim: '#b4b4b4', accent: '#ffd400', danger: '#ff3030', shadow: '#000000',
    sand: ['#d55e00', '#f0e442', '#009e73', '#56b4e9', '#cc79a7'],
    speck: '#ffffff', overlay: '0,0,0', boss: '#ff3030',
  },
};

const SHADES = [1.12, 1.0, 0.91, 0.82];
// warna garis tepi kartu prestasi per tingkat trofi (emas memakai warna aksen palet)
const TIER_COLOR = { bronze: '#d08a4c', silver: '#c9cbe0', secret: '#b45ce0' };
// panah pixel 5x5 untuk tombol keyboard di petunjuk kontrol
const KEY_ARROWS = {
  left: ['..#..', '.#...', '#####', '.#...', '..#..'],
  right: ['..#..', '...#.', '#####', '...#.', '..#..'],
  up: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  down: ['..#..', '..#..', '#.#.#', '.###.', '..#..'],
  // simbol spasi ␣ (dipusatkan di tombol panjang)
  space: ['.....', '.....', '#.......#', '#.......#', '#########'],
};
const EVENT_NAMES = { quake: 'GEMPA', wind: 'ANGIN', force: 'PAPAN MIRING' };

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function scaleRgb([r, g, b], f) {
  return [Math.min(255, Math.round(r * f)), Math.min(255, Math.round(g * f)), Math.min(255, Math.round(b * f))];
}
function pack([r, g, b]) { return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; } // ABGR little-endian
function css([r, g, b]) { return `rgb(${r},${g},${b})`; }

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

class Renderer {
  constructor(canvas, events) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    [this.low, this.lctx] = makeCanvas(LW, LH);
    [this.boardCanvas, this.bctx] = makeCanvas(W, H);
    this.img = this.bctx.createImageData(W, H);
    this.pix = new Uint32Array(this.img.data.buffer);

    this.scale = 1;
    this.k = 1;          // piksel layar per piksel logis
    this.tp = 1;         // ukuran titik glyph teks dalam piksel layar
    this.texts = [];
    this.ox = 0; this.oy = 0;

    this.time = 0;
    this.angle = 0;
    this.shake = 0;
    this.flash = 0;
    this.particles = [];
    this.floats = [];
    this.rain = [];
    this.streaks = [];
    this.buttons = [];
    this.toast = null;
    this.setPalette('default');
    this.listen(events);
  }

  setPalette(name) {
    this.paletteName = PALETTES[name] ? name : 'default';
    const P = this.pal = PALETTES[this.paletteName];
    this.sandPix = new Uint32Array(6 * 4);
    this.sandCss = [];
    // tex[c]: warna siap pakai per material, masing-masing { p: packed untuk ImageData, s: string CSS }
    this.tex = [];
    const mk = (rgb) => ({ p: pack(rgb), s: css(rgb) });
    for (let c = 1; c <= 5; c++) {
      const base = hexToRgb(P.sand[c - 1]);
      this.sandCss[c] = [];
      for (let s = 0; s < 4; s++) {
        const rgb = scaleRgb(base, SHADES[s]);
        this.sandPix[c * 4 + s] = pack(rgb);
        this.sandCss[c][s] = css(rgb);
      }
      const sc = (f) => mk(scaleRgb(base, f));
      this.tex[c] = {
        piece: { base: mk(base), light: sc(1.35), dark: sc(0.62), ghost: sc(0.42) },
        // batu: warna lebih gelap & padat, dengan retakan
        stone: { light: sc(1.0), base: sc(0.72), base2: sc(0.62), dark: sc(0.38), crack: sc(0.5) },
        // mesiu: warna sangat gelap dengan bintik api
        gun: [sc(0.52), sc(0.45), sc(0.38)],
      };
    }
    this.speck = mk(hexToRgb(P.speck));
    this.bgA = pack(hexToRgb(P.boardA));
    this.bgB = pack(hexToRgb(P.boardB));
    this.white = pack([255, 255, 255]);
  }

  listen(ev) {
    ev.on('land', (d) => { this.shake = Math.max(this.shake, d.hard ? 2.5 : 1); this.dust(d); });
    ev.on('clear', (d) => {
      this.flash = 0.12 + 0.03 * Math.min(d.chain, 5);
      this.shake = Math.max(this.shake, Math.min(6, 1.5 + d.grains / 250 + d.chain * 0.5));
      let sx = 0, sy = 0, n = 0;
      for (let k = 0; k < d.cells.length; k += 7) { sx += d.cells[k] % W; sy += (d.cells[k] / W) | 0; n++; }
      const cx = BX + sx / n, cy = BY + sy / n;
      this.addFloat(`+${d.points}`, cx, cy, this.pal.text);
      if (d.chain > 1) this.addFloat(`CHAIN X${d.chain}!`, cx, cy + 7, this.pal.accent);
    });
    ev.on('cleared', (d) => this.burst(d.cells, d.colors));
    ev.on('levelUp', (d) => this.addFloat(`LEVEL ${d.level}!`, BX + W / 2, BY + 50, d.boss ? this.pal.boss : this.pal.accent, 1.6));
    ev.on('gameOver', () => { this.shake = 6; });
    ev.on('quake', () => { this.shake = 10; });
    ev.on('eventStart', (e) => { if (e.type === 'quake') this.shake = 6; });
    ev.on('explode', (d) => {
      this.shake = Math.max(this.shake, 8);
      this.flash = 0.3;
      for (const [x, y] of d.centers) {
        for (let n = 0; n < 24; n++) {
          const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 70, life = 0.3 + Math.random() * 0.4;
          this.particles.push({ x: BX + x, y: BY + y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 40,
            life, max: life, color: Math.random() < 0.5 ? '#ffb347' : '#ff5a36', white: true });
        }
      }
      const [cx, cy] = d.centers[0] || [W / 2, H / 2];
      this.addFloat(d.stones > 0 ? 'BATU HANCUR!' : 'LEDAKAN!', BX + cx, BY + cy - 10, '#ffb347', 1.2);
    });
  }

  // ---------- efek ----------
  dust({ x, y, color }) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: BX + x + Math.random() * 24, y: BY + y + 16 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 20, life: 0.3, max: 0.3,
        color: this.sandCss[color][1], g: 60,
      });
    }
  }

  burst(cells, colors) {
    const step = Math.max(1, Math.floor(cells.length / 220));
    for (let k = 0; k < cells.length; k += step) {
      const i = cells[k];
      const life = 0.4 + Math.random() * 0.5;
      this.particles.push({
        x: BX + (i % W), y: BY + ((i / W) | 0),
        vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 50,
        life, max: life, color: this.sandCss[colors[k]]?.[0] || '#fff', g: 120, white: true,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  addFloat(text, x, y, color, life = 1) { this.floats.push({ text, x, y, color, t: 0, life }); }

  // icon: tier trofi (bronze/silver/gold/secret) atau null
  showToast(title, name, icon = null) { this.toast = { title, name, icon, t: 0 }; }

  // Ikon trofi pixel art 12x11 dari assets/image (dimuat sekali).
  drawTrophy(ctx, tier, x, y) {
    if (!this.icons) {
      this.icons = {};
      for (const t of ['bronze', 'silver', 'gold', 'secret', 'locked']) {
        const img = new Image();
        img.src = `assets/image/trophy-${t}.svg`;
        this.icons[t] = img;
      }
    }
    const img = this.icons[tier] || this.icons.locked;
    if (img.complete && img.naturalWidth) ctx.drawImage(img, Math.round(x), Math.round(y), 12, 11);
    else { ctx.fillStyle = this.pal.accent; ctx.fillRect(Math.round(x) + 2, Math.round(y) + 1, 8, 8); }
  }

  // Tekstur satu titik di dalam blok n×n (dipakai piece jatuh, preview NEXT).
  texel(mat, c, lx, ly, n, salt = 0) {
    const T = this.tex[c], e = n - 1;
    if (mat === MAT_STONE) {
      if (lx === 0 || ly === 0) return T.stone.light;
      if (lx === e || ly === e) return T.stone.dark;
      if (n > 5 && (lx === 1 || ly === 1 || lx === e - 1 || ly === e - 1)) return T.stone.base2;
      return (lx + ly * 3 + salt) % 5 === 0 ? T.stone.crack : T.stone.base;
    }
    if (mat === MAT_GUN) {
      if (lx === 0 || ly === 0) return T.piece.base;
      if (lx === e || ly === e) return T.piece.dark;
      return (lx * 3 + ly * 5 + salt) % (n > 5 ? 7 : 4) === 0 ? this.speck : T.gun[(lx + ly) % 3];
    }
    if (lx === 0 || ly === 0) return T.piece.light;
    if (lx === e || ly === e) return T.piece.dark;
    return T.piece.base;
  }

  // ---------- ukuran ----------
  resize(availW, availH) {
    // Skala bulat dalam piksel PERANGKAT (bukan CSS), jadi di HP dpr 3 layar bisa memenuhi slot tanpa blur.
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((availW * dpr) / LW, (availH * dpr) / LH);
    const k = Math.max(1, Math.floor(fit));
    this.canvas.width = LW * k;
    this.canvas.height = LH * k;
    // Layar padat (HP, retina): kanvas boleh diperbesar sedikit lagi oleh CSS supaya memenuhi slot;
    // selisih ukuran piksel di layar seperti itu tidak terlihat. Layar biasa tetap skala bulat.
    const shown = dpr >= 2 ? Math.max(k, fit) : k;
    this.canvas.style.width = (LW * shown) / dpr + 'px';
    this.canvas.style.height = (LH * shown) / dpr + 'px';
    this.ctx.imageSmoothingEnabled = false;
    this.scale = k / dpr;
    this.k = k;
    // ukuran titik teks: sekitar setengah piksel papan, maksimal 4 piksel logis per huruf
    this.tp = Math.max(1, Math.min(Math.round(k * 0.6), Math.floor((k * 4) / 6)));
  }

  hit(lx, ly) {
    for (let k = this.buttons.length - 1; k >= 0; k--) {
      const b = this.buttons[k];
      if (lx >= b.x && lx < b.x + b.w && ly >= b.y && ly < b.y + b.h) return b.id;
    }
    return null;
  }

  // ---------- teks (dikumpulkan dulu, digambar terakhir di resolusi layar) ----------
  txt(str, x, y, color, size = 1, align = 'left', shadow = true) {
    this.texts.push({ str: String(str), x: x + this.ox, y: y + this.oy, color, px: this.px(size), align, alpha: 1, shadow, clip: this.clipRect });
  }
  // Pecah teks per kata supaya lebarnya <= maxW (piksel logis).
  wrap(str, maxW, size = 1) {
    const lines = [];
    let cur = '';
    for (const word of String(str).split(' ')) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && this.tw(next, size) > maxW) { lines.push(cur); cur = word; } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  // ukuran titik glyph (piksel layar); size boleh pecahan untuk mengecilkan teks yang kepanjangan
  px(size = 1) { return Math.max(1, Math.floor(this.tp * size)); }
  tw(str, size = 1) { return textWidthPx(String(str).toUpperCase(), this.px(size)) / this.k; }
  th(size = 1) { return (7 * this.px(size)) / this.k; }

  // ---------- gambar ----------
  draw(dt, ui) {
    this.time += dt;
    this.dt = dt;
    const g = ui.game;
    const ctx = this.lctx, P = this.pal;
    this.buttons = [];
    this.texts = [];
    this.scrollArea = null;

    const playing = ui.screen === 'play' || ui.screen === 'pause';
    const eff = playing && g.state === 'play' ? g.effectiveTilt() : 0;
    const forced = g.event && g.event.phase === 'active' && g.event.type === 'force';
    const targetAngle = eff * (forced ? 4 : 3) * Math.PI / 180;
    this.angle += (targetAngle - this.angle) * Math.min(1, dt * 18);
    if (playing && g.event && g.event.phase === 'active' && g.event.type === 'quake') this.shake = Math.max(this.shake, 2.5);
    this.shake = Math.max(0, this.shake - dt * 20);
    this.flash = Math.max(0, this.flash - dt);
    this.updateParticles(dt, g, playing);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, LW, LH);

    const sx = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const sy = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    ctx.translate(sx, sy);
    this.ox = sx; this.oy = sy;

    if (ui.screen === 'title' || ui.screen === 'ach' || ui.screen === 'settings' || ui.screen === 'start' || ui.screen === 'help' || (ui.screen === 'board' && !ui.fromOver)) {
      this.drawRain(ctx, dt);
    } else {
      this.drawBoard(ctx, g);
      if (ui.tutView) { this.drawTutorialMarks(ctx, ui.tutView); this.drawTutorialPanel(ctx, ui.tutView, ui); }
      else this.drawPanel(ctx, g, ui);
      this.drawEventBanner(ctx, g, ui);
    }

    for (const p of this.particles) {
      ctx.fillStyle = p.white && p.life > p.max * 0.75 ? '#ffffff' : p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w || 1, 1);
    }
    for (const f of this.floats) {
      // teks melayang (skor, LEDAKAN!, BATU HANCUR!) digeser supaya tidak terpotong tepi layar
      const hw = this.tw(f.text) / 2;
      this.txt(f.text, Math.max(hw + 1, Math.min(LW - hw - 1, f.x)), f.y - f.t * 12, f.color, 1, 'center');
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.35, this.flash * 1.5)})`;
      ctx.fillRect(BX, BY, W, H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ox = 0; this.oy = 0;

    switch (ui.screen) {
      case 'title': this.drawTitle(ctx, ui); break;
      case 'pause': this.drawPause(ctx, ui); break;
      case 'over': this.drawOver(ctx, ui); break;
      case 'board': this.drawLeaderboard(ctx, ui); break;
      case 'ach': this.drawAchievements(ctx, ui); break;
      case 'settings': this.drawSettings(ctx, ui); break;
      case 'start': this.drawStart(ctx); break;
      case 'help': this.drawHelp(ctx, ui); break;
      case 'tutDone': this.drawTutDone(ctx, ui); break;
    }
    this.drawToast(ctx, dt);
    this.composite();
  }

  // Gambar lapisan saat ini (grafis low-res + teksnya) ke layar, lalu kosongkan kanvas low-res
  // agar lapisan berikutnya (dim, menu, toast) benar-benar menutupi teks di bawahnya.
  composite() {
    const out = this.ctx, k = this.k;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.imageSmoothingEnabled = false;
    out.drawImage(this.low, 0, 0, this.canvas.width, this.canvas.height);
    const shadow = this.pal.shadow;
    for (const t of this.texts) {
      if (t.alpha <= 0.02) continue;
      out.globalAlpha = t.alpha;
      if (t.clip) {
        out.save();
        out.beginPath();
        out.rect(t.clip.x * k, t.clip.y * k, t.clip.w * k, t.clip.h * k);
        out.clip();
      }
      if (t.shadow) drawText(out, t.str, t.x * k + t.px, t.y * k + t.px, shadow, t.px, t.align);
      drawText(out, t.str, t.x * k, t.y * k, t.color, t.px, t.align);
      if (t.clip) out.restore();
    }
    out.globalAlpha = 1;
    this.texts = [];
    const l = this.lctx;
    l.save();
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, LW, LH);
    l.restore();
  }

  // Mulai lapisan baru di atas semua yang sudah digambar (z-index lebih tinggi).
  layer() { this.composite(); }

  updateParticles(dt, g, playing) {
    const ps = this.particles;
    for (let k = ps.length - 1; k >= 0; k--) {
      const p = ps[k];
      p.life -= dt;
      if (p.life <= 0) { ps[k] = ps[ps.length - 1]; ps.pop(); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let k = this.floats.length - 1; k >= 0; k--) {
      const f = this.floats[k];
      f.t += dt;
      if (f.t >= f.life) this.floats.splice(k, 1);
    }
    // garis angin
    const e = g.event;
    if (playing && e && e.phase === 'active' && e.type === 'wind' && Math.random() < 0.5) {
      const x = e.dir > 0 ? BX - 4 : BX + W + 4;
      ps.push({ x, y: BY + Math.random() * H, vx: e.dir * (140 + Math.random() * 80), vy: 0, g: 0,
        life: 0.6, max: 0.6, color: 'rgba(236,232,245,0.45)', w: 4 });
    }
  }

  drawBoard(ctx, g) {
    const pix = this.pix, c = g.sand.cells, s = g.sand.shade, m = g.sand.mat, sp = this.sandPix;
    const bgA = this.bgA, bgB = this.bgB, speck = this.speck.p;
    for (let y = 0; y < H; y++) {
      const row = y * W, by = y >> 3;
      for (let x = 0; x < W; x++) {
        const i = row + x, v = c[i];
        if (v === 0) { pix[i] = ((x >> 3) + by) & 1 ? bgB : bgA; continue; }
        const mt = m[i];
        if (mt === MAT_STONE) {
          // batu: tepi atas terang, tepi bawah gelap, ada retakan → terlihat seperti blok padat
          const st = this.tex[v].stone;
          const up = y > 0 && (c[i - W] === 0 || m[i - W] !== MAT_STONE);
          const down = y < H - 1 && (c[i + W] === 0 || m[i + W] !== MAT_STONE);
          pix[i] = up ? st.light.p : down ? st.dark.p : (x + y * 3) % 7 === 0 ? st.crack.p : (s[i] & 1 ? st.base2.p : st.base.p);
        } else if (mt === MAT_GUN) {
          pix[i] = s[i] === 3 && (i & 1) ? speck : this.tex[v].gun[s[i] % 3].p;
        } else pix[i] = sp[v * 4 + s[i]];
      }
    }

    // Kilatan clear: merambat dari kiri ke kanan, lalu berkedip sebelum meledak.
    if (g.clearing) {
      const cl = g.clearing;
      const prog = 1 - cl.t / cl.t0;
      const front = (prog / 0.6) * (W + 6);
      const blinkOn = Math.floor(this.time * 20) % 2 === 0;
      const cells = cl.cells;
      for (let k = 0; k < cells.length; k++) {
        const i = cells[k], x = i % W;
        if (prog >= 0.6) { if (blinkOn) pix[i] = this.white; }
        else if (x < front - 6) pix[i] = this.white;
        else if (x < front) pix[i] = this.sandPix[c[i] * 4] | 0; // ujung kilatan: warna paling terang
      }
    }

    // ghost + piece aktif
    const p = g.piece;
    if (p && g.state === 'play') {
      const ghost = this.tex[p.color].piece.ghost.p;
      const blocks = SHAPES[p.type].rots[p.rot];
      const gy = g.dropY(p);
      if (gy > p.y + BLOCK) {
        for (const [bx, bby] of blocks) {
          const cx = p.x + bx * BLOCK, cy = gy + bby * BLOCK;
          for (let ly = 0; ly < BLOCK; ly++) {
            const yy = cy + ly;
            if (yy < 0 || yy >= H) continue;
            for (let lx = 0; lx < BLOCK; lx++) {
              if (lx !== 0 && ly !== 0 && lx !== BLOCK - 1 && ly !== BLOCK - 1) continue;
              const i = yy * W + cx + lx;
              if (c[i] === 0) pix[i] = ghost;
            }
          }
        }
      }
      for (const [bx, bby] of blocks) {
        const cx = p.x + bx * BLOCK, cy = p.y + bby * BLOCK;
        for (let ly = 0; ly < BLOCK; ly++) {
          const yy = cy + ly;
          if (yy < 0 || yy >= H) continue;
          for (let lx = 0; lx < BLOCK; lx++) {
            pix[yy * W + cx + lx] = this.texel(p.mat, p.color, lx, ly, BLOCK, bx + bby).p;
          }
        }
      }
    }
    this.bctx.putImageData(this.img, 0, 0);

    // bingkai + papan, ikut miring
    const P = this.pal;
    ctx.save();
    const cx = BX + W / 2, cy = BY + H / 2;
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);
    ctx.translate(-cx, -cy);
    const dangerOn = g.danger > 0 && Math.floor(this.time * 6) % 2 === 0;
    ctx.fillStyle = dangerOn ? P.danger : P.frame;
    ctx.fillRect(BX - 2, BY - 2, W + 4, H + 4);
    ctx.fillStyle = P.shadow;
    ctx.fillRect(BX - 1, BY - 1, W + 2, H + 2);
    ctx.drawImage(this.boardCanvas, BX, BY);
    ctx.fillStyle = g.danger > 0 ? P.danger : 'rgba(255,77,94,0.35)';
    for (let x = 0; x < W; x += 4) ctx.fillRect(BX + x, BY + CFG.DANGER_Y, 2, 1);
    ctx.restore();
  }

  drawPanel(ctx, g, ui) {
    const P = this.pal;
    let y = 10;
    const label = (t) => { this.txt(t, PX, y, P.dim); y += 7; };
    const value = (t, col = P.text) => { this.txt(t, PX, y, col); y += 10; };

    label('NEXT');
    ctx.fillStyle = P.shadow;
    ctx.fillRect(PX, y, 26, 18);
    if (g.next) {
      const blocks = SHAPES[g.next.type].rots[0];
      let minX = 9, maxX = 0, minY = 9, maxY = 0;
      for (const [bx, by] of blocks) { minX = Math.min(minX, bx); maxX = Math.max(maxX, bx); minY = Math.min(minY, by); maxY = Math.max(maxY, by); }
      // Preview memakai tekstur material yang sama dengan piece (blok 5x5) → pemain tahu lebih dulu.
      const n = 5;
      const ox = PX + Math.floor((26 - (maxX - minX + 1) * n) / 2), oy = y + Math.floor((18 - (maxY - minY + 1) * n) / 2);
      for (const [bx, by] of blocks) {
        const x0 = ox + (bx - minX) * n, y0 = oy + (by - minY) * n;
        for (let ly = 0; ly < n; ly++) {
          for (let lx = 0; lx < n; lx++) {
            ctx.fillStyle = this.texel(g.next.mat, g.next.color, lx, ly, n, bx + by).s;
            ctx.fillRect(x0 + lx, y0 + ly, 1, 1);
          }
        }
      }
      if (g.next.mat === MAT_STONE) this.txt('BATU', PX + 29, y + 6, P.text);
      else if (g.next.mat === MAT_GUN) this.txt('MESIU', PX + 29, y + 6, this.speck.s);
    }
    y += 22;

    label('SKOR'); value(g.score);
    label('TERBAIK'); value(Math.max(ui.best, g.score), P.dim);
    // level boss: angka LEVEL memakai warna boss tema (kontras >= 5:1 dengan latar, beda dari teks & aksen)
    label('LEVEL'); value(g.level + (g.breather > 0 ? ' ~' : ''), isBossLevel(g.level) ? P.boss : P.text);
    label('CHAIN'); value(g.chain > 0 ? 'X' + g.chain : '-', g.chain > 1 ? P.accent : P.text);

    // meter miring
    label('MIRING');
    const t = g.tilt, bw = 54;
    ctx.fillStyle = P.shadow; ctx.fillRect(PX, y, bw, 5);
    const low = t.meter < CFG.TILT_MIN_START && !t.active;
    ctx.fillStyle = t.active ? (Math.floor(this.time * 12) % 2 ? '#ffffff' : P.accent) : low ? P.danger : P.accent;
    ctx.fillRect(PX, y, Math.round(bw * t.meter), 5);
    y += 11;

    // warna aktif
    for (let k = 1; k <= g.numColors; k++) {
      ctx.fillStyle = this.sandCss[k][1];
      ctx.fillRect(PX + (k - 1) * 6, y, 4, 4);
    }

    // Petunjuk tombol keyboard hanya di desktop; di HP tombolnya sudah terlihat di layar.
    if (this.k >= 2 && !ui.touch) {   // di layar sangat kecil teks bantuan tidak muat
      this.txt('TAHAN Q/E MIRING', PX, 144, P.dim);
      this.txt('P JEDA  M SUARA', PX, 151, P.dim);
    }
    this.txt('SANDTILT', PX, 165, P.frame, 1, 'left', false);
  }

  // Banner peringatan & event aktif di atas papan.
  drawEventBanner(ctx, g, ui) {
    const e = g.event;
    if (!e || g.state !== 'play') return;
    const P = this.pal;
    const arrow = e.dir > 0 ? '>>' : '<<';
    let line1, line2 = '', col;
    if (e.phase === 'warn') {
      const pulse = Math.floor(this.time * 6) % 2 === 0;
      line1 = `${EVENT_NAMES[e.type]} ${e.type === 'quake' ? '' : arrow}`.trim();
      line2 = `DALAM ${Math.ceil(e.t)}`;
      col = pulse ? P.accent : P.text;
    } else {
      line1 = e.type === 'quake' ? 'GEMPA!' : `${EVENT_NAMES[e.type]} ${arrow}`;
      if (e.type === 'force') line2 = ui.touch ? `TAHAN ${e.dir > 0 ? 'L' : 'R'} MELAWAN` : `TAHAN ${e.dir > 0 ? 'Q' : 'E'} MELAWAN`;
      if (e.type === 'wind') line2 = 'PIECE TERDORONG';
      col = P.danger;
    }
    const y = BY + 22;
    // banner tidak boleh lebih lebar dari papan: teks diperkecil kalau perlu
    const natural = Math.max(this.tw(line1), this.tw(line2));
    const size = Math.min(1, (W - 6) / natural);
    const w = Math.min(W + 2, Math.ceil(Math.max(this.tw(line1, size), this.tw(line2, size))) + 8);
    const h = line2 ? 17 : 10;
    const x = Math.round(BX + (W - w) / 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.shadow; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    this.txt(line1, BX + W / 2, y + 2.5, col, size, 'center');
    if (line2) this.txt(line2, BX + W / 2, y + 9.5, P.text, size, 'center');
  }

  // ---------- layar ----------
  button(ctx, id, label, x, y, w, h, focused) {
    const P = this.pal;
    this.buttons.push({ id, x, y, w, h });
    ctx.fillStyle = focused ? P.accent : P.frame;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = focused ? P.accent : P.shadow;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    this.txt(label, x + w / 2, y + (h - this.th()) / 2, focused ? P.shadow : P.text, 1, 'center', !focused);
  }

  menu(ctx, ui, items, y, w = 84, gap = 15) {
    const x = Math.floor((LW - w) / 2);
    items.forEach(([id, label], k) => this.button(ctx, id, label, x, y + k * gap, w, 11, ui.focus === k));
  }

  // ---------- daftar yang bisa digulir (peringkat, prestasi) ----------
  // ui.scroll = { pos, target }: posisi gulir dalam piksel logis. main.js mengubah target
  // (roda mouse, seret, tombol ▲▼); di sini target dibatasi lalu pos mengejarnya dengan halus.
  // Isi di antara beginScroll/endScroll (grafis & teks) terpotong di dalam kotak x,y,w,h.
  beginScroll(ctx, ui, x, y, w, h, contentH) {
    const s = ui.scroll || (ui.scroll = { pos: 0, target: 0 });
    const max = Math.max(0, Math.ceil(contentH - h));
    s.target = Math.max(0, Math.min(max, s.target));
    s.pos += (s.target - s.pos) * Math.min(1, (this.dt || 0) * 16);
    if (Math.abs(s.target - s.pos) < 0.3) s.pos = s.target;
    this.scrollArea = { x, y, w, h, max };
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = this.pal.bg;   // latar polos supaya hujan pasir tidak terlihat di sela baris
    ctx.fillRect(x, y, w, h);
    this.clipRect = { x, y, w, h };
    return Math.round(s.pos);
  }

  // Tutup area gulir + gambar scrollbar pixel di sisi kanannya (hanya kalau isinya lebih panjang).
  endScroll(ctx, ui) {
    ctx.restore();
    this.clipRect = null;
    const a = this.scrollArea, s = ui.scroll;
    if (!a || a.max <= 0) return;
    const bx = a.x + a.w + 2;
    ctx.fillStyle = this.pal.shadow;
    ctx.fillRect(bx, a.y, 2, a.h);
    const th = Math.max(6, Math.round((a.h * a.h) / (a.h + a.max)));
    const ty = a.y + Math.round((a.h - th) * (s.pos / a.max));
    ctx.fillStyle = this.pal.dim;
    ctx.fillRect(bx, ty, 2, th);
  }

  // ---------- petunjuk kontrol: tombol keyboard pixel ----------
  // Tombol 9 px tinggi: tepi terang bersudut terpotong, muka, dan bibir bawah gelap (kesan 3D).
  drawKey(ctx, x, y, w, label) {
    const P = this.pal, h = 9;
    ctx.fillStyle = P.dim;
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = P.shadow;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = P.frame;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 3);
    const arrow = KEY_ARROWS[label];
    if (arrow) {
      ctx.fillStyle = P.text;
      const aw = Math.max(...arrow.map((row) => row.length));
      const ax = x + Math.floor((w - aw) / 2);
      arrow.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(ax + rx, y + 1 + ry, 1, 1);
      });
    } else {
      this.txt(label, x + w / 2, y + 1.6, P.text, 1, 'center', false);
    }
  }

  // parts: 'TEKS' | { k: 'Q' | 'left' | 'right' | 'up' | 'down', w? } | angka (jarak tambahan).
  // Baris dipusatkan di layar, atau rata kiri mulai x0 kalau diberikan.
  // Bagian bertanda done (tutorial: tombol sudah dicoba) digambar pudar; rowDone memudarkan teks barisnya juga.
  keyHints(ctx, y, parts, x0 = null, rowDone = false) {
    const keyW = (p) => p.w || (KEY_ARROWS[p.k] ? 9 : Math.max(9, Math.ceil(this.tw(p.k)) + 5));
    const width = (p) => (typeof p === 'number' ? p : typeof p === 'string' ? this.tw(p) : keyW(p));
    const total = parts.reduce((s, p, i) => s + width(p) + (i && typeof p !== 'number' ? 2 : 0), 0);
    let x = x0 ?? Math.round((LW - total) / 2);
    const FADE = 0.3;
    const fadeText = (from) => { for (let k = from; k < this.texts.length; k++) this.texts[k].alpha = FADE; };
    parts.forEach((p, i) => {
      if (i && typeof p !== 'number') x += 2;
      if (typeof p === 'number') x += p;
      else if (typeof p === 'string') {
        this.txt(p, x, y + 2.3, this.pal.dim);
        if (rowDone) fadeText(this.texts.length - 1);
        x += this.tw(p);
      } else {
        x = Math.round(x);
        const t0 = this.texts.length;
        if (p.done) ctx.globalAlpha = FADE;
        this.drawKey(ctx, x, y, keyW(p), p.k);
        ctx.globalAlpha = 1;
        if (p.done) fadeText(t0);
        x += keyW(p);
      }
    });
  }

  dim(ctx, a = 0.82) {
    this.layer();
    ctx.fillStyle = `rgba(${this.pal.overlay || '8,7,14'},${a})`;
    ctx.fillRect(0, 0, LW, LH);
  }

  drawRain(ctx, dt) {
    if (this.rain.length < 70 && Math.random() < 0.6) {
      this.rain.push({ x: Math.random() * LW, y: -2, v: 20 + Math.random() * 40, c: 1 + ((Math.random() * 5) | 0) });
    }
    for (let k = this.rain.length - 1; k >= 0; k--) {
      const r = this.rain[k];
      r.y += r.v * dt;
      if (r.y > LH) { this.rain.splice(k, 1); continue; }
      ctx.fillStyle = this.sandCss[r.c][2];
      ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 2);
    }
  }

  drawLogo(ctx, y) {
    const word = 'SANDTILT', sc = 3;
    let x = Math.floor((LW - blockTextWidth(word, sc)) / 2);
    for (let k = 0; k < word.length; k++) {
      const bob = Math.round(Math.sin(this.time * 3 + k * 0.7) * 1.2);
      drawBlockText(ctx, word[k], x + 1, y + bob + 1, this.pal.shadow, sc);
      drawBlockText(ctx, word[k], x, y + bob, this.sandCss[(k % 5) + 1][0], sc);
      x += 4 * sc;
    }
  }

  drawStart(ctx) {
    this.drawLogo(ctx, 50);
    if (Math.floor(this.time * 2) % 2 === 0) this.txt('KLIK / TAP UNTUK MULAI', LW / 2, 110, this.pal.text, 1, 'center');
  }

  drawTitle(ctx, ui) {
    const P = this.pal;
    this.drawLogo(ctx, 24);
    this.txt('TETRIS PASIR YANG BISA MIRING', LW / 2, 46, P.dim, 1, 'center');
    this.helpIcon(ctx, ui);
    const items = (ui.titleItems || ['play', 'board', 'ach', 'settings']).map((id) => [id, this.menuLabel(id, ui)]);
    // 5 item (dengan KREDIT): mulai sedikit lebih atas & lebih rapat supaya tidak menabrak teks TERBAIK
    this.menu(ctx, ui, items, items.length > 4 ? 58 : 64, 84, items.length > 4 ? 13 : items.length > 3 ? 14 : 15);
    this.txt(`TERBAIK: ${ui.best}`, LW / 2, 124, P.accent, 1, 'center');
    if (ui.playerName) this.txt(`PEMAIN: ${ui.playerName}`, LW / 2, 132, P.dim, 1, 'center');
    // Petunjuk tombol keyboard hanya di desktop; di HP tombolnya sudah terlihat di layar.
    if (!ui.touch) {
      const space = { k: 'space', w: 25 };
      this.keyHints(ctx, 143, [{ k: 'left' }, { k: 'right' }, 'GESER', 5, { k: 'up' }, 'PUTAR', 5, space, 'JATUH']);
      this.keyHints(ctx, 155, ['TAHAN', { k: 'Q' }, '/', { k: 'E' }, 'MIRING', 5, { k: 'P' }, 'JEDA']);
    }
    if (ui.soundMode && ui.soundMode !== 'all') {
      this.txt(ui.soundMode === 'off' ? 'SUARA: MATI' : 'MUSIK: MATI', LW / 2, 168, P.dim, 1, 'center');
    }
  }

  // Label menu bersama (judul, jeda, pengaturan).
  menuLabel(id, ui) {
    const SOUND = { all: 'SEMUA', sfx: 'EFEK SAJA', off: 'MATI' };
    switch (id) {
      case 'play': return 'MAIN';
      case 'board': return 'PERINGKAT';
      case 'ach': return 'PRESTASI';
      case 'settings': return 'PENGATURAN';
      case 'credits': return 'KREDIT';
      case 'tutorial': return 'MAIN TUTORIAL';
      case 'skipTut': return 'LEWATI TUTORIAL';
      case 'resume': return 'LANJUT';
      case 'restart': return 'ULANG';
      case 'menu': return 'MENU UTAMA';
      case 'back': return 'KEMBALI';
      case 'sound': return `SUARA: ${SOUND[ui.soundMode] || 'SEMUA'}`;
      case 'theme': return `TEMA: ${ui.themeName || 'KLASIK'}`;
      default: return id.toUpperCase();
    }
  }

  // Tombol bantuan "?" di pojok kanan atas layar judul (keyboard: H).
  helpIcon(ctx, ui) {
    const P = this.pal, x = LW - 15, y = 4, s = 11;
    this.buttons.push({ id: 'help', x: x - 3, y: y - 3, w: s + 6, h: s + 6 });   // area sentuh sedikit lebih besar
    ctx.fillStyle = P.frame;
    ctx.fillRect(x + 1, y, s - 2, s);
    ctx.fillRect(x, y + 1, s, s - 2);
    ctx.fillStyle = P.shadow;
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    this.txt('?', x + s / 2, y + (s - this.th()) / 2, P.accent, 1, 'center');
    if (!ui.touch) this.txt('H', x - 3, y + (s - this.th()) / 2, P.dim, 1, 'right');
  }

  // CARA MAIN: modal di atas layar judul (bukan halaman baru). Isi rata tengah, kotak di tengah layar.
  // Klik/tap di luar kotak = tutup. Tombol: MAIN TUTORIAL | KEMBALI.
  drawHelp(ctx, ui) {
    const P = this.pal;
    this.drawTitle(ctx, { ...ui, focus: -1 });   // layar judul tetap terlihat di belakang modal
    this.buttons = [];                             // tombol judul tidak bisa diklik selama modal terbuka
    this.dim(ctx, 0.7);
    this.buttons.push({ id: 'back', x: 0, y: 0, w: LW, h: LH });   // area luar kotak

    const tilt = ui.touch ? 'TAHAN L / R' : 'TAHAN Q / E';
    const items = [
      'BALOK YANG MENDARAT HANCUR JADI PASIR.',
      'SAMBUNG SATU WARNA DARI DINDING KIRI KE KANAN: JEMBATAN HILANG, DAPAT SKOR.',
      `${tilt} UNTUK MEMIRINGKAN PAPAN. PASIR IKUT MENGALIR.`,
      'MESIU MELEDAK SAAT KENA CLEAR. BATU KAKU, TIDAK LONGSOR.',
      'PASIR LEWAT GARIS MERAH ATAS = KALAH.',
    ];
    const BW = 146, PAD = 6, MW = BW - 2 * PAD, LINE = 7, GAP = 6, DEMO = 22;
    const wrapped = items.map((t) => this.wrap(t, MW));
    const titleH = this.th(1.5) + 6;
    const bodyH = wrapped.reduce((h, ls) => h + ls.length * LINE + GAP, 0) + DEMO;
    const BH = Math.round(PAD + titleH + bodyH + 2 + 11 + PAD);
    const bx = Math.floor((LW - BW) / 2), by = Math.max(2, Math.floor((LH - BH) / 2));
    this.layer();
    this.buttons.push({ id: 'none', x: bx, y: by, w: BW, h: BH });   // klik di dalam kotak tidak menutup
    ctx.fillStyle = P.frame; ctx.fillRect(bx, by, BW, BH);
    ctx.fillStyle = P.bg; ctx.fillRect(bx + 1, by + 1, BW - 2, BH - 2);

    const cx = LW / 2;
    let y = by + PAD;
    this.txt('CARA MAIN', cx, y, P.accent, 1.5, 'center');
    y += titleH;
    wrapped.forEach((lines, k) => {
      for (const line of lines) { this.txt(line, cx, y, P.text, 1, 'center'); y += LINE; }
      if (k === 1) { this.drawBridgeDemo(ctx, Math.round(cx - 28), y + 1); y += DEMO; }
      if (k < wrapped.length - 1) {                  // titik pemisah antar poin
        ctx.fillStyle = P.frame;
        ctx.fillRect(Math.round(cx) - 1, Math.round(y + GAP / 2 - 1), 2, 1);
      }
      y += GAP;
    });
    y += 2;
    const ids = ui.menuItems || ['tutorial', 'back'];
    const bws = [78, 52], gap = 4, total = bws[0] + bws[1] + gap;
    let x = Math.floor((LW - total) / 2);
    ids.forEach((id, k) => {
      this.button(ctx, id, this.menuLabel(id, ui), x, Math.round(y), bws[k], 11, ui.focus === k);
      x += bws[k] + gap;
    });
  }

  // Ilustrasi kecil jembatan: papan mini, pita merah dari dinding kiri ke kanan berkedip lalu hilang.
  drawBridgeDemo(ctx, x, y) {
    const P = this.pal, w = 56, h = 18;
    ctx.fillStyle = P.frame; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = P.boardA; ctx.fillRect(x, y, w, h);
    for (let bx = 0; bx < w; bx += 4) {           // alas bergaris
      ctx.fillStyle = this.sandCss[(bx / 4) % 2 ? 3 : 2][1];
      ctx.fillRect(x + bx, y + h - 6, 4, 6);
    }
    const t = this.time % 2.4;                     // 0-1.6 terlihat, lalu kedip, lalu kosong
    if (t < 2.0) {
      const blink = t > 1.6 && Math.floor(this.time * 16) % 2 === 0;
      for (let bx = 0; bx < w; bx++) {
        const top = y + h - 10 - Math.round(1.5 + Math.sin(bx * 0.35) * 1.5);
        ctx.fillStyle = blink ? '#ffffff' : this.sandCss[1][(bx >> 1) % 4];
        ctx.fillRect(x + bx, top, 1, y + h - 6 - top);
      }
    }
    // dinding kiri & kanan ditandai
    ctx.fillStyle = P.accent;
    ctx.fillRect(x - 3, y + 2, 2, h - 4);
    ctx.fillRect(x + w + 1, y + 2, 2, h - 4);
  }

  // Penanda di papan saat tutorial: dinding kiri & kanan menyala, panah ke target.
  drawTutorialMarks(ctx, v) {
    const m = v.mark;
    if (!m) return;
    const P = this.pal, on = Math.floor(this.time * 4) % 2 === 0;
    if (m.walls) {
      ctx.fillStyle = on ? P.accent : P.frame;
      ctx.fillRect(BX - 2, BY + CFG.DANGER_Y, 2, H - CFG.DANGER_Y + 2);
      ctx.fillRect(BX + W, BY + CFG.DANGER_Y, 2, H - CFG.DANGER_Y + 2);
    }
    const bob = Math.round(Math.sin(this.time * 6) * 1.5);
    ctx.fillStyle = P.accent;
    if (m.arrowX != null) {
      // panah ke bawah di atas lubang
      const x = BX + m.arrowX, y = BY + m.arrowY + bob;
      ctx.fillRect(x - 1, y - 6, 2, 4);
      for (let r = 0; r < 4; r++) ctx.fillRect(x - 4 + r, y - 2 + r, 8 - 2 * r, 1);
    }
    if (m.box) {
      // garis putus-putus berkedip di sekeliling area yang perlu diperhatikan (tumpukan batu langkah MESIU)
      const b = m.box, x0 = BX + b.x, y0 = BY + b.y, x1 = x0 + b.w - 1, y1 = y0 + b.h - 1;
      const off = Math.floor(this.time * 8) % 4;
      ctx.fillStyle = on ? P.accent : P.text;
      for (let x = x0 + off; x <= x1; x += 4) { ctx.fillRect(x, y0 - 1, 2, 1); ctx.fillRect(x, y1 + 1, 2, 1); }
      for (let y = y0 + off; y <= y1; y += 4) ctx.fillRect(x1 + 1, y, 1, 2);
    }
    if (m.push) {
      // tiga panah ke kanan menuju dinding kanan
      const shift = Math.floor(this.time * 8) % 4;
      for (let k = 0; k < 3; k++) {
        const x = BX + W - 24 + k * 6 + shift, y = BY + m.arrowY;
        for (let r = 0; r < 4; r++) ctx.fillRect(x + r, y - 3 + r, 1, 7 - 2 * r);
      }
    }
  }

  // Panel samping saat tutorial (menggantikan skor/level).
  drawTutorialPanel(ctx, v, ui) {
    const P = this.pal, MW = LW - PX - 4;
    this.txt('TUTORIAL', PX, 10, P.dim);
    for (let k = 0; k < v.total; k++) {           // titik kemajuan
      ctx.fillStyle = k < v.n - 1 || (k === v.n - 1 && v.good) ? P.accent : k === v.n - 1 ? P.text : P.frame;
      ctx.fillRect(PX + k * 6, 19, 4, 4);
    }
    let y = 28;
    if (v.mat && v.mat.mat) {
      // contoh satu blok material (batu/mesiu) tepat di kanan judul
      const n = 8, bx = Math.ceil(PX + this.tw(v.title, 1.5) + 4), by = Math.round(y + (this.th(1.5) - n) / 2);
      for (let ly = 0; ly < n; ly++) {
        for (let lx = 0; lx < n; lx++) {
          ctx.fillStyle = this.texel(v.mat.mat, v.mat.color, lx, ly, n).s;
          ctx.fillRect(bx + lx, by + ly, 1, 1);
        }
      }
    }
    this.txt(v.title, PX, y, v.good ? P.accent : P.text, 1.5);
    y += this.th(1.5) + 4;
    const lines = this.wrap(v.body, MW);
    lines.forEach((line, i) => {
      this.txt(line, PX, y, v.retry && i === 0 ? P.danger : P.text);
      y += 7;
    });
    y += 4;
    for (const row of v.keys) { this.keyHints(ctx, y, row.parts, PX, row.done); y += 12; }
    this.txt(ui.touch ? 'MENU: LEWATI' : 'ESC: LEWATI', PX, 158, P.dim);
    this.txt('SANDTILT', PX, 165, P.frame, 1, 'left', false);
  }

  drawTutDone(ctx, ui) {
    const P = this.pal;
    this.dim(ctx, 0.86);
    this.txt('SIAP MAIN!', LW / 2, 24, P.accent, 2, 'center');
    let y = 48;
    const lines = [
      'JANGAN BIARKAN PASIR LEWAT GARIS MERAH ATAS.',
      'GANGGUAN (GEMPA, ANGIN, PAPAN MIRING) SELALU DIPERINGATKAN 3 DETIK SEBELUMNYA.',
    ];
    for (const text of lines) {
      for (const line of this.wrap(text, LW - 24)) { this.txt(line, LW / 2, y, P.text, 1, 'center'); y += 8; }
      y += 5;
    }
    const items = (ui.menuItems || ['play', 'menu']).map((id) => [id, id === 'play' ? 'MAIN SEKARANG' : this.menuLabel(id, ui)]);
    this.menu(ctx, ui, items, 110, 96, 15);
  }

  drawPause(ctx, ui) {
    this.dim(ctx);
    this.txt('JEDA', LW / 2, 40, this.pal.text, 2, 'center');
    const items = (ui.menuItems || ['resume', 'restart', 'menu']).map((id) => [id, this.menuLabel(id, ui)]);
    this.menu(ctx, ui, items, 62, 96, 15);
  }

  drawSettings(ctx, ui) {
    this.dim(ctx, 0.6);
    this.txt('PENGATURAN', LW / 2, 30, this.pal.text, 2, 'center');
    const items = (ui.menuItems || ['sound', 'back']).map((id) => [id, this.menuLabel(id, ui)]);
    this.menu(ctx, ui, items, 60, 96, 15);
    if (ui.themeHint) this.txt(ui.themeHint, LW / 2, 130, this.pal.dim, 1, 'center');
    if (!ui.touch) this.txt('M = SUARA   P = JEDA SAAT MAIN', LW / 2, 140, this.pal.dim, 1, 'center');
  }

  drawOver(ctx, ui) {
    const P = this.pal, o = ui.over || {};
    this.dim(ctx, 0.86);
    this.txt('GAME OVER', LW / 2, 12, P.danger, 2, 'center');
    let y = 34;
    const row = (k, v, col = P.text) => {
      this.txt(k, 24, y, P.dim);
      this.txt(v, 136, y, col, 1, 'right');
      y += 9;
    };
    row('SKOR', o.score ?? 0, P.accent);
    row('CHAIN TERBAIK', o.bestChain ?? 0);
    row('LEVEL', o.level ?? 1);
    row('BUTIR DIHAPUS', o.grains ?? 0);
    row('DURASI', `${o.duration ?? 0} DTK`);
    y += 3;
    if (o.newBest) { this.txt('REKOR PRIBADI BARU!', LW / 2, y, P.accent, 1, 'center'); y += 9; }
    if (ui.lbStatus) { this.txt(ui.lbStatus, LW / 2, y, ui.lbStatusColor || P.text, 1, 'center'); y += 9; }
    if (o.newAch > 0) this.txt(`${o.newAch} PRESTASI BARU`, LW / 2, y, P.dim, 1, 'center');
    this.menu(ctx, ui, [['restart', 'MAIN LAGI'], ['board', 'PERINGKAT'], ['menu', 'MENU']], 120);
  }

  drawLeaderboard(ctx, ui) {
    const P = this.pal, lb = ui.lb || {};
    if (ui.fromOver) this.dim(ctx, 0.92);
    this.txt('PERINGKAT', LW / 2, 4, P.text, 2, 'center');
    this.button(ctx, 'tabWeekly', 'MINGGU INI', 6, 20, 72, 11, lb.tab === 'weekly');
    this.button(ctx, 'tabAll', 'SEPANJANG MASA', 82, 20, 72, 11, lb.tab === 'alltime');

    if (lb.loading) {
      this.txt('MEMUAT...', LW / 2, 80, P.dim, 1, 'center');
    } else if (!lb.rows || lb.rows.length === 0) {
      this.txt('BELUM ADA SKOR', LW / 2, 70, P.dim, 1, 'center');
      this.txt('JADILAH YANG PERTAMA!', LW / 2, 80, P.dim, 1, 'center');
    } else {
      // Sampai 100 baris, bisa digulir. Kalau pemain di luar daftar (peringkat 100+),
      // barisnya ditaruh langsung di bawah baris terakhir, dipisah titik-titik.
      const LX = 6, LY = 35, LWD = 144, LHT = 110, ROW = 10, SEP = 7;
      const rows = lb.rows;
      const pinned = lb.mine && !rows.some((r) => r.me) ? lb.mine : null;
      const contentH = rows.length * ROW + (pinned ? SEP + ROW : 0) - 1;
      const s = ui.scroll || (ui.scroll = { pos: 0, target: 0 });
      if (s.revealMe) {
        // dibuka dari game over: gulir otomatis ke baris pemain
        const i = rows.findIndex((r) => r.me);
        const meY = i >= 0 ? i * ROW : pinned ? rows.length * ROW + SEP : -1;
        if (meY >= 0) s.target = meY + ROW / 2 - LHT / 2;
        s.revealMe = false;
      }
      const off = this.beginScroll(ctx, ui, LX, LY, LWD, LHT, contentH);
      const row = (rank, r, ry, k) => {
        if (ry + ROW <= LY || ry >= LY + LHT) return;
        if (r.me) ctx.fillStyle = P.frame;
        else ctx.fillStyle = k % 2 ? P.boardB : P.boardA;
        ctx.fillRect(LX, ry, LWD, ROW - 1);
        const gold = k === 0;
        this.txt(rank, LX + 16, ry + 2, k < 3 ? P.accent : P.dim, 1, 'right');
        this.txt((r.name || '?').slice(0, 16), LX + 20, ry + 2, gold ? P.accent : P.text);
        this.txt(r.score, LX + LWD - 5, ry + 2, gold ? P.accent : P.text, 1, 'right');
      };
      let y = LY - off;
      rows.forEach((r, k) => { row(k + 1, r, y, k); y += ROW; });
      if (pinned) {
        ctx.fillStyle = P.dim;
        for (let dx = -6; dx <= 6; dx += 6) ctx.fillRect(LX + LWD / 2 + dx, y + 2, 1, 1);
        y += SEP;
        row(pinned.rank, { name: pinned.name || 'KAMU', score: pinned.score, me: true }, y, pinned.rank - 1);
      }
      this.endScroll(ctx, ui);
    }
    const info = lb.offline ? 'OFFLINE - SKOR LOKAL' : (lb.tab === 'weekly' && lb.resetIn ? `RESET DALAM ${lb.resetIn}` : '');
    if (info) this.txt(info, LW / 2, 149, lb.offline ? P.danger : P.dim, 1, 'center');
    this.menu(ctx, { focus: 0 }, [['back', 'KEMBALI']], 160, 60);
  }

  drawAchievements(ctx, ui) {
    const P = this.pal;
    this.dim(ctx, 0.6);
    this.txt('PRESTASI', LW / 2, 4, P.text, 2, 'center');
    const list = ui.ach || [];
    this.txt(`TROFI ${list.filter((a) => a.unlocked).length}/${list.length}`, LW / 2, 18, P.dim, 1, 'center');
    // Satu kartu per prestasi: trofi di kiri, nama + deskripsi (dibungkus kalau kepanjangan).
    // Yang sudah terbuka diberi garis warna tingkat trofinya di tepi kiri.
    const LX = 6, LY = 27, LWD = 144, LHT = 127, GAP = 3, TX = LX + 20;
    const cards = list.map((a) => {
      const show = a.unlocked || !a.hidden;
      // Kartu maksimal 3 baris: nama + deskripsi + hadiah. Deskripsi boleh 2 baris hanya kalau tidak ada hadiah;
      // kalau tetap kepanjangan, deskripsi diperkecil jadi satu baris (cadangan, deskripsi idealnya <= 30 huruf).
      const desc = show ? a.desc : 'RAHASIA', maxW = LX + LWD - 3 - TX;
      let lines = this.wrap(desc, maxW);
      if (lines.length > (a.reward ? 1 : 2)) lines = [{ text: desc, size: Math.min(1, maxW / this.tw(desc)) }];
      // hadiah (mis. tema) selalu ditulis, juga untuk prestasi rahasia → pemain tahu ada yang bisa dikejar
      if (a.reward) lines.push({ reward: `HADIAH: ${a.reward}` });
      return { a, show, lines, h: 10 + lines.length * 7 };
    });
    const contentH = cards.reduce((sum, c) => sum + c.h + GAP, -GAP);
    let y = LY - this.beginScroll(ctx, ui, LX, LY, LWD, LHT, contentH);
    for (const { a, show, lines, h } of cards) {
      if (y + h > LY && y < LY + LHT) {
        ctx.fillStyle = a.unlocked ? P.boardB : P.boardA;
        ctx.fillRect(LX, y, LWD, h);
        if (a.unlocked) {
          ctx.fillStyle = a.tier === 'gold' ? P.accent : TIER_COLOR[a.tier] || P.dim;
          ctx.fillRect(LX, y, 2, h);
        }
        this.drawTrophy(ctx, a.unlocked ? a.tier : 'locked', LX + 5, y + Math.floor((h - 11) / 2));
        this.txt(show ? a.name : '???', TX, y + 3, a.unlocked ? P.text : P.dim);
        lines.forEach((ln, i) => {
          if (ln.reward) this.txt(ln.reward, TX, y + 9.5 + i * 7, a.unlocked ? P.accent : P.text);
          else if (ln.text) this.txt(ln.text, TX, y + 9.5 + i * 7, P.dim, ln.size);
          else this.txt(ln, TX, y + 9.5 + i * 7, P.dim);
        });
      }
      y += h + GAP;
    }
    this.endScroll(ctx, ui);
    this.menu(ctx, { focus: 0 }, [['back', 'KEMBALI']], 160, 60);
  }

  drawToast(ctx, dt) {
    const t = this.toast;
    if (!t) return;
    t.t += dt;
    if (t.t > 2.6) { this.toast = null; return; }
    this.layer();
    const P = this.pal;
    const slide = Math.min(1, t.t * 6, (2.6 - t.t) * 6);
    const y = Math.round(-16 + 18 * slide);
    const iconW = t.icon ? 15 : 0;
    // Teks terlalu panjang untuk layar → perkecil ukurannya supaya kotak notifikasi selalu muat.
    const maxW = LW - 6;
    const natural = Math.max(this.tw(t.name), this.tw(t.title));
    const size = Math.min(1, (maxW - 10 - iconW) / natural);
    const w = Math.min(maxW, Math.ceil(Math.max(this.tw(t.name, size), this.tw(t.title, size))) + 10 + iconW);
    const x = Math.floor((LW - w) / 2);
    ctx.fillStyle = P.accent; ctx.fillRect(x, y, w, 16);
    ctx.fillStyle = P.shadow; ctx.fillRect(x + 1, y + 1, w - 2, 14);
    if (t.icon) {
      // trofi berkilau sebentar saat muncul
      const bob = t.t < 0.6 ? Math.round(Math.sin(t.t * 20) * 1) : 0;
      this.drawTrophy(ctx, t.icon, x + 3, y + 2.5 + bob);
    }
    const cx = x + iconW + (w - iconW) / 2;
    this.txt(t.title, cx, y + 2, P.accent, size, 'center');
    this.txt(t.name, cx, y + 8.5, P.text, size, 'center');
  }
}

return { LW, LH, PALETTES, Renderer };
})();

// ===================================================================== js/input.js
__mod["input"] = (function () {
const { CFG } = __mod["config"];

// Input → aksi bernama. Gameplay hanya membaca aksi, bukan tombol mentah.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'soft', KeyS: 'soft',
  ArrowUp: 'rotCW', KeyX: 'rotCW', KeyW: 'rotCW',
  KeyZ: 'rotCCW',
  Space: 'hardDrop',
  KeyQ: 'tiltL', KeyE: 'tiltR',
};
const REPEAT = new Set(['left', 'right']);
const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

class Input {
  constructor(onUiKey) {
    this.onUiKey = onUiKey;
    this.held = { left: false, right: false, soft: false, tiltL: false, tiltR: false };
    this.queue = [];
    this.repeat = { left: 0, right: 0 };
    this.enabled = false;   // aksi gameplay hanya dikumpulkan saat bermain

    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (PREVENT.has(e.code)) e.preventDefault();
      this.onUiKey(e);
      const a = KEYMAP[e.code];
      if (!a || e.repeat) return;
      this.press(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.release(a);
    });
    window.addEventListener('blur', () => this.releaseAll());
  }

  press(a) {
    if (a in this.held) this.held[a] = true;
    if (!this.enabled) return;
    if (a === 'soft' || a === 'tiltL' || a === 'tiltR') return; // aksi tahan, dibaca lewat poll()
    this.queue.push(a);
    if (REPEAT.has(a)) this.repeat[a] = -CFG.DAS;
  }

  release(a) { if (a in this.held) this.held[a] = false; }

  releaseAll() { for (const k in this.held) this.held[k] = false; }

  // Tombol sentuh di layar memakai aksi yang sama.
  bindTouch(root) {
    for (const el of root.querySelectorAll('[data-action]')) {
      const a = el.dataset.action;
      const down = (e) => { e.preventDefault(); el.classList.add('on'); this.press(a); };
      const up = (e) => { e.preventDefault(); el.classList.remove('on'); this.release(a); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // Dipanggil sekali per tick: mengembalikan aksi + auto-repeat geser (DAS/ARR).
  poll(dt) {
    const actions = this.queue;
    this.queue = [];
    if (this.enabled) {
      for (const a of REPEAT) {
        if (!this.held[a]) continue;
        this.repeat[a] += dt;
        while (this.repeat[a] >= CFG.ARR) { this.repeat[a] -= CFG.ARR; actions.push(a); }
      }
    }
    const tilt = this.enabled ? (this.held.tiltR ? 1 : 0) - (this.held.tiltL ? 1 : 0) : 0;
    return { actions, soft: this.enabled && this.held.soft, tilt };
  }

  clear() { this.queue = []; }
}

return { Input };
})();

// ===================================================================== js/audio.js
__mod["audio"] = (function () {
// Mesin audio SandTilt: SFX & musik dari file di assets/ (WebAudio).
// - SFX: paket Kenney (CC0) + angin/pasir buatan ffmpeg → assets/sfx/*.mp3
// - Musik: chiptune orisinal → assets/music/{title,game}.mp3 (loop mulus, panjang loop di loops.json)
// Suara diposisikan stereo sesuai letak kejadian di papan, musik meredup sesaat saat ledakan/clear,
// dan musik terdengar "teredam" (low-pass) saat pasir melewati garis bahaya.

const SFX_NAMES = [
  'ui-cursor', 'ui-confirm', 'ui-back', 'ui-pause', 'ui-resume', 'ui-toggle',
  'move', 'rotate', 'harddrop', 'tilt-fail', 'tilt-slide',
  'land-sand-0', 'land-sand-1', 'land-sand-2', 'land-stone-0', 'land-stone-1', 'land-gun',
  'clear', 'chain', 'explode-0', 'explode-1', 'explode-2', 'explode-low',
  'quake-rumble', 'force-creak', 'wind', 'wind-push', 'heartbeat',
  'jingle-level', 'jingle-gameover', 'jingle-warn', 'jingle-material',
  'trophy-bronze', 'trophy-silver', 'trophy-gold', 'trophy-secret',
];
const MUSIC_VOL = 0.42;

let ctx = null, master = null, sfxBus = null, musicBus = null, musicFilter = null;
const buffers = {};
let loops = { game: 0, title: 0 };
let loading = null;
let musicSrc = null, musicName = null, musicWanted = null;
let mode = 'all';                 // 'all' | 'sfx' (musik mati) | 'off'
let duckUntil = 0;

// Dibuka lewat klik ganda (file://)? fetch() ke file lokal diblokir browser, jadi audio diambil dari
// assets/audio-data.js (base64, dimuat sebagai <script> biasa yang tetap diizinkan di file://).
const FILE_MODE = location.protocol === 'file:';

function loadEmbedded() {
  return new Promise((resolve, reject) => {
    if (window.SANDTILT_AUDIO) { resolve(window.SANDTILT_AUDIO); return; }
    const s = document.createElement('script');
    s.src = 'assets/audio-data.js';
    s.onload = () => (window.SANDTILT_AUDIO ? resolve(window.SANDTILT_AUDIO) : reject(new Error('audio-data kosong')));
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function b64ToBuffer(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function load() {
  if (loading) return loading;
  const done = () => { if (musicWanted) playMusic(musicWanted, true); };
  if (FILE_MODE) {
    const dec = (b64) => ctx.decodeAudioData(b64ToBuffer(b64));
    loading = loadEmbedded().then((data) => Promise.all([
      ...SFX_NAMES.map((n) => (data.sfx[n] ? dec(data.sfx[n]).then((b) => { buffers[n] = b; }).catch(() => {}) : null)),
      ...['title', 'game'].map((n) => (data.music[n] ? dec(data.music[n]).then((b) => { buffers['music:' + n] = b; }).catch(() => {}) : null)),
    ]).then(() => { if (data.loops) loops = data.loops; })).catch(() => {}).then(done);
    return loading;
  }
  const get = async (url) => ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
  loading = Promise.all([
    ...SFX_NAMES.map((n) => get(`assets/sfx/${n}.mp3`).then((b) => { buffers[n] = b; }).catch(() => {})),
    get('assets/music/title.mp3').then((b) => { buffers['music:title'] = b; }).catch(() => {}),
    get('assets/music/game.mp3').then((b) => { buffers['music:game'] = b; }).catch(() => {}),
    fetch('assets/music/loops.json').then((r) => r.json()).then((j) => { loops = j; }).catch(() => {}),
  ]).then(done);
  return loading;
}

function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 20000;
      musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_VOL;
      musicBus.connect(musicFilter);
      musicFilter.connect(master);
      applyMode();
      load();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* audio tidak tersedia */ }
}

// ------------------------------------------------------------ mode suara
function applyMode() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.value = mode === 'off' ? 0 : 1;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(mode === 'all' ? MUSIC_VOL : 0, t);
}
function setSoundMode(m) { mode = ['all', 'sfx', 'off'].includes(m) ? m : 'all'; applyMode(); }
function getSoundMode() { return mode; }
function cycleSoundMode() { setSoundMode(mode === 'all' ? 'sfx' : mode === 'sfx' ? 'off' : 'all'); return mode; }
// kompatibilitas lama
function setMuted(m) { setSoundMode(m ? 'off' : 'all'); }
function isMuted() { return mode === 'off'; }

// ------------------------------------------------------------ pemutar SFX
function play(name, { vol = 1, rate = 1, pan = 0, delay = 0, offset = 0, dur } = {}) {
  if (!ctx || ctx.state !== 'running' || mode === 'off') return null;
  const buf = buffers[name];
  if (!buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = vol;
  let node = src;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p); node = p;
  }
  node.connect(g);
  g.connect(sfxBus);
  const t = ctx.currentTime + delay;
  if (dur) {
    g.gain.setValueAtTime(vol, t + Math.max(0, dur - 0.25));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.start(t, offset, dur + 0.05);
  } else src.start(t, offset);
  return src;
}
const pick = (base, n) => `${base}-${(Math.random() * n) | 0}`;
const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;   // variasi pitch kecil supaya tidak monoton
const panX = (x) => (x / 80) * 1.4 - 0.7;                          // posisi papan 0..80 → stereo

// Musik meredup sesaat (ledakan, jingle) lalu kembali.
function duck(level = 0.35, hold = 0.5) {
  if (!ctx || mode !== 'all') return;
  const t = ctx.currentTime;
  duckUntil = Math.max(duckUntil, t + hold);
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(MUSIC_VOL * level, t + 0.05);
  musicBus.gain.setValueAtTime(MUSIC_VOL * level, duckUntil);
  musicBus.gain.linearRampToValueAtTime(MUSIC_VOL, duckUntil + 0.6);
}

// ------------------------------------------------------------ musik
function playMusic(name, force = false) {
  musicWanted = name;
  if (!ctx) return;
  if (!force && musicName === name && musicSrc) return;
  const old = musicSrc;
  if (old) {
    const g = old._gain, t = ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    old.stop(t + 0.65);
  }
  musicSrc = null; musicName = null;
  const buf = name && buffers['music:' + name];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = loops[name] || buf.duration;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
  src.connect(g); g.connect(musicBus);
  src._gain = g;
  src.start();
  musicSrc = src; musicName = name;
}
function setMusic(name) { playMusic(name); }

// Saat bahaya: musik teredam & sedikit lebih pelan agar detak jantung terdengar.
function setDanger(on) {
  if (!ctx) return;
  const t = ctx.currentTime;
  musicFilter.frequency.cancelScheduledValues(t);
  musicFilter.frequency.setTargetAtTime(on ? 900 : 20000, t, 0.15);
}

// Saat jeda: musik pelan.
function setPausedMusic(paused) {
  if (!ctx || !musicSrc) return;
  const g = musicSrc._gain, t = ctx.currentTime;
  g.gain.setTargetAtTime(paused ? 0.3 : 1, t, 0.1);
}

// Info untuk pengujian (window.sandtilt.audio()).
function audioDebug() {
  return {
    state: ctx ? ctx.state : 'none', mode, music: musicName, wanted: musicWanted,
    loaded: Object.keys(buffers).length, expected: SFX_NAMES.length + 2,
    filterHz: musicFilter ? Math.round(musicFilter.frequency.value) : null,
  };
}

// ------------------------------------------------------------ API efek suara
const sfx = {
  // menu
  click() { play('ui-confirm', { vol: 0.7 }); },
  cursor() { play('ui-cursor', { vol: 0.6 }); },
  back() { play('ui-back', { vol: 0.7 }); },
  pause() { play('ui-pause', { vol: 0.8 }); },
  resume() { play('ui-resume', { vol: 0.8 }); },
  toggle() { play('ui-toggle', { vol: 0.8 }); },

  // piece
  move() { play('move', { vol: 0.35, rate: vary(0.04) }); },
  rotate() { play('rotate', { vol: 0.5, rate: vary(0.05) }); },
  land(d = {}) {
    const pan = d.x != null ? panX(d.x + 12) : 0;
    if (d.mat === 1) play(pick('land-stone', 2), { vol: 0.75, rate: vary(0.05), pan });
    else if (d.mat === 2) play('land-gun', { vol: 0.8, rate: vary(0.08), pan });
    else play(pick('land-sand', 3), { vol: 0.9, rate: vary(0.08), pan });
  },
  hardDrop(d = {}) {
    const pan = d.x != null ? panX(d.x + 12) : 0;
    play('harddrop', { vol: 0.8, rate: vary(0.05), pan });
    this.land({ ...d, x: d.x });
  },

  // miring
  tilt(dir) {
    play('tilt-slide', { vol: 0.8, rate: vary(0.06), pan: dir * 0.6 });
    play('force-creak', { vol: 0.25, rate: 1.4, pan: dir * 0.4 });
  },
  tiltFail() { play('tilt-fail', { vol: 0.5 }); },

  // clear & chain: nada naik setiap chain
  clear(chain = 1, x = 40) {
    const rate = Math.min(2, 1 + 0.09 * (chain - 1));
    play('clear', { vol: 0.75, rate });
    if (chain > 1) play('chain', { vol: 0.55, rate, delay: 0.08, pan: panX(x) * 0.5 });
    duck(0.55, 0.3);
  },
  // butir larut (saat ledakan partikel)
  scatter(x = 40) { play(pick('land-sand', 3), { vol: 0.45, rate: 1.6, pan: panX(x) }); },

  explode(d = {}) {
    const cx = d.centers && d.centers.length ? d.centers.reduce((s, c) => s + c[0], 0) / d.centers.length : 40;
    play(pick('explode', 3), { vol: 1, rate: vary(0.08), pan: panX(cx) });
    play('explode-low', { vol: 0.9, delay: 0.02 });
    if (d.stones > 0) play(pick('land-stone', 2), { vol: 0.7, rate: 0.8, delay: 0.12, pan: panX(cx) });
    duck(0.25, 0.8);
  },

  // event pengganggu
  warn() { play('jingle-warn', { vol: 0.7 }); },
  quake() {
    play('quake-rumble', { vol: 1, dur: 1.9 });
    play('explode-low', { vol: 0.6, rate: 0.7 });
    duck(0.4, 1.4);
  },
  wind(dir) { play('wind', { vol: 0.9, pan: dir * 0.7 }); },
  windPush(dir) { play('wind-push', { vol: 0.45, rate: vary(0.1), pan: dir * 0.6 }); },
  force(dir) {
    play('force-creak', { vol: 0.9, rate: 0.8, pan: dir * 0.5 });
    play('tilt-slide', { vol: 0.7, rate: 0.7, pan: dir * 0.6, delay: 0.15 });
  },
  heartbeat() { play('heartbeat', { vol: 0.9, rate: 0.75 }); play('heartbeat', { vol: 0.6, rate: 0.7, delay: 0.18 }); },

  // jingle
  levelUp() { play('jingle-level', { vol: 0.8 }); duck(0.3, 0.9); },
  achievement(tier = 'bronze') { play('trophy-' + (buffers['trophy-' + tier] ? tier : 'bronze'), { vol: 0.85 }); duck(0.3, 0.7); },
  material() { play('jingle-material', { vol: 0.7 }); },
  gameOver() { playMusic(null); play('jingle-gameover', { vol: 0.9 }); },
};

return { unlockAudio, setSoundMode, getSoundMode, cycleSoundMode, setMuted, isMuted, setMusic, setDanger, setPausedMusic, audioDebug, sfx };
})();

// ===================================================================== js/achievements.js
__mod["achievements"] = (function () {
const { store } = __mod["util"];

// Deskripsi maksimal 30 karakter supaya muat SATU baris di semua ukuran layar
// (kartu prestasi maksimal 3 baris: nama + deskripsi + hadiah).
// tier: bronze | silver | gold | secret → menentukan ikon trofi (assets/image/trophy-*.svg).
const ACHIEVEMENTS = [
  { id: 'first_bridge', tier: 'bronze', name: 'JEMBATAN PERTAMA', desc: 'CLEAR PERTAMA KALI' },
  { id: 'chain3', tier: 'silver', name: 'REAKSI BERANTAI', desc: 'CAPAI CHAIN X3' },
  { id: 'chain5', tier: 'gold', name: 'BADAI PASIR', desc: 'CAPAI CHAIN X5' },
  { id: 'tilt_master', tier: 'silver', name: 'AHLI MIRING', desc: 'CLEAR < 1 DETIK SETELAH MIRING' },
  { id: 'close_call', tier: 'silver', name: 'NYARIS!', desc: 'CLEAR SAAT DEKAT GARIS BAHAYA', reward: 'TEMA KERTAS' },
  { id: 'clean_board', tier: 'gold', name: 'PAPAN BERSIH', desc: 'KOSONGKAN PAPAN SETELAH CLEAR' },
  { id: 'boom', tier: 'bronze', name: 'BOOM!', desc: 'LEDAKKAN MESIU PERTAMA KALI' },
  { id: 'stone_breaker', tier: 'silver', name: 'PENGHANCUR BATU', desc: 'HANCURKAN BATU DENGAN LEDAKAN' },
  { id: 'no_tilt', tier: 'gold', name: 'TANGAN KOSONG', desc: 'LEVEL 5 TANPA MIRING' },
  { id: 'marathon', tier: 'gold', name: 'MARATON', desc: 'CAPAI LEVEL 10' },
  { id: 'quake', tier: 'secret', name: 'GOYANG DUMANG!', desc: 'MIRING KIRI-KANAN 6X < 2 DETIK', hidden: true, reward: 'TEMA NEON' },
  { id: 'counter', tier: 'secret', name: 'LAWAN ARUS', desc: 'TAHAN MIRING LAWAN ARAH PAPAN', hidden: true, reward: 'TEMA RETRO' },
];

class Achievements {
  constructor(events, onUnlock) {
    this.unlocked = new Set(store.get('ach', []));
    this.onUnlock = onUnlock;
    this.sessionNew = 0;
    this.tiltLog = [];
    this.bind(events);
  }

  unlock(id) {
    if (this.disabled || this.unlocked.has(id)) return false;   // disabled: mode uji (lihat main.js)
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return false;
    this.unlocked.add(id);
    this.sessionNew++;
    store.set('ach', [...this.unlocked]);
    this.onUnlock(def);
    return true;
  }

  list() { return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: this.unlocked.has(a.id) })); }

  bind(ev) {
    ev.on('clear', (d) => {
      this.unlock('first_bridge');
      if (d.chain >= 3) this.unlock('chain3');
      if (d.chain >= 5) this.unlock('chain5');
      if (d.sinceTilt <= 1) this.unlock('tilt_master');
      if (d.inDanger) this.unlock('close_call');
    });
    ev.on('boardClear', () => this.unlock('clean_board'));
    // Rahasia: tahan miring berlawanan arah saat event Papan Miring (bisa di HP maupun desktop).
    ev.on('counterForce', () => this.unlock('counter'));
    ev.on('explode', (d) => {
      this.unlock('boom');
      if (d.stones > 0) this.unlock('stone_breaker');
    });
    ev.on('levelUp', (d) => {
      if (d.level >= 5 && d.tiltsUsed === 0) this.unlock('no_tilt');
      if (d.level >= 10) this.unlock('marathon');
    });
    // Gempa: 6 percobaan miring bergantian arah dalam 2 detik (charge tidak harus ada).
    ev.on('tiltAttempt', (dir) => {
      const now = performance.now();
      this.tiltLog.push({ dir, now });
      this.tiltLog = this.tiltLog.filter((t) => now - t.now <= 2000);
      const log = this.tiltLog;
      if (log.length >= 6) {
        let alt = true;
        for (let k = log.length - 5; k < log.length; k++) if (log[k].dir === log[k - 1].dir) alt = false;
        if (alt) { this.tiltLog = []; ev.emit('quake'); this.unlock('quake'); }
      }
    });
  }
}

return { ACHIEVEMENTS, Achievements };
})();

// ===================================================================== js/leaderboard.js
__mod["leaderboard"] = (function () {
const { store } = __mod["util"];

// Klien leaderboard. Server utama = API pusat di sandtilt.vercel.app (satu papan untuk semua platform);
// hanya deployment itu yang punya database. Deployment lain (Vercel lain, gameedukasi, itch.io, ...)
// cuma tampilan yang memanggil API pusat, jadi tidak perlu database sendiri.
// Di gameedukasi, kalau server pusat tidak bisa dihubungi, pindah ke api/leaderboard.php lokal.
// Tanpa server sama sekali → mode offline (skor disimpan di localStorage).
//
// Uji coba: tambahkan ?lb=central | php | off di URL untuk memaksa satu server.
const CENTRAL_API = 'https://sandtilt.vercel.app/api/leaderboard';
const LOCAL_PHP_API = 'api/leaderboard.php';
const NAME_RE = /^[A-Za-z0-9 _-]{2,16}$/;

// Daftar server yang dicoba berurutan untuk halaman ini.
function apiList() {
  const force = new URLSearchParams(location.search).get('lb');
  if (force === 'central') return [CENTRAL_API];
  if (force === 'php') return [LOCAL_PHP_API];
  if (force === 'off') return [];
  const host = location.hostname;
  if (location.protocol === 'file:') return [];                              // dibuka dari disk: offline
  if (host === new URL(CENTRAL_API).hostname) return ['/api/leaderboard'];   // server pusat itu sendiri
  if (/\.vercel\.app$/.test(host)) return [CENTRAL_API];                     // Vercel lain (sandtilt-azhar, preview): tanpa PHP
  if (host === 'localhost' || host === '127.0.0.1') return [LOCAL_PHP_API];  // tes lokal tidak mengotori papan pusat
  return [CENTRAL_API, LOCAL_PHP_API];                                       // gameedukasi & platform lain
}

// Jawaban server yang berarti "server ini belum bisa dipakai" → coba server berikutnya.
const SERVER_DOWN = new Set(['NO_DB', 'SERVER_ERROR', 'FORBIDDEN_ORIGIN']);

function makeUuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256; });
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Senin minggu ini (tanggal lokal) — hanya untuk mode offline. Mode online memakai tanggal dari server.
function localWeekStart() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function request(url, opts = {}, timeout = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function validName(name) { return NAME_RE.test(name.trim()); }

function formatDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}H ${h}J`;
  if (h > 0) return `${h}J ${m}M`;
  return `${m}M`;
}

// Run (permainan yang dibuka di server) yang terikat pada hasil satu game.
const runOf = new WeakMap();
const NO_RUN = Promise.resolve({ error: 'offline' });

class Leaderboard {
  constructor() {
    // Token rahasia pemain (disimpan dengan kunci lama 'uuid' supaya pemain lama tetap dikenali).
    // Tidak pernah ditampilkan: papan peringkat hanya memakai public id (pid) dari server.
    this.token = store.get('uuid');
    if (!this.token) { this.token = makeUuid(); store.set('uuid', this.token); }
    this.pid = store.get('pid', '');
    this.name = store.get('name', '');
    this.apis = apiList();
    this.runPromise = NO_RUN;
  }

  setName(name) { this.name = name.trim(); store.set('name', this.name); }
  setPid(pid) { if (pid && pid !== this.pid) { this.pid = pid; store.set('pid', pid); } }

  // Panggil server berurutan. Server yang mati/belum siap dilewati; yang berhasil dipakai duluan
  // berikutnya. only = paksa satu server (run hanya berlaku di server yang membukanya).
  async call(action, { body, query = {} } = {}, only = null) {
    const list = only ? [only] : this.apis;
    let lastErr = new Error('offline');
    for (const api of list) {
      const qs = new URLSearchParams({ action, ...query });
      const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
      try {
        const j = await request(`${api}?${qs}`, opts);
        if (!j || typeof j !== 'object') throw new Error('bukan JSON');
        if (!j.success && SERVER_DOWN.has(j.code)) throw new Error(j.code);
        if (!only && api !== this.apis[0]) this.apis = [api, ...this.apis.filter((a) => a !== api)];
        if (j.player_id) this.setPid(j.player_id);
        return { j, api };
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  // Dipanggil saat game dimulai: server mencatat waktu mulai; skor nanti hanya diterima untuk run ini.
  startRun() {
    if (!this.apis.length) { this.runPromise = NO_RUN; return; }
    this.runPromise = this.call('start_run', { body: { token: this.token } })
      .then(({ j, api }) => (j.success ? { id: j.run_id, api } : { error: j.code || 'gagal' }))
      .catch(() => ({ error: 'offline' }));
  }

  // Simpan juga di lokal: untuk mode offline & antrean kirim ulang. Dipanggil saat game selesai,
  // sekaligus mengikat run game ini ke hasilnya (game berikutnya membuka run baru).
  saveLocal(stats) {
    runOf.set(stats, this.runPromise);
    this.runPromise = NO_RUN;
    const runs = store.get('runs', []);
    runs.push({ week: localWeekStart(), score: stats.score, chain: stats.bestChain, at: Date.now() });
    runs.sort((a, b) => b.score - a.score);
    store.set('runs', runs.slice(0, 50));
  }

  localBoard(tab) {
    const week = localWeekStart();
    const runs = store.get('runs', []).filter((r) => tab === 'alltime' || r.week === week);
    const name = this.name || 'KAMU';
    return { offline: true, tab, rows: runs.map((r) => ({ name, score: r.score, me: true })), mine: null };
  }

  async get(tab) {
    try {
      const { j } = await this.call('get', { query: { tab, ...(this.pid ? { pid: this.pid } : {}) } });
      if (!j.success) throw new Error(j.message || 'gagal');
      return {
        offline: false, tab,
        rows: j.data.map((r) => ({ name: r.player_name, score: r.score, me: !!this.pid && r.player_id === this.pid })),
        mine: j.mine ? { name: j.mine.player_name, score: j.mine.score, rank: j.mine.rank } : null,
        resetIn: j.reset_in_sec != null ? formatDuration(j.reset_in_sec) : '',
      };
    } catch {
      return this.localBoard(tab);
    }
  }

  // Melempar error kalau semua server tidak bisa dihubungi (pemanggil menganggapnya offline).
  async claimName(name) {
    const { j } = await this.call('claim_name', { body: { token: this.token, player_name: name.trim() } });
    return j;
  }

  async submit(stats) {
    const run = stats.run || await (runOf.get(stats) || NO_RUN);
    if (!run.id) {
      if (run.error === 'offline') return { ok: false, offline: true };
      return { ok: false, code: run.error === 'RATE_LIMIT' ? 'RATE_LIMIT' : 'NO_RUN' };
    }
    const body = {
      token: this.token, player_name: this.name, run_id: run.id,
      score: stats.score, max_chain: stats.bestChain, level: stats.level,
      clears: stats.clears, duration_sec: stats.duration,
    };
    try {
      const { j } = await this.call('submit', { body }, run.api);
      if (!j.success) return { ok: false, code: j.code, message: j.message };
      this.clearPending(stats);
      return { ok: true, newBest: j.new_best, rankWeekly: j.rank_weekly, rankAll: j.rank_alltime };
    } catch {
      this.queuePending({ ...stats, run });
      return { ok: false, offline: true };
    }
  }

  // Skor yang gagal terkirim disimpan (hanya yang terbaik, beserta run-nya) dan dicoba lagi nanti.
  queuePending(stats) {
    const p = store.get('pending');
    if (!p || stats.score > p.score) store.set('pending', { ...stats, week: localWeekStart() });
  }
  clearPending(stats) {
    const p = store.get('pending');
    if (p && p.score <= stats.score) store.set('pending', null);
  }
  // Kirim ulang skor tertunda. Hasil: 'sent' (terkirim), 'name' (perlu nama baru: nama lama ternyata
  // dipakai pemain lain; skor TETAP disimpan, run-nya belum terpakai di server), atau null.
  async flushPending() {
    const p = store.get('pending');
    if (p && (p.week !== localWeekStart() || !p.run)) { store.set('pending', null); return null; }
    if (!p) return null;
    if (!this.name) return 'name';
    const r = await this.submit(p);
    if (r.code === 'NAME_TAKEN' || r.code === 'BAD_NAME') return 'name';
    if (r.ok || !r.offline) store.set('pending', null);
    return r.ok ? 'sent' : null;
  }
}

return { CENTRAL_API, validName, formatDuration, Leaderboard };
})();

// ===================================================================== js/tutorial.js
__mod["tutorial"] = (function () {
const { W, H, BLOCK, MAT_STONE, MAT_GUN } = __mod["config"];

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

class Tutorial {
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

return { Tutorial };
})();

// ===================================================================== js/main.js
__mod["main"] = (function () {
const { Emitter, store } = __mod["util"];
const { Game } = __mod["game"];
const { Renderer, LW, LH } = __mod["render"];
const { Input } = __mod["input"];
const { sfx, unlockAudio, setSoundMode, getSoundMode, cycleSoundMode, setMusic, setDanger, setPausedMusic, audioDebug } = __mod["audio"];
const { Achievements } = __mod["achievements"];
const { Leaderboard, validName } = __mod["leaderboard"];
const { Tutorial } = __mod["tutorial"];
const { CFG, colorsForLevel, levelConfig } = __mod["config"];

const STEP = 1 / 60;
const canvas = document.getElementById('screen');
const consoleEl = document.getElementById('console');
const slotEl = document.getElementById('slot');
const nameBox = document.getElementById('namebox');
const creditsBox = document.getElementById('credits');
const nameForm = document.getElementById('nameform');
const nameInput = document.getElementById('nameinput');
const nameErr = document.getElementById('nameerr');
const nameSkip = document.getElementById('nameskip');

const events = new Emitter();
const game = new Game(events);
const renderer = new Renderer(canvas, events);
const lb = new Leaderboard();
const TIER_TITLE = { bronze: 'TROFI PERUNGGU!', silver: 'TROFI PERAK!', gold: 'TROFI EMAS!', secret: 'TROFI RAHASIA!' };
const ach = new Achievements(events, (def) => {
  renderer.showToast(TIER_TITLE[def.tier] || 'PRESTASI!', def.name, def.tier);
  sfx.achievement(def.tier);
  // prestasi berhadiah (tema) → beri tahu di mana hadiahnya bisa dipakai
  if (def.reward) setTimeout(() => renderer.showToast('HADIAH TERBUKA', `${def.reward} DI PENGATURAN`), 2700);
});

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

const ui = {
  screen: 'start', game, focus: 0, best: store.get('best', 0), over: null,
  lb: { tab: 'weekly', rows: [], loading: false }, lbStatus: '', lbStatusColor: null,
  ach: [], touch: isTouch, muted: false, playerName: lb.name, fromOver: false, scroll: { pos: 0, target: 0 },
};
// mode suara: all (musik + efek) | sfx (efek saja) | off
setSoundMode(store.get('soundMode', store.get('muted', false) ? 'off' : 'all'));
ui.soundMode = getSoundMode();
ui.muted = ui.soundMode === 'off';
const SOUND_LABEL = { all: 'MUSIK + EFEK', sfx: 'EFEK SAJA', off: 'MATI' };
// musik yang diputar per layar
const SCREEN_MUSIC = { title: 'title', board: 'title', ach: 'title', settings: 'title', help: 'title', play: 'game', pause: 'game', tutDone: 'game', over: null };
renderer.setPalette(store.get('palette', 'default'));

// Menu dengan isi dinamis (pause, settings) dihitung di menuItems().
const MENUS = {
  title: ['play', 'board', 'ach', 'settings', 'credits'],
  over: ['restart', 'board', 'menu'],
  board: ['back'],
  ach: ['back'],
  help: ['tutorial', 'back'],
  tutDone: ['play', 'menu'],
};

// ---------------------------------------------------------------- input
const input = new Input(onUiKey);

// Navigasi menu bersama untuk keyboard & tombol shell. cmd: up | down | left | right | ok | back
function uiNav(cmd) {
  if (ui.screen === 'pause' && cmd === 'back') { resume(); return; }
  if (ui.screen === 'board' && (cmd === 'left' || cmd === 'right')) {
    loadBoard(ui.lb.tab === 'weekly' ? 'alltime' : 'weekly');
    sfx.click();
    return;
  }
  // Peringkat & prestasi: ▲▼ menggulir daftar (menu hanya berisi KEMBALI).
  if (SCROLL_STEP[ui.screen] && (cmd === 'up' || cmd === 'down')) {
    scrollBy(cmd === 'up' ? -SCROLL_STEP[ui.screen] : SCROLL_STEP[ui.screen]);
    return;
  }
  const items = menuItems(ui.screen);
  if (!items) return;
  if (ui.screen === 'help' && (cmd === 'left' || cmd === 'right')) cmd = cmd === 'left' ? 'up' : 'down';   // tombol berdampingan
  if (cmd === 'down') { ui.focus = (ui.focus + 1) % items.length; sfx.cursor(); }
  else if (cmd === 'up') { ui.focus = (ui.focus + items.length - 1) % items.length; sfx.cursor(); }
  else if (cmd === 'ok') { sfx.click(); activate(items[ui.focus]); }
  else if (cmd === 'back') {
    if (ui.screen === 'board' || ui.screen === 'ach' || ui.screen === 'settings' || ui.screen === 'help') { sfx.back(); activate('back'); }
    else if (ui.screen === 'over' || ui.screen === 'tutDone') { sfx.back(); activate('menu'); }
  }
}

const KEY_NAV = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Space: 'ok', Escape: 'back' };

// ------------------------------------------------------- daftar gulir
// Satu langkah ▲▼ per layar (piksel logis = tinggi satu baris peringkat / kira-kira satu kartu prestasi).
const SCROLL_STEP = { board: 10, ach: 20 };
function scrollBy(d) {
  const s = ui.scroll, max = renderer.scrollArea ? renderer.scrollArea.max : 0;
  s.target = Math.max(0, Math.min(max, s.target + d));
}
const SCROLL_KEYS = { PageUp: -1, PageDown: 1, Home: -Infinity, End: Infinity };

function onUiKey(e) {
  if (nameBox.classList.contains('show')) return;
  if (creditsOpen()) {
    if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'Enter') { e.preventDefault(); closeCredits(); }
    return;
  }
  unlockAudio();
  if (ui.screen === 'start') { goTitle(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyF') { toggleFullscreen(); return; }
  if (e.code === 'KeyH' && ui.screen === 'title') { sfx.click(); activate('help'); return; }

  if (ui.screen === 'play') {
    if (e.code === 'KeyP' || e.code === 'Escape') pause();
    return;
  }
  if (ui.screen === 'pause' && e.code === 'KeyP') { resume(); return; }
  if (SCROLL_STEP[ui.screen] && e.code in SCROLL_KEYS && renderer.scrollArea) {
    e.preventDefault();
    const dir = SCROLL_KEYS[e.code];
    scrollBy(Number.isFinite(dir) ? dir * (renderer.scrollArea.h - 10) : dir);
    return;
  }

  const cmd = KEY_NAV[e.code];
  if (cmd) uiNav(cmd);
}

// ------------------------------------------------------- tombol shell
// Saat bermain: D-pad gerak (atas = jatuh), A putar, B putar balik, L/R miring, START jeda, SELECT suara.
// Di menu: D-pad navigasi, A/START pilih, B kembali.
// Saat bermain: ◀ ▶ geser, TURUN pelan, JATUH instan, PUTAR / BALIK, tahan MIRING L/R, II jeda, ♪ suara.
// Di menu: tombol di layar bisa disentuh langsung; ◀ ▶ ganti tab, TURUN pindah pilihan, PUTAR/JATUH pilih, BALIK kembali.
const PLAY_MAP = { left: 'left', right: 'right', down: 'soft', up: 'hardDrop', a: 'rotCW', b: 'rotCCW', l: 'tiltL', r: 'tiltR' };
const MENU_MAP = { up: 'up', down: 'down', left: 'left', right: 'right', a: 'ok', b: 'back' };

function shellPress(btn) {
  unlockAudio();
  // getar halus (Android); hanya setelah sentuhan asli supaya browser tidak memblokir
  const active = !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (navigator.vibrate && active) { try { navigator.vibrate(8); } catch { /* abaikan */ } }
  if (nameBox.classList.contains('show')) return;
  if (creditsOpen()) { if (btn === 'b' || btn === 'menu' || btn === 'a') closeCredits(); return; }
  if (ui.screen === 'start') { goTitle(); sfx.click(); return; }
  // MENU: saat main → jeda (berisi pengaturan); di jeda → lanjut; di layar lain → kembali
  if (btn === 'menu') {
    if (ui.screen === 'play') pause();
    else if (ui.screen === 'pause') resume();
    else uiNav('back');
    return;
  }
  if (ui.screen === 'play') {
    const a = PLAY_MAP[btn];
    if (a) input.press(a);
    return;
  }
  const cmd = MENU_MAP[btn];
  if (cmd) uiNav(cmd);
}

function shellRelease(btn) {
  const a = PLAY_MAP[btn];
  if (a) input.release(a);
}

for (const el of consoleEl.querySelectorAll('[data-btn]')) {
  const btn = el.dataset.btn;
  let down = false;
  const press = (e) => { e.preventDefault(); if (down) return; down = true; el.classList.add('on'); shellPress(btn); };
  const release = (e) => { if (e) e.preventDefault(); if (!down) return; down = false; el.classList.remove('on'); shellRelease(btn); };
  el.addEventListener('pointerdown', (e) => { try { el.setPointerCapture(e.pointerId); } catch { /* abaikan */ } press(e); });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', () => release());
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * LW, ((e.clientY - r.top) / r.height) * LH];
}
function inScrollArea(lx, ly) {
  const a = renderer.scrollArea;
  return a && lx >= a.x && lx < a.x + a.w + 4 && ly >= a.y && ly < a.y + a.h;
}

// Seret daftar dengan jari/mouse: posisi mengikuti langsung, lalu sisa kecepatan dilanjutkan sedikit.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  if (ui.screen === 'start') { goTitle(); return; }
  const [lx, ly] = toLogical(e);
  const id = renderer.hit(lx, ly);
  if (id) { if (id !== 'none') { sfx.click(); activate(id); } return; }   // 'none': bagian dalam modal
  if (inScrollArea(lx, ly)) {
    drag = { id: e.pointerId, y: ly, target: ui.scroll.target, lastY: ly, lastT: e.timeStamp, v: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const [, ly] = toLogical(e);
  const max = renderer.scrollArea ? renderer.scrollArea.max : 0;
  ui.scroll.target = ui.scroll.pos = Math.max(0, Math.min(max, drag.target - (ly - drag.y)));
  const dt = e.timeStamp - drag.lastT;
  if (dt >= 8) { drag.v = (ly - drag.lastY) / dt; drag.lastY = ly; drag.lastT = e.timeStamp; }
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (e.timeStamp - drag.lastT < 80) scrollBy(Math.max(-80, Math.min(80, -drag.v * 180)));   // lemparan singkat
  drag = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', (e) => {
  if (!SCROLL_STEP[ui.screen] || !renderer.scrollArea) return;
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const perLogical = r.height / LH;
  const d = e.deltaMode === 1 ? e.deltaY * 10 : e.deltaMode === 2 ? e.deltaY * renderer.scrollArea.h : e.deltaY / perLogical;
  scrollBy(d);
}, { passive: false });

// --------------------------------------------------------------- layar
function setScreen(s) {
  ui.screen = s;
  ui.focus = 0;
  ui.scroll = { pos: 0, target: 0 };
  drag = null;
  if (s in SCREEN_MUSIC && !(s === 'board' && ui.fromOver)) setMusic(SCREEN_MUSIC[s]);
  if (s !== 'play' && dangerOn) { dangerOn = false; setDanger(false); }
  setPausedMusic(s === 'pause');
}

function goTitle() {
  input.enabled = false;
  ui.playerName = lb.name;
  setScreen('title');
}

// Mode uji (untuk mencoba kesulitan):
//   ?jatuh=0.15  → kecepatan jatuh tetap 0,15 detik per baris di semua level
//   ?level=12    → mulai langsung di level 12
// Selama mode uji, skor tidak dikirim/disimpan dan prestasi tidak terbuka.
const TEST = {
  fall: Number(params.get('jatuh')) || 0,
  level: Math.max(1, Math.min(99, Math.floor(Number(params.get('level')) || 1))),
};
TEST.on = TEST.fall > 0 || TEST.level > 1;
if (TEST.fall > 0) CFG.FALL_OVERRIDE = Math.max(0.02, Math.min(2, TEST.fall));
ach.disabled = TEST.on;

function startGame() {
  unlockAudio();
  endTutorial();
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  game.reset(seed);
  if (TEST.level > 1) {
    // mulai langsung di level tertentu (warna, batu, mesiu, event ikut level itu)
    game.level = TEST.level;
    game.clears = (TEST.level - 1) * CFG.CLEARS_PER_LEVEL;
    game.numColors = colorsForLevel(TEST.level);
    game.eventTimer = Math.min(game.eventTimer, game.randRange(levelConfig(TEST.level).eventGap));
  }
  if (TEST.on) renderer.showToast('MODE UJI', 'SKOR & PRESTASI TIDAK DISIMPAN');
  ach.sessionNew = 0;
  ui.over = null;
  ui.lbStatus = '';
  overTimer = 0;
  lb.startRun();   // server mencatat waktu mulai; skor hanya diterima untuk run ini
  setScreen('play');
  enableInputNextFrame();
}

// ------------------------------------------------------------- TUTORIAL
// Pemain baru (belum pernah menyelesaikan/melewati tutorial) otomatis masuk tutorial saat menekan MAIN.
// Bisa diulang dari ikon ? di layar judul → CARA MAIN → MAIN TUTORIAL.
const tutorial = new Tutorial(game, events, () => {
  store.set('tutorialDone', true);
  input.enabled = false;
  input.releaseAll();
  sfx.levelUp();
  setScreen('tutDone');
});
ui.tutorial = tutorial;

function startTutorial() {
  unlockAudio();
  game.reset((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  ach.disabled = true;           // tutorial tidak membuka prestasi
  tutorial.start();
  ui.over = null;
  setScreen('play');
  enableInputNextFrame();
}

function endTutorial() {
  tutorial.stop();
  ach.disabled = TEST.on;
}

function skipTutorial() {
  store.set('tutorialDone', true);
  startGame();
}

function enableInputNextFrame() {
  input.enabled = false;
  requestAnimationFrame(() => { input.clear(); input.enabled = ui.screen === 'play'; });
}

function pause() {
  if (ui.screen !== 'play' || game.state !== 'play') return;
  input.enabled = false;
  input.releaseAll();
  sfx.pause();
  setScreen('pause');
}

function resume() {
  sfx.resume();
  setScreen('play');
  enableInputNextFrame();
}

function activate(id) {
  switch (id) {
    case 'play':
      if (!store.get('tutorialDone', false) && !TEST.on && ui.screen === 'title') startTutorial();
      else startGame();
      break;
    case 'restart': startGame(); break;
    case 'help': setScreen('help'); break;
    case 'tutorial': startTutorial(); break;
    case 'skipTut': skipTutorial(); break;
    case 'resume': resume(); break;
    case 'menu':
      if (tutorial.active) store.set('tutorialDone', true);   // keluar dari tutorial = tidak dipaksa lagi
      endTutorial();
      goTitle();
      break;
    case 'board':
      ui.fromOver = ui.screen === 'over';
      setScreen('board');
      loadBoard(ui.lb.tab || 'weekly');
      break;
    case 'ach': ui.ach = ach.list(); setScreen('ach'); break;
    case 'theme': toggleTheme(); break;
    case 'sound': toggleMute(); break;
    case 'settings': setScreen('settings'); break;
    case 'credits': openCredits(); break;
    case 'back':
      if (ui.screen === 'board' && ui.fromOver) { setScreen('over'); ui.focus = 1; }
      else goTitle();
      break;
    case 'tabWeekly': loadBoard('weekly'); break;
    case 'tabAll': loadBoard('alltime'); break;
  }
}

async function loadBoard(tab) {
  ui.lb = { tab, rows: [], loading: true };
  // dibuka dari game over → gulir otomatis ke baris pemain sendiri
  ui.scroll = { pos: 0, target: 0, revealMe: ui.fromOver };
  const res = await lb.get(tab);
  if (ui.lb.tab === tab) ui.lb = { ...res, loading: false };
}

function toggleMute() {
  ui.soundMode = cycleSoundMode();
  ui.muted = ui.soundMode === 'off';
  store.set('soundMode', ui.soundMode);
  // di layar jeda/pengaturan labelnya sudah terlihat di menu, jadi tidak perlu toast
  if (ui.screen !== 'pause' && ui.screen !== 'settings') renderer.showToast('SUARA', SOUND_LABEL[ui.soundMode]);
  sfx.toggle();
}

// Daftar tema (urutan = urutan saat tombol TEMA ditekan).
// unlock: null = gratis | id prestasi = hadiah prestasi itu (ditulis juga di kartu prestasinya, lihat achievements.js).
const THEMES = [
  { id: 'default', name: 'KLASIK', unlock: null },
  { id: 'senja', name: 'SENJA', unlock: null },
  { id: 'kontras', name: 'KONTRAS', unlock: null },
  { id: 'retro', name: 'RETRO', unlock: 'counter' },      // hadiah prestasi rahasia LAWAN ARUS
  { id: 'neon', name: 'NEON', unlock: 'quake' },          // hadiah prestasi rahasia GOYANG DUMANG!
  { id: 'kertas', name: 'KERTAS', unlock: 'close_call' }, // hadiah prestasi NYARIS!
];
function themeUnlocked(t) {
  if (!t.unlock || renderer.paletteName === t.id) return true;
  return ach.unlocked.has(t.unlock) || (t.id === 'retro' && ach.unlocked.has('secret_code'));  // secret_code: versi lama
}
// ------------------------------------------------------------- KREDIT
// Modal HTML (lihat index.html #credits): foto & link sosmed pembuat, mata kuliah, sumber aset.
function creditsOpen() { return creditsBox.classList.contains('show'); }
function openCredits() {
  creditsBox.classList.add('show');
  creditsBox.querySelector('.panel').scrollTop = 0;
  input.releaseAll();
  checkAlvinWebsite();
  setTimeout(() => document.getElementById('creditsclose').focus({ preventScroll: true }), 50);
}
function closeCredits() {
  creditsBox.classList.remove('show');
  sfx.back();
  ui.focus = MENUS.title.indexOf('credits');
}
document.getElementById('creditsclose').addEventListener('click', closeCredits);
creditsBox.addEventListener('click', (e) => { if (e.target === creditsBox) closeCredits(); });

// Website Alvin dicek saat KREDIT dibuka. Kalau tidak bisa dihubungi, tombolnya ditandai offline
// dan Instagram dipindah ke depan sebagai alternatif.
let alvinChecked = false;
function checkAlvinWebsite() {
  if (alvinChecked) return;
  alvinChecked = true;
  const web = document.getElementById('alvin-web');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  fetch('https://alvinzanua.site', { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
    .catch(() => {
      web.classList.add('down');
      web.textContent = 'WEBSITE (OFFLINE)';
      web.parentElement.appendChild(web); // Instagram jadi pilihan pertama
    })
    .finally(() => clearTimeout(timer));
}

function titleItems() { return MENUS.title; }
// Isi menu per layar. Jeda & pengaturan selalu memuat SUARA dan TEMA.
function menuItems(screen) {
  if (screen === 'pause') return tutorial.active ? ['resume', 'skipTut', 'menu'] : ['resume', 'restart', 'sound', 'theme', 'menu'];
  if (screen === 'settings') return ['sound', 'theme', 'back'];
  return MENUS[screen];
}
function toggleTheme() {
  const open = THEMES.filter(themeUnlocked);
  const i = open.findIndex((t) => t.id === renderer.paletteName);
  const next = open[(i + 1) % open.length].id;
  renderer.setPalette(next);
  store.set('palette', next);
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch { /* abaikan */ }
}

// -------------------------------------------------------- suara & event
events.on('move', () => sfx.move());
events.on('rotate', () => sfx.rotate());
// Suara mendarat sesuai material & posisi (stereo); hard drop punya hentakan tambahan.
events.on('land', (d) => { if (d.hard) sfx.hardDrop(d); else sfx.land(d); });
events.on('tiltStart', (dir) => sfx.tilt(dir));
events.on('tiltFail', () => sfx.tiltFail());
events.on('eventWarn', () => sfx.warn());
events.on('eventStart', (e) => {
  if (e.type === 'quake') sfx.quake();
  else if (e.type === 'wind') sfx.wind(e.dir);
  else sfx.force(e.dir);
});
events.on('windPush', (dir) => sfx.windPush(dir));
events.on('explode', (d) => sfx.explode(d));
const centerX = (cells) => {
  let sx = 0, n = 0;
  for (let k = 0; k < cells.length; k += 9) { sx += cells[k] % 80; n++; }
  return n ? sx / n : 40;
};
events.on('cleared', (d) => sfx.scatter(centerX(d.cells)));

// Perkenalan material baru (sekali per perangkat).
// Kunci = id material (lihat config.js): 1 batu, 2 mesiu.
const MATERIAL_INTRO = {
  2: ['MATERIAL BARU: MESIU', 'MELEDAK SAAT KENA CLEAR'],
  1: ['MATERIAL BARU: BATU', 'BERAT, TIDAK LONGSOR'],
};
events.on('spawn', (p) => {
  const intro = MATERIAL_INTRO[p.mat];
  if (!intro) return;
  const seen = store.get('seenMats', []);
  if (seen.includes(p.mat)) return;
  store.set('seenMats', [...seen, p.mat]);
  renderer.showToast(intro[0], intro[1]);
  sfx.material();
});
events.on('clear', (d) => sfx.clear(d.chain, centerX(d.cells)));
events.on('levelUp', () => sfx.levelUp());
events.on('quake', () => sfx.quake());
events.on('gameOver', onGameOver);

let overTimer = 0;
function onGameOver(stats) {
  input.enabled = false;
  input.releaseAll();
  if (tutorial.active) { startTutorial(); return; }   // seharusnya tidak terjadi (garis bahaya mati); mulai ulang saja
  sfx.gameOver();
  if (TEST.on) {
    // mode uji: hasil hanya ditampilkan, tidak masuk rekor, skor lokal, atau peringkat
    ui.over = { ...stats, newBest: false, newAch: 0 };
    overTimer = 0.9;
    ui.lbStatus = 'MODE UJI - SKOR TIDAK DISIMPAN';
    ui.lbStatusColor = renderer.pal.dim;
    return;
  }
  const newBest = stats.score > ui.best;
  if (newBest) { ui.best = stats.score; store.set('best', ui.best); }
  ui.over = { ...stats, newBest, newAch: 0 };
  overTimer = 0.9;
  lb.saveLocal(stats);
  if (stats.score > 0 && stats.duration >= 5) {
    if (!lb.name) {
      ui.lbStatus = 'ISI NAMA UNTUK PERINGKAT';
      ui.lbStatusColor = null;
      setTimeout(() => askName(() => submitScore(stats)), 900);
    } else submitScore(stats);
  }
}

async function submitScore(stats) {
  ui.lbStatus = 'MENGIRIM SKOR...';
  ui.lbStatusColor = null;
  const r = await lb.submit(stats);
  const P = renderer.pal;
  if (r.ok) {
    ui.lbStatus = r.newBest ? `REKOR MINGGU INI! #${r.rankWeekly}` : `PERINGKAT MINGGU INI #${r.rankWeekly}`;
    ui.lbStatusColor = r.newBest ? P.accent : P.text;
  } else if (r.offline) {
    ui.lbStatus = 'OFFLINE - DISIMPAN LOKAL';
    ui.lbStatusColor = P.danger;
  } else if (r.code === 'NAME_TAKEN' || r.code === 'BAD_NAME') {
    ui.lbStatus = 'NAMA SUDAH DIPAKAI';
    ui.lbStatusColor = P.danger;
    askName(() => submitScore(stats), 'Nama itu sudah dipakai pemain lain.');
  } else if (r.code === 'RATE_LIMIT') {
    ui.lbStatus = 'TERLALU CEPAT, COBA LAGI';
    ui.lbStatusColor = P.danger;
  } else {
    ui.lbStatus = 'SKOR TIDAK TERCATAT';
    ui.lbStatusColor = P.danger;
  }
}

// ------------------------------------------------------- input nama (DOM)
let nameDone = null;
function askName(onDone, error = '') {
  nameDone = onDone;
  nameInput.value = lb.name || '';
  nameErr.textContent = error;
  nameBox.classList.add('show');
  input.enabled = false;
  setTimeout(() => nameInput.focus(), 50);
}
function closeName() {
  nameBox.classList.remove('show');
  nameInput.blur();
}
nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  if (!validName(name)) { nameErr.textContent = 'Nama 2-16 karakter: huruf, angka, spasi, _ atau -'; return; }
  nameErr.textContent = 'Memeriksa nama...';
  try {
    const r = await lb.claimName(name);
    if (!r.success) {
      nameErr.textContent = r.code === 'NAME_TAKEN' ? 'Nama itu sudah dipakai pemain lain.' : (r.code === 'NO_DB' ? 'Server peringkat belum siap.' : 'Nama tidak valid.');
      if (r.code !== 'NO_DB') return;
    }
  } catch {
    // Offline: simpan nama lokal dulu, skor dikirim ulang nanti.
  }
  lb.setName(name);
  ui.playerName = name;
  closeName();
  const fn = nameDone; nameDone = null;
  if (fn) fn();
});
// Skor tertunda (gagal terkirim saat offline) dikirim ulang saat game dibuka. Kalau namanya ternyata
// sudah dipakai pemain lain, skor tetap disimpan dan pemain diminta memilih nama baru.
async function flushPendingScore() {
  const r = await lb.flushPending();
  if (r === 'sent') renderer.showToast('SKOR TERTUNDA', 'MASUK PERINGKAT');
  else if (r === 'name' && !nameBox.classList.contains('show')) {
    askName(flushPendingScore, lb.name
      ? `Nama "${lb.name}" sudah dipakai pemain lain. Pilih nama baru supaya skor tertundamu tersimpan.`
      : 'Isi nama supaya skor tertundamu tersimpan.');
  }
}
nameSkip.addEventListener('click', () => {
  closeName();
  nameDone = null;
  ui.lbStatus = 'SKOR TIDAK DIKIRIM';
  ui.lbStatusColor = renderer.pal.dim;
});

// -------------------------------------------------------------- layout
// Pilih bentuk shell sesuai orientasi, lalu sesuaikan kanvas dengan ukuran slot layar.
// Tombol sentuh hanya di perangkat layar sentuh (atau paksa dengan ?pad=1 / sembunyikan dengan ?pad=0).
const showPad = params.has('pad') ? params.get('pad') !== '0' : isTouch;
ui.touch = showPad;
consoleEl.classList.toggle('has-pad', showPad);

// Ukuran area terlihat untuk menentukan orientasi. Tinggi CSS memakai dvh (lihat style.css);
// visualViewport dipakai agar layout dihitung ulang saat bilah Safari/Chrome muncul/hilang.
function viewportSize() {
  return { w: window.innerWidth, h: window.innerHeight };
}

// Tinggi aplikasi = window.innerHeight (jendela LAYOUT). Safari iOS menghitung titik sentuh di
// koordinat jendela layout; 100dvh mengikuti jendela VISUAL dan saat bilah alamat berubah ukuran
// keduanya bisa berbeda → tombol tergambar lebih bawah dari area sentuhnya. dvh tetap jadi cadangan CSS.
function applyAppHeight() {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
}

// Kembalikan halaman ke posisi 0,0. Safari bisa meninggalkan halaman tergeser setelah keyboard ditutup
// atau bilah alamat mengecil/membesar, sehingga gambar dan area sentuh tidak sejajar.
function resetScroll() {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  const se = document.scrollingElement;
  if (se && se.scrollTop) se.scrollTop = 0;
  if (document.body.scrollTop) document.body.scrollTop = 0;
}

function layout() {
  applyAppHeight();
  resetScroll();
  const { w, h } = viewportSize();
  const portrait = h > w * 1.05;
  consoleEl.classList.toggle('portrait', portrait);
  consoleEl.classList.toggle('landscape', !portrait);
  // ukur setelah grid menyesuaikan
  canvas.style.width = '0px';
  canvas.style.height = '0px';
  const r = slotEl.getBoundingClientRect();
  renderer.resize(r.width - 2, r.height - 2);
}
let layoutQueued = false;
const queueLayout = () => {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => { layoutQueued = false; layout(); });
};
window.addEventListener('resize', queueLayout);
window.addEventListener('orientationchange', () => { queueLayout(); setTimeout(layout, 300); });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', queueLayout);
  window.visualViewport.addEventListener('scroll', resetScroll);
}
window.addEventListener('scroll', resetScroll, { passive: true });
window.addEventListener('pageshow', () => queueLayout());
// setelah keyboard (kotak nama) ditutup, iOS kadang tidak mengembalikan halaman → reset & hitung ulang
document.addEventListener('focusout', () => { setTimeout(() => { resetScroll(); layout(); }, 80); setTimeout(layout, 400); });
// Safari iOS kadang tetap menggulir halaman meski overflow:hidden → tolak gestur geser di luar kotak input.
document.addEventListener('touchmove', (e) => {
  if (!(e.target instanceof Element) || !e.target.closest('input, .credits')) e.preventDefault();
}, { passive: false });
if (window.ResizeObserver) new ResizeObserver(queueLayout).observe(document.getElementById('app'));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------- loop
let last = performance.now(), acc = 0, heart = 0, dangerOn = false;

function tick() {
  game.update(STEP, input.poll(STEP));
  tutorial.update(STEP);
}

function step(dt) {
  if (ui.screen === 'play') {
    if (game.state === 'play') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 4) { tick(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
      if (game.danger > 0) {
        heart -= dt;
        if (heart <= 0) { sfx.heartbeat(); heart = 0.7; }
      } else heart = 0;
      const danger = game.danger > 0;
      if (danger !== dangerOn) { dangerOn = danger; setDanger(danger); }
    } else if (overTimer > 0) {
      overTimer -= dt;
      if (overTimer <= 0) {
        ui.over.newAch = ach.sessionNew;
        setScreen('over');
      }
    }
  } else acc = 0;
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  step(dt);
  ui.titleItems = titleItems();
  ui.menuItems = menuItems(ui.screen);
  ui.tutView = tutorial.active || ui.screen === 'tutDone' ? tutorial.view(ui.touch) : null;
  ui.theme = renderer.paletteName;
  ui.themeName = (THEMES.find((t) => t.id === ui.theme) || THEMES[0]).name;
  // di Pengaturan: beri tahu kalau masih ada tema yang bisa dibuka lewat prestasi
  const locked = THEMES.filter((t) => !themeUnlocked(t)).length;
  ui.themeHint = locked ? `${locked} TEMA LAGI: HADIAH PRESTASI` : '';
  renderer.draw(dt, ui);
  requestAnimationFrame(frame);
}

layout();
window.addEventListener('load', layout);
flushPendingScore();
requestAnimationFrame(frame);

// ------------------------------------------------- hook untuk pengujian
window.advanceTime = (ms) => {
  const n = Math.max(1, Math.round(ms / (STEP * 1000)));
  for (let k = 0; k < n; k++) step(STEP);
  renderer.draw(0, ui);
};

window.render_game_to_text = () => {
  const g = game, p = g.piece;
  const heights = [];
  for (let bx = 0; bx < 10; bx++) {
    let top = 160;
    for (let y = 0; y < 160 && top === 160; y++) {
      for (let x = bx * 8; x < bx * 8 + 8; x++) if (g.sand.cells[y * 80 + x]) { top = y; break; }
    }
    heights.push(160 - top);
  }
  return JSON.stringify({
    note: 'grid 80x160 butir, origin kiri-atas, y ke bawah; heights = tinggi pasir per kolom blok',
    tutorial: tutorial.active ? { step: tutorial.key, done: tutorial.done, retry: tutorial.retry } : null,
    screen: ui.screen, state: g.state, score: g.score, level: g.level, chain: g.chain,
    clears: g.clears, colors: g.numColors, grains: g.sand.count(), danger: +g.danger.toFixed(2),
    tilt: { meter: +g.tilt.meter.toFixed(2), active: g.tilt.active, dir: g.tilt.dir, effective: g.effectiveTilt() },
    event: g.event ? { type: g.event.type, dir: g.event.dir, phase: g.event.phase, t: +g.event.t.toFixed(2) } : null,
    nextEventIn: g.event ? null : +g.eventTimer.toFixed(1),
    piece: p ? { type: p.type, color: p.color, x: p.x, y: p.y, rot: p.rot } : null,
    next: g.next, heights, clearing: !!g.clearing,
    materials: { stone: g.sand.countMat(1), gunpowder: g.sand.countMat(2), explosions: g.explosions },
  });
};

// ------------------------------------------------- debug sentuh (?debug=touch)
// Menampilkan ukuran viewport dan titik merah di posisi sentuhan yang diterima browser. Kalau titik merah
// tidak jatuh di bawah jari, selisihnya terlihat langsung di angka scrollY / offsetTop.
if (params.get('debug') === 'touch') {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:4px;top:4px;z-index:99;padding:4px 6px;background:rgba(0,0,0,.75);color:#6dff8a;font:11px/1.3 monospace;white-space:pre;pointer-events:none';
  document.body.appendChild(box);
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#ff3b3b;z-index:99;pointer-events:none;display:none';
  document.body.appendChild(dot);
  let last = '-';
  const info = () => {
    const vv = window.visualViewport;
    box.textContent = [
      `inner ${window.innerWidth}x${window.innerHeight}  dpr ${window.devicePixelRatio}`,
      `visual ${vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) : '-'}  offTop ${vv ? vv.offsetTop.toFixed(1) : '-'}  pgTop ${vv ? vv.pageTop.toFixed(1) : '-'}`,
      `scrollY ${window.scrollY}  body ${Math.round(document.body.getBoundingClientRect().height)}  app-h ${getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()}`,
      `sentuh terakhir: ${last}`,
    ].join('\n');
  };
  document.addEventListener('pointerdown', (e) => {
    dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; dot.style.display = 'block';
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const b = t && t.closest('[data-btn]');
    last = `${Math.round(e.clientX)},${Math.round(e.clientY)} → ${b ? b.dataset.btn : (t ? t.tagName.toLowerCase() : '-')}`;
    info();
  }, true);
  setInterval(info, 500);
  info();
}

window.sandtilt = { game, ui, events, input, startGame, audio: audioDebug };

return {  };
})();
})();
