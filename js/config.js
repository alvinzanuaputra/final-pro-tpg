// Semua angka yang bisa di-tuning ada di sini (lihat GDD bagian 4.3).

export const BLOCK = 8;            // 1 blok tetromino = 8x8 butir
export const COLS = 10;            // lebar papan dalam blok
export const ROWS = 20;            // tinggi papan dalam blok
export const W = COLS * BLOCK;     // 80 butir
export const H = ROWS * BLOCK;     // 160 butir

export const CFG = {
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

  TILT_DURATION: 0.4,
  TILT_CHARGES: 3,
  TILT_RECHARGE: 4,

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
  if (level >= 8) return 5;
  if (level >= 4) return 4;
  return 3;
}

export const STORAGE_PREFIX = 'sandtilt.';
