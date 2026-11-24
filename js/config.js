// Semua angka yang bisa di-tuning ada di sini (lihat GDD bagian 4.3).

export const BLOCK = 8;            // 1 blok tetromino = 8x8 butir
export const COLS = 10;            // lebar papan dalam blok
export const ROWS = 20;            // tinggi papan dalam blok
export const W = COLS * BLOCK;     // 80 butir
export const H = ROWS * BLOCK;     // 160 butir

// Material butir. Setiap piece punya warna (1..5) DAN material.
export const MAT_SAND = 0;         // Pasir: longsor & ikut tilt
export const MAT_STONE = 1;        // Batu: hanya jatuh lurus, tidak longsor, tidak terdorong tilt/gempa
export const MAT_GUN = 2;          // Mesiu: seperti pasir, meledak kalau ikut/tersentuh clear

export const CFG = {
  // Material
  GUN_LEVEL: 2,                    // mesiu mulai muncul di level ini
  GUN_CHANCE: 0.1,
  STONE_LEVEL: 3,                  // batu mulai muncul di level ini
  STONE_CHANCE: 0.08,
  BLAST_RADIUS: 7,                 // radius ledakan per butir mesiu (dalam butir)

  TICK_HZ: 60,
  CONNECT_8: true,                 // clear dihitung dengan 8 arah (termasuk diagonal)
  CHECK_EVERY: 6,                  // cek jembatan tiap N tick selama pasir bergerak

  MOVE_STEP: BLOCK,                // geser kiri/kanan per 1 blok
  LOCK_DELAY: 0.2,                 // detik menempel sebelum piece hancur jadi pasir
  LOCK_RESETS: 8,
  SOFT_DROP_SPEED: 120,            // butir per detik saat soft drop

  GRAVITY_BASE: 0.8,               // detik per baris blok di level 1
  GRAVITY_DECAY: 0.85,
  GRAVITY_MIN: 0.08,
  CLEARS_PER_LEVEL: 5,
  BREATHER: 30,                    // detik kecepatan diturunkan 1 level saat warna baru masuk

  // Tilt: tahan Q/E selama meter masih ada.
  TILT_CAPACITY: 2.0,              // detik miring dari meter penuh
  TILT_REFILL: 4.0,                // detik untuk mengisi meter dari kosong ke penuh
  TILT_REFILL_DELAY: 0.4,          // jeda sebelum meter mulai terisi setelah dilepas
  TILT_MIN_START: 0.1,             // minimal isi meter untuk mulai miring

  // Event pengganggu
  EVENT_FIRST: [35, 50],           // detik sampai event pertama (acak di rentang ini)
  EVENT_GAP: [45, 75],             // jeda antar event (makin pendek di level tinggi)
  EVENT_WARN: 3,                   // detik peringatan sebelum event mulai
  QUAKE_DURATION: 1.6,
  QUAKE_JITTER: 0.35,
  QUAKE_SWAPS: 400,                // tukar butir acak per tick saat gempa (mengacak isi tumpukan)
  WIND_DURATION: 5,
  WIND_PUSH_EVERY: 0.45,
  FORCE_DURATION: 5,

  DANGER_Y: 2 * BLOCK,             // pasir di atas garis ini = bahaya
  DANGER_GRACE: 1.5,

  CLEAR_FLASH: 0.3,                // durasi kedip + hitstop saat clear
  CLEAR_FLASH_PER_CHAIN: 0.04,
  MAX_CHAIN_MULT: 8,

  DAS: 0.15,
  ARR: 0.05,
};

// Jumlah warna aktif berdasarkan level.
export function colorsForLevel(level) {
  if (level >= 6) return 5;
  if (level >= 3) return 4;
  return 3;
}

export const STORAGE_PREFIX = 'sandtilt.';
