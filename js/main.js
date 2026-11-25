import { Emitter, store } from './util.js';
import { Game } from './game.js';
import { Renderer, LW, LH } from './render.js';
import { Input } from './input.js';
import { sfx, unlockAudio, setSoundMode, getSoundMode, cycleSoundMode, setMusic, setDanger, setPausedMusic, audioDebug } from './audio.js';
import { Achievements } from './achievements.js';
import { Leaderboard, validName } from './leaderboard.js';

const STEP = 1 / 60;
const canvas = document.getElementById('screen');
const consoleEl = document.getElementById('console');
const slotEl = document.getElementById('slot');
const nameBox = document.getElementById('namebox');
const nameForm = document.getElementById('nameform');
const nameInput = document.getElementById('nameinput');
const nameErr = document.getElementById('nameerr');
const nameSkip = document.getElementById('nameskip');

const events = new Emitter();
const game = new Game(events);
const renderer = new Renderer(canvas, events);
const lb = new Leaderboard();
const TIER_TITLE = { bronze: 'TROFI PERUNGGU!', silver: 'TROFI PERAK!', gold: 'TROFI EMAS!', secret: 'TROFI RAHASIA!' };
const ach = new Achievements(events, (def) => {
  renderer.showToast(TIER_TITLE[def.tier] || 'PRESTASI!', def.name, def.tier);
  sfx.achievement(def.tier);
  if (def.id === 'counter') setTimeout(() => renderer.showToast('HADIAH TERBUKA', 'TEMA RETRO DI MENU'), 2700);
});

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

const ui = {
  screen: 'start', game, focus: 0, best: store.get('best', 0), over: null,
  lb: { tab: 'weekly', rows: [], loading: false }, lbStatus: '', lbStatusColor: null,
  ach: [], touch: isTouch, muted: false, playerName: lb.name, fromOver: false,
};
// mode suara: all (musik + efek) | sfx (efek saja) | off
setSoundMode(store.get('soundMode', store.get('muted', false) ? 'off' : 'all'));
ui.soundMode = getSoundMode();
ui.muted = ui.soundMode === 'off';
const SOUND_LABEL = { all: 'MUSIK + EFEK', sfx: 'EFEK SAJA', off: 'MATI' };
// musik yang diputar per layar
const SCREEN_MUSIC = { title: 'title', board: 'title', ach: 'title', settings: 'title', play: 'game', pause: 'game', over: null };
renderer.setPalette(store.get('palette', 'default'));

// Menu dengan isi dinamis (pause, settings) dihitung di menuItems().
const MENUS = {
  title: ['play', 'board', 'ach', 'settings'],
  over: ['restart', 'board', 'menu'],
  board: ['back'],
  ach: ['back'],
};

// ---------------------------------------------------------------- input
const input = new Input(onUiKey);

// Navigasi menu bersama untuk keyboard & tombol shell. cmd: up | down | left | right | ok | back
function uiNav(cmd) {
  if (ui.screen === 'pause' && cmd === 'back') { resume(); return; }
  if (ui.screen === 'board' && (cmd === 'left' || cmd === 'right')) {
    loadBoard(ui.lb.tab === 'weekly' ? 'alltime' : 'weekly');
    sfx.click();
    return;
  }
  const items = menuItems(ui.screen);
  if (!items) return;
  if (cmd === 'down') { ui.focus = (ui.focus + 1) % items.length; sfx.cursor(); }
  else if (cmd === 'up') { ui.focus = (ui.focus + items.length - 1) % items.length; sfx.cursor(); }
  else if (cmd === 'ok') { sfx.click(); activate(items[ui.focus]); }
  else if (cmd === 'back') {
    if (ui.screen === 'board' || ui.screen === 'ach' || ui.screen === 'settings') { sfx.back(); activate('back'); }
    else if (ui.screen === 'over') { sfx.back(); activate('menu'); }
  }
}

const KEY_NAV = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Space: 'ok', Escape: 'back' };

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
  if (ui.screen === 'pause' && e.code === 'KeyP') { resume(); return; }

  const cmd = KEY_NAV[e.code];
  if (cmd) uiNav(cmd);
}

// ------------------------------------------------------- tombol shell
// Saat bermain: D-pad gerak (atas = jatuh), A putar, B putar balik, L/R miring, START jeda, SELECT suara.
// Di menu: D-pad navigasi, A/START pilih, B kembali.
// Saat bermain: ◀ ▶ geser, TURUN pelan, JATUH instan, PUTAR / BALIK, tahan MIRING L/R, II jeda, ♪ suara.
// Di menu: tombol di layar bisa disentuh langsung; ◀ ▶ ganti tab, TURUN pindah pilihan, PUTAR/JATUH pilih, BALIK kembali.
const PLAY_MAP = { left: 'left', right: 'right', down: 'soft', up: 'hardDrop', a: 'rotCW', b: 'rotCCW', l: 'tiltL', r: 'tiltR' };
const MENU_MAP = { up: 'up', down: 'down', left: 'left', right: 'right', a: 'ok', b: 'back' };

function shellPress(btn) {
  unlockAudio();
  // getar halus (Android); hanya setelah sentuhan asli supaya browser tidak memblokir
  const active = !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (navigator.vibrate && active) { try { navigator.vibrate(8); } catch { /* abaikan */ } }
  if (nameBox.classList.contains('show')) return;
  if (ui.screen === 'start') { goTitle(); sfx.click(); return; }
  // MENU: saat main → jeda (berisi pengaturan); di jeda → lanjut; di layar lain → kembali
  if (btn === 'menu') {
    if (ui.screen === 'play') pause();
    else if (ui.screen === 'pause') resume();
    else uiNav('back');
    return;
  }
  if (ui.screen === 'play') {
    const a = PLAY_MAP[btn];
    if (a) input.press(a);
    return;
  }
  const cmd = MENU_MAP[btn];
  if (cmd) uiNav(cmd);
}

function shellRelease(btn) {
  const a = PLAY_MAP[btn];
  if (a) input.release(a);
}

for (const el of consoleEl.querySelectorAll('[data-btn]')) {
  const btn = el.dataset.btn;
  let down = false;
  const press = (e) => { e.preventDefault(); if (down) return; down = true; el.classList.add('on'); shellPress(btn); };
  const release = (e) => { if (e) e.preventDefault(); if (!down) return; down = false; el.classList.remove('on'); shellRelease(btn); };
  el.addEventListener('pointerdown', (e) => { try { el.setPointerCapture(e.pointerId); } catch { /* abaikan */ } press(e); });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', () => release());
  el.addEventListener('contextmenu', (e) => e.preventDefault());
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
  if (s in SCREEN_MUSIC && !(s === 'board' && ui.fromOver)) setMusic(SCREEN_MUSIC[s]);
  if (s !== 'play' && dangerOn) { dangerOn = false; setDanger(false); }
  setPausedMusic(s === 'pause');
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
  sfx.pause();
  setScreen('pause');
}

function resume() {
  sfx.resume();
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
    case 'theme': toggleTheme(); break;
    case 'sound': toggleMute(); break;
    case 'settings': setScreen('settings'); break;
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
  ui.soundMode = cycleSoundMode();
  ui.muted = ui.soundMode === 'off';
  store.set('soundMode', ui.soundMode);
  // di layar jeda/pengaturan labelnya sudah terlihat di menu, jadi tidak perlu toast
  if (ui.screen !== 'pause' && ui.screen !== 'settings') renderer.showToast('SUARA', SOUND_LABEL[ui.soundMode]);
  sfx.toggle();
}

// Tema retro: hadiah prestasi rahasia LAWAN ARUS (atau KODE RAHASIA versi lama).
function retroUnlocked() {
  return ach.unlocked.has('counter') || ach.unlocked.has('secret_code') || renderer.paletteName === 'retro';
}
function titleItems() { return MENUS.title; }
// Isi menu per layar. Jeda & pengaturan memuat SUARA dan TEMA (kalau tema retro sudah terbuka).
function menuItems(screen) {
  const theme = retroUnlocked() ? ['theme'] : [];
  if (screen === 'pause') return ['resume', 'restart', 'sound', ...theme, 'menu'];
  if (screen === 'settings') return ['sound', ...theme, 'back'];
  return MENUS[screen];
}
function toggleTheme() {
  const next = renderer.paletteName === 'retro' ? 'default' : 'retro';
  renderer.setPalette(next);
  store.set('palette', next);
  ui.theme = next;
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
// Suara mendarat sesuai material & posisi (stereo); hard drop punya hentakan tambahan.
events.on('land', (d) => { if (d.hard) sfx.hardDrop(d); else sfx.land(d); });
events.on('tiltStart', (dir) => sfx.tilt(dir));
events.on('tiltFail', () => sfx.tiltFail());
events.on('eventWarn', () => sfx.warn());
events.on('eventStart', (e) => {
  if (e.type === 'quake') sfx.quake();
  else if (e.type === 'wind') sfx.wind(e.dir);
  else sfx.force(e.dir);
});
events.on('windPush', (dir) => sfx.windPush(dir));
events.on('explode', (d) => sfx.explode(d));
const centerX = (cells) => {
  let sx = 0, n = 0;
  for (let k = 0; k < cells.length; k += 9) { sx += cells[k] % 80; n++; }
  return n ? sx / n : 40;
};
events.on('cleared', (d) => sfx.scatter(centerX(d.cells)));

// Perkenalan material baru (sekali per perangkat).
// Kunci = id material (lihat config.js): 1 batu, 2 mesiu.
const MATERIAL_INTRO = {
  2: ['MATERIAL BARU: MESIU', 'MELEDAK SAAT KENA CLEAR'],
  1: ['MATERIAL BARU: BATU', 'BERAT, TIDAK LONGSOR'],
};
events.on('spawn', (p) => {
  const intro = MATERIAL_INTRO[p.mat];
  if (!intro) return;
  const seen = store.get('seenMats', []);
  if (seen.includes(p.mat)) return;
  store.set('seenMats', [...seen, p.mat]);
  renderer.showToast(intro[0], intro[1]);
  sfx.material();
});
events.on('clear', (d) => sfx.clear(d.chain, centerX(d.cells)));
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
// Pilih bentuk shell sesuai orientasi, lalu sesuaikan kanvas dengan ukuran slot layar.
// Tombol sentuh hanya di perangkat layar sentuh (atau paksa dengan ?pad=1 / sembunyikan dengan ?pad=0).
const showPad = params.has('pad') ? params.get('pad') !== '0' : isTouch;
ui.touch = showPad;
consoleEl.classList.toggle('has-pad', showPad);

// Ukuran area terlihat untuk menentukan orientasi. Tinggi CSS memakai dvh (lihat style.css);
// visualViewport dipakai agar layout dihitung ulang saat bilah Safari/Chrome muncul/hilang.
function viewportSize() {
  return { w: window.innerWidth, h: window.innerHeight };
}

// Tinggi aplikasi = window.innerHeight (jendela LAYOUT). Safari iOS menghitung titik sentuh di
// koordinat jendela layout; 100dvh mengikuti jendela VISUAL dan saat bilah alamat berubah ukuran
// keduanya bisa berbeda → tombol tergambar lebih bawah dari area sentuhnya. dvh tetap jadi cadangan CSS.
function applyAppHeight() {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
}

// Kembalikan halaman ke posisi 0,0. Safari bisa meninggalkan halaman tergeser setelah keyboard ditutup
// atau bilah alamat mengecil/membesar, sehingga gambar dan area sentuh tidak sejajar.
function resetScroll() {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  const se = document.scrollingElement;
  if (se && se.scrollTop) se.scrollTop = 0;
  if (document.body.scrollTop) document.body.scrollTop = 0;
}

function layout() {
  applyAppHeight();
  resetScroll();
  const { w, h } = viewportSize();
  const portrait = h > w * 1.05;
  consoleEl.classList.toggle('portrait', portrait);
  consoleEl.classList.toggle('landscape', !portrait);
  // ukur setelah grid menyesuaikan
  canvas.style.width = '0px';
  canvas.style.height = '0px';
  const r = slotEl.getBoundingClientRect();
  renderer.resize(r.width - 2, r.height - 2);
}
let layoutQueued = false;
const queueLayout = () => {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => { layoutQueued = false; layout(); });
};
window.addEventListener('resize', queueLayout);
window.addEventListener('orientationchange', () => { queueLayout(); setTimeout(layout, 300); });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', queueLayout);
  window.visualViewport.addEventListener('scroll', resetScroll);
}
window.addEventListener('scroll', resetScroll, { passive: true });
window.addEventListener('pageshow', () => queueLayout());
// setelah keyboard (kotak nama) ditutup, iOS kadang tidak mengembalikan halaman → reset & hitung ulang
document.addEventListener('focusout', () => { setTimeout(() => { resetScroll(); layout(); }, 80); setTimeout(layout, 400); });
// Safari iOS kadang tetap menggulir halaman meski overflow:hidden → tolak gestur geser di luar kotak input.
document.addEventListener('touchmove', (e) => {
  if (!(e.target instanceof Element) || !e.target.closest('input')) e.preventDefault();
}, { passive: false });
if (window.ResizeObserver) new ResizeObserver(queueLayout).observe(document.getElementById('app'));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------- loop
let last = performance.now(), acc = 0, heart = 0, dangerOn = false;

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
      const danger = game.danger > 0;
      if (danger !== dangerOn) { dangerOn = danger; setDanger(danger); }
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
  ui.titleItems = titleItems();
  ui.menuItems = menuItems(ui.screen);
  ui.theme = renderer.paletteName;
  renderer.draw(dt, ui);
  requestAnimationFrame(frame);
}

layout();
window.addEventListener('load', layout);
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
    tilt: { meter: +g.tilt.meter.toFixed(2), active: g.tilt.active, dir: g.tilt.dir, effective: g.effectiveTilt() },
    event: g.event ? { type: g.event.type, dir: g.event.dir, phase: g.event.phase, t: +g.event.t.toFixed(2) } : null,
    nextEventIn: g.event ? null : +g.eventTimer.toFixed(1),
    piece: p ? { type: p.type, color: p.color, x: p.x, y: p.y, rot: p.rot } : null,
    next: g.next, heights, clearing: !!g.clearing,
    materials: { stone: g.sand.countMat(1), gunpowder: g.sand.countMat(2), explosions: g.explosions },
  });
};

// ------------------------------------------------- debug sentuh (?debug=touch)
// Menampilkan ukuran viewport dan titik merah di posisi sentuhan yang diterima browser. Kalau titik merah
// tidak jatuh di bawah jari, selisihnya terlihat langsung di angka scrollY / offsetTop.
if (params.get('debug') === 'touch') {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:4px;top:4px;z-index:99;padding:4px 6px;background:rgba(0,0,0,.75);color:#6dff8a;font:11px/1.3 monospace;white-space:pre;pointer-events:none';
  document.body.appendChild(box);
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#ff3b3b;z-index:99;pointer-events:none;display:none';
  document.body.appendChild(dot);
  let last = '-';
  const info = () => {
    const vv = window.visualViewport;
    box.textContent = [
      `inner ${window.innerWidth}x${window.innerHeight}  dpr ${window.devicePixelRatio}`,
      `visual ${vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) : '-'}  offTop ${vv ? vv.offsetTop.toFixed(1) : '-'}  pgTop ${vv ? vv.pageTop.toFixed(1) : '-'}`,
      `scrollY ${window.scrollY}  body ${Math.round(document.body.getBoundingClientRect().height)}  app-h ${getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()}`,
      `sentuh terakhir: ${last}`,
    ].join('\n');
  };
  document.addEventListener('pointerdown', (e) => {
    dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; dot.style.display = 'block';
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const b = t && t.closest('[data-btn]');
    last = `${Math.round(e.clientX)},${Math.round(e.clientY)} → ${b ? b.dataset.btn : (t ? t.tagName.toLowerCase() : '-')}`;
    info();
  }, true);
  setInterval(info, 500);
  info();
}

window.sandtilt = { game, ui, events, input, startGame, audio: audioDebug };
