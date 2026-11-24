import { W, H, BLOCK, CFG } from './config.js';
import { SHAPES } from './pieces.js';
import { drawText, textWidth } from './font.js';

// Seluruh game digambar di kanvas kecil 160x176 lalu diperbesar dengan skala bulat → tampilan pixel art.
export const LW = 160, LH = 176;
const BX = 6, BY = 10;   // posisi papan
const PX = 94;           // posisi panel samping

export const PALETTES = {
  default: {
    bg: '#14121f', boardA: '#1b192b', boardB: '#1f1c31', frame: '#4a4470', text: '#ece8f5',
    dim: '#8a84a8', accent: '#f2c14e', danger: '#ff4d5e', shadow: '#0b0a12',
    sand: ['#e8505b', '#f2c14e', '#3fbf8f', '#4c8bf5', '#b45ce0'],
  },
  retro: {
    bg: '#0d170d', boardA: '#132213', boardB: '#162716', frame: '#3f6f3f', text: '#c8f5b0',
    dim: '#5f9a5a', accent: '#e8ff9a', danger: '#f0ff70', shadow: '#081008',
    sand: ['#f0ffd8', '#a9e47c', '#6fbd4f', '#3f8a32', '#d2d36a'],
  },
};

const SHADES = [1.12, 1.0, 0.91, 0.82];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function scaleRgb([r, g, b], f) {
  return [Math.min(255, Math.round(r * f)), Math.min(255, Math.round(g * f)), Math.min(255, Math.round(b * f))];
}
function pack([r, g, b]) { return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; } // ABGR little-endian
function css([r, g, b]) { return `rgb(${r},${g},${b})`; }

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export class Renderer {
  constructor(canvas, events) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    [this.low, this.lctx] = makeCanvas(LW, LH);
    [this.boardCanvas, this.bctx] = makeCanvas(W, H);
    this.img = this.bctx.createImageData(W, H);
    this.pix = new Uint32Array(this.img.data.buffer);

    this.scale = 1;
    this.time = 0;
    this.angle = 0;
    this.shake = 0;
    this.flash = 0;
    this.particles = [];
    this.floats = [];
    this.rain = [];
    this.buttons = [];
    this.toast = null;
    this.setPalette('default');
    this.listen(events);
  }

  setPalette(name) {
    this.paletteName = PALETTES[name] ? name : 'default';
    const P = this.pal = PALETTES[this.paletteName];
    this.sandPix = new Uint32Array(6 * 4);
    this.sandCss = [];
    this.piecePix = [];
    for (let c = 1; c <= 5; c++) {
      const base = hexToRgb(P.sand[c - 1]);
      this.sandCss[c] = [];
      for (let s = 0; s < 4; s++) {
        const rgb = scaleRgb(base, SHADES[s]);
        this.sandPix[c * 4 + s] = pack(rgb);
        this.sandCss[c][s] = css(rgb);
      }
      this.piecePix[c] = {
        base: pack(base), light: pack(scaleRgb(base, 1.35)), dark: pack(scaleRgb(base, 0.62)),
        ghost: pack(scaleRgb(base, 0.42)),
      };
    }
    this.bgA = pack(hexToRgb(P.boardA));
    this.bgB = pack(hexToRgb(P.boardB));
    this.white = pack([255, 255, 255]);
  }

  listen(ev) {
    ev.on('land', (d) => { this.shake = Math.max(this.shake, d.hard ? 2.5 : 1); this.dust(d); });
    ev.on('clear', (d) => {
      this.flash = 0.12 + 0.03 * Math.min(d.chain, 5);
      this.shake = Math.max(this.shake, Math.min(6, 1.5 + d.grains / 250 + d.chain * 0.5));
      let sx = 0, sy = 0;
      for (let k = 0; k < d.cells.length; k += 7) { sx += d.cells[k] % W; sy += (d.cells[k] / W) | 0; }
      const n = Math.ceil(d.cells.length / 7);
      const cx = BX + sx / n, cy = BY + sy / n;
      this.addFloat(`+${d.points}`, cx, cy, this.pal.text);
      if (d.chain > 1) this.addFloat(`CHAIN X${d.chain}!`, cx, cy + 8, this.pal.accent);
    });
    ev.on('cleared', (d) => this.burst(d.cells, d.colors));
    ev.on('levelUp', (d) => this.addFloat(`LEVEL ${d.level}!`, BX + W / 2, BY + 40, this.pal.accent, 1.6));
    ev.on('gameOver', () => { this.shake = 6; });
    ev.on('quake', () => { this.shake = 10; });
  }

  // ---------- efek ----------
  dust({ x, y, color }) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: BX + x + Math.random() * 24, y: BY + y + 16 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 20, life: 0.3, max: 0.3,
        color: this.sandCss[color][1], g: 60,
      });
    }
  }

  burst(cells, colors) {
    const step = Math.max(1, Math.floor(cells.length / 220));
    for (let k = 0; k < cells.length; k += step) {
      const i = cells[k];
      const life = 0.4 + Math.random() * 0.5;
      this.particles.push({
        x: BX + (i % W), y: BY + ((i / W) | 0),
        vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 50,
        life, max: life, color: this.sandCss[colors[k]]?.[0] || '#fff', g: 120, white: true,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  addFloat(text, x, y, color, life = 1) {
    this.floats.push({ text, x, y, color, t: 0, life });
  }

  showToast(title, name) { this.toast = { title, name, t: 0 }; }

  // ---------- ukuran ----------
  resize(availW, availH) {
    this.scale = Math.max(1, Math.floor(Math.min(availW / LW, availH / LH)));
    const dpr = window.devicePixelRatio || 1;
    const cw = LW * this.scale, ch = LH * this.scale;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  hit(lx, ly) {
    for (let k = this.buttons.length - 1; k >= 0; k--) {
      const b = this.buttons[k];
      if (lx >= b.x && lx < b.x + b.w && ly >= b.y && ly < b.y + b.h) return b.id;
    }
    return null;
  }

  // ---------- gambar ----------
  draw(dt, ui) {
    this.time += dt;
    const g = ui.game;
    const ctx = this.lctx, P = this.pal;
    this.buttons = [];

    // update efek
    const targetAngle = g.tilt.t > 0 && ui.screen === 'play' ? g.tilt.dir * 3 * Math.PI / 180 : 0;
    this.angle += (targetAngle - this.angle) * Math.min(1, dt * 18);
    this.shake = Math.max(0, this.shake - dt * 20);
    this.flash = Math.max(0, this.flash - dt);
    this.updateParticles(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, LW, LH);

    const sx = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const sy = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    ctx.translate(sx, sy);

    if (ui.screen === 'title' || ui.screen === 'ach' || (ui.screen === 'board' && !ui.fromOver)) {
      this.drawRain(ctx, dt);
    } else {
      this.drawBoard(ctx, g);
      this.drawPanel(ctx, g, ui);
    }

    // partikel & teks melayang
    for (const p of this.particles) {
      ctx.fillStyle = p.white && p.life > p.max * 0.75 ? '#ffffff' : p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    for (const f of this.floats) {
      const y = Math.round(f.y - f.t * 12);
      drawText(ctx, f.text, Math.round(f.x) + 1, y + 1, P.shadow, 1, 'center');
      drawText(ctx, f.text, Math.round(f.x), y, f.color, 1, 'center');
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.35, this.flash * 1.5)})`;
      ctx.fillRect(BX, BY, W, H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // layar menu
    switch (ui.screen) {
      case 'title': this.drawTitle(ctx, ui); break;
      case 'pause': this.drawPause(ctx, ui); break;
      case 'over': this.drawOver(ctx, ui); break;
      case 'board': this.drawLeaderboard(ctx, ui); break;
      case 'ach': this.drawAchievements(ctx, ui); break;
      case 'start': this.drawStart(ctx); break;
    }
    this.drawToast(ctx, dt);

    // tampilkan ke kanvas utama dengan skala bulat
    const out = this.ctx;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.imageSmoothingEnabled = false;
    out.drawImage(this.low, 0, 0, this.canvas.width, this.canvas.height);
  }

  updateParticles(dt) {
    const ps = this.particles;
    for (let k = ps.length - 1; k >= 0; k--) {
      const p = ps[k];
      p.life -= dt;
      if (p.life <= 0) { ps[k] = ps[ps.length - 1]; ps.pop(); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let k = this.floats.length - 1; k >= 0; k--) {
      const f = this.floats[k];
      f.t += dt;
      if (f.t >= f.life) this.floats.splice(k, 1);
    }
  }

  drawBoard(ctx, g) {
    const pix = this.pix, c = g.sand.cells, s = g.sand.shade, sp = this.sandPix;
    const bgA = this.bgA, bgB = this.bgB;
    for (let y = 0; y < H; y++) {
      const row = y * W, by = y >> 3;
      for (let x = 0; x < W; x++) {
        const i = row + x, v = c[i];
        pix[i] = v !== 0 ? sp[v * 4 + s[i]] : (((x >> 3) + by) & 1 ? bgB : bgA);
      }
    }

    // butir yang sedang di-clear berkedip putih
    if (g.clearing && Math.floor(this.time * 18) % 2 === 0) {
      const cells = g.clearing.cells;
      for (let k = 0; k < cells.length; k++) pix[cells[k]] = this.white;
    }

    // ghost + piece aktif
    const p = g.piece;
    if (p && g.state === 'play') {
      const pp = this.piecePix[p.color];
      const blocks = SHAPES[p.type].rots[p.rot];
      const gy = g.dropY(p);
      if (gy > p.y + BLOCK) {
        for (const [bx, bby] of blocks) {
          const cx = p.x + bx * BLOCK, cy = gy + bby * BLOCK;
          for (let ly = 0; ly < BLOCK; ly++) {
            const yy = cy + ly;
            if (yy < 0 || yy >= H) continue;
            for (let lx = 0; lx < BLOCK; lx++) {
              if (lx !== 0 && ly !== 0 && lx !== BLOCK - 1 && ly !== BLOCK - 1) continue;
              const i = yy * W + cx + lx;
              if (c[i] === 0) pix[i] = pp.ghost;
            }
          }
        }
      }
      for (const [bx, bby] of blocks) {
        const cx = p.x + bx * BLOCK, cy = p.y + bby * BLOCK;
        for (let ly = 0; ly < BLOCK; ly++) {
          const yy = cy + ly;
          if (yy < 0 || yy >= H) continue;
          for (let lx = 0; lx < BLOCK; lx++) {
            let col = pp.base;
            if (lx === 0 || ly === 0) col = pp.light;
            else if (lx === BLOCK - 1 || ly === BLOCK - 1) col = pp.dark;
            pix[yy * W + cx + lx] = col;
          }
        }
      }
    }
    this.bctx.putImageData(this.img, 0, 0);

    // bingkai + papan, ikut miring saat tilt
    const P = this.pal;
    ctx.save();
    const cx = BX + W / 2, cy = BY + H / 2;
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);
    ctx.translate(-cx, -cy);
    const dangerOn = g.danger > 0 && Math.floor(this.time * 6) % 2 === 0;
    ctx.fillStyle = dangerOn ? P.danger : P.frame;
    ctx.fillRect(BX - 2, BY - 2, W + 4, H + 4);
    ctx.fillStyle = P.shadow;
    ctx.fillRect(BX - 1, BY - 1, W + 2, H + 2);
    ctx.drawImage(this.boardCanvas, BX, BY);

    // garis bahaya (putus-putus)
    ctx.fillStyle = g.danger > 0 ? P.danger : 'rgba(255,77,94,0.35)';
    for (let x = 0; x < W; x += 4) ctx.fillRect(BX + x, BY + CFG.DANGER_Y, 2, 1);
    ctx.restore();
  }

  drawPanel(ctx, g, ui) {
    const P = this.pal;
    let y = 10;
    const label = (t) => { drawText(ctx, t, PX, y, P.dim); y += 7; };
    const value = (t, col = P.text) => { drawText(ctx, t, PX, y, col); y += 10; };

    label('NEXT');
    ctx.fillStyle = P.shadow;
    ctx.fillRect(PX, y, 26, 18);
    if (g.next) {
      const sh = SHAPES[g.next.type];
      const blocks = sh.rots[0];
      let minX = 9, maxX = 0, minY = 9, maxY = 0;
      for (const [bx, by] of blocks) { minX = Math.min(minX, bx); maxX = Math.max(maxX, bx); minY = Math.min(minY, by); maxY = Math.max(maxY, by); }
      const bw = (maxX - minX + 1) * 4, bh = (maxY - minY + 1) * 4;
      const ox = PX + Math.floor((26 - bw) / 2), oy = y + Math.floor((18 - bh) / 2);
      for (const [bx, by] of blocks) {
        ctx.fillStyle = this.sandCss[g.next.color][0];
        ctx.fillRect(ox + (bx - minX) * 4, oy + (by - minY) * 4, 4, 4);
        ctx.fillStyle = this.sandCss[g.next.color][3];
        ctx.fillRect(ox + (bx - minX) * 4 + 3, oy + (by - minY) * 4, 1, 4);
        ctx.fillRect(ox + (bx - minX) * 4, oy + (by - minY) * 4 + 3, 4, 1);
      }
    }
    y += 22;

    label('SKOR'); value(String(g.score));
    label('TERBAIK'); value(String(Math.max(ui.best, g.score)), P.dim);
    label('LEVEL'); value(String(g.level) + (g.breather > 0 ? ' ~' : ''));
    label('CHAIN'); value(g.chain > 0 ? 'X' + g.chain : '-', g.chain > 1 ? P.accent : P.text);

    label('MIRING');
    for (let k = 0; k < CFG.TILT_CHARGES; k++) {
      const on = k < g.tilt.charges;
      ctx.fillStyle = on ? P.accent : P.shadow;
      ctx.fillRect(PX + k * 9, y, 7, 5);
      if (!on && k === g.tilt.charges) {
        const w = Math.round(7 * g.tilt.recharge / CFG.TILT_RECHARGE);
        ctx.fillStyle = P.dim;
        ctx.fillRect(PX + k * 9, y + 4, w, 1);
      }
    }
    y += 12;

    // warna aktif
    for (let k = 1; k <= g.numColors; k++) {
      ctx.fillStyle = this.sandCss[k][1];
      ctx.fillRect(PX + (k - 1) * 6, y, 4, 4);
    }
    y += 10;

    if (!ui.touch) {
      drawText(ctx, 'Q/E MIRING', PX, 150, P.dim);
      drawText(ctx, 'P JEDA', PX, 157, P.dim);
    }
    drawText(ctx, 'SANDTILT', PX, 166, P.frame);
  }

  // ---------- layar ----------
  button(ctx, id, label, x, y, w, h, focused) {
    const P = this.pal;
    this.buttons.push({ id, x, y, w, h });
    ctx.fillStyle = focused ? P.accent : P.frame;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = focused ? P.accent : P.shadow;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    drawText(ctx, label, x + Math.floor(w / 2), y + Math.floor((h - 5) / 2), focused ? P.shadow : P.text, 1, 'center');
  }

  menu(ctx, ui, items, y, w = 84, gap = 15) {
    const x = Math.floor((LW - w) / 2);
    items.forEach(([id, label], k) => this.button(ctx, id, label, x, y + k * gap, w, 11, ui.focus === k));
  }

  dim(ctx, a = 0.82) {
    ctx.fillStyle = `rgba(8,7,14,${a})`;
    ctx.fillRect(0, 0, LW, LH);
  }

  drawRain(ctx, dt) {
    if (this.rain.length < 70 && Math.random() < 0.6) {
      this.rain.push({ x: Math.random() * LW, y: -2, v: 20 + Math.random() * 40, c: 1 + ((Math.random() * 5) | 0) });
    }
    for (let k = this.rain.length - 1; k >= 0; k--) {
      const r = this.rain[k];
      r.y += r.v * dt;
      if (r.y > LH) { this.rain.splice(k, 1); continue; }
      ctx.fillStyle = this.sandCss[r.c][2];
      ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 2);
    }
  }

  drawStart(ctx) {
    const P = this.pal;
    this.dim(ctx, 0.9);
    this.drawLogo(ctx, 50);
    if (Math.floor(this.time * 2) % 2 === 0) drawText(ctx, 'KLIK / TAP UNTUK MULAI', LW / 2, 110, P.text, 1, 'center');
  }

  drawLogo(ctx, y) {
    const word = 'SANDTILT';
    const sc = 3;
    let x = Math.floor((LW - textWidth(word, sc)) / 2);
    for (let k = 0; k < word.length; k++) {
      const bob = Math.round(Math.sin(this.time * 3 + k * 0.7) * 1.2);
      drawText(ctx, word[k], x + 1, y + bob + 1, this.pal.shadow, sc);
      drawText(ctx, word[k], x, y + bob, this.sandCss[(k % 5) + 1][0], sc);
      x += 4 * sc;
    }
  }

  drawTitle(ctx, ui) {
    const P = this.pal;
    this.drawLogo(ctx, 26);
    drawText(ctx, 'TETRIS PASIR YANG BISA MIRING', LW / 2, 48, P.dim, 1, 'center');
    this.menu(ctx, ui, [['play', 'MAIN'], ['board', 'PERINGKAT'], ['ach', 'PRESTASI']], 70);
    drawText(ctx, `TERBAIK: ${ui.best}`, LW / 2, 122, P.accent, 1, 'center');
    if (ui.playerName) drawText(ctx, `PEMAIN: ${ui.playerName}`, LW / 2, 130, P.dim, 1, 'center');
    if (!ui.touch) {
      drawText(ctx, '<- -> GESER   ^ PUTAR   SPASI JATUH', LW / 2, 150, P.dim, 1, 'center');
      drawText(ctx, 'Q / E MIRING   P JEDA   M SUARA', LW / 2, 158, P.dim, 1, 'center');
    }
    drawText(ctx, ui.muted ? 'SUARA: MATI' : '', LW / 2, 168, P.dim, 1, 'center');
  }

  drawPause(ctx, ui) {
    this.dim(ctx);
    drawText(ctx, 'JEDA', LW / 2, 50, this.pal.text, 3, 'center');
    this.menu(ctx, ui, [['resume', 'LANJUT'], ['restart', 'ULANG'], ['menu', 'MENU']], 80);
  }

  drawOver(ctx, ui) {
    const P = this.pal, o = ui.over || {};
    this.dim(ctx, 0.86);
    drawText(ctx, 'GAME OVER', LW / 2, 14, P.danger, 2, 'center');
    let y = 34;
    const row = (k, v, col = P.text) => {
      drawText(ctx, k, 30, y, P.dim);
      drawText(ctx, String(v), 130, y, col, 1, 'right');
      y += 9;
    };
    row('SKOR', o.score ?? 0, P.accent);
    row('CHAIN TERBAIK', o.bestChain ?? 0);
    row('LEVEL', o.level ?? 1);
    row('BUTIR DIHAPUS', o.grains ?? 0);
    row('DURASI', `${o.duration ?? 0} DTK`);
    y += 4;
    if (o.newBest) { drawText(ctx, 'REKOR PRIBADI BARU!', LW / 2, y, P.accent, 1, 'center'); y += 9; }
    if (ui.lbStatus) { drawText(ctx, ui.lbStatus, LW / 2, y, ui.lbStatusColor || P.text, 1, 'center'); y += 9; }
    if (o.newAch > 0) { drawText(ctx, `${o.newAch} PRESTASI BARU`, LW / 2, y, P.dim, 1, 'center'); }
    this.menu(ctx, ui, [['restart', 'MAIN LAGI'], ['board', 'PERINGKAT'], ['menu', 'MENU']], 120);
  }

  drawLeaderboard(ctx, ui) {
    const P = this.pal, lb = ui.lb || {};
    if (ui.fromOver) this.dim(ctx, 0.9);
    drawText(ctx, 'PERINGKAT', LW / 2, 5, P.text, 2, 'center');
    this.button(ctx, 'tabWeekly', 'MINGGU INI', 6, 20, 72, 11, lb.tab === 'weekly');
    this.button(ctx, 'tabAll', 'SEPANJANG MASA', 82, 20, 72, 11, lb.tab === 'alltime');

    let y = 37;
    if (lb.loading) {
      drawText(ctx, 'MEMUAT...', LW / 2, 80, P.dim, 1, 'center');
    } else if (!lb.rows || lb.rows.length === 0) {
      drawText(ctx, 'BELUM ADA SKOR', LW / 2, 70, P.dim, 1, 'center');
      drawText(ctx, 'JADILAH YANG PERTAMA!', LW / 2, 80, P.dim, 1, 'center');
    } else {
      lb.rows.slice(0, 10).forEach((r, k) => {
        const me = r.me;
        if (me) { ctx.fillStyle = P.frame; ctx.fillRect(6, y - 2, 148, 9); }
        const col = k === 0 ? P.accent : me ? P.text : P.text;
        drawText(ctx, String(k + 1), 17, y, k < 3 ? P.accent : P.dim, 1, 'right');
        drawText(ctx, (r.name || '?').slice(0, 16), 22, y, col);
        drawText(ctx, String(r.score), 153, y, col, 1, 'right');
        y += 10;
      });
      if (lb.mine && !lb.rows.slice(0, 10).some((r) => r.me)) {
        y += 2;
        ctx.fillStyle = P.frame; ctx.fillRect(6, y - 2, 148, 9);
        drawText(ctx, `#${lb.mine.rank}`, 21, y, P.accent, 1, 'right');
        drawText(ctx, (lb.mine.name || 'KAMU').slice(0, 16), 24, y, P.text);
        drawText(ctx, String(lb.mine.score), 153, y, P.text, 1, 'right');
      }
    }
    const info = lb.offline ? 'OFFLINE - SKOR LOKAL' : (lb.tab === 'weekly' && lb.resetIn ? `RESET DALAM ${lb.resetIn}` : '');
    if (info) drawText(ctx, info, LW / 2, 150, lb.offline ? P.danger : P.dim, 1, 'center');
    this.menu(ctx, { focus: 0 }, [['back', 'KEMBALI']], 160, 60);
  }

  drawAchievements(ctx, ui) {
    const P = this.pal;
    this.dim(ctx, 0.6);
    drawText(ctx, 'PRESTASI', LW / 2, 5, P.text, 2, 'center');
    const list = ui.ach || [];
    const done = list.filter((a) => a.unlocked).length;
    drawText(ctx, `${done}/${list.length}`, LW / 2, 19, P.dim, 1, 'center');
    let y = 28;
    for (const a of list) {
      const show = a.unlocked || !a.hidden;
      ctx.fillStyle = a.unlocked ? P.accent : P.shadow;
      ctx.fillRect(6, y, 7, 7);
      if (!a.unlocked) { ctx.fillStyle = P.frame; ctx.fillRect(8, y + 2, 3, 3); }
      drawText(ctx, show ? a.name : '???', 17, y, a.unlocked ? P.text : P.dim);
      drawText(ctx, show ? a.desc : 'RAHASIA', 17, y + 6, P.dim);
      y += 13;
    }
    this.menu(ctx, { focus: 0 }, [['back', 'KEMBALI']], 160, 60);
  }

  drawToast(ctx, dt) {
    const t = this.toast;
    if (!t) return;
    t.t += dt;
    if (t.t > 2.6) { this.toast = null; return; }
    const P = this.pal;
    const slide = Math.min(1, t.t * 6, (2.6 - t.t) * 6);
    const y = Math.round(-16 + 18 * slide);
    const w = Math.max(textWidth(t.name), textWidth(t.title)) + 10;
    const x = Math.floor((LW - w) / 2);
    ctx.fillStyle = P.accent; ctx.fillRect(x, y, w, 15);
    ctx.fillStyle = P.shadow; ctx.fillRect(x + 1, y + 1, w - 2, 13);
    drawText(ctx, t.title, LW / 2, y + 2, P.accent, 1, 'center');
    drawText(ctx, t.name, LW / 2, y + 8, P.text, 1, 'center');
  }
}
