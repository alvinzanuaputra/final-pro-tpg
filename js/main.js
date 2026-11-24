import { Emitter, store } from './util.js';
import { Game } from './game.js';
import { Renderer, LW, LH } from './render.js';
import { Input } from './input.js';
import { sfx, unlockAudio, setMuted, isMuted } from './audio.js';
import { Achievements } from './achievements.js';
import { Leaderboard, validName } from './leaderboard.js';

const STEP = 1 / 60;
const canvas = document.getElementById('screen');
const touchEl = document.getElementById('touch');
const nameBox = document.getElementById('namebox');
const nameForm = document.getElementById('nameform');
const nameInput = document.getElementById('nameinput');
const nameErr = document.getElementById('nameerr');
const nameSkip = document.getElementById('nameskip');

const events = new Emitter();
const game = new Game(events);
const renderer = new Renderer(canvas, events);
const lb = new Leaderboard();
const ach = new Achievements(events, (def) => { renderer.showToast('PRESTASI!', def.name); sfx.achievement(); });

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

const ui = {
  screen: 'start', game, focus: 0, best: store.get('best', 0), over: null,
  lb: { tab: 'weekly', rows: [], loading: false }, lbStatus: '', lbStatusColor: null,
  ach: [], touch: isTouch, muted: false, playerName: lb.name, fromOver: false,
};
setMuted(store.get('muted', false));
ui.muted = isMuted();
renderer.setPalette(store.get('palette', 'default'));

const MENUS = {
  title: ['play', 'board', 'ach'],
  pause: ['resume', 'restart', 'menu'],
  over: ['restart', 'board', 'menu'],
  board: ['back'],
  ach: ['back'],
};

// ---------------------------------------------------------------- input
const input = new Input(onUiKey);
input.bindTouch(touchEl);
touchEl.querySelector('[data-ui="pause"]').addEventListener('pointerdown', (e) => { e.preventDefault(); pause(); });

let secret = '';
function onUiKey(e) {
  if (nameBox.classList.contains('show')) return;
  unlockAudio();
  if (ui.screen === 'start') { goTitle(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyF') { toggleFullscreen(); return; }

  if (ui.screen === 'play') {
    if (e.code === 'KeyP' || e.code === 'Escape') pause();
    return;
  }
  if (ui.screen === 'pause' && (e.code === 'KeyP' || e.code === 'Escape')) { resume(); return; }

  if (ui.screen === 'title' && e.key && e.key.length === 1) {
    secret = (secret + e.key.toUpperCase()).slice(-5);
    if (secret === 'PASIR') { secret = ''; toggleRetro(); return; }
  }
  if (ui.screen === 'board' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    loadBoard(ui.lb.tab === 'weekly' ? 'alltime' : 'weekly');
    sfx.click();
    return;
  }

  const items = MENUS[ui.screen];
  if (!items) return;
  if (e.code === 'ArrowDown') { ui.focus = (ui.focus + 1) % items.length; sfx.move(); }
  else if (e.code === 'ArrowUp') { ui.focus = (ui.focus + items.length - 1) % items.length; sfx.move(); }
  else if (e.code === 'Enter' || e.code === 'Space') { sfx.click(); activate(items[ui.focus]); }
  else if (e.code === 'Escape') {
    if (ui.screen === 'board' || ui.screen === 'ach') activate('back');
    else if (ui.screen === 'over') activate('menu');
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  if (ui.screen === 'start') { goTitle(); return; }
  const r = canvas.getBoundingClientRect();
  const lx = ((e.clientX - r.left) / r.width) * LW;
  const ly = ((e.clientY - r.top) / r.height) * LH;
  const id = renderer.hit(lx, ly);
  if (id) { sfx.click(); activate(id); }
});

// --------------------------------------------------------------- layar
function setScreen(s) {
  ui.screen = s;
  ui.focus = 0;
  touchEl.classList.toggle('show', isTouch && s === 'play');
  layout();
}

function goTitle() {
  input.enabled = false;
  ui.playerName = lb.name;
  setScreen('title');
}

function startGame() {
  unlockAudio();
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  game.reset(seed);
  ach.sessionNew = 0;
  ui.over = null;
  ui.lbStatus = '';
  overTimer = 0;
  setScreen('play');
  enableInputNextFrame();
}

function enableInputNextFrame() {
  input.enabled = false;
  requestAnimationFrame(() => { input.clear(); input.enabled = ui.screen === 'play'; });
}

function pause() {
  if (ui.screen !== 'play' || game.state !== 'play') return;
  input.enabled = false;
  input.releaseAll();
  setScreen('pause');
}

function resume() {
  setScreen('play');
  enableInputNextFrame();
}

function activate(id) {
  switch (id) {
    case 'play':
    case 'restart': startGame(); break;
    case 'resume': resume(); break;
    case 'menu': goTitle(); break;
    case 'board':
      ui.fromOver = ui.screen === 'over';
      setScreen('board');
      loadBoard(ui.lb.tab || 'weekly');
      break;
    case 'ach': ui.ach = ach.list(); setScreen('ach'); break;
    case 'back':
      if (ui.screen === 'board' && ui.fromOver) { setScreen('over'); ui.focus = 1; }
      else goTitle();
      break;
    case 'tabWeekly': loadBoard('weekly'); break;
    case 'tabAll': loadBoard('alltime'); break;
  }
}

async function loadBoard(tab) {
  ui.lb = { tab, rows: [], loading: true };
  const res = await lb.get(tab);
  if (ui.lb.tab === tab) ui.lb = { ...res, loading: false };
}

function toggleMute() {
  setMuted(!isMuted());
  ui.muted = isMuted();
  store.set('muted', ui.muted);
}

function toggleRetro() {
  const next = renderer.paletteName === 'retro' ? 'default' : 'retro';
  renderer.setPalette(next);
  store.set('palette', next);
  ach.unlock('secret_code');
  sfx.levelUp();
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch { /* abaikan */ }
}

// -------------------------------------------------------- suara & event
events.on('move', () => sfx.move());
events.on('rotate', () => sfx.rotate());
events.on('land', (d) => { if (!d.hard) sfx.land(); });
events.on('hardDrop', () => sfx.hardDrop());
events.on('tilt', (dir) => sfx.tilt(dir));
events.on('tiltFail', () => sfx.tiltFail());
events.on('clear', (d) => sfx.clear(d.chain));
events.on('levelUp', () => sfx.levelUp());
events.on('quake', () => sfx.quake());
events.on('gameOver', onGameOver);

let overTimer = 0;
function onGameOver(stats) {
  input.enabled = false;
  input.releaseAll();
  sfx.gameOver();
  const newBest = stats.score > ui.best;
  if (newBest) { ui.best = stats.score; store.set('best', ui.best); }
  ui.over = { ...stats, newBest, newAch: 0 };
  overTimer = 0.9;
  lb.saveLocal(stats);
  if (stats.score > 0 && stats.duration >= 5) {
    if (!lb.name) {
      ui.lbStatus = 'ISI NAMA UNTUK PERINGKAT';
      ui.lbStatusColor = null;
      setTimeout(() => askName(() => submitScore(stats)), 900);
    } else submitScore(stats);
  }
}

async function submitScore(stats) {
  ui.lbStatus = 'MENGIRIM SKOR...';
  ui.lbStatusColor = null;
  const r = await lb.submit(stats);
  const P = renderer.pal;
  if (r.ok) {
    ui.lbStatus = r.newBest ? `REKOR MINGGU INI! #${r.rankWeekly}` : `PERINGKAT MINGGU INI #${r.rankWeekly}`;
    ui.lbStatusColor = r.newBest ? P.accent : P.text;
  } else if (r.offline) {
    ui.lbStatus = 'OFFLINE - DISIMPAN LOKAL';
    ui.lbStatusColor = P.danger;
  } else if (r.code === 'NAME_TAKEN' || r.code === 'BAD_NAME') {
    ui.lbStatus = 'NAMA SUDAH DIPAKAI';
    ui.lbStatusColor = P.danger;
    askName(() => submitScore(stats), 'Nama itu sudah dipakai pemain lain.');
  } else if (r.code === 'RATE_LIMIT') {
    ui.lbStatus = 'TERLALU CEPAT, COBA LAGI';
    ui.lbStatusColor = P.danger;
  } else {
    ui.lbStatus = 'SKOR TIDAK TERCATAT';
    ui.lbStatusColor = P.danger;
  }
}

// ------------------------------------------------------- input nama (DOM)
let nameDone = null;
function askName(onDone, error = '') {
  nameDone = onDone;
  nameInput.value = lb.name || '';
  nameErr.textContent = error;
  nameBox.classList.add('show');
  input.enabled = false;
  setTimeout(() => nameInput.focus(), 50);
}
function closeName() {
  nameBox.classList.remove('show');
  nameInput.blur();
}
nameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  if (!validName(name)) { nameErr.textContent = 'Nama 2-16 karakter: huruf, angka, spasi, _ atau -'; return; }
  nameErr.textContent = 'Memeriksa nama...';
  try {
    const r = await lb.claimName(name);
    if (!r.success) {
      nameErr.textContent = r.code === 'NAME_TAKEN' ? 'Nama itu sudah dipakai pemain lain.' : (r.code === 'NO_DB' ? 'Server peringkat belum siap.' : 'Nama tidak valid.');
      if (r.code !== 'NO_DB') return;
    }
  } catch {
    // Offline: simpan nama lokal dulu, skor dikirim ulang nanti.
  }
  lb.setName(name);
  ui.playerName = name;
  closeName();
  const fn = nameDone; nameDone = null;
  if (fn) fn();
});
nameSkip.addEventListener('click', () => {
  closeName();
  nameDone = null;
  ui.lbStatus = 'SKOR TIDAK DIKIRIM';
  ui.lbStatusColor = renderer.pal.dim;
});

// -------------------------------------------------------------- layout
function layout() {
  const touchH = touchEl.classList.contains('show') ? touchEl.offsetHeight + 8 : 0;
  renderer.resize(window.innerWidth - 32, window.innerHeight - 16 - touchH);
}
window.addEventListener('resize', layout);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------- loop
let last = performance.now(), acc = 0, heart = 0;

function tick() {
  game.update(STEP, input.poll(STEP));
}

function step(dt) {
  if (ui.screen === 'play') {
    if (game.state === 'play') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 4) { tick(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
      if (game.danger > 0) {
        heart -= dt;
        if (heart <= 0) { sfx.heartbeat(); heart = 0.7; }
      } else heart = 0;
    } else if (overTimer > 0) {
      overTimer -= dt;
      if (overTimer <= 0) {
        ui.over.newAch = ach.sessionNew;
        setScreen('over');
      }
    }
  } else acc = 0;
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  step(dt);
  renderer.draw(dt, ui);
  requestAnimationFrame(frame);
}

layout();
lb.flushPending();
requestAnimationFrame(frame);

// ------------------------------------------------- hook untuk pengujian
window.advanceTime = (ms) => {
  const n = Math.max(1, Math.round(ms / (STEP * 1000)));
  for (let k = 0; k < n; k++) step(STEP);
  renderer.draw(0, ui);
};

window.render_game_to_text = () => {
  const g = game, p = g.piece;
  const heights = [];
  for (let bx = 0; bx < 10; bx++) {
    let top = 160;
    for (let y = 0; y < 160 && top === 160; y++) {
      for (let x = bx * 8; x < bx * 8 + 8; x++) if (g.sand.cells[y * 80 + x]) { top = y; break; }
    }
    heights.push(160 - top);
  }
  return JSON.stringify({
    note: 'grid 80x160 butir, origin kiri-atas, y ke bawah; heights = tinggi pasir per kolom blok',
    screen: ui.screen, state: g.state, score: g.score, level: g.level, chain: g.chain,
    clears: g.clears, colors: g.numColors, grains: g.sand.count(), danger: +g.danger.toFixed(2),
    tilt: { charges: g.tilt.charges, active: g.tilt.t > 0, dir: g.tilt.dir },
    piece: p ? { type: p.type, color: p.color, x: p.x, y: p.y, rot: p.rot } : null,
    next: g.next, heights, clearing: !!g.clearing,
  });
};

window.sandtilt = { game, ui, events, startGame };
