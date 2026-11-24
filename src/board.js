import { MATERIAL, RULES } from './config.js';

export function createBoard(width = RULES.width, height = RULES.height) {
  return {
    width, height, material: new Uint8Array(width * height),
    color: new Uint8Array(width * height), moved: new Uint8Array(width * height),
    revision: 0, direction: 1,
  };
}

function waterSide(board, x, y, direction) {
  const { width, material } = board;
  const row = y * width;
  for (let distance = 1; distance <= RULES.waterReach; distance++) {
    const col = x + distance * direction;
    if (col < 0 || col >= width || material[row + col]) break;
    if (!material[row + width + col]) return distance;
  }
  return Infinity;
}

export function stepBoard(board) {
  const { width, height, material, color, moved, direction } = board;
  const start = direction > 0 ? 0 : width - 1;
  const end = direction > 0 ? width : -1;
  board.direction = -direction;
  moved.fill(0);
  let changed = false;

  for (let y = height - 2; y >= 0; y--) {
    for (let x = start; x !== end; x += direction) {
      const index = y * width + x;
      const kind = material[index];
      if (!kind || kind === MATERIAL.STONE || moved[index]) continue;

      const below = index + width;
      let target = -1;
      if (!material[below]) target = below;
      else if (x + direction >= 0 && x + direction < width && !material[below + direction]) target = below + direction;
      else if (x - direction >= 0 && x - direction < width && !material[below - direction]) target = below - direction;
      else if (kind === MATERIAL.WATER) {
        const forward = waterSide(board, x, y, direction);
        const backward = waterSide(board, x, y, -direction);
        if (forward < Infinity || backward < Infinity) target = index + (forward <= backward ? direction : -direction);
      }
      if (target < 0) continue;
      material[target] = kind;
      color[target] = color[index];
      material[index] = MATERIAL.EMPTY;
      color[index] = 0;
      moved[target] = 1;
      changed = true;
    }
  }
  if (changed) board.revision++;
  return changed;
}

function changeArea(board, centerX, centerY, radius, dyeColor) {
  const { width, height, material, color } = board;
  let changed = false;
  for (let y = Math.max(0, Math.ceil(centerY - radius)); y <= Math.min(height - 1, centerY + radius); y++) {
    for (let x = Math.max(0, Math.ceil(centerX - radius)); x <= Math.min(width - 1, centerX + radius); x++) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 > radius ** 2) continue;
      const index = y * width + x;
      if (!material[index]) continue;
      if (dyeColor === undefined) material[index] = MATERIAL.EMPTY;
      color[index] = dyeColor ?? 0;
      changed = true;
    }
  }
  if (changed) board.revision++;
}

export function explode(board, x, y) {
  changeArea(board, x, y, RULES.blastRadius);
}

export function dye(board, x, y, color) {
  changeArea(board, x, y, RULES.dyeRadius, color);
}
