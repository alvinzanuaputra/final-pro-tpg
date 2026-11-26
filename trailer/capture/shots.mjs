// Daftar shot yang direkam capture.mjs.
// Tiap shot: seed piece, warmup (frame dijalankan tapi tidak disimpan), frames (yang disimpan, 60 fps),
// setup (opsional, dijalankan di halaman; window.__T dari scenario.js untuk menyusun papan),
// dan actions: [frame, 'tap'|'down'|'up', KeyboardEvent.code]. Frame dihitung dari awal (termasuk warmup).
//
// Warna: 1 merah, 2 kuning, 3 hijau, 4 biru, 5 ungu. Material: 0 pasir, 1 batu, 2 mesiu.
// Trik pemicu: permukaan papan dibuat RATA (pasir tidak longsor), satu warna menyentuh dinding kiri dan naik ke
// permukaan di sisi kanan, sedangkan kolom paling kanan berwarna lain. Piece warna itu dijatuhkan di atas sambungan
// -> menyentuh dinding kanan -> jembatan -> clear.

// Helper: jatuhkan piece ke kolom tertentu. dx < 0 = geser kiri, dx > 0 = geser kanan, rot = jumlah putar.
function drop(at, dx, rot = 0, gap = 4) {
  const acts = [];
  let f = at;
  for (let i = 0; i < rot; i++) { acts.push([f, 'tap', 'ArrowUp']); f += gap; }
  const key = dx < 0 ? 'ArrowLeft' : 'ArrowRight';
  for (let i = 0; i < Math.abs(dx); i++) { acts.push([f, 'tap', key]); f += gap; }
  acts.push([f + 6, 'tap', 'Space']);
  return acts;
}
const hold = (code, from, to) => [[from, 'down', code], [to, 'up', code]];

export const SHOTS = [
  {
    // Piece mendarat dan pecah jadi pasir, beberapa kali di kolom berbeda.
    name: 'crumble',
    seed: 123,
    warmup: 30,
    frames: 360,
    actions: [
      ...drop(40, -4),
      ...drop(100, 3, 1),
      ...drop(160, 0),
      ...drop(220, -2, 2),
      ...drop(280, 4),
      ...drop(340, -1, 1),
    ],
  },
  // ---- Shot di bawah ini memakai papan ALAMI dari capture/plans/*.json (hasil search.mjs):
  // papan dibangun dari piece acak sungguhan, lalu pemicunya dimainkan (piece diarahkan dengan tombol, atau tilt ditahan).
  { name: 'tilt', plan: 'tilt', seed: 7, warmup: 90, steerFrom: 90, fireAt: 120, frames: 220, score: 4180 },
  {
    name: 'chain', plan: 'chain-s202', seed: 11, warmup: 90, steerFrom: 92, fireAt: 160, frames: 330, score: 12450,
    // trofi "REAKSI BERANTAI" (chain x3) sengaja belum terbuka -> toast muncul di tengah chain
    storage: { ach: ['first_bridge', 'chain3', 'chain5', 'tilt_master', 'close_call', 'clean_board', 'boom', 'stone_breaker', 'no_tilt', 'marathon', 'quake', 'counter'].filter((a) => a !== 'chain3') },
  },
  { name: 'gunpowder', plan: 'gunpowder', seed: 21, warmup: 90, steerFrom: 92, fireAt: 160, frames: 240, score: 28760 },
  { name: 'save', plan: 'save', seed: 61, warmup: 50, steerFrom: 52, fireAt: 72, frames: 260, score: 87340, danger: -0.6 },
  // event pengganggu di papan alami
  { name: 'quake', plan: 'board', seed: 31, warmup: 60, frames: 200, score: 21300, event: ['quake', 1, 1.5] },
  { name: 'wind', plan: 'board', seed: 41, warmup: 60, frames: 240, score: 9870, event: ['wind', 1, 1.4] },
  { name: 'force', plan: 'board', seed: 51, warmup: 60, frames: 240, score: 41220, event: ['force', 1, 1.4],
    actions: [...hold('KeyQ', 200, 280)] },
];
