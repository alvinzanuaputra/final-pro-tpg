import { COLORS, EFFECTS, MATERIAL, MATERIAL_INFO, RULES } from './config.js';
import { footprint, landingY, tilesFor } from './pieces.js';

function makePalette() {
  const image = document.createElement('canvas').getContext('2d').createImageData(1, 1);
  const pixel = new Uint32Array(image.data.buffer);
  return COLORS.map(({ rgb }) => [[], ...MATERIAL_INFO.slice(1).map((_, materialIndex) => {
    const factors = [
      [0.8, 1, 0.88, 0.95],
      [0.7, 0.76, 1, 0.91],
      [0.64, 0.83, 0.64, 0.86],
      [0.65, 0.68, 1, 0.71],
    ][materialIndex];
    return factors.map(factor => {
      image.data.set([...rgb.map(channel => Math.round(channel * factor)), 255]);
      return pixel[0];
    });
  })]);
}

function paintPiece(ctx, piece, x, y, unit, ghost = false) {
  const color = COLORS[piece.color].hex;
  ctx.fillStyle = color;
  ctx.strokeStyle = piece.special ? '#fff1ff' : color;
  ctx.lineWidth = Math.max(1, Math.floor(unit / 4));
  for (const [dx, dy] of tilesFor(piece)) {
    const left = x + dx * unit;
    const top = y + dy * unit;
    if (ghost) {
      ctx.strokeRect(left + 1, top + 1, unit - 2, unit - 2);
      continue;
    }
    ctx.fillStyle = color;
    ctx.fillRect(left, top, unit, unit);
    ctx.fillStyle = '#111a25a0';
    ctx.fillRect(left, top + unit - ctx.lineWidth, unit, ctx.lineWidth);
    ctx.fillRect(left + unit - ctx.lineWidth, top, ctx.lineWidth, unit);
    ctx.fillStyle = '#fff6';
    ctx.fillRect(left, top, unit - ctx.lineWidth, ctx.lineWidth);
    if (piece.material !== MATERIAL.SAND || piece.special) {
      ctx.fillStyle = '#1a2736b0';
      const dot = Math.max(1, Math.floor(unit / 4));
      ctx.fillRect(left + dot, top + dot, piece.material === MATERIAL.WATER ? dot * 2 : dot, dot);
      if (piece.special || piece.material === MATERIAL.POWDER) {
        ctx.fillRect(left + dot * 2, top + dot * 2, dot, dot);
      }
    }
    if (piece.special) ctx.strokeRect(left + 1, top + 1, unit - 2, unit - 2);
  }
}

export function createRenderer(root) {
  const byId = id => root.querySelector('#' + id);
  const canvas = byId('arena');
  const ctx = canvas.getContext('2d', { alpha: false });
  const preview = byId('next');
  preview.width = preview.height = 48;
  const previewCtx = preview.getContext('2d');
  const grid = document.createElement('canvas');
  grid.width = RULES.width;
  grid.height = RULES.height;
  const gridCtx = grid.getContext('2d');
  const image = gridCtx.createImageData(grid.width, grid.height);
  const pixels = new Uint32Array(image.data.buffer);
  const palette = makePalette();
  const charge = byId('charge');
  const reducedMotion = byId('reduced-motion');
  const effects = [];
  let scale = 1;
  let lastBoard;
  let lastRevision = -1;
  let lastFrame;
  let lastNext;
  let lastLevel;
  let lastCharge;
  let lastBest;
  let lastScore;
  let lastStatus;

  const materialRows = MATERIAL_INFO.slice(1).map(material => {
    const row = document.createElement('li');
    const symbol = document.createElement('span');
    symbol.className = 'symbol';
    symbol.textContent = material.symbol;
    symbol.setAttribute('aria-hidden', 'true');
    row.append(symbol, material.name);
    byId('materials').append(row);
    return row;
  });

  function resize() {
    const well = canvas.parentElement;
    const maxWidth = well.clientWidth - 4;
    const maxHeight = Math.max(RULES.height * 3, window.innerHeight - 225);
    scale = Math.max(1, Math.floor(Math.min(maxWidth / grid.width, maxHeight / grid.height)));
    const width = grid.width * scale;
    const height = grid.height * scale;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.imageSmoothingEnabled = false;
    lastFrame = undefined;
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  window.addEventListener('resize', resize);
  resize();

  function upload(game) {
    const { board } = game;
    if (board === lastBoard && board.revision === lastRevision) return;
    for (let i = 0; i < pixels.length; i++) {
      const x = i % board.width;
      const y = Math.floor(i / board.width);
      const grain = (x * 17 ^ y * 13 ^ (x * y)) & 3;
      if (game.phase === 'ready') {
        const level = board.height - 4 - Math.floor(6 * Math.abs(Math.sin(x / 8)));
        const color = x < 17 ? 0 : x < 33 ? 1 : 2;
        pixels[i] = y >= level ? palette[color][MATERIAL.SAND][grain] : 0;
      } else {
        const kind = board.material[i];
        let texture = grain;
        if (kind === MATERIAL.WATER) texture = y % 4;
        if (kind === MATERIAL.STONE) texture = ((x >> 1) + (y >> 1)) % 2 + 2;
        pixels[i] = kind ? palette[board.color[i]][kind][texture] : 0;
      }
    }
    gridCtx.putImageData(image, 0, 0);
    lastBoard = board;
    lastRevision = board.revision;
  }

  function renderHud(game, best, paused) {
    if (game.score !== lastScore) {
      lastScore = game.score;
      byId('score').textContent = game.score.toLocaleString('id-ID');
    }
    if (best !== lastBest) {
      lastBest = best;
      byId('best').textContent = best.toLocaleString('id-ID');
    }
    if (game.level !== lastLevel) {
      lastLevel = game.level;
      byId('level').textContent = 'Level ' + game.level;
      materialRows.forEach((row, index) => {
        const info = MATERIAL_INFO[index + 1];
        const locked = game.level < index + 1;
        row.classList.toggle('locked', locked);
        row.classList.toggle('new', index > 0 && game.level === index + 1);
        row.title = locked ? 'Terbuka di level ' + (index + 1) : info.description;
        row.setAttribute('aria-label', info.name + '. ' + row.title);
      });
    }
    if (game.next !== lastNext) {
      lastNext = game.next;
      previewCtx.clearRect(0, 0, preview.width, preview.height);
      if (game.next) {
        const { width, height } = footprint(game.next);
        const unit = 10;
        paintPiece(previewCtx, game.next, (48 - width / RULES.tile * unit) / 2,
          (48 - height / RULES.tile * unit) / 2, unit);
        byId('next-label').textContent = (game.next.special ? 'Dye' : MATERIAL_INFO[game.next.material].name)
          + ' · ' + COLORS[game.next.color].name;
      } else {
        byId('next-label').textContent = '—';
      }
    }
    if (game.charge !== lastCharge) {
      lastCharge = game.charge;
      charge.setAttribute('aria-valuenow', game.charge);
      charge.classList.toggle('full', game.charge === RULES.chargeMax);
      Array.from(charge.children).forEach((segment, index) => segment.classList.toggle('filled', index < game.charge));
      byId('charge-label').textContent = game.charge === RULES.chargeMax ? 'Dye berikutnya' : game.charge + ' / ' + RULES.chargeMax;
    }
    const piece = game.active;
    const state = paused ? 'Jeda' : {
      ready: 'Siap dimainkan',
      over: 'Ronde selesai',
      settling: game.chain ? 'Sambungan ×' + game.chain : 'Partikel bergerak',
      falling: piece ? (piece.special ? 'Dye' : MATERIAL_INFO[piece.material].name) + ' · ' + COLORS[piece.color].name : '',
    }[game.phase];
    if (state !== lastStatus) {
      lastStatus = state;
      byId('status').textContent = state;
    }
  }

  function render(game, best, paused, now) {
    renderHud(game, best, paused);
    const previousBoard = lastBoard;
    const previousRevision = lastRevision;
    upload(game);

    const { active, board } = game;
    const previousEffects = effects.length;
    for (let i = effects.length - 1; i >= 0; i--) {
      if (now - effects[i].start >= effects[i].duration) effects.splice(i, 1);
    }
    const key = active ? [active.shape, active.color, active.material, active.special, active.x, active.y, active.rotation].join('/') : game.phase;
    if (!previousEffects && lastFrame === key && previousBoard === lastBoard && previousRevision === lastRevision) return;
    lastFrame = key;

    ctx.fillStyle = '#0c141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const clear = effects.find(effect => effect.type === 'clear');
    if (clear && !reducedMotion.checked) {
      const elapsed = (now - clear.start) / clear.duration;
      ctx.translate(Math.round(Math.sin(elapsed * Math.PI * 5) * 2 * (1 - elapsed)), 0);
    }
    ctx.fillStyle = '#22323c';
    for (let y = 4; y < board.height; y += RULES.tile) {
      for (let x = RULES.tile; x < board.width; x += RULES.tile) {
        ctx.fillRect(x * scale, y * scale, 1, 1);
      }
    }
    ctx.drawImage(grid, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#47616a';
    ctx.fillRect(0, 0, 1, canvas.height);
    ctx.fillRect(canvas.width - 1, 0, 1, canvas.height);

    const unit = RULES.tile * scale;
    if (game.phase === 'ready') {
      paintPiece(ctx, { shape: 'L', color: 2, material: MATERIAL.SAND }, 14 * scale, 10 * scale, unit);
    } else if (active) {
      const y = landingY(board, active);
      if (y > active.y) {
        ctx.globalAlpha = 0.24;
        paintPiece(ctx, active, active.x * scale, y * scale, unit, true);
        ctx.globalAlpha = 1;
      }
      paintPiece(ctx, active, active.x * scale, active.y * scale, unit);
    }

    for (const effect of effects) {
      const progress = Math.max(0, (now - effect.start) / effect.duration);
      ctx.globalAlpha = 1 - progress;
      if (effect.type === 'clear') {
        ctx.fillStyle = '#fff1c9';
        for (const index of effect.indices) {
          ctx.fillRect(index % board.width * scale, Math.floor(index / board.width) * scale, scale, scale);
        }
      } else {
        const isDye = effect.type === 'dye';
        const radius = isDye ? RULES.dyeRadius : RULES.blastRadius;
        ctx.strokeStyle = isDye ? COLORS[effect.color].hex : '#ff9665';
        ctx.lineWidth = Math.max(1, scale / 3);
        ctx.beginPath();
        ctx.arc((effect.x + 0.5) * scale, (effect.y + 0.5) * scale,
          radius * scale * (reducedMotion.checked ? 1 : 0.3 + progress * 0.7), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  return {
    render,
    addEvent(event, now) {
      const duration = { clear: EFFECTS.clearMs, explode: EFFECTS.blastMs, dye: EFFECTS.dyeMs }[event.type];
      if (duration) effects.push({ ...event, start: now, duration });
    },
    resetEffects() { effects.length = 0; },
  };
}
