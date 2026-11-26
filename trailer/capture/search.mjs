// Cari papan ALAMI (dibangun dari piece acak yang dijatuhkan seperti pemain biasa) yang menghasilkan momen bagus.
//
//   node capture/search.mjs chain        -> cari, simpan capture/plans/chain.json
//   node capture/search.mjs chain 300    -> coba 300 papan (default 120)
//
// Goal: chain (chain terpanjang), gunpowder (ledakan + batu hancur), tilt (clear hanya karena dimiringkan),
// save (papan melewati garis bahaya lalu satu piece menyelamatkan), board (papan alami biasa untuk event).
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const GOALS = {
  chain: { level: 6, colors: 4, pieces: [18, 30], special: 0 },
  gunpowder: { level: 9, colors: 4, pieces: [16, 26], special: 1 },
  tilt: { level: 3, colors: 3, pieces: [8, 16], special: 0 },
  save: { level: 12, colors: 5, pieces: [34, 60], special: 0, high: true },
  board: { level: 5, colors: 4, pieces: [14, 20], special: 0 },
};

// ------------------------------------------------------------ pencarian
function searchInPage({ goal, cfg, tries, seed0 }) {
  const T = window.__T;
  const g = T.offscreen();
  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const R = T.makeRng(seed0);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const DANGER_Y = 16;

  const surfaceTop = () => {   // baris pasir tertinggi
    const c = g.sand.cells;
    for (let i = 0; i < c.length; i++) if (c[i]) return Math.floor(i / 80);
    return 160;
  };

  // Pemain "biasa": dari beberapa posisi acak, pilih yang mendarat paling rendah (kadang asal, biar tidak rapi).
  function choosePlacement(type, color, mat, edges = false) {
    let best = null;
    const want = R() < 0.25 ? 1 : 4;   // jumlah posisi valid yang dibandingkan
    for (let k = 0, valid = 0; k < 40 && valid < want; k++) {
      const rot = Math.floor(R() * 4), col = edges ? pick([0, 0, 7, 8]) : Math.floor(R() * 10);
      // tanpa spawn(): spawn memakai rng game, sedangkan replay (T.build) tidak melakukan percobaan ini
      const p = { type, rot, x: col * 8, y: type === 'I' ? -8 : 0 };
      if (g.collides(p, p.x, p.y, p.rot)) continue;
      const y = g.dropY(p);
      if (y < (cfg.high ? 8 : 2)) continue;     // terlalu tinggi: keluar papan / menutup tempat munculnya piece
      valid++;
      if (!best || y > best.y) best = { y, pc: [type, color, mat, col, rot] };
    }
    return best && best.pc;
  }

  const why = {};
  const fail = (k) => { why[k] = (why[k] || 0) + 1; return null; };
  function makePlan() {
    const plan = { seed: Math.floor(R() * 1e9), level: cfg.level, colors: cfg.colors, score: 0, clears: 0, pieces: [] };
    T.prepare(g, plan);
    const n = cfg.pieces[0] + Math.floor(R() * (cfg.pieces[1] - cfg.pieces[0]));
    for (let k = 0; k < n; k++) {
      let mat = 0;
      if (cfg.special) { const r = R(); mat = r < 0.22 ? 2 : r < 0.32 ? 1 : 0; }
      // papan tinggi: setelah separuh penuh, tumpuk di pinggir (tengah atas tetap kosong untuk piece baru)
      const pc = choosePlacement(pick(TYPES), 1 + Math.floor(R() * cfg.colors), mat, cfg.high && surfaceTop() < 70);
      if (!pc) return fail('noPlacement');
      plan.pieces.push(pc);
      if (!T.place(g, pc)) return fail('place');
      if (!T.settle(g)) { const go = g.log.filter((e) => e[0] === 'gameOver').pop(); if (!why.sample) { const c = g.sand.cells, h = []; for (let bx = 0; bx < 10; bx++) { let t = 160; for (let y = 0; y < 160; y++) if (c[y * 80 + bx * 8 + 4]) { t = y; break; } h.push(t); } why.sample = { h, k: plan.pieces.length, last: pc }; } return fail('over:' + (go ? go[1].reason : '?')); }
      if (cfg.high && surfaceTop() < DANGER_Y) break;
    }
    T.settle(g, 120);
    if (g.state !== 'play') return fail('state');
    // bangun ulang persis seperti saat rekam, supaya snapshot = papan yang nanti direkam
    if (!T.build(g, plan) || g.state !== 'play') return fail('rebuild');
    if (cfg.high && surfaceTop() >= DANGER_Y) return null;       // harus melewati garis bahaya
    return plan;
  }

  // Jalankan cabang percobaan sampai pasir diam; ringkas hasilnya.
  function runTrial(snap, act) {
    T.restore(g, snap);
    g.log.length = 0;
    if (!act(g)) return null;
    let quiet = 0, maxChain = 0, frames = 0;
    for (; frames < 900; frames++) {
      const tilt = act.tilt && frames < act.tilt.frames ? act.tilt.dir : 0;
      g.update(T.STEP, tilt ? { actions: [], soft: false, tilt } : T.NO_INPUT);
      g.piece = null;
      if (g.state !== 'play') return null;
      maxChain = Math.max(maxChain, g.chain);
      quiet = !g.clearing && !g.dirty && g.chain === 0 ? quiet + 1 : 0;
      if (quiet > 20 && frames > (act.tilt ? act.tilt.frames : 0)) break;
      if (frames > 50 && maxChain === 0 && !act.tilt) break;   // tidak ada clear sama sekali -> hentikan cepat
    }
    const clears = g.log.filter((e) => e[0] === 'clear');
    const exps = g.log.filter((e) => e[0] === 'explode');
    return {
      chain: maxChain,
      grains: clears.reduce((a, e) => a + e[1].grains, 0),
      explosions: exps.length,
      stones: exps.reduce((a, e) => a + (e[1].stones || 0), 0),
      safe: surfaceTop() >= DANGER_Y,
      frames,
    };
  }

  const score = (r) => {
    if (!r) return -1;
    if (goal === 'chain') return r.chain * 1000 + r.grains / 10;
    if (goal === 'gunpowder') return r.explosions ? r.explosions * 400 + r.stones * 5 + r.chain * 100 + r.grains / 20 : -1;
    if (goal === 'tilt') return r.chain ? 500 + r.grains : -1;
    if (goal === 'save') return r.chain && r.safe ? r.grains + r.chain * 300 : -1;
    return 0;
  };

  let best = null;
  const t0 = performance.now();
  for (let t = 0; t < tries; t++) {
    const plan = makePlan();
    if (!plan) continue;
    const snap = T.snapshot(g);
    if (goal === 'board') { best = { plan, score: 0 }; break; }

    const cands = [];
    if (goal === 'tilt') {
      for (const dir of [-1, 1]) { const a = () => true; a.tilt = { dir, frames: 110 }; a.desc = { tilt: dir }; cands.push(a); }
    } else {
      for (const type of TYPES) for (let color = 1; color <= cfg.colors; color++) for (let rot = 0; rot < (type === 'O' ? 1 : 4); rot++)
        for (let col = 0; col < 10; col++) {
          const pc = [type, color, 0, col, rot];
          const a = (game) => T.place(game, pc);
          a.desc = { piece: pc };
          cands.push(a);
        }
    }
    for (const a of cands) {
      const r = runTrial(snap, a);
      const s = score(r);
      if (s > 0 && (!best || s > best.score)) best = { plan, trigger: a.desc, result: r, score: s };
    }
    if (best && (goal !== 'chain' || best.result.chain >= 5) && goal !== 'gunpowder' && goal !== 'save') {
      if (goal === 'tilt' && best.result.grains > 900) break;
      if (goal === 'chain') break;
    }
  }
  return { best, ms: Math.round(performance.now() - t0), why };
}

// ------------------------------------------------------------ node (tanpa browser: modul game murni)
globalThis.window = globalThis;
const { Game } = await import('../../js/game.js');
window.sandtilt = { game: new Game({ emit() {}, on() {} }) };
await import('./scenario.js');
globalThis.performance ??= { now: () => Date.now() };

const goal = process.argv[2];
const tries = Number(process.argv[3] || 120);
if (!GOALS[goal]) { console.error(`goal: ${Object.keys(GOALS).join(', ')}`); process.exit(1); }
const seed0 = Number(process.argv[4] || 1);
const { best, ms, why } = searchInPage({ goal, cfg: GOALS[goal], tries, seed0 });

if (!best) { console.log(`${goal}: tidak ketemu dalam ${tries} papan (${ms} ms). Alasan gagal: ${JSON.stringify(why)}`); process.exit(2); }
await mkdir(join(HERE, 'plans'), { recursive: true });
const out = { ...best.plan, trigger: best.trigger || null, expect: best.result || null };
const tag = process.argv[5] ? `-${process.argv[5]}` : '';
await writeFile(join(HERE, 'plans', `${goal}${tag}.json`), JSON.stringify(out));
console.log(`${goal}${tag}: ${ms} ms, ${out.pieces.length} piece, trigger ${JSON.stringify(out.trigger)}, hasil ${JSON.stringify(out.expect)}, gagal ${JSON.stringify(why)}`);
