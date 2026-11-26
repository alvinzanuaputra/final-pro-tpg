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
const OUT_ROOT = resolve(HERE, '..', 'public', 'footage');
const FPS = 60;

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
  await page.clock.install({ time: 0 });                 // jam dibekukan: loop rAF game tidak jalan sendiri
  await page.addInitScript(SEEDED_RANDOM);
  if (shot.storage) await page.addInitScript((kv) => { for (const k in kv) localStorage.setItem(k, kv[k]); }, shot.storage);
  await page.goto(`${base}/?seed=${shot.seed}&lb=off${shot.query || ''}`);
  await page.waitForFunction(() => window.sandtilt && window.advanceTime);
  await page.evaluate(() => window.sandtilt.startGame());
  if (shot.setup) await page.evaluate(shot.setup);

  const dir = join(OUT_ROOT, shot.name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

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
    const res = await page.evaluate(({ acts, dt, grab }) => {
      for (const [kind, code] of acts) {
        if (kind !== 'up') window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
        if (kind !== 'down') window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
      }
      window.advanceTime(dt);
      const st = JSON.parse(window.render_game_to_text());
      return { png: grab ? document.getElementById('screen').toDataURL('image/png') : null,
        st: { score: st.score, chain: st.chain, clears: st.clears, level: st.level, grains: st.grains,
          explosions: st.materials.explosions, state: st.state, clearing: st.clearing } };
    }, { acts, dt: 1000 / FPS, grab: f >= shot.warmup });
    if (res.png) {
      await writeFile(join(dir, `${String(n).padStart(4, '0')}.png`), Buffer.from(res.png.split(',')[1], 'base64'));
      log.push(res.st);
      n++;
    }
  }
  await writeFile(join(dir, 'meta.json'), JSON.stringify({ name: shot.name, fps: FPS, frames: n,
    width: 800, height: 880, log }, null, 0));
  await page.close();
  const last = log[log.length - 1] || {};
  console.log(`  ${shot.name}: ${n} frame -> public/footage/${shot.name}/  (skor ${last.score}, clear ${last.clears}, chain max ${Math.max(0, ...log.map((s) => s.chain || 0))})`);
}

const only = process.argv[2];
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
