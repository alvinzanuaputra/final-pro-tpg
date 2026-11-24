import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoard, dye, explode, stepBoard } from '../src/board.js';
import { MATERIAL, RULES } from '../src/config.js';
import { createConnectionFinder } from '../src/connections.js';
import { createGame, startGame, tickGame } from '../src/game.js';
import { fits, landingY } from '../src/pieces.js';

function set(board, x, y, material = MATERIAL.SAND, color = 0) {
  board.material[y * board.width + x] = material;
  board.color[y * board.width + x] = color;
}

function row(board, y, color) {
  for (let x = 0; x < board.width; x++) set(board, x, y, MATERIAL.STONE, color);
}

test('sand moves once per tick with its color and stone can hang unsupported', () => {
  const board = createBoard(5, 5);
  set(board, 2, 0, MATERIAL.SAND, 2);
  set(board, 1, 1, MATERIAL.STONE, 1);
  assert.equal(stepBoard(board), true);
  assert.equal(board.material[7], MATERIAL.SAND);
  assert.equal(board.color[7], 2);
  assert.equal(board.material[2], MATERIAL.EMPTY);
  assert.equal(board.material[6], MATERIAL.STONE);
  stepBoard(board);
  assert.equal(board.material[6], MATERIAL.STONE);
});

test('water follows a lateral path to a lower gap and then the board stabilizes', () => {
  const board = createBoard(7, 5);
  for (let x = 0; x < 5; x++) set(board, x, 2, MATERIAL.STONE);
  set(board, 2, 1, MATERIAL.WATER, 1);
  stepBoard(board);
  assert.equal(board.material[10], MATERIAL.WATER);
  let ticks = 1;
  while (stepBoard(board)) assert.ok(++ticks < 18);
  assert.equal(board.material[33], MATERIAL.WATER);
  assert.equal(board.color[33], 1);
});

test('diagonals do not clear, but a four-way connection bridges different materials', () => {
  const board = createBoard(3, 3);
  const find = createConnectionFinder(9);
  set(board, 0, 0, MATERIAL.SAND, 1);
  set(board, 1, 1, MATERIAL.WATER, 1);
  set(board, 2, 2, MATERIAL.STONE, 1);
  assert.equal(find(board).componentCount, 0);
  set(board, 0, 1, MATERIAL.STONE, 1);
  set(board, 1, 2, MATERIAL.POWDER, 1);
  const { componentCount, indices } = find(board);
  assert.equal(componentCount, 1);
  assert.deepEqual([...indices].sort((a, b) => a - b), [0, 3, 4, 7, 8]);
});

test('same-wave clears are simultaneous and charge yields exactly one Dye through a combo', () => {
  const game = createGame(123);
  startGame(game);
  game.phase = 'settling';
  game.active = null;
  game.charge = RULES.chargeMax - 1;
  row(game.board, RULES.height - 1, 0);
  row(game.board, RULES.height - 2, 1);
  tickGame(game);
  assert.equal(game.score, RULES.width * 2);
  assert.equal(game.clearedComponents, 2);
  assert.equal(game.next.special, true);
  assert.equal(game.charge, RULES.chargeMax);

  row(game.board, RULES.height - 1, 2);
  tickGame(game);
  assert.equal(game.score, RULES.width * 4);
  assert.equal(game.events.filter(event => event.type === 'charge-full').length, 1);
  assert.equal(game.events.filter(event => event.type === 'combo').length, 1);
  tickGame(game);
  assert.equal(game.active.special, true);
  assert.equal(game.charge, 0);
  assert.equal(game.next.special, false);
  tickGame(game, { hardDrop: true });
  assert.equal(game.events.filter(event => event.type === 'dye').length, 1);
});

test('area operations clip against the wall and Dye preserves material', () => {
  const board = createBoard(12, 12);
  set(board, 0, 0, MATERIAL.WATER, 0);
  set(board, 4, 4, MATERIAL.STONE, 0);
  set(board, 5, 5, MATERIAL.SAND, 1);
  dye(board, 0.5, 0.5, 2);
  assert.equal(board.material[0], MATERIAL.WATER);
  assert.equal(board.color[0], 2);
  assert.equal(board.color[52], 2);
  assert.equal(board.color[65], 1);
  explode(board, 0.5, 0.5);
  assert.equal(board.material[0], MATERIAL.EMPTY);
  assert.equal(board.material[52], MATERIAL.EMPTY);
  assert.equal(board.material[65], MATERIAL.SAND);
});

test('a powder landing triggers one explosion without awarding clear points', () => {
  const game = createGame(2);
  startGame(game);
  game.active.material = MATERIAL.POWDER;
  tickGame(game, { hardDrop: true });
  assert.equal(game.events.filter(event => event.type === 'explode').length, 1);
  assert.equal(game.score, 0);
  assert.equal(game.charge, 0);
});

test('hard drop stops above an obstacle and an occupied spawn ends the round', () => {
  const game = createGame(456);
  startGame(game);
  const { active, board } = game;
  const y = landingY(board, active);
  set(board, active.x, RULES.height - 1, MATERIAL.STONE, 1);
  assert.ok(landingY(board, active) < y);
  assert.equal(fits(board, active, -1, 0), false);
  board.material.fill(MATERIAL.STONE, 0, board.width * 16);
  for (let x = 0; x < board.width; x++) set(board, x, 0, MATERIAL.STONE, x % 2);
  for (let index = board.width; index < board.width * 16; index++) board.color[index] = index % 2;
  game.phase = 'settling';
  game.active = null;
  tickGame(game);
  assert.equal(game.phase, 'over');
  assert.equal(game.events.at(-1).type, 'game-over');
});

test('same seed gives the same first bag with one of every shape', () => {
  function firstBag() {
    const game = createGame(123);
    startGame(game);
    const pieces = [];
    for (let count = 0; count < 4; count++) {
      pieces.push({ ...game.active });
      tickGame(game, { hardDrop: true });
      while (game.phase === 'settling') tickGame(game);
    }
    return pieces;
  }
  const sequence = firstBag();
  assert.deepEqual(sequence, firstBag());
  assert.deepEqual(new Set(sequence.map(piece => piece.shape)), new Set(['I', 'L', 'T', 'O']));
});

test('a new level supplies its material mix to newly queued pieces', () => {
  for (const [level, expected] of [
    [1, MATERIAL.SAND], [2, MATERIAL.WATER], [3, MATERIAL.STONE], [4, MATERIAL.POWDER],
  ]) {
    const game = createGame(9);
    game.level = level;
    game.random = () => 0.99;
    startGame(game);
    assert.equal(game.active.material, expected);
    assert.equal(game.next.material, expected);
  }
});
