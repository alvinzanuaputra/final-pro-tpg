// BRAND: semua warna di trailer berasal dari palet game (js/render.js, tema default).
// Jangan menulis warna hex baru di sini; lihat docs/BRAND.md.
import { PALETTES } from '../../js/render.js';

export const FPS = 60;
export const sec = (s: number) => Math.round(s * FPS);

export const P = PALETTES.default;
const SHADES = [1.12, 1.0, 0.91, 0.82];   // sama dengan render.js
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(255, Math.round(v * f)));
  return `rgb(${ch.join(',')})`;
};
/** Warna pasir ke-c (1..5) dengan shade s (0 terang .. 3 gelap), persis seperti di game. */
export const SAND = (c: number, s = 1) => shade(P.sand[c - 1], SHADES[s]);

export const C = {
  bg: P.bg,
  shadow: P.shadow,
  frame: P.frame,
  text: P.text,
  dim: P.dim,
  accent: P.accent,
  danger: P.danger,
  red: SAND(1, 0),
  yellow: SAND(2, 0),
  green: SAND(3, 0),
  blue: SAND(4, 0),
  purple: SAND(5, 0),
};
