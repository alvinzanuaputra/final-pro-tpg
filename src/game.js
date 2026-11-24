import { createBoard, dye, explode, stepBoard } from './board.js';
import { COLORS, MATERIAL, RULES } from './config.js';
import { clearCells, createConnectionFinder } from './connections.js';
import { fits, footprint, landingY, SHAPE_NAMES, stamp } from './pieces.js';
import { createRng, shuffle } from './rng.js';

export function createGame(seed) {
  const board = createBoard();
  const random = createRng(seed);
  const bag = [];
  const events = [];
  const findConnections = createConnectionFinder(board.material.length);
  return {
    seed, board, random, bag, events, findConnections,
    phase: 'ready', active: null, next: null, score: 0, level: 1,
    clearedComponents: 0, charge: 0, chain: 0, settleTicks: 0, dropTicks: 0,
  };
}

function rollPiece(game) {
  if (!game.bag.length) game.bag.push(...shuffle([...SHAPE_NAMES], game.random));
  const weights = RULES.materialWeights[Math.min(game.level, RULES.materialWeights.length) - 1];
  let roll = game.random() * 100;
  const material = weights.findIndex(weight => (roll -= weight) < 0) + 1;
  return { shape: game.bag.pop(), color: Math.floor(game.random() * COLORS.length), material, special: false };
}

function spawn(game) {
  const piece = { ...game.next, rotation: 0, x: 0, y: 0 };
  piece.x = Math.floor((game.board.width - footprint(piece).width) / 2);
  if (!fits(game.board, piece, piece.x, piece.y)) {
    game.active = null;
    game.phase = 'over';
    game.events.push({ type: 'game-over' });
    return;
  }
  if (piece.special) game.charge = 0;
  game.active = piece;
  game.next = rollPiece(game);
  game.dropTicks = 0;
  game.phase = 'falling';
}

export function startGame(game) {
  game.next = rollPiece(game);
  spawn(game);
}

function lock(game) {
  const piece = game.active;
  const { width, height } = footprint(piece);
  const x = piece.x + (width - 1) / 2;
  const y = piece.y + (height - 1) / 2;
  stamp(game.board, piece);
  game.events.push({ type: 'land', material: piece.material });

  if (piece.special) {
    dye(game.board, x, y, piece.color);
    game.events.push({ type: 'dye', x, y, color: piece.color });
  } else if (piece.material === MATERIAL.POWDER) {
    explode(game.board, x, y);
    game.events.push({ type: 'explode', x, y });
  }

  game.active = null;
  game.chain = 0;
  game.settleTicks = 0;
  game.phase = 'settling';
}

function settle(game) {
  const changed = stepBoard(game.board);
  game.settleTicks++;
  if (changed && game.settleTicks < RULES.maxSettleTicks) return;

  const { componentCount, indices } = game.findConnections(game.board);
  if (!componentCount) {
    spawn(game);
    return;
  }

  game.chain++;
  const points = indices.length * game.chain;
  game.score += points;
  game.clearedComponents += componentCount;
  game.level = 1 + Math.floor(game.clearedComponents / RULES.levelEvery);
  game.events.push({ type: 'clear', indices: indices.slice(), points, chain: game.chain });
  if (game.chain > 1) game.events.push({ type: 'combo', chain: game.chain });
  clearCells(game.board, indices);

  if (game.charge < RULES.chargeMax) {
    game.charge = Math.min(RULES.chargeMax, game.charge + componentCount);
    if (game.charge === RULES.chargeMax) {
      game.next = { ...game.next, material: MATERIAL.SAND, special: true };
      game.events.push({ type: 'charge-full' });
    }
  }
  game.settleTicks = 0;
}

export function tickGame(game, { move = 0, rotate = false, hardDrop = false, softDrop = false, softPressed = false } = {}) {
  if (game.phase === 'settling') {
    settle(game);
    return;
  }
  if (game.phase !== 'falling') return;

  const { active, board } = game;
  if (move && fits(board, active, active.x + move, active.y)) active.x += move;
  if (rotate) {
    const rotation = (active.rotation + 1) % 4;
    if (fits(board, active, active.x, active.y, rotation)) active.rotation = rotation;
  }
  if (hardDrop) {
    active.y = landingY(board, active);
    lock(game);
    return;
  }
  const interval = softDrop ? RULES.softDropTicks : Math.max(
    RULES.softDropTicks, Math.ceil(RULES.fallTicks * RULES.fallFactor ** (game.level - 1)),
  );
  game.dropTicks++;
  if (!softPressed && game.dropTicks < interval) return;
  game.dropTicks = 0;
  if (fits(board, active, active.x, active.y + 1)) active.y++;
  else lock(game);
}
