// Disuntikkan ke halaman game saat rekam (bukan bagian game). Membuat susunan papan siap pakai untuk shot trailer.
// Koordinat dalam butir: papan 80 x 160, origin kiri-atas. Warna 1..5 = merah, kuning, hijau, biru, ungu.
// Material: 0 pasir, 1 batu, 2 mesiu.
window.__T = (() => {
  const W = 80, H = 160;
  const g = () => window.sandtilt.game;
  let s = 99;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const T = {
    W, H,
    /** Kosongkan papan dan bekukan event acak (bisa dipicu manual dengan T.event). */
    clear() {
      g().sand.reset();
      g().eventTimer = 1e9;
      g().event = null;
      g().dirty = true;
      return T;
    },
    /** Isi persegi [x0,x1) x [y0,y1) dengan warna c dan material mat. */
    rect(x0, y0, x1, y1, c, mat = 0) {
      const sand = g().sand;
      for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
        for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
          const i = y * W + x;
          sand.cells[i] = c; sand.mat[i] = c ? mat : 0; sand.shade[i] = (rnd() * 4) | 0;
        }
      g().dirty = true;
      return T;
    },
    /** Gundukan pasir: puncak di (cx, top), lebar dasar 2*half, sampai lantai bawah `bottom`. */
    mound(cx, top, half, bottom, c, mat = 0) {
      for (let x = cx - half; x < cx + half; x++) {
        const h = Math.round((1 - Math.abs(x + 0.5 - cx) / half) * (bottom - top));
        T.rect(x, bottom - h, x + 1, bottom, c, mat);
      }
      return T;
    },
    /** Ganti piece aktif (dan berikutnya). type I O T S Z J L, x dalam kolom blok 0..9. */
    piece(type, color, mat = 0, col = null, rot = 0) {
      const game = g();
      game.next = { type, color, mat };
      game.spawn();
      if (col !== null) game.piece.x = col * 8;
      game.piece.rot = rot;
      return T;
    },
    next(type, color, mat = 0) { g().next = { type, color, mat }; return T; },
    /** Set level/warna aktif (untuk HUD). */
    level(n, colors) { g().level = n; if (colors) g().numColors = colors; return T; },
    score(n) { g().score = n; return T; },
    /** Jumlah clear sejauh ini (level naik tiap 5 clear) -> atur supaya level naik di momen yang diinginkan. */
    clears(n) { g().clears = n; return T; },
    /** Picu event: 'quake' | 'wind' | 'force', arah -1/1, langsung fase peringatan. */
    event(type, dir = 1, warn = 3) {
      g().event = { type, dir, phase: 'warn', t: warn, push: 0 };
      g().events.emit('eventWarn', g().event);
      return T;
    },
  };
  return T;
})();

// Catat semua event game per frame (untuk SFX yang pas di Remotion).
window.__EV = [];
window.__hookEvents = () => {
  const ev = window.sandtilt.game.events;
  const orig = ev.emit.bind(ev);
  ev.emit = (name, data) => {
    const d = {};
    if (data && typeof data === 'object') {
      for (const k of ['chain', 'hard', 'mat', 'type', 'dir', 'level', 'grains', 'stones', 'color']) if (k in data) d[k] = data[k];
      if (data.cells) d.size = data.cells.length;
    } else if (data !== undefined) d.v = data;
    window.__EV.push([name, d]);
    return orig(name, data);
  };
};
