// Membuat ikon trofi pixel art (12x11) sebagai SVG. Desain asli untuk SandTilt.
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const MAP = [
  '..oooooooo..',
  'ooohmmmmsooo',
  'o.ohmmmmso.o',
  'ooohmmmmsooo',
  '...ohmmso...',
  '....ohso....',
  '.....oo.....',
  '.....oo.....',
  '...oohmsoo..',
  '..ohmmmmmso.',
  '..oooooooo..',
];
const STAR = { 2: [6], 3: [5, 6, 7] }; // bintik bintang kecil di badan piala
const TIERS = {
  bronze: { o: '#3d220e', h: '#ffcf9a', m: '#cd7f32', s: '#8a5420', star: '#ffe0b8' },
  silver: { o: '#2f3245', h: '#ffffff', m: '#c9cde0', s: '#8a8fa8', star: '#ffffff' },
  gold:   { o: '#5a3a08', h: '#fff4b0', m: '#f2c14e', s: '#b8861f', star: '#ffffff' },
  secret: { o: '#2a1240', h: '#f6c8ff', m: '#b45ce0', s: '#6e2f9a', star: '#ffffff' },
  locked: { o: '#06050c', h: '#3a3655', m: '#2a2740', s: '#1e1c30', star: null },
};
for (const [name, pal] of Object.entries(TIERS)) {
  let rects = '';
  MAP.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    let col = pal[ch];
    if (pal.star && STAR[y] && STAR[y].includes(x) && ch === 'm') col = pal.star;
    rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${col}"/>`;
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="11" viewBox="0 0 12 11" shape-rendering="crispEdges">${rects}</svg>\n`;
  writeFileSync(`${out}/trophy-${name}.svg`, svg);
}
console.log('ok');
