import { store } from './util.js';

// Klien leaderboard. Server utama = API pusat di Vercel (satu papan untuk semua platform).
// Di gameedukasi, kalau server pusat tidak bisa dihubungi, pindah ke api/leaderboard.php lokal.
// Tanpa server sama sekali → mode offline (skor disimpan di localStorage).
//
// Uji coba: tambahkan ?lb=central | php | off di URL untuk memaksa satu server.
export const CENTRAL_API = 'https://sandtilt.vercel.app/api/leaderboard';
const LOCAL_PHP_API = 'api/leaderboard.php';
const NAME_RE = /^[A-Za-z0-9 _-]{2,16}$/;

// Daftar server yang dicoba berurutan untuk halaman ini.
function apiList() {
  const force = new URLSearchParams(location.search).get('lb');
  if (force === 'central') return [CENTRAL_API];
  if (force === 'php') return [LOCAL_PHP_API];
  if (force === 'off') return [];
  const host = location.hostname;
  if (location.protocol === 'file:') return [];                              // dibuka dari disk: offline
  if (/\.vercel\.app$/.test(host)) return ['/api/leaderboard'];              // deployment Vercel: API di domain sendiri
  if (host === 'localhost' || host === '127.0.0.1') return [LOCAL_PHP_API];  // tes lokal tidak mengotori papan pusat
  return [CENTRAL_API, LOCAL_PHP_API];                                       // gameedukasi & platform lain
}

// Jawaban server yang berarti "server ini belum bisa dipakai" → coba server berikutnya.
const SERVER_DOWN = new Set(['NO_DB', 'SERVER_ERROR', 'FORBIDDEN_ORIGIN']);

function makeUuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256; });
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Senin minggu ini (tanggal lokal) — hanya untuk mode offline. Mode online memakai tanggal dari server.
function localWeekStart() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function request(url, opts = {}, timeout = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

export function validName(name) { return NAME_RE.test(name.trim()); }

export function formatDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}H ${h}J`;
  if (h > 0) return `${h}J ${m}M`;
  return `${m}M`;
}

// Run (permainan yang dibuka di server) yang terikat pada hasil satu game.
const runOf = new WeakMap();
const NO_RUN = Promise.resolve({ error: 'offline' });

export class Leaderboard {
  constructor() {
    // Token rahasia pemain (disimpan dengan kunci lama 'uuid' supaya pemain lama tetap dikenali).
    // Tidak pernah ditampilkan: papan peringkat hanya memakai public id (pid) dari server.
    this.token = store.get('uuid');
    if (!this.token) { this.token = makeUuid(); store.set('uuid', this.token); }
    this.pid = store.get('pid', '');
    this.name = store.get('name', '');
    this.apis = apiList();
    this.runPromise = NO_RUN;
  }

  setName(name) { this.name = name.trim(); store.set('name', this.name); }
  setPid(pid) { if (pid && pid !== this.pid) { this.pid = pid; store.set('pid', pid); } }

  // Panggil server berurutan. Server yang mati/belum siap dilewati; yang berhasil dipakai duluan
  // berikutnya. only = paksa satu server (run hanya berlaku di server yang membukanya).
  async call(action, { body, query = {} } = {}, only = null) {
    const list = only ? [only] : this.apis;
    let lastErr = new Error('offline');
    for (const api of list) {
      const qs = new URLSearchParams({ action, ...query });
      const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
      try {
        const j = await request(`${api}?${qs}`, opts);
        if (!j || typeof j !== 'object') throw new Error('bukan JSON');
        if (!j.success && SERVER_DOWN.has(j.code)) throw new Error(j.code);
        if (!only && api !== this.apis[0]) this.apis = [api, ...this.apis.filter((a) => a !== api)];
        if (j.player_id) this.setPid(j.player_id);
        return { j, api };
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  // Dipanggil saat game dimulai: server mencatat waktu mulai; skor nanti hanya diterima untuk run ini.
  startRun() {
    if (!this.apis.length) { this.runPromise = NO_RUN; return; }
    this.runPromise = this.call('start_run', { body: { token: this.token } })
      .then(({ j, api }) => (j.success ? { id: j.run_id, api } : { error: j.code || 'gagal' }))
      .catch(() => ({ error: 'offline' }));
  }

  // Simpan juga di lokal: untuk mode offline & antrean kirim ulang. Dipanggil saat game selesai,
  // sekaligus mengikat run game ini ke hasilnya (game berikutnya membuka run baru).
  saveLocal(stats) {
    runOf.set(stats, this.runPromise);
    this.runPromise = NO_RUN;
    const runs = store.get('runs', []);
    runs.push({ week: localWeekStart(), score: stats.score, chain: stats.bestChain, at: Date.now() });
    runs.sort((a, b) => b.score - a.score);
    store.set('runs', runs.slice(0, 50));
  }

  localBoard(tab) {
    const week = localWeekStart();
    const runs = store.get('runs', []).filter((r) => tab === 'alltime' || r.week === week);
    const name = this.name || 'KAMU';
    return { offline: true, tab, rows: runs.map((r) => ({ name, score: r.score, me: true })), mine: null };
  }

  async get(tab) {
    try {
      const { j } = await this.call('get', { query: { tab, ...(this.pid ? { pid: this.pid } : {}) } });
      if (!j.success) throw new Error(j.message || 'gagal');
      return {
        offline: false, tab,
        rows: j.data.map((r) => ({ name: r.player_name, score: r.score, me: !!this.pid && r.player_id === this.pid })),
        mine: j.mine ? { name: j.mine.player_name, score: j.mine.score, rank: j.mine.rank } : null,
        resetIn: j.reset_in_sec != null ? formatDuration(j.reset_in_sec) : '',
      };
    } catch {
      return this.localBoard(tab);
    }
  }

  // Melempar error kalau semua server tidak bisa dihubungi (pemanggil menganggapnya offline).
  async claimName(name) {
    const { j } = await this.call('claim_name', { body: { token: this.token, player_name: name.trim() } });
    return j;
  }

  async submit(stats) {
    const run = stats.run || await (runOf.get(stats) || NO_RUN);
    if (!run.id) {
      if (run.error === 'offline') return { ok: false, offline: true };
      return { ok: false, code: run.error === 'RATE_LIMIT' ? 'RATE_LIMIT' : 'NO_RUN' };
    }
    const body = {
      token: this.token, player_name: this.name, run_id: run.id,
      score: stats.score, max_chain: stats.bestChain, level: stats.level,
      clears: stats.clears, duration_sec: stats.duration,
    };
    try {
      const { j } = await this.call('submit', { body }, run.api);
      if (!j.success) return { ok: false, code: j.code, message: j.message };
      this.clearPending(stats);
      return { ok: true, newBest: j.new_best, rankWeekly: j.rank_weekly, rankAll: j.rank_alltime };
    } catch {
      this.queuePending({ ...stats, run });
      return { ok: false, offline: true };
    }
  }

  // Skor yang gagal terkirim disimpan (hanya yang terbaik, beserta run-nya) dan dicoba lagi nanti.
  queuePending(stats) {
    const p = store.get('pending');
    if (!p || stats.score > p.score) store.set('pending', { ...stats, week: localWeekStart() });
  }
  clearPending(stats) {
    const p = store.get('pending');
    if (p && p.score <= stats.score) store.set('pending', null);
  }
  async flushPending() {
    const p = store.get('pending');
    if (p && (p.week !== localWeekStart() || !p.run)) { store.set('pending', null); return; }
    if (!p || !this.name) return;
    const r = await this.submit(p);
    if (r.ok || !r.offline) store.set('pending', null);
  }
}
