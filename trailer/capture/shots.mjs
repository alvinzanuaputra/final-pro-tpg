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
  {
    // Miring: gundukan kuning belum menyentuh dinding kanan; tahan E -> pasir mengalir -> jembatan -> clear.
    name: 'tilt',
    seed: 7,
    warmup: 20,
    frames: 210,
    setup: () => {
      const T = window.__T.clear();
      T.rect(0, 148, 36, 160, 3).rect(36, 148, 80, 160, 4);          // dasar hijau | biru
      T.mound(6, 96, 62, 148, 2);                                     // gundukan kuning dari dinding kiri
      T.mound(74, 128, 10, 148, 1);                                   // gundukan merah kecil di kanan
      T.level(3, 4).score(4180).piece('T', 5, 0, 3);
    },
    actions: [...hold('KeyE', 50, 150)],
  },
  {
    // Chain: jembatan merah memicu runtuhan berlapis -> kuning -> hijau -> biru (-> ungu).
    name: 'chain',
    seed: 11,
    // trofi "REAKSI BERANTAI" sengaja belum terbuka -> toast muncul saat chain x3
    storage: { ach: ['first_bridge', 'chain5', 'tilt_master', 'close_call', 'clean_board', 'boom', 'stone_breaker', 'no_tilt', 'marathon', 'quake', 'counter'] },
    warmup: 20,
    frames: 300,
    setup: () => {
      const T = window.__T.clear();
      T.rect(0, 96, 36, 104, 5).rect(36, 96, 72, 104, 1).rect(72, 96, 80, 104, 5);
      T.rect(0, 104, 36, 112, 4).rect(36, 104, 44, 112, 1).rect(44, 104, 56, 112, 4).rect(56, 104, 64, 112, 3).rect(64, 104, 80, 112, 4);
      T.rect(0, 112, 20, 128, 3).rect(20, 112, 28, 128, 2).rect(28, 112, 36, 128, 3).rect(36, 112, 44, 128, 1).rect(44, 112, 80, 128, 3);
      T.rect(0, 128, 36, 152, 2).rect(36, 128, 44, 152, 1).rect(44, 128, 80, 152, 2);
      T.rect(0, 152, 44, 160, 1).rect(44, 152, 80, 160, 2);
      T.level(6, 5).clears(27).score(12450).piece('O', 1, 0, 8);   // clear ke-30 (chain x3) = naik level 7
    },
    actions: [[45, 'tap', 'Space']],
  },
  {
    // Mesiu: jembatan merah menyalakan urat mesiu -> ledakan berantai, batu ikut hancur/meluncur.
    name: 'gunpowder',
    seed: 21,
    warmup: 20,
    frames: 240,
    setup: () => {
      const T = window.__T.clear();
      T.rect(0, 144, 40, 160, 3).rect(40, 144, 80, 160, 4);                       // dasar
      T.rect(0, 128, 64, 144, 1).rect(64, 128, 80, 144, 5);                       // lapisan merah
      T.rect(0, 112, 56, 128, 2).rect(56, 112, 64, 128, 1).rect(64, 112, 80, 128, 5);   // permukaan + tiang merah
      T.rect(10, 130, 18, 140, 1, 2).rect(46, 134, 54, 144, 1, 2).rect(46, 144, 54, 156, 4, 2);   // urat mesiu
      T.rect(26, 118, 34, 128, 2, 2);                                             // kantong mesiu di lapisan kuning
      T.rect(8, 96, 24, 112, 4, 1).rect(30, 104, 46, 112, 3, 1);                 // batu di permukaan
      T.level(9, 5).score(28760).piece('I', 1, 0, 6);
    },
    actions: [[50, 'tap', 'Space']],
  },
  {
    // Gempa: papan bergetar, gundukan runtuh dan pasir tercampur.
    name: 'quake',
    seed: 31,
    warmup: 10,
    frames: 200,
    setup: () => {
      const T = window.__T.clear();
      // perbukitan landai tiga warna (tidak ada warna yang menyentuh dua dinding sekaligus)
      for (let x = 0; x < 80; x++) {
        const top = Math.round(100 - 12 * Math.sin(x / 8) - (x % 27) * 0.4);
        T.rect(x, top, x + 1, 148, x < 27 ? 1 : x < 54 ? 2 : 3).rect(x, 148, x + 1, 160, x < 40 ? 5 : 4);
      }
      T.level(8, 5).score(21300).piece('L', 2, 0, 4).event('quake', 1, 0.6);
    },
  },
  {
    // Angin: piece yang jatuh didorong ke samping.
    name: 'wind',
    seed: 41,
    warmup: 10,
    frames: 240,
    setup: () => {
      const T = window.__T.clear();
      T.mound(10, 112, 26, 160, 2).mound(40, 120, 22, 160, 3).mound(70, 108, 20, 160, 1);
      T.level(5, 4).score(9870).piece('T', 4, 0, 2).event('wind', 1, 0.5);
    },
  },
  {
    // Papan miring paksa: seluruh pasir meluncur ke satu sisi, pemain melawan dengan Q.
    name: 'force',
    seed: 51,
    warmup: 10,
    frames: 240,
    setup: () => {
      const T = window.__T.clear();
      T.rect(0, 136, 40, 160, 3).rect(40, 136, 80, 160, 5);
      T.mound(20, 96, 24, 136, 2).mound(58, 104, 24, 136, 4);
      T.rect(36, 120, 44, 136, 5, 1);
      T.level(11, 5).score(41220).piece('S', 1, 0, 3).event('force', 1, 0.5);
    },
    actions: [...hold('KeyQ', 150, 230)],
  },
  {
    // Nyaris kalah: pasir melewati garis bahaya, satu piece merah menyelamatkan (clear besar, semuanya runtuh).
    name: 'save',
    seed: 61,
    warmup: 10,
    frames: 270,
    setup: () => {
      const T = window.__T.clear();
      // merah: dasar menyentuh dinding kiri + tiang naik ke permukaan (baris 40) di x64-72; kolom kanan ungu
      T.rect(0, 120, 64, 160, 1).rect(64, 40, 72, 160, 1).rect(72, 40, 80, 160, 5);
      for (let k = 0; k < 10; k++) T.rect(0, 40 + k * 8, 64, 48 + k * 8, k % 2 ? 4 : 2);   // garis kuning/biru
      T.mound(0, 6, 34, 40, 3).mound(0, 16, 22, 40, 4);                                 // gunungan melewati garis bahaya
      T.level(14, 5).score(87340).piece('O', 1, 0, 8);
      window.sandtilt.game.gravityInterval = () => 0.5;   // piece turun pelan supaya ketegangan terasa
      window.sandtilt.game.danger = -1.2;                  // tambahan waktu sebelum game over (detak jantung terdengar)
    },
    actions: [[70, 'tap', 'Space']],
  },
];
