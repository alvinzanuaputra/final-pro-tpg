import { MATERIAL, MATERIAL_INFO } from './config.js';

export function loadFixture(game) {
  const { board } = game;
  for (let index = 0; index < board.material.length; index++) {
    const x = index % board.width;
    const y = Math.floor(index / board.width);
    const depth = board.height - y;
    board.material[index] = MATERIAL.EMPTY;
    board.color[index] = 0;
    if (depth <= 4) {
      board.material[index] = MATERIAL.STONE;
      board.color[index] = Math.floor(depth / 2) % 3;
    } else if (depth < 20 && (x < 12 || x > board.width - 11)) {
      board.material[index] = MATERIAL.SAND;
      board.color[index] = 2;
    } else if (depth > 28 && depth < 40 && x > 13 && x < 30) {
      board.material[index] = MATERIAL.WATER;
      board.color[index] = 1;
    }
  }
  board.revision++;
  game.active = null;
  game.phase = 'settling';
  game.settleTicks = 0;
  game.chain = 0;
}

export function attachDebug(root, actions) {
  const panel = document.createElement('div');
  panel.className = 'debug';
  const stats = document.createElement('output');
  const fixture = document.createElement('button');
  fixture.type = 'button';
  fixture.textContent = 'Muat papan uji';
  fixture.addEventListener('click', actions.fixture);
  const force = document.createElement('select');
  force.setAttribute('aria-label', 'Material berikutnya');
  force.add(new Option('Material berikutnya', ''));
  MATERIAL_INFO.slice(1).forEach((item, index) => force.add(new Option(item.name, index + 1)));
  force.addEventListener('change', () => {
    if (force.value) actions.force(Number(force.value));
    force.value = '';
  });
  panel.append(stats, fixture, force);
  root.append(panel);

  const samples = [];
  const frames = [];
  let lastReport = 0;
  let lastFrame;
  return (now, elapsed) => {
    samples.push(elapsed);
    if (samples.length > 1800) samples.shift();
    if (lastFrame !== undefined) {
      frames.push(now - lastFrame);
      if (frames.length > 1800) frames.shift();
    }
    lastFrame = now;
    if (now - lastReport < 600) return;
    lastReport = now;
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    const mean = frames.reduce((sum, value) => sum + value, 0) / frames.length;
    stats.value = Math.round(1000 / mean) + ' FPS · p95 ' + p95.toFixed(2) + ' ms';
  };
}
