import { STORAGE_PREFIX } from './config.js';

// RNG ber-seed (mulberry32) supaya urutan piece bisa direproduksi.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Event bus sederhana: logika game memancarkan event, render/audio/achievement mendengarkan.
export class Emitter {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, []);
    this.map.get(name).push(fn);
  }
  emit(name, data) {
    const list = this.map.get(name);
    if (list) for (const fn of list) fn(data);
  }
}

// localStorage bisa melempar error (iframe, mode privat), jadi selalu dibungkus.
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* abaikan */ }
  },
};

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
