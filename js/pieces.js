// 7 tetromino standar. Koordinat blok di dalam kotak berukuran `size`.
const BASE = {
  I: { size: 4, blocks: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, blocks: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, blocks: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, blocks: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, blocks: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, blocks: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, blocks: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

export const TYPES = Object.keys(BASE);

// Rotasi searah jarum jam: (x, y) -> (size-1-y, x). Dihitung sekali di awal.
export const SHAPES = {};
for (const t of TYPES) {
  const { size, blocks } = BASE[t];
  const rots = [blocks];
  for (let r = 1; r < 4; r++) {
    rots.push(rots[r - 1].map(([x, y]) => [size - 1 - y, x]));
  }
  SHAPES[t] = { size, rots: t === 'O' ? [blocks, blocks, blocks, blocks] : rots };
}

// Sistem 7-bag: setiap 7 piece pasti berisi ketujuh bentuk.
export class Bag {
  constructor(rng) { this.rng = rng; this.items = []; }
  next() {
    if (this.items.length === 0) {
      this.items = TYPES.slice();
      for (let i = this.items.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
      }
    }
    return this.items.pop();
  }
}
