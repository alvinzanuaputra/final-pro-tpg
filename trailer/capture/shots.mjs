// Daftar shot yang direkam capture.mjs.
// Tiap shot: seed piece, warmup (frame dijalankan tapi tidak disimpan), frames (yang disimpan, 60 fps),
// dan actions: [frame, 'tap'|'down'|'up', KeyboardEvent.code]. Frame dihitung dari awal (termasuk warmup).

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

export const SHOTS = [
  {
    // Shot uji: piece mendarat dan pecah jadi pasir, beberapa kali di kolom berbeda.
    name: 'crumble',
    seed: 123,
    warmup: 30,
    frames: 360,   // 6 detik
    actions: [
      ...drop(40, -4),
      ...drop(100, 3, 1),
      ...drop(160, 0),
      ...drop(220, -2, 2),
      ...drop(280, 4),
      ...drop(340, -1, 1),
    ],
  },
];
