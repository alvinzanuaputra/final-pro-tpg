// Rekam gameplay SandTilt frame per frame (deterministik) untuk trailer.
//
//   node capture/capture.mjs            -> rekam semua shot di shots.mjs
//   node capture/capture.mjs crumble    -> rekam satu shot
//
// Cara kerja: game dibuka di Chromium headless dengan jam palsu (requestAnimationFrame tidak pernah jalan),
// lalu tiap frame skrip memanggil advanceTime(1000/60) dan menyimpan isi canvas. Hasilnya 60 fps sempurna,
// sama persis setiap kali direkam (seed piece + Math.random dibuat tetap).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS } from './shots.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = resolve(HERE, '..', '..');            // root repo (index.html game)
// bahasa UI game saat merekam: --lang=en | --lang=id (default id). Rekaman tiap bahasa di folder sendiri.
const LANG = (process.argv.find((a) => a.startsWith('--lang=')) || '--lang=id').slice(7);
const OUT_ROOT = resolve(HERE, '..', 'public', 'footage', LANG);
const FPS = 60;
const window_stage = (cfg) => window.__stage(cfg);
const ALL_ACH = ['tutorial', 'first_bridge', 'chain3', 'tilt_master', 'close_call', 'clean_board', 'boom', 'stone_breaker',
  'no_tilt', 'survivor', 'marathon', 'chain5', 'quake', 'counter'];
// versi data sama dengan main.js (kalau beda, game mereset skor/prestasi saat dibuka); tutorial dianggap selesai
export const DEFAULT_STORAGE = { ach: ALL_ACH, achVersion: 2, scoreVersion: 2, tutorialDone: true, seenMats: [1, 2], best: 152340 };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg',
  '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function serveGame() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(GAME_ROOT, path === '/' ? 'index.html' : path));
    if (!file.startsWith(GAME_ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Math.random tetap (efek partikel render.js memakainya), supaya rekaman bisa diulang.
const SEEDED_RANDOM = `(() => {
  let s = 0x9e3779b9;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;

async function captureShot(browser, base, shot) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.clock.install({ time: 0 });                 // jam palsu (masih berjalan sampai di-pause di bawah)
  await page.addInitScript(SEEDED_RANDOM);
  await page.addInitScript({ path: join(HERE, 'scenario.js') });
  // Pemain "berpengalaman": semua trofi sudah terbuka (tidak ada toast mengganggu), material sudah dikenal,
  // skor terbaik realistis. Shot boleh menimpa lewat shot.storage (mis. menyisakan satu trofi untuk dimunculkan).
  const storage = { ...DEFAULT_STORAGE, lang: LANG, ...(shot.storage || {}) };
  await page.addInitScript((kv) => { for (const k in kv) localStorage.setItem('sandtilt.' + k, JSON.stringify(kv[k])); }, storage);
  await page.goto(`${base}/?seed=${shot.seed}&lb=off${shot.query || ''}`);
  await page.waitForFunction(() => window.sandtilt && window.advanceTime);
  // Bekukan jam: tanpa ini loop requestAnimationFrame game tetap jalan real-time di sela rekaman dan menggeser
  // hasil +-1 frame (tidak deterministik). Setelah pause, game hanya maju lewat advanceTime().
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  // startGame() mengaktifkan input di requestAnimationFrame berikutnya; jam sedang dijeda, jadi aktifkan langsung
  await page.evaluate(() => { window.sandtilt.startGame(); window.sandtilt.input.enabled = true; window.__hookEvents(); });
  if (shot.setup) await page.evaluate(shot.setup);
  if (shot.plan) {
    const plan = JSON.parse(await readFile(join(HERE, 'plans', `${shot.plan}.json`), 'utf8'));
    await page.evaluate(window_stage, { plan, steerFrom: shot.steerFrom ?? 0, fireAt: shot.fireAt, fireMin: shot.fireMin, tiltFrames: shot.tiltFrames,
      score: shot.score, spawn: shot.spawn, danger: shot.danger, event: shot.event });
  }
  await page.evaluate(() => { window.__EV.length = 0; });

  const dir = join(OUT_ROOT, shot.name);
  if (!DRY) { await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true }); }

  // Jadwal aksi: [frame, 'tap'|'down'|'up', KeyCode] -> dikelompokkan per frame
  const byFrame = new Map();
  for (const [f, kind, code] of shot.actions || []) {
    if (!byFrame.has(f)) byFrame.set(f, []);
    byFrame.get(f).push([kind, code]);
  }

  const total = shot.warmup + shot.frames;
  const log = [];
  let n = 0;
  for (let f = 0; f < total; f++) {
    const acts = byFrame.get(f) || [];
    const res = await page.evaluate(({ acts, dt, grab, f }) => {
      window.__frame && window.__frame(f);
      for (const [kind, code] of acts) {
        if (kind !== 'up') window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
        if (kind !== 'down') window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
      }
      window.advanceTime(dt);
      window.__after && window.__after(f);
      const st = JSON.parse(window.render_game_to_text());
      const ev = window.__EV.splice(0);
      return { png: grab ? document.getElementById('screen').toDataURL('image/png') : null,
        st: { score: st.score, chain: st.chain, clears: st.clears, level: st.level, grains: st.grains,
          explosions: st.materials.explosions, state: st.state, clearing: st.clearing, ev } };
    }, { acts, dt: 1000 / FPS, grab: !DRY && f >= shot.warmup, f });
    if (f >= shot.warmup) {
      if (res.png) await writeFile(join(dir, `${String(n).padStart(4, '0')}.png`), Buffer.from(res.png.split(',')[1], 'base64'));
      log.push(res.st);
      n++;
    }
  }
  if (!DRY) await writeFile(join(dir, 'meta.json'), JSON.stringify({ name: shot.name, fps: FPS, frames: n,
    width: 800, height: 880, log }, null, 0));
  await page.close();
  const last = log[log.length - 1] || {};
  const evs = {};
  log.forEach((st, i) => st.ev.forEach(([name, d]) => { if (!['move', 'rotate', 'spawn'].includes(name)) (evs[name] ||= []).push(i + (d.chain ? '(x' + d.chain + ')' : '')); }));
  console.log(`  ${shot.name}${DRY ? ' [dry]' : ''}: ${n} frame  (skor ${last.score}, clear ${last.clears}, chain max ${Math.max(0, ...log.map((s) => s.chain || 0))}, ledakan ${last.explosions}, state ${last.state})`);
  for (const k in evs) console.log(`     ${k}: ${evs[k].slice(0, 12).join(' ')}${evs[k].length > 12 ? ' ...' : ''}`);
}

const DRY = process.argv.includes('--dry');
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
console.log(`bahasa game: ${LANG}`);
const shots = SHOTS.filter((s) => !only || s.name === only);
if (!shots.length) { console.error(`Shot "${only}" tidak ada. Pilihan: ${SHOTS.map((s) => s.name).join(', ')}`); process.exit(1); }

const server = await serveGame();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  for (const shot of shots) await captureShot(browser, base, shot);
} finally {
  await browser.close();
  server.close();
}
