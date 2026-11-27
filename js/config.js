// Semua angka yang bisa di-tuning ada di sini (lihat GDD bagian 4.3).

export const BLOCK = 8;            // 1 blok tetromino = 8x8 butir
export const COLS = 10;            // lebar papan dalam blok
export const ROWS = 20;            // tinggi papan dalam blok
export const W = COLS * BLOCK;     // 80 butir
export const H = ROWS * BLOCK;     // 160 butir

// Material butir. Setiap piece punya warna (1..5) DAN material.
export const MAT_SAND = 0;         // Pasir: longsor & ikut tilt
export const MAT_STONE = 1;        // Batu: benda kaku. Satu kelompok batu bergerak sebagai satu blok, ikut kemiringan tanah, tidak terdorong gempa
export const MAT_GUN = 2;          // Mesiu: seperti pasir, meledak kalau ikut/tersentuh clear

export const CFG = {
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
  EVENT_SPREAD: 0.2,               // jeda antar event acak ±20% dari rata-rata level (lihat eventGap)
  BOSS_EVENT_DELAY: 3,             // detik setelah masuk level boss sampai peringatan event yang pasti muncul
  QUAKE_DURATION: 1.6,
  QUAKE_JITTER: 0.35,
  QUAKE_SWAPS: 400,                // tukar butir acak per tick saat gempa (mengacak isi tumpukan)
  WIND_DURATION: 5,
  WIND_PUSH_EVERY: 0.45,
  FORCE_DURATION: 5,
  COUNTER_TIME: 1.5,               // detik menahan miring berlawanan saat Papan Miring → prestasi rahasia

  DANGER_Y: 2 * BLOCK,             // pasir di atas garis ini = bahaya
  DANGER_GRACE: 1.5,
  SPAWN_WAIT: 1.5,                 // detik piece berikutnya boleh menunggu tempat muncul kosong sebelum kalah
  NEAR_MISS: BLOCK,                // prestasi NYARIS: clear saat pasir sampai ≤ 1 blok di bawah garis bahaya (atau lewat)

  // Kedip + hitstop saat clear (lihat clearFlash di bawah). Selama kedip, tombol diabaikan.
  CLEAR_FLASH: 0.3,                // chain 1
  CLEAR_FLASH_PER_CHAIN: 0.04,     // tambahan per langkah chain...
  CLEAR_FLASH_MAX: 0.5,            // ...sampai batas ini (tercapai di chain 6)
  CLEAR_FLASH_FAST_CHAIN: 15,      // mulai chain ini kedip dipersingkat supaya chain panjang tidak tersendat
  CLEAR_FLASH_FAST: 0.2,
  MAX_CHAIN_MULT: 8,

  DAS: 0.15,
  ARR: 0.05,
};

// ------------------------------------------------------------ kesulitan per level
// Kurva bergerigi (GDD 4.2): tiap level ke-5 adalah level BOSS (event jauh lebih sering,
// kecepatan tidak ikut naik, event pasti muncul); level sesudahnya LEMBAH (kecepatan turun, event lebih longgar).
// Setelah kecepatan mentok (level 40) yang terus naik pelan hanya event dan batu.
const FALL = [0.8, 0.72, 0.65, 0.58, 0.58, 0.55, 0.5, 0.455, 0.41, 0.41, 0.38, 0.35, 0.32,
  0.29, 0.29, 0.27, 0.25, 0.23, 0.21, 0.21, 0.2, 0.19, 0.18, 0.17, 0.17];   // detik per baris, level 1..25
// Level 26..30 turun 0,01/level (0,16 → 0,12), lalu 0,11 di level 35 dan 0,10 (minimum) di level 40.
function fallFor(level) {
  if (level <= FALL.length) return FALL[level - 1];
  if (level <= 30) return Math.round((FALL[FALL.length - 1] - (level - FALL.length) * 0.01) * 100) / 100;
  if (level < 35) return 0.12;
  if (level < 40) return 0.11;
  return 0.10;
}
export const isBossLevel = (level) => level % 5 === 0;
export const isTroughLevel = (level) => level > 1 && level % 5 === 1;

// Lama kedip (detik) untuk langkah chain ke-n: naik pelan sampai batas, lalu dipersingkat di chain panjang.
// Contoh: chain 1 = 0,30 · chain 6+ = 0,50 · chain 15+ = 0,20.
export function clearFlash(chain) {
  if (chain >= CFG.CLEAR_FLASH_FAST_CHAIN) return CFG.CLEAR_FLASH_FAST;
  return Math.min(CFG.CLEAR_FLASH_MAX, CFG.CLEAR_FLASH + CFG.CLEAR_FLASH_PER_CHAIN * (chain - 1));
}

export function colorsForLevel(level) {
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
// Jeda rata-rata antar event di level normal: turun 1,5 dtk/level sampai 20 dtk (level 21),
// lalu 0,25 dtk/level sampai minimum 12 dtk (level 53). Tidak pernah naik lagi.
function normalGap(level) {
  if (level <= 21) return 50 - 1.5 * (level - 1);
  return Math.max(12, 20 - 0.25 * (level - 21));
}
// Boss: setengah jeda normal (min 9 dtk). Lembah: sama dengan level normal sebelum boss,
// jadi lebih santai dari boss tapi tidak pernah lebih jarang dari level-level sebelumnya.
function eventGap(level) {
  const mid = isBossLevel(level) ? Math.max(9, normalGap(level) * 0.5)
    : isTroughLevel(level) ? normalGap(level - 2) : normalGap(level);
  return [mid * (1 - CFG.EVENT_SPREAD), mid * (1 + CFG.EVENT_SPREAD)];
}

// Jenis event yang pasti muncul di level boss: bergiliran gempa → papan miring → angin.
const BOSS_EVENTS = ['quake', 'force', 'wind'];
export const bossEventType = (level) => BOSS_EVENTS[(Math.floor(level / 5) - 1) % BOSS_EVENTS.length];

// Semua angka kesulitan untuk satu level. Peluang batu/mesiu = peluang NYATA per piece.
export function levelConfig(level) {
  level = Math.max(1, Math.floor(level));
  const fall = CFG.FALL_OVERRIDE > 0 ? CFG.FALL_OVERRIDE : fallFor(level);
  return {
    fall, colors: colorsForLevel(level), stone: stoneChance(level), gun: gunChance(level),
    eventGap: eventGap(level), boss: isBossLevel(level), trough: isTroughLevel(level),
  };
}

export const STORAGE_PREFIX = 'sandtilt.';
