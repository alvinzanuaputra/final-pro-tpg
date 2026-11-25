import { store } from './util.js';

// Klien leaderboard: bicara ke api/leaderboard.php, dengan fallback lokal kalau offline.
const API = 'api/leaderboard.php';
const NAME_RE = /^[A-Za-z0-9 _-]{2,16}$/;

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

export class Leaderboard {
  constructor() {
    this.uuid = store.get('uuid');
    if (!this.uuid) { this.uuid = makeUuid(); store.set('uuid', this.uuid); }
    this.name = store.get('name', '');
  }

  setName(name) { this.name = name.trim(); store.set('name', this.name); }

  // Simpan juga di lokal: untuk mode offline & antrean kirim ulang.
  saveLocal(stats) {
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
      const j = await request(`${API}?action=get&tab=${encodeURIComponent(tab)}&uuid=${encodeURIComponent(this.uuid)}`);
      if (!j.success) throw new Error(j.message || 'gagal');
      return {
        offline: false, tab,
        rows: j.data.map((r) => ({ name: r.player_name, score: r.score, me: r.player_uuid === this.uuid })),
        mine: j.mine ? { name: j.mine.player_name, score: j.mine.score, rank: j.mine.rank } : null,
        resetIn: j.reset_in_sec != null ? formatDuration(j.reset_in_sec) : '',
      };
    } catch {
      return this.localBoard(tab);
    }
  }

  async claimName(name) {
    const j = await request(`${API}?action=claim_name`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_uuid: this.uuid, player_name: name.trim() }),
    });
    return j;
  }

  async submit(stats) {
    const body = {
      player_uuid: this.uuid, player_name: this.name,
      score: stats.score, max_chain: stats.bestChain, level: stats.level,
      clears: stats.clears, duration_sec: stats.duration,
    };
    try {
      const j = await request(`${API}?action=submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!j.success) return { ok: false, code: j.code, message: j.message };
      this.clearPending(stats);
      return { ok: true, newBest: j.new_best, rankWeekly: j.rank_weekly, rankAll: j.rank_alltime };
    } catch {
      this.queuePending(stats);
      return { ok: false, offline: true };
    }
  }

  // Skor yang gagal terkirim disimpan (hanya yang terbaik) dan dicoba lagi nanti.
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
    if (!p || !this.name || p.week !== localWeekStart()) { if (p && p.week !== localWeekStart()) store.set('pending', null); return; }
    const r = await this.submit(p);
    if (r.ok) store.set('pending', null);
  }
}
