// Disuntikkan ke halaman game saat rekam/cari (bukan bagian game, kode game tidak diubah).
// Papan dibangun dengan MENJATUHKAN PIECE SUNGGUHAN (pecah jadi pasir oleh simulasi game), bukan menggambar pasir,
// supaya susunannya alami seperti hasil bermain.
//
// "plan" = { seed, level, colors, score, clears, pieces: [[type, color, mat, col, rot], ...] }
//   col = kolom blok kiri (0..9), rot = 0..3, mat 0 pasir / 1 batu / 2 mesiu. Warna 1..5.
window.__T = (() => {
  const STEP = 1 / 60;
  const NO_INPUT = { actions: [], soft: false, tilt: 0 };

  // RNG yang state-nya bisa disalin (mulberry32), dipasang ke game supaya cabang percobaan bisa diulang persis.
  function makeRng(seed) {
    const r = () => {
      r.s = (r.s + 0x6d2b79f5) | 0;
      let t = Math.imul(r.s ^ (r.s >>> 15), 1 | r.s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.s = seed | 0;
    return r;
  }

  /** Siapkan game untuk dibangun: rng tetap, level/warna/skor, event acak dibekukan, papan kosong. */
  function prepare(game, plan) {
    const rng = makeRng(plan.seed);
    game.rng = game.sand.rng = game.bag.rng = rng;
    game.sand.reset();                 // juga tick = 0 (arah pindai pasir bergantian per tick)
    game.time = 0;
    game.tilt = { meter: 1, dir: 0, active: false, used: 0, cool: 0 };
    game.prevWant = 0;
    game.lastTiltAt = -99;
    game.buffer = [];
    game.explosions = 0;
    game.breather = 0;
    game.checkTimer = 0;
    game.level = plan.level || 1;
    game.numColors = plan.colors || 3;
    game.score = plan.score || 0;
    game.clears = plan.clears || 0;
    game.chain = 0;
    game.clearing = null;
    game.event = null;
    game.eventTimer = 1e9;
    game.piece = null;
    game.danger = 0;
    return rng;
  }

  /** Taruh satu piece di kolom/rotasi tertentu lalu jatuhkan. false kalau posisinya tidak valid. */
  function place(game, [type, color, mat, col, rot]) {
    game.next = { type, color, mat };
    game.spawn();
    const p = game.piece;
    if (!p) return false;
    p.rot = rot;
    p.x = col * 8;
    if (game.collides(p, p.x, p.y, p.rot)) { game.piece = null; return false; }
    game.hardDrop();
    game.piece = null;           // piece berikutnya ditahan selama pasir mengendap
    return true;
  }

  /** Jalankan simulasi tanpa piece sampai pasir diam (atau batas frame). */
  function settle(game, maxFrames = 240) {
    let quiet = 0;
    for (let f = 0; f < maxFrames; f++) {
      game.update(STEP, NO_INPUT);
      game.piece = null;
      game.danger = 0;           // selama membangun, garis bahaya diabaikan (pemain belum "ada")
      if (game.state !== 'play') return false;
      quiet = !game.clearing && !game.dirty && game.chain === 0 ? quiet + 1 : 0;
      if (quiet > 20) return true;
    }
    return true;
  }

  /** Bangun papan dari plan. Mengembalikan false kalau game over di tengah jalan. */
  function build(game, plan) {
    prepare(game, plan);
    for (const pc of plan.pieces) {
      if (!place(game, pc)) return false;
      if (!settle(game)) return false;
    }
    settle(game, 120);
    return true;
  }

  // Salinan LENGKAP keadaan game (semua angka/boolean + tilt + papan + rng + tick), supaya setiap percobaan
  // dan rekaman mulai dari keadaan yang identik.
  function snapshot(game) {
    const s = game.sand, prim = {};
    for (const k of Object.keys(game)) { const v = game[k]; if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') prim[k] = v; }
    return { prim, tilt: { ...game.tilt }, cells: s.cells.slice(), mat: s.mat.slice(), shade: s.shade.slice(),
      rng: game.rng.s, tick: s.tick };
  }
  function restore(game, snap) {
    const s = game.sand;
    s.cells.set(snap.cells); s.mat.set(snap.mat); s.shade.set(snap.shade);
    s.tick = snap.tick;
    game.rng.s = snap.rng;
    Object.assign(game, snap.prim);
    game.tilt = { ...snap.tilt };
    game.clearing = null; game.event = null; game.piece = null; game.buffer = [];
  }

  /** Game terpisah (tanpa layar/suara) untuk mencari plan. Event dicatat ke game.log. */
  function offscreen() {
    const Game = window.sandtilt.game.constructor;
    const log = [];
    const g = new Game({ emit: (name, d) => log.push([name, d]), on() {} });
    g.log = log;
    return g;
  }

  return { STEP, NO_INPUT, makeRng, prepare, place, settle, build, snapshot, restore, offscreen };
})();

// ------------------------------------------------------------ rekam: papan dari plan + pemicu yang dimainkan
// cfg = { plan, warm: frame, steerFrom, fireAt, tiltFrames, score }
//  - papan dibangun dari plan (piece sungguhan), lalu piece pemicu muncul di atas dan DIGERAKKAN dengan tombol
//    ke kolom/rotasi target (seperti pemain), lalu di frame fireAt dijatuhkan.
//  - Tepat sebelum dijatuhkan, rng + tick dikembalikan ke kondisi saat pencarian -> hasil (chain, ledakan) sama persis.
//  - Selama rangkaian clear berlangsung piece berikutnya ditahan (seperti pencarian), lalu muncul lagi.
window.__stage = (cfg) => {
  const T = window.__T, game = window.sandtilt.game;
  // bangun papan tanpa memancarkan event: tidak ada angka skor, partikel, suara, atau banner sisa pembangunan
  const ev = game.events, emit = ev.emit;
  ev.emit = () => {};
  T.build(game, cfg.plan);
  ev.emit = emit;
  if (cfg.score != null) game.score = cfg.score;
  const S = T.snapshot(game);
  const trig = cfg.plan.trigger;
  if (trig && trig.piece) { game.next = { type: trig.piece[0], color: trig.piece[1], mat: trig.piece[2] }; game.spawn(); }
  else if (cfg.spawn !== false) game.spawn();
  game.gravityInterval = () => 0.9;  // piece pemicu turun pelan selama diarahkan (pasir tidak terpengaruh)
  if (cfg.event) {                   // event pengganggu langsung fase peringatan
    const [type, dir, warn] = cfg.event;
    game.event = { type, dir, phase: 'warn', t: warn, push: 0 };
    game.events.emit('eventWarn', game.event);
  }
  game.danger = cfg.danger || 0;     // < 0 = waktu tambahan di atas garis bahaya sebelum pemicu
  window.__S = S; window.__CFG = cfg; window.__hold = false; window.__quiet = 0; window.__fired = null;
  // jeda awal seperti pemain yang baru melihat piece, lalu mulai bergerak
  window.__human = { next: (cfg.steerFrom || 0) + 8 + Math.floor(Math.random() * 10), target: 4, retarget: 0, wobbled: false };
};

const KEY = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code })); };

/** Dipanggil tiap frame SEBELUM advanceTime. f = frame sejak mulai (termasuk warmup). */
window.__frame = (f) => {
  const cfg = window.__CFG; if (!cfg) return;
  const T = window.__T, game = window.sandtilt.game, trig = cfg.plan.trigger || {};
  const p = game.piece;
  const H = window.__human;
  // Piece pemicu: diarahkan ke target seperti pemain (jeda antar tombol tidak rata, kadang salah arah dulu lalu
  // dikoreksi); begitu sampai, jatuhkan (paling lambat fireAt).
  let ready = false;
  if (trig.piece && p && window.__fired == null && f >= cfg.steerFrom) {
    const [, , , col, rot] = trig.piece;
    ready = p.rot === rot && p.x === col * 8;
    if (!ready && f >= H.next) {
      if (!H.wobbled && Math.random() < 0.5) { KEY(Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight'); H.wobbled = true; }
      else if (p.rot !== rot) KEY('ArrowUp');
      else KEY(p.x < col * 8 ? 'ArrowRight' : 'ArrowLeft');
      H.next = f + 3 + Math.floor(Math.random() * 6);
    }
  } else if (p && !(trig.piece && window.__fired == null) && f >= H.next) {
    // Piece lain (event, setelah pemicu): pemain "menimbang" posisi -> geser ke kolom incaran, sesekali putar.
    if (f >= H.retarget) { H.target = Math.floor(Math.random() * 8); H.retarget = f + 40 + Math.floor(Math.random() * 50); }
    const r = Math.random();
    if (r < 0.3) KEY('ArrowUp');
    else if (p.x !== H.target * 8) KEY(p.x < H.target * 8 ? 'ArrowRight' : 'ArrowLeft');
    else if (r < 0.5) KEY('ArrowUp');
    H.next = f + 5 + Math.floor(Math.random() * 12);
  }
  if (window.__fired == null && (f === cfg.fireAt || (ready && f >= (cfg.fireMin ?? cfg.steerFrom)))) {
    window.__fired = f;
    const S = window.__S;
    T.restore(game, S);              // keadaan persis seperti saat pencarian
    if (cfg.score != null) game.score = cfg.score;
    delete game.gravityInterval;     // kembali ke kecepatan level
    game.piece = null;
    if (trig.piece) {
      T.place(game, trig.piece);
      game.piece = null;
    }
    if (trig.tilt) window.dispatchEvent(new KeyboardEvent('keydown', { code: trig.tilt < 0 ? 'KeyQ' : 'KeyE', key: 'x' }));
    window.__hold = true; window.__quiet = 0;
  }
  if (trig.tilt && f === window.__fired + (cfg.tiltFrames || 110))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: trig.tilt < 0 ? 'KeyQ' : 'KeyE', key: 'x' }));
};

/** Dipanggil tiap frame SESUDAH advanceTime: tahan piece sampai rangkaian clear selesai. */
window.__after = (f) => {
  const cfg = window.__CFG; if (!cfg || !window.__hold) return;
  const game = window.sandtilt.game;
  game.piece = null;
  window.__quiet = !game.clearing && !game.dirty && game.chain === 0 ? window.__quiet + 1 : 0;
  const tiltDone = !(cfg.plan.trigger || {}).tilt || f > window.__fired + (cfg.tiltFrames || 110);
  if (window.__quiet > 20 && tiltDone) { window.__hold = false; game.spawn(); }
};

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
