// Membuat ikon tab browser (favicon) dari logo game: huruf "S" pertama SANDTILT, font blok 3x5,
// warna pasir pertama + bayangan 1 piksel, di atas latar tema bawaan. Tanpa dependensi.
//
// Pemakaian: node tools/make-favicon.mjs
// Hasil: assets/image/favicon.svg (tab browser) dan assets/image/apple-touch-icon.png (ikon layar utama iOS).

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'image');

// Warna diambil dari PALETTES.default di js/render.js (jangan buat warna baru).
const BG = '#14121f', SHADOW = '#0b0a12', LETTER = '#e8505b', FRAME = '#4a4470';
// Huruf S dari font blok 3x5 (js/font.js, BLOCK.S).
const S = ['011', '100', '010', '001', '110'];

// Kanvas 21x21 satuan: tiap sel huruf 3x3, bayangan bergeser 1 satuan (seperti logo skala 3).
const N = 21, CELL = 3, OX = 6, OY = 3;
const px = Array.from({ length: N }, () => Array(N).fill(BG));
const plot = (dx, dy, color) => {
  S.forEach((row, ry) => [...row].forEach((b, rx) => {
    if (b !== '1') return;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) px[OY + ry * CELL + y + dy][OX + rx * CELL + x + dx] = color;
  }));
};
plot(1, 1, SHADOW);
plot(0, 0, LETTER);

// ---------- SVG (tab browser) ----------
let rects = '';
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const c = px[y][x];
    if (c !== BG) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">`
  + `<rect width="${N}" height="${N}" rx="3" fill="${BG}"/>`
  + `<rect x="0.5" y="0.5" width="${N - 1}" height="${N - 1}" rx="2.5" fill="none" stroke="${FRAME}" stroke-width="1"/>`
  + rects + '</svg>\n';
writeFileSync(join(OUT, 'favicon.svg'), svg);

// ---------- PNG 180x180 (ikon layar utama iOS) ----------
// 21 satuan x 8 piksel = 168, ditengahkan di kanvas 180 berlatar sama (iOS membulatkan sudut sendiri).
const SIZE = 180, SC = 8, PAD = (SIZE - N * SC) / 2;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 3 + 1)] = 0;   // filter: none
  for (let x = 0; x < SIZE; x++) {
    const ux = Math.floor((x - PAD) / SC), uy = Math.floor((y - PAD) / SC);
    const c = ux >= 0 && ux < N && uy >= 0 && uy < N ? px[uy][ux] : BG;
    const [r, g, b] = hex(c);
    const o = y * (SIZE * 3 + 1) + 1 + x * 3;
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(join(OUT, 'apple-touch-icon.png'), png);

console.log(`favicon.svg (${svg.length} B), apple-touch-icon.png (${png.length} B)`);
