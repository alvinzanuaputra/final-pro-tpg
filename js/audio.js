// Mesin audio SandTilt: SFX & musik dari file di assets/ (WebAudio).
// - SFX: paket Kenney (CC0) + angin/pasir buatan ffmpeg → assets/sfx/*.mp3
// - Musik: chiptune orisinal → assets/music/{title,game}.mp3 (loop mulus, panjang loop di loops.json)
// Suara diposisikan stereo sesuai letak kejadian di papan, musik meredup sesaat saat ledakan/clear,
// dan musik terdengar "teredam" (low-pass) saat pasir melewati garis bahaya.

const SFX_NAMES = [
  'ui-cursor', 'ui-confirm', 'ui-back', 'ui-pause', 'ui-resume', 'ui-toggle',
  'move', 'rotate', 'harddrop', 'tilt-fail', 'tilt-slide',
  'land-sand-0', 'land-sand-1', 'land-sand-2', 'land-stone-0', 'land-stone-1', 'land-gun',
  'clear', 'chain', 'explode-0', 'explode-1', 'explode-2', 'explode-low',
  'quake-rumble', 'force-creak', 'wind', 'wind-push', 'heartbeat',
  'jingle-level', 'jingle-gameover', 'jingle-warn', 'jingle-material',
  'trophy-bronze', 'trophy-silver', 'trophy-gold', 'trophy-secret',
];
const MUSIC_VOL = 0.42;

let ctx = null, master = null, sfxBus = null, musicBus = null, musicFilter = null;
const buffers = {};
let loops = { game: 0, title: 0 };
let loading = null;
let musicSrc = null, musicName = null, musicWanted = null;
let mode = 'all';                 // 'all' | 'sfx' (musik mati) | 'off'
let duckUntil = 0;

// Dibuka lewat klik ganda (file://)? fetch() ke file lokal diblokir browser, jadi audio diambil dari
// assets/audio-data.js (base64, dimuat sebagai <script> biasa yang tetap diizinkan di file://).
const FILE_MODE = location.protocol === 'file:';

function loadEmbedded() {
  return new Promise((resolve, reject) => {
    if (window.SANDTILT_AUDIO) { resolve(window.SANDTILT_AUDIO); return; }
    const s = document.createElement('script');
    s.src = 'assets/audio-data.js';
    s.onload = () => (window.SANDTILT_AUDIO ? resolve(window.SANDTILT_AUDIO) : reject(new Error('audio-data kosong')));
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function b64ToBuffer(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function load() {
  if (loading) return loading;
  const done = () => { if (musicWanted) playMusic(musicWanted, true); };
  if (FILE_MODE) {
    const dec = (b64) => ctx.decodeAudioData(b64ToBuffer(b64));
    loading = loadEmbedded().then((data) => Promise.all([
      ...SFX_NAMES.map((n) => (data.sfx[n] ? dec(data.sfx[n]).then((b) => { buffers[n] = b; }).catch(() => {}) : null)),
      ...['title', 'game'].map((n) => (data.music[n] ? dec(data.music[n]).then((b) => { buffers['music:' + n] = b; }).catch(() => {}) : null)),
    ]).then(() => { if (data.loops) loops = data.loops; })).catch(() => {}).then(done);
    return loading;
  }
  const get = async (url) => ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
  loading = Promise.all([
    ...SFX_NAMES.map((n) => get(`assets/sfx/${n}.mp3`).then((b) => { buffers[n] = b; }).catch(() => {})),
    get('assets/music/title.mp3').then((b) => { buffers['music:title'] = b; }).catch(() => {}),
    get('assets/music/game.mp3').then((b) => { buffers['music:game'] = b; }).catch(() => {}),
    fetch('assets/music/loops.json').then((r) => r.json()).then((j) => { loops = j; }).catch(() => {}),
  ]).then(done);
  return loading;
}

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 20000;
      musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_VOL;
      musicBus.connect(musicFilter);
      musicFilter.connect(master);
      applyMode();
      load();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* audio tidak tersedia */ }
}

// ------------------------------------------------------------ mode suara
function applyMode() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.value = mode === 'off' ? 0 : 1;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(mode === 'all' ? MUSIC_VOL : 0, t);
}
export function setSoundMode(m) { mode = ['all', 'sfx', 'off'].includes(m) ? m : 'all'; applyMode(); }
export function getSoundMode() { return mode; }
export function cycleSoundMode() { setSoundMode(mode === 'all' ? 'sfx' : mode === 'sfx' ? 'off' : 'all'); return mode; }
// kompatibilitas lama
export function setMuted(m) { setSoundMode(m ? 'off' : 'all'); }
export function isMuted() { return mode === 'off'; }

// ------------------------------------------------------------ pemutar SFX
function play(name, { vol = 1, rate = 1, pan = 0, delay = 0, offset = 0, dur } = {}) {
  if (!ctx || ctx.state !== 'running' || mode === 'off') return null;
  const buf = buffers[name];
  if (!buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = vol;
  let node = src;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p); node = p;
  }
  node.connect(g);
  g.connect(sfxBus);
  const t = ctx.currentTime + delay;
  if (dur) {
    g.gain.setValueAtTime(vol, t + Math.max(0, dur - 0.25));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.start(t, offset, dur + 0.05);
  } else src.start(t, offset);
  return src;
}
const pick = (base, n) => `${base}-${(Math.random() * n) | 0}`;
const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;   // variasi pitch kecil supaya tidak monoton
const panX = (x) => (x / 80) * 1.4 - 0.7;                          // posisi papan 0..80 → stereo

// Musik meredup sesaat (ledakan, jingle) lalu kembali.
function duck(level = 0.35, hold = 0.5) {
  if (!ctx || mode !== 'all') return;
  const t = ctx.currentTime;
  duckUntil = Math.max(duckUntil, t + hold);
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(MUSIC_VOL * level, t + 0.05);
  musicBus.gain.setValueAtTime(MUSIC_VOL * level, duckUntil);
  musicBus.gain.linearRampToValueAtTime(MUSIC_VOL, duckUntil + 0.6);
}

// ------------------------------------------------------------ musik
function playMusic(name, force = false) {
  musicWanted = name;
  if (!ctx) return;
  if (!force && musicName === name && musicSrc) return;
  const old = musicSrc;
  if (old) {
    const g = old._gain, t = ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    old.stop(t + 0.65);
  }
  musicSrc = null; musicName = null;
  const buf = name && buffers['music:' + name];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = loops[name] || buf.duration;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
  src.connect(g); g.connect(musicBus);
  src._gain = g;
  src.start();
  musicSrc = src; musicName = name;
}
export function setMusic(name) { playMusic(name); }

// Saat bahaya: musik teredam & sedikit lebih pelan agar detak jantung terdengar.
export function setDanger(on) {
  if (!ctx) return;
  const t = ctx.currentTime;
  musicFilter.frequency.cancelScheduledValues(t);
  musicFilter.frequency.setTargetAtTime(on ? 900 : 20000, t, 0.15);
}

// Saat jeda: musik pelan.
export function setPausedMusic(paused) {
  if (!ctx || !musicSrc) return;
  const g = musicSrc._gain, t = ctx.currentTime;
  g.gain.setTargetAtTime(paused ? 0.3 : 1, t, 0.1);
}

// Info untuk pengujian (window.sandtilt.audio()).
export function audioDebug() {
  return {
    state: ctx ? ctx.state : 'none', mode, music: musicName, wanted: musicWanted,
    loaded: Object.keys(buffers).length, expected: SFX_NAMES.length + 2,
    filterHz: musicFilter ? Math.round(musicFilter.frequency.value) : null,
  };
}

// ------------------------------------------------------------ API efek suara
export const sfx = {
  // menu
  click() { play('ui-confirm', { vol: 0.7 }); },
  cursor() { play('ui-cursor', { vol: 0.6 }); },
  back() { play('ui-back', { vol: 0.7 }); },
  pause() { play('ui-pause', { vol: 0.8 }); },
  resume() { play('ui-resume', { vol: 0.8 }); },
  toggle() { play('ui-toggle', { vol: 0.8 }); },

  // piece
  move() { play('move', { vol: 0.35, rate: vary(0.04) }); },
  rotate() { play('rotate', { vol: 0.5, rate: vary(0.05) }); },
  land(d = {}) {
    const pan = d.x != null ? panX(d.x + 12) : 0;
    if (d.mat === 1) play(pick('land-stone', 2), { vol: 0.75, rate: vary(0.05), pan });
    else if (d.mat === 2) play('land-gun', { vol: 0.8, rate: vary(0.08), pan });
    else play(pick('land-sand', 3), { vol: 0.9, rate: vary(0.08), pan });
  },
  hardDrop(d = {}) {
    const pan = d.x != null ? panX(d.x + 12) : 0;
    play('harddrop', { vol: 0.8, rate: vary(0.05), pan });
    this.land({ ...d, x: d.x });
  },

  // miring
  tilt(dir) {
    play('tilt-slide', { vol: 0.8, rate: vary(0.06), pan: dir * 0.6 });
    play('force-creak', { vol: 0.25, rate: 1.4, pan: dir * 0.4 });
  },
  tiltFail() { play('tilt-fail', { vol: 0.5 }); },

  // clear & chain: nada naik setiap chain
  clear(chain = 1, x = 40) {
    const rate = Math.min(2, 1 + 0.09 * (chain - 1));
    play('clear', { vol: 0.75, rate });
    if (chain > 1) play('chain', { vol: 0.55, rate, delay: 0.08, pan: panX(x) * 0.5 });
    duck(0.55, 0.3);
  },
  // butir larut (saat ledakan partikel)
  scatter(x = 40) { play(pick('land-sand', 3), { vol: 0.45, rate: 1.6, pan: panX(x) }); },

  explode(d = {}) {
    const cx = d.centers && d.centers.length ? d.centers.reduce((s, c) => s + c[0], 0) / d.centers.length : 40;
    play(pick('explode', 3), { vol: 1, rate: vary(0.08), pan: panX(cx) });
    play('explode-low', { vol: 0.9, delay: 0.02 });
    if (d.stones > 0) play(pick('land-stone', 2), { vol: 0.7, rate: 0.8, delay: 0.12, pan: panX(cx) });
    duck(0.25, 0.8);
  },

  // event pengganggu
  warn() { play('jingle-warn', { vol: 0.7 }); },
  quake() {
    play('quake-rumble', { vol: 1, dur: 1.9 });
    play('explode-low', { vol: 0.6, rate: 0.7 });
    duck(0.4, 1.4);
  },
  wind(dir) { play('wind', { vol: 0.9, pan: dir * 0.7 }); },
  windPush(dir) { play('wind-push', { vol: 0.45, rate: vary(0.1), pan: dir * 0.6 }); },
  force(dir) {
    play('force-creak', { vol: 0.9, rate: 0.8, pan: dir * 0.5 });
    play('tilt-slide', { vol: 0.7, rate: 0.7, pan: dir * 0.6, delay: 0.15 });
  },
  heartbeat() { play('heartbeat', { vol: 0.9, rate: 0.75 }); play('heartbeat', { vol: 0.6, rate: 0.7, delay: 0.18 }); },

  // jingle
  levelUp() { play('jingle-level', { vol: 0.8 }); duck(0.3, 0.9); },
  achievement(tier = 'bronze') {
    if (tier === 'legend') tier = 'secret';   // trofi ungu: suara sama
    play('trophy-' + (buffers['trophy-' + tier] ? tier : 'bronze'), { vol: 0.85 }); duck(0.3, 0.7);
  },
  material() { play('jingle-material', { vol: 0.7 }); },
  gameOver() { playMusic(null); play('jingle-gameover', { vol: 0.9 }); },
};
