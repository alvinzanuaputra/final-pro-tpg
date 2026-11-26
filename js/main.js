import { Emitter, store } from './util.js';
import { Game } from './game.js';
import { Renderer, LW, LH } from './render.js';
import { Input } from './input.js';
import { sfx, unlockAudio, setSoundMode, getSoundMode, cycleSoundMode, setMusic, setDanger, setPausedMusic, audioDebug } from './audio.js';
import { Achievements } from './achievements.js';
import { Leaderboard, validName } from './leaderboard.js';
import { Tutorial } from './tutorial.js';
import { CFG, colorsForLevel, levelConfig } from './config.js';

const STEP = 1 / 60;
const canvas = document.getElementById('screen');
const consoleEl = document.getElementById('console');
const slotEl = document.getElementById('slot');
const nameBox = document.getElementById('namebox');
const creditsBox = document.getElementById('credits');
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
  // prestasi berhadiah (tema) → beri tahu di mana hadiahnya bisa dipakai
  if (def.reward) setTimeout(() => renderer.showToast('HADIAH TERBUKA', `${def.reward} DI PENGATURAN`), 2700);
});

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

const ui = {
  screen: 'start', game, focus: 0, best: store.get('best', 0), over: null,
  lb: { tab: 'weekly', rows: [], loading: false }, lbStatus: '', lbStatusColor: null,
  ach: [], touch: isTouch, muted: false, playerName: lb.name, fromOver: false, scroll: { pos: 0, target: 0 },
};
// mode suara: all (musik + efek) | sfx (efek saja) | off
setSoundMode(store.get('soundMode', store.get('muted', false) ? 'off' : 'all'));
ui.soundMode = getSoundMode();
ui.muted = ui.soundMode === 'off';
const SOUND_LABEL = { all: 'MUSIK + EFEK', sfx: 'EFEK SAJA', off: 'MATI' };
// musik yang diputar per layar
const SCREEN_MUSIC = { title: 'title', board: 'title', ach: 'title', settings: 'title', help: 'title', play: 'game', pause: 'game', tutDone: 'game', over: null };
renderer.setPalette(store.get('palette', 'default'));

// Menu dengan isi dinamis (pause, settings) dihitung di menuItems().
const MENUS = {
  title: ['play', 'board', 'ach', 'settings', 'credits'],
  over: ['restart', 'board', 'menu'],
  board: ['back'],
  ach: ['back'],
  help: ['tutorial', 'back'],
  tutDone: ['play', 'menu'],
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
  // Peringkat & prestasi: ▲▼ menggulir daftar (menu hanya berisi KEMBALI).
  if (SCROLL_STEP[ui.screen] && (cmd === 'up' || cmd === 'down')) {
    scrollBy(cmd === 'up' ? -SCROLL_STEP[ui.screen] : SCROLL_STEP[ui.screen]);
    return;
  }
  const items = menuItems(ui.screen);
  if (!items) return;
  if (ui.screen === 'help' && (cmd === 'left' || cmd === 'right')) cmd = cmd === 'left' ? 'up' : 'down';   // tombol berdampingan
  if (cmd === 'down') { ui.focus = (ui.focus + 1) % items.length; sfx.cursor(); }
  else if (cmd === 'up') { ui.focus = (ui.focus + items.length - 1) % items.length; sfx.cursor(); }
  else if (cmd === 'ok') { sfx.click(); activate(items[ui.focus]); }
  else if (cmd === 'back') {
    if (ui.screen === 'board' || ui.screen === 'ach' || ui.screen === 'settings' || ui.screen === 'help') { sfx.back(); activate('back'); }
    else if (ui.screen === 'over' || ui.screen === 'tutDone') { sfx.back(); activate('menu'); }
  }
}

const KEY_NAV = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Space: 'ok', Escape: 'back' };

// ------------------------------------------------------- daftar gulir
// Satu langkah ▲▼ per layar (piksel logis = tinggi satu baris peringkat / kira-kira satu kartu prestasi).
const SCROLL_STEP = { board: 10, ach: 20 };
function scrollBy(d) {
  const s = ui.scroll, max = renderer.scrollArea ? renderer.scrollArea.max : 0;
  s.target = Math.max(0, Math.min(max, s.target + d));
}
const SCROLL_KEYS = { PageUp: -1, PageDown: 1, Home: -Infinity, End: Infinity };

function onUiKey(e) {
  if (nameBox.classList.contains('show')) return;
  if (creditsOpen()) {
    if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'Enter') { e.preventDefault(); closeCredits(); }
    return;
  }
  unlockAudio();
  if (ui.screen === 'start') { goTitle(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyF') { toggleFullscreen(); return; }
  if (e.code === 'KeyH' && ui.screen === 'title') { sfx.click(); activate('help'); return; }

  if (ui.screen === 'play') {
    if (e.code === 'KeyP' || e.code === 'Escape') pause();
    return;
  }
  if (ui.screen === 'pause' && e.code === 'KeyP') { resume(); return; }
  if (SCROLL_STEP[ui.screen] && e.code in SCROLL_KEYS && renderer.scrollArea) {
    e.preventDefault();
    const dir = SCROLL_KEYS[e.code];
    scrollBy(Number.isFinite(dir) ? dir * (renderer.scrollArea.h - 10) : dir);
    return;
  }

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
  if (creditsOpen()) { if (btn === 'b' || btn === 'menu' || btn === 'a') closeCredits(); return; }
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

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * LW, ((e.clientY - r.top) / r.height) * LH];
}
function inScrollArea(lx, ly) {
  const a = renderer.scrollArea;
  return a && lx >= a.x && lx < a.x + a.w + 4 && ly >= a.y && ly < a.y + a.h;
}

// Seret daftar dengan jari/mouse: posisi mengikuti langsung, lalu sisa kecepatan dilanjutkan sedikit.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  if (ui.screen === 'start') { goTitle(); return; }
  const [lx, ly] = toLogical(e);
  const id = renderer.hit(lx, ly);
  if (id) { if (id !== 'none') { sfx.click(); activate(id); } return; }   // 'none': bagian dalam modal
  if (inScrollArea(lx, ly)) {
    drag = { id: e.pointerId, y: ly, target: ui.scroll.target, lastY: ly, lastT: e.timeStamp, v: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const [, ly] = toLogical(e);
  const max = renderer.scrollArea ? renderer.scrollArea.max : 0;
  ui.scroll.target = ui.scroll.pos = Math.max(0, Math.min(max, drag.target - (ly - drag.y)));
  const dt = e.timeStamp - drag.lastT;
  if (dt >= 8) { drag.v = (ly - drag.lastY) / dt; drag.lastY = ly; drag.lastT = e.timeStamp; }
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (e.timeStamp - drag.lastT < 80) scrollBy(Math.max(-80, Math.min(80, -drag.v * 180)));   // lemparan singkat
  drag = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', (e) => {
  if (!SCROLL_STEP[ui.screen] || !renderer.scrollArea) return;
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const perLogical = r.height / LH;
  const d = e.deltaMode === 1 ? e.deltaY * 10 : e.deltaMode === 2 ? e.deltaY * renderer.scrollArea.h : e.deltaY / perLogical;
  scrollBy(d);
}, { passive: false });

// --------------------------------------------------------------- layar
function setScreen(s) {
  ui.screen = s;
  ui.focus = 0;
  ui.scroll = { pos: 0, target: 0 };
  drag = null;
  if (s in SCREEN_MUSIC && !(s === 'board' && ui.fromOver)) setMusic(SCREEN_MUSIC[s]);
  if (s !== 'play' && dangerOn) { dangerOn = false; setDanger(false); }
  setPausedMusic(s === 'pause');
}

function goTitle() {
  input.enabled = false;
  ui.playerName = lb.name;
  setScreen('title');
}

// Mode uji (untuk mencoba kesulitan):
//   ?jatuh=0.15  → kecepatan jatuh tetap 0,15 detik per baris di semua level
//   ?level=12    → mulai langsung di level 12
// Selama mode uji, skor tidak dikirim/disimpan dan prestasi tidak terbuka.
const TEST = {
  fall: Number(params.get('jatuh')) || 0,
  level: Math.max(1, Math.min(99, Math.floor(Number(params.get('level')) || 1))),
};
TEST.on = TEST.fall > 0 || TEST.level > 1;
if (TEST.fall > 0) CFG.FALL_OVERRIDE = Math.max(0.02, Math.min(2, TEST.fall));
ach.disabled = TEST.on;

function startGame() {
  unlockAudio();
  endTutorial();
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  game.reset(seed);
  if (TEST.level > 1) {
    // mulai langsung di level tertentu (warna, batu, mesiu, event ikut level itu)
    game.level = TEST.level;
    game.clears = (TEST.level - 1) * CFG.CLEARS_PER_LEVEL;
    game.numColors = colorsForLevel(TEST.level);
    game.eventTimer = Math.min(game.eventTimer, game.randRange(levelConfig(TEST.level).eventGap));
  }
  if (TEST.on) renderer.showToast('MODE UJI', 'SKOR DAN PRESTASI TIDAK DISIMPAN');
  ach.sessionNew = 0;
  ui.over = null;
  ui.lbStatus = '';
  overTimer = 0;
  lb.startRun();   // server mencatat waktu mulai; skor hanya diterima untuk run ini
  setScreen('play');
  enableInputNextFrame();
}

// ------------------------------------------------------------- TUTORIAL
// Pemain baru (belum pernah menyelesaikan/melewati tutorial) otomatis masuk tutorial saat menekan MAIN.
// Bisa diulang dari ikon ? di layar judul → CARA MAIN → MAIN TUTORIAL.
const tutorial = new Tutorial(game, events, () => {
  store.set('tutorialDone', true);
  input.enabled = false;
  input.releaseAll();
  sfx.levelUp();
  setScreen('tutDone');
});
ui.tutorial = tutorial;

function startTutorial() {
  unlockAudio();
  game.reset((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  ach.disabled = true;           // tutorial tidak membuka prestasi
  tutorial.start();
  ui.over = null;
  setScreen('play');
  enableInputNextFrame();
}

function endTutorial() {
  tutorial.stop();
  ach.disabled = TEST.on;
}

function skipTutorial() {
  store.set('tutorialDone', true);
  startGame();
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
      if (!store.get('tutorialDone', false) && !TEST.on && ui.screen === 'title') startTutorial();
      else startGame();
      break;
    case 'restart': startGame(); break;
    case 'help': setScreen('help'); break;
    case 'tutorial': startTutorial(); break;
    case 'skipTut': skipTutorial(); break;
    case 'resume': resume(); break;
    case 'menu':
      if (tutorial.active) store.set('tutorialDone', true);   // keluar dari tutorial = tidak dipaksa lagi
      endTutorial();
      goTitle();
      break;
    case 'board':
      ui.fromOver = ui.screen === 'over';
      setScreen('board');
      loadBoard(ui.lb.tab || 'weekly');
      break;
    case 'ach': ui.ach = ach.list(); setScreen('ach'); break;
    case 'theme': toggleTheme(); break;
    case 'name': askName(() => renderer.showToast('NAMA DISIMPAN', lb.name)); break;   // ganti nama (pengaturan)
    case 'sound': toggleMute(); break;
    case 'settings': setScreen('settings'); break;
    case 'credits': openCredits(); break;
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
  // dibuka dari game over → gulir otomatis ke baris pemain sendiri
  ui.scroll = { pos: 0, target: 0, revealMe: ui.fromOver };
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

// Daftar tema (urutan = urutan saat tombol TEMA ditekan).
// unlock: null = gratis | id prestasi = hadiah prestasi itu (ditulis juga di kartu prestasinya, lihat achievements.js).
const THEMES = [
  { id: 'default', name: 'KLASIK', unlock: null },
  { id: 'senja', name: 'SENJA', unlock: null },
  { id: 'kontras', name: 'KONTRAS', unlock: null },
  { id: 'retro', name: 'RETRO', unlock: 'counter' },      // hadiah prestasi rahasia LAWAN ARUS
  { id: 'neon', name: 'NEON', unlock: 'quake' },          // hadiah prestasi rahasia GOYANG DUMANG!
  { id: 'kertas', name: 'KERTAS', unlock: 'close_call' }, // hadiah prestasi NYARIS!
];
function themeUnlocked(t) {
  if (!t.unlock || renderer.paletteName === t.id) return true;
  return ach.unlocked.has(t.unlock) || (t.id === 'retro' && ach.unlocked.has('secret_code'));  // secret_code: versi lama
}
// ------------------------------------------------------------- KREDIT
// Modal HTML (lihat index.html #credits): foto & link sosmed pembuat, mata kuliah, sumber aset.
function creditsOpen() { return creditsBox.classList.contains('show'); }
function openCredits() {
  creditsBox.classList.add('show');
  creditsBox.querySelector('.panel').scrollTop = 0;
  input.releaseAll();
  checkAlvinWebsite();
  setTimeout(() => document.getElementById('creditsclose').focus({ preventScroll: true }), 50);
}
function closeCredits() {
  creditsBox.classList.remove('show');
  sfx.back();
  ui.focus = MENUS.title.indexOf('credits');
}
document.getElementById('creditsclose').addEventListener('click', closeCredits);
creditsBox.addEventListener('click', (e) => { if (e.target === creditsBox) closeCredits(); });

// Website Alvin dicek saat KREDIT dibuka. Kalau tidak bisa dihubungi, tombolnya ditandai offline
// dan Instagram dipindah ke depan sebagai alternatif.
let alvinChecked = false;
function checkAlvinWebsite() {
  if (alvinChecked) return;
  alvinChecked = true;
  const web = document.getElementById('alvin-web');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  fetch('https://alvinzanua.site', { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
    .catch(() => {
      web.classList.add('down');
      web.textContent = 'WEBSITE (OFFLINE)';
      web.parentElement.appendChild(web); // Instagram jadi pilihan pertama
    })
    .finally(() => clearTimeout(timer));
}

function titleItems() { return MENUS.title; }
// Isi menu per layar. Jeda & pengaturan selalu memuat SUARA dan TEMA.
function menuItems(screen) {
  if (screen === 'pause') return tutorial.active ? ['resume', 'skipTut', 'menu'] : ['resume', 'restart', 'sound', 'theme', 'menu'];
  if (screen === 'settings') return ['sound', 'theme', 'name', 'back'];
  return MENUS[screen];
}
function toggleTheme() {
  const open = THEMES.filter(themeUnlocked);
  const i = open.findIndex((t) => t.id === renderer.paletteName);
  const next = open[(i + 1) % open.length].id;
  renderer.setPalette(next);
  store.set('palette', next);
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
  if (tutorial.active) { startTutorial(); return; }   // seharusnya tidak terjadi (garis bahaya mati); mulai ulang saja
  sfx.gameOver();
  if (TEST.on) {
    // mode uji: hasil hanya ditampilkan, tidak masuk rekor, skor lokal, atau peringkat
    ui.over = { ...stats, newBest: false, newAch: 0 };
    overTimer = 0.9;
    ui.lbStatus = 'MODE UJI - SKOR TIDAK DISIMPAN';
    ui.lbStatusColor = renderer.pal.dim;
    return;
  }
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
// Skor tertunda (gagal terkirim saat offline) dikirim ulang saat game dibuka. Kalau namanya ternyata
// sudah dipakai pemain lain, skor tetap disimpan dan pemain diminta memilih nama baru.
async function flushPendingScore() {
  const r = await lb.flushPending();
  if (r === 'sent') renderer.showToast('SKOR TERTUNDA', 'MASUK PERINGKAT');
  else if (r === 'name' && !nameBox.classList.contains('show')) {
    askName(flushPendingScore, lb.name
      ? `Nama "${lb.name}" sudah dipakai pemain lain. Pilih nama baru supaya skor tertundamu tersimpan.`
      : 'Isi nama supaya skor tertundamu tersimpan.');
  }
}
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
  if (!(e.target instanceof Element) || !e.target.closest('input, .credits')) e.preventDefault();
}, { passive: false });
if (window.ResizeObserver) new ResizeObserver(queueLayout).observe(document.getElementById('app'));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------- loop
let last = performance.now(), acc = 0, heart = 0, dangerOn = false;

function tick() {
  const inp = input.poll(STEP);
  // Selama kedip clear tombol diabaikan; geser-otomatis (tombol ← → ditahan) mulai ulang dari jeda
  // awal, jadi piece tidak langsung meluncur begitu kedip selesai.
  if (game.clearing) input.restartRepeat();
  game.update(STEP, inp);
  tutorial.update(STEP);
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
  ui.tutView = tutorial.active || ui.screen === 'tutDone' ? tutorial.view(ui.touch) : null;
  ui.theme = renderer.paletteName;
  ui.themeName = (THEMES.find((t) => t.id === ui.theme) || THEMES[0]).name;
  // di Pengaturan: beri tahu kalau masih ada tema yang bisa dibuka lewat prestasi
  const locked = THEMES.filter((t) => !themeUnlocked(t)).length;
  ui.themeHint = locked ? `${locked} TEMA LAGI: HADIAH PRESTASI` : '';
  renderer.draw(dt, ui);
  requestAnimationFrame(frame);
}

layout();
window.addEventListener('load', layout);
flushPendingScore();
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
    tutorial: tutorial.active ? { step: tutorial.key, done: tutorial.done, retry: tutorial.retry } : null,
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
