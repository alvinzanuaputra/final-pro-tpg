import { RULES } from './config.js';

const SHAPES = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  L: [[0, 0], [0, 1], [0, 2], [1, 2]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
};

export const SHAPE_NAMES = Object.keys(SHAPES);
const ROTATIONS = Object.fromEntries(Object.entries(SHAPES).map(([name, cells]) => {
  const rotations = [cells];
  for (let turn = 1; turn < 4; turn++) {
    const rotated = rotations[turn - 1].map(([x, y]) => [-y, x]);
    const minX = Math.min(...rotated.map(([x]) => x));
    const minY = Math.min(...rotated.map(([, y]) => y));
    rotations.push(rotated.map(([x, y]) => [x - minX, y - minY]));
  }
  return [name, rotations];
}));

export function tilesFor(piece, rotation = piece.rotation ?? 0) {
  return ROTATIONS[piece.shape][rotation];
}

export function footprint(piece, rotation = piece.rotation ?? 0) {
  const tiles = tilesFor(piece, rotation);
  return {
    width: (Math.max(...tiles.map(([x]) => x)) + 1) * RULES.tile,
    height: (Math.max(...tiles.map(([, y]) => y)) + 1) * RULES.tile,
  };
}

export function fits(board, piece, x, y, rotation = piece.rotation) {
  for (const [tileX, tileY] of tilesFor(piece, rotation)) {
    const left = x + tileX * RULES.tile;
    const top = y + tileY * RULES.tile;
    if (left < 0 || top < 0 || left + RULES.tile > board.width || top + RULES.tile > board.height) return false;
    for (let row = top; row < top + RULES.tile; row++) {
      for (let col = left; col < left + RULES.tile; col++) {
        if (board.material[row * board.width + col]) return false;
      }
    }
  }
  return true;
}

export function landingY(board, piece) {
  let y = piece.y;
  while (fits(board, piece, piece.x, y + 1)) y++;
  return y;
}

export function stamp(board, piece) {
  for (const [tileX, tileY] of tilesFor(piece)) {
    const left = piece.x + tileX * RULES.tile;
    const top = piece.y + tileY * RULES.tile;
    for (let row = top; row < top + RULES.tile; row++) {
      const start = row * board.width + left;
      board.material.fill(piece.material, start, start + RULES.tile);
      board.color.fill(piece.color, start, start + RULES.tile);
    }
  }
  board.revision++;
}
