import { W, H, BLOCK, CFG, MAT_STONE, MAT_GUN } from './config.js';
import { SHAPES } from './pieces.js';
import { drawText, textWidthPx, drawBlockText, blockTextWidth } from './font.js';

// Gambar pixel art (papan, pasir, kotak UI) di kanvas kecil 160x176 lalu diperbesar dengan skala bulat.
// Teks digambar terpisah langsung di resolusi layar dengan font 5x7 → lebih kecil & mudah dibaca.
export const LW = 160, LH = 176;
const BX = 6, BY = 10;   // posisi papan
const PX = 94;           // posisi panel samping

export const PALETTES = {
  default: {
    bg: '#14121f', boardA: '#1b192b', boardB: '#1f1c31', frame: '#4a4470', text: '#ece8f5',
    dim: '#8a84a8', accent: '#f2c14e', danger: '#ff4d5e', shadow: '#0b0a12',
    sand: ['#e8505b', '#f2c14e', '#3fbf8f', '#4c8bf5', '#b45ce0'],
    speck: '#ffb04a',                                    // bintik mesiu
  },
  retro: {
    bg: '#0d170d', boardA: '#132213', boardB: '#162716', frame: '#3f6f3f', text: '#c8f5b0',
    dim: '#5f9a5a', accent: '#e8ff9a', danger: '#f0ff70', shadow: '#081008',
    sand: ['#f0ffd8', '#a9e47c', '#6fbd4f', '#3f8a32', '#d2d36a'],
    speck: '#ffff9a',
  },
};

const SHADES = [1.12, 1.0, 0.91, 0.82];
const EVENT_NAMES = { quake: 'GEMPA', wind: 'ANGIN', force: 'PAPAN MIRING' };

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
    this.k = 1;          // piksel layar per piksel logis
    this.tp = 1;         // ukuran titik glyph teks dalam piksel layar
    this.texts = [];
    this.ox = 0; this.oy = 0;

    this.time = 0;
    this.angle = 0;
    this.shake = 0;
    this.flash = 0;
    this.particles = [];
    this.floats = [];
    this.rain = [];
    this.streaks = [];
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
    // tex[c]: warna siap pakai per material, masing-masing { p: packed untuk ImageData, s: string CSS }
    this.tex = [];
    const mk = (rgb) => ({ p: pack(rgb), s: css(rgb) });
    for (let c = 1; c <= 5; c++) {
      const base = hexToRgb(P.sand[c - 1]);
      this.sandCss[c] = [];
      for (let s = 0; s < 4; s++) {
        const rgb = scaleRgb(base, SHADES[s]);
        this.sandPix[c * 4 + s] = pack(rgb);
        this.sandCss[c][s] = css(rgb);
      }
      const sc = (f) => mk(scaleRgb(base, f));
      this.tex[c] = {
        piece: { base: mk(base), light: sc(1.35), dark: sc(0.62), ghost: sc(0.42) },
        // batu: warna lebih gelap & padat, dengan retakan
        stone: { light: sc(1.0), base: sc(0.72), base2: sc(0.62), dark: sc(0.38), crack: sc(0.5) },
        // mesiu: warna sangat gelap dengan bintik api
        gun: [sc(0.52), sc(0.45), sc(0.38)],
      };
    }
    this.speck = mk(hexToRgb(P.speck));
    this.bgA = pack(hexToRgb(P.boardA));
    this.bgB = pack(hexToRgb(P.boardB));
    this.white = pack([255, 255, 255]);
  }

  listen(ev) {
    ev.on('land', (d) => { this.shake = Math.max(this.shake, d.hard ? 2.5 : 1); this.dust(d); });
    ev.on('clear', (d) => {
      this.flash = 0.12 + 0.03 * Math.min(d.chain, 5);
      this.shake = Math.max(this.shake, Math.min(6, 1.5 + d.grains / 250 + d.chain * 0.5));
      let sx = 0, sy = 0, n = 0;
      for (let k = 0; k < d.cells.length; k += 7) { sx += d.cells[k] % W; sy += (d.cells[k] / W) | 0; n++; }
      const cx = BX + sx / n, cy = BY + sy / n;
      this.addFloat(`+${d.points}`, cx, cy, this.pal.text);
      if (d.chain > 1) this.addFloat(`CHAIN X${d.chain}!`, cx, cy + 7, this.pal.accent);
    });
    ev.on('cleared', (d) => this.burst(d.cells, d.colors));
    ev.on('levelUp', (d) => this.addFloat(`LEVEL ${d.level}!`, BX + W / 2, BY + 50, this.pal.accent, 1.6));
    ev.on('gameOver', () => { this.shake = 6; });
    ev.on('quake', () => { this.shake = 10; });
    ev.on('eventStart', (e) => { if (e.type === 'quake') this.shake = 6; });
    ev.on('explode', (d) => {
      this.shake = Math.max(this.shake, 8);
      this.flash = 0.3;
      for (const [x, y] of d.centers) {
        for (let n = 0; n < 24; n++) {
          const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 70, life = 0.3 + Math.random() * 0.4;
          this.particles.push({ x: BX + x, y: BY + y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 40,
            life, max: life, color: Math.random() < 0.5 ? '#ffb347' : '#ff5a36', white: true });
        }
      }
      const [cx, cy] = d.centers[0] || [W / 2, H / 2];
      this.addFloat(d.stones > 0 ? 'BATU HANCUR!' : 'LEDAKAN!', BX + cx, BY + cy - 10, '#ffb347', 1.2);
    });
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

  addFloat(text, x, y, color, life = 1) { this.floats.push({ text, x, y, color, t: 0, life }); }

  // icon: tier trofi (bronze/silver/gold/secret) atau null
  showToast(title, name, icon = null) { this.toast = { title, name, icon, t: 0 }; }

  // Ikon trofi pixel art 12x11 dari assets/image (dimuat sekali).
  drawTrophy(ctx, tier, x, y) {
    if (!this.icons) {
      this.icons = {};
      for (const t of ['bronze', 'silver', 'gold', 'secret', 'locked']) {
        const img = new Image();
        img.src = `assets/image/trophy-${t}.svg`;
        this.icons[t] = img;
      }
    }
    const img = this.icons[tier] || this.icons.locked;
    if (img.complete && img.naturalWidth) ctx.drawImage(img, Math.round(x), Math.round(y), 12, 11);
    else { ctx.fillStyle = this.pal.accent; ctx.fillRect(Math.round(x) + 2, Math.round(y) + 1, 8, 8); }
  }

  // Tekstur satu titik di dalam blok n×n (dipakai piece jatuh, preview NEXT).
  texel(mat, c, lx, ly, n, salt = 0) {
    const T = this.tex[c], e = n - 1;
    if (mat === MAT_STONE) {
      if (lx === 0 || ly === 0) return T.stone.light;
      if (lx === e || ly === e) return T.stone.dark;
      if (n > 5 && (lx === 1 || ly === 1 || lx === e - 1 || ly === e - 1)) return T.stone.base2;
      return (lx + ly * 3 + salt) % 5 === 0 ? T.stone.crack : T.stone.base;
    }
    if (mat === MAT_GUN) {
      if (lx === 0 || ly === 0) return T.piece.base;
      if (lx === e || ly === e) return T.piece.dark;
      return (lx * 3 + ly * 5 + salt) % (n > 5 ? 7 : 4) === 0 ? this.speck : T.gun[(lx + ly) % 3];
    }
    if (lx === 0 || ly === 0) return T.piece.light;
    if (lx === e || ly === e) return T.piece.dark;
    return T.piece.base;
  }

  // ---------- ukuran ----------
  resize(availW, availH) {
    // Skala bulat dalam piksel PERANGKAT (bukan CSS), jadi di HP dpr 3 layar bisa memenuhi slot tanpa blur.
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((availW * dpr) / LW, (availH * dpr) / LH);
    const k = Math.max(1, Math.floor(fit));
    this.canvas.width = LW * k;
    this.canvas.height = LH * k;
    // Layar padat (HP, retina): kanvas boleh diperbesar sedikit lagi oleh CSS supaya memenuhi slot;
    // selisih ukuran piksel di layar seperti itu tidak terlihat. Layar biasa tetap skala bulat.
    const shown = dpr >= 2 ? Math.max(k, fit) : k;
    this.canvas.style.width = (LW * shown) / dpr + 'px';
    this.canvas.style.height = (LH * shown) / dpr + 'px';
    this.ctx.imageSmoothingEnabled = false;
    this.scale = k / dpr;
    this.k = k;
    // ukuran titik teks: sekitar setengah piksel papan, maksimal 4 piksel logis per huruf
    this.tp = Math.max(1, Math.min(Math.round(k * 0.6), Math.floor((k * 4) / 6)));
  }

  hit(lx, ly) {
    for (let k = this.buttons.length - 1; k >= 0; k--) {
      const b = this.buttons[k];
      if (lx >= b.x && lx < b.x + b.w && ly >= b.y && ly < b.y + b.h) return b.id;
    }
    return null;
  }

  // ---------- teks (dikumpulkan dulu, digambar terakhir di resolusi layar) ----------
  txt(str, x, y, color, size = 1, align = 'left', shadow = true) {
    this.texts.push({ str: String(str), x: x + this.ox, y: y + this.oy, color, px: this.tp * size, align, alpha: 1, shadow });
  }
  tw(str, size = 1) { return textWidthPx(String(str).toUpperCase(), this.tp * size) / this.k; }
  th(size = 1) { return (7 * this.tp * size) / this.k; }

  // ---------- gambar ----------
  draw(dt, ui) {
    this.time += dt;
    const g = ui.game;
    const ctx = this.lctx, P = this.pal;
    this.buttons = [];
    this.texts = [];

    const playing = ui.screen === 'play' || ui.screen === 'pause';
    const eff = playing && g.state === 'play' ? g.effectiveTilt() : 0;
    const forced = g.event && g.event.phase === 'active' && g.event.type === 'force';
    const targetAngle = eff * (forced ? 4 : 3) * Math.PI / 180;
    this.angle += (targetAngle - this.angle) * Math.min(1, dt * 18);
    if (playing && g.event && g.event.phase === 'active' && g.event.type === 'quake') this.shake = Math.max(this.shake, 2.5);
    this.shake = Math.max(0, this.shake - dt * 20);
    this.flash = Math.max(0, this.flash - dt);
    this.updateParticles(dt, g, playing);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, LW, LH);

    const sx = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const sy = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    ctx.translate(sx, sy);
    this.ox = sx; this.oy = sy;

    if (ui.screen === 'title' || ui.screen === 'ach' || ui.screen === 'settings' || ui.screen === 'start' || (ui.screen === 'board' && !ui.fromOver)) {
      this.drawRain(ctx, dt);
    } else {
      this.drawBoard(ctx, g);
      this.drawPanel(ctx, g, ui);
      this.drawEventBanner(ctx, g, ui);
    }

    for (const p of this.particles) {
      ctx.fillStyle = p.white && p.life > p.max * 0.75 ? '#ffffff' : p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w || 1, 1);
    }
    for (const f of this.floats) this.txt(f.text, f.x, f.y - f.t * 12, f.color, 1, 'center');
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.35, this.flash * 1.5)})`;
      ctx.fillRect(BX, BY, W, H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ox = 0; this.oy = 0;

    switch (ui.screen) {
      case 'title': this.drawTitle(ctx, ui); break;
      case 'pause': this.drawPause(ctx, ui); break;
      case 'over': this.drawOver(ctx, ui); break;
      case 'board': this.drawLeaderboard(ctx, ui); break;
      case 'ach': this.drawAchievements(ctx, ui); break;
      case 'settings': this.drawSettings(ctx, ui); break;
      case 'start': this.drawStart(ctx); break;
    }
    this.drawToast(ctx, dt);
    this.composite();
  }

  // Gambar lapisan saat ini (grafis low-res + teksnya) ke layar, lalu kosongkan kanvas low-res
  // agar lapisan berikutnya (dim, menu, toast) benar-benar menutupi teks di bawahnya.
  composite() {
    const out = this.ctx, k = this.k;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.imageSmoothingEnabled = false;
    out.drawImage(this.low, 0, 0, this.canvas.width, this.canvas.height);
    const shadow = this.pal.shadow;
    for (const t of this.texts) {
      if (t.alpha <= 0.02) continue;
      out.globalAlpha = t.alpha;
      if (t.shadow) drawText(out, t.str, t.x * k + t.px, t.y * k + t.px, shadow, t.px, t.align);
      drawText(out, t.str, t.x * k, t.y * k, t.color, t.px, t.align);
    }
    out.globalAlpha = 1;
    this.texts = [];
    const l = this.lctx;
    l.save();
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, LW, LH);
    l.restore();
  }

  // Mulai lapisan baru di atas semua yang sudah digambar (z-index lebih tinggi).
  layer() { this.composite(); }

  updateParticles(dt, g, playing) {
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
    // garis angin
    const e = g.event;
    if (playing && e && e.phase === 'active' && e.type === 'wind' && Math.random() < 0.5) {
      const x = e.dir > 0 ? BX - 4 : BX + W + 4;
      ps.push({ x, y: BY + Math.random() * H, vx: e.dir * (140 + Math.random() * 80), vy: 0, g: 0,
        life: 0.6, max: 0.6, color: 'rgba(236,232,245,0.45)', w: 4 });
    }
  }

  drawBoard(ctx, g) {
    const pix = this.pix, c = g.sand.cells, s = g.sand.shade, m = g.sand.mat, sp = this.sandPix;
    const bgA = this.bgA, bgB = this.bgB, speck = this.speck.p;
    for (let y = 0; y < H; y++) {
      const row = y * W, by = y >> 3;
      for (let x = 0; x < W; x++) {
        const i = row + x, v = c[i];
        if (v === 0) { pix[i] = ((x >> 3) + by) & 1 ? bgB : bgA; continue; }
        const mt = m[i];
        if (mt === MAT_STONE) {
          // batu: tepi atas terang, tepi bawah gelap, ada retakan → terlihat seperti blok padat
          const st = this.tex[v].stone;
          const up = y > 0 && (c[i - W] === 0 || m[i - W] !== MAT_STONE);
          const down = y < H - 1 && (c[i + W] === 0 || m[i + W] !== MAT_STONE);
          pix[i] = up ? st.light.p : down ? st.dark.p : (x + y * 3) % 7 === 0 ? st.crack.p : (s[i] & 1 ? st.base2.p : st.base.p);
        } else if (mt === MAT_GUN) {
          pix[i] = s[i] === 3 && (i & 1) ? speck : this.tex[v].gun[s[i] % 3].p;
        } else pix[i] = sp[v * 4 + s[i]];
      }
    }

    // Kilatan clear: merambat dari kiri ke kanan, lalu berkedip sebelum meledak.
    if (g.clearing) {
      const cl = g.clearing;
      const prog = 1 - cl.t / cl.t0;
      const front = (prog / 0.6) * (W + 6);
      const blinkOn = Math.floor(this.time * 20) % 2 === 0;
      const cells = cl.cells;
      for (let k = 0; k < cells.length; k++) {
        const i = cells[k], x = i % W;
        if (prog >= 0.6) { if (blinkOn) pix[i] = this.white; }
        else if (x < front - 6) pix[i] = this.white;
        else if (x < front) pix[i] = this.sandPix[c[i] * 4] | 0; // ujung kilatan: warna paling terang
      }
    }

    // ghost + piece aktif
    const p = g.piece;
    if (p && g.state === 'play') {
      const ghost = this.tex[p.color].piece.ghost.p;
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
              if (c[i] === 0) pix[i] = ghost;
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
            pix[yy * W + cx + lx] = this.texel(p.mat, p.color, lx, ly, BLOCK, bx + bby).p;
          }
        }
      }
    }
    this.bctx.putImageData(this.img, 0, 0);

    // bingkai + papan, ikut miring
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
    ctx.fillStyle = g.danger > 0 ? P.danger : 'rgba(255,77,94,0.35)';
    for (let x = 0; x < W; x += 4) ctx.fillRect(BX + x, BY + CFG.DANGER_Y, 2, 1);
    ctx.restore();
  }

  drawPanel(ctx, g, ui) {
    const P = this.pal;
    let y = 10;
    const label = (t) => { this.txt(t, PX, y, P.dim); y += 7; };
    const value = (t, col = P.text) => { this.txt(t, PX, y, col); y += 10; };

    label('NEXT');
    ctx.fillStyle = P.shadow;
    ctx.fillRect(PX, y, 26, 18);
    if (g.next) {
      const blocks = SHAPES[g.next.type].rots[0];
      let minX = 9, maxX = 0, minY = 9, maxY = 0;
      for (const [bx, by] of blocks) { minX = Math.min(minX, bx); maxX = Math.max(maxX, bx); minY = Math.min(minY, by); maxY = Math.max(maxY, by); }
      // Preview memakai tekstur material yang sama dengan piece (blok 5x5) → pemain tahu lebih dulu.
      const n = 5;
      const ox = PX + Math.floor((26 - (maxX - minX + 1) * n) / 2), oy = y + Math.floor((18 - (maxY - minY + 1) * n) / 2);
      for (const [bx, by] of blocks) {
        const x0 = ox + (bx - minX) * n, y0 = oy + (by - minY) * n;
        for (let ly = 0; ly < n; ly++) {
          for (let lx = 0; lx < n; lx++) {
            ctx.fillStyle = this.texel(g.next.mat, g.next.color, lx, ly, n, bx + by).s;
            ctx.fillRect(x0 + lx, y0 + ly, 1, 1);
          }
        }
      }
      if (g.next.mat === MAT_STONE) this.txt('BATU', PX + 29, y + 6, P.text);
      else if (g.next.mat === MAT_GUN) this.txt('MESIU', PX + 29, y + 6, this.speck.s);
    }
    y += 22;

    label('SKOR'); value(g.score);
    label('TERBAIK'); value(Math.max(ui.best, g.score), P.dim);
    label('LEVEL'); value(g.level + (g.breather > 0 ? ' ~' : ''));
    label('CHAIN'); value(g.chain > 0 ? 'X' + g.chain : '-', g.chain > 1 ? P.accent : P.text);

    // meter miring
    label('MIRING');
    const t = g.tilt, bw = 54;
    ctx.fillStyle = P.shadow; ctx.fillRect(PX, y, bw, 5);
    const low = t.meter < CFG.TILT_MIN_START && !t.active;
    ctx.fillStyle = t.active ? (Math.floor(this.time * 12) % 2 ? '#ffffff' : P.accent) : low ? P.danger : P.accent;
    ctx.fillRect(PX, y, Math.round(bw * t.meter), 5);
    y += 11;

    // warna aktif
    for (let k = 1; k <= g.numColors; k++) {
      ctx.fillStyle = this.sandCss[k][1];
      ctx.fillRect(PX + (k - 1) * 6, y, 4, 4);
    }

    if (this.k >= 2) {   // di layar sangat kecil teks bantuan tidak muat
      this.txt(ui.touch ? 'TAHAN L/R MIRING' : 'TAHAN Q/E MIRING', PX, 144, P.dim);
      this.txt(ui.touch ? 'MENU = JEDA' : 'P JEDA  M SUARA', PX, 151, P.dim);
    }
    this.txt('SANDTILT', PX, 165, P.frame, 1, 'left', false);
  }

  // Banner peringatan & event aktif di atas papan.
  drawEventBanner(ctx, g, ui) {
    const e = g.event;
    if (!e || g.state !== 'play') return;
    const P = this.pal;
    const arrow = e.dir > 0 ? '>>' : '<<';
    let line1, line2 = '', col;
    if (e.phase === 'warn') {
      const pulse = Math.floor(this.time * 6) % 2 === 0;
      line1 = `${EVENT_NAMES[e.type]} ${e.type === 'quake' ? '' : arrow}`.trim();
      line2 = `DALAM ${Math.ceil(e.t)}`;
      col = pulse ? P.accent : P.text;
    } else {
      line1 = e.type === 'quake' ? 'GEMPA!' : `${EVENT_NAMES[e.type]} ${arrow}`;
      if (e.type === 'force') line2 = ui.touch ? `TAHAN ${e.dir > 0 ? 'L' : 'R'} MELAWAN` : `TAHAN ${e.dir > 0 ? 'Q' : 'E'} MELAWAN`;
      if (e.type === 'wind') line2 = 'PIECE TERDORONG';
      col = P.danger;
    }
    const y = BY + 22;
    const w = Math.ceil(Math.max(this.tw(line1), this.tw(line2))) + 8;
    const h = line2 ? 17 : 10;
    const x = Math.round(BX + (W - w) / 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.shadow; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    this.txt(line1, BX + W / 2, y + 2.5, col, 1, 'center');
    if (line2) this.txt(line2, BX + W / 2, y + 9.5, P.text, 1, 'center');
  }

  // ---------- layar ----------
  button(ctx, id, label, x, y, w, h, focused) {
    const P = this.pal;
    this.buttons.push({ id, x, y, w, h });
    ctx.fillStyle = focused ? P.accent : P.frame;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = focused ? P.accent : P.shadow;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    this.txt(label, x + w / 2, y + (h - this.th()) / 2, focused ? P.shadow : P.text, 1, 'center', !focused);
  }

  menu(ctx, ui, items, y, w = 84, gap = 15) {
    const x = Math.floor((LW - w) / 2);
    items.forEach(([id, label], k) => this.button(ctx, id, label, x, y + k * gap, w, 11, ui.focus === k));
  }

  dim(ctx, a = 0.82) {
    this.layer();
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

  drawLogo(ctx, y) {
    const word = 'SANDTILT', sc = 3;
    let x = Math.floor((LW - blockTextWidth(word, sc)) / 2);
    for (let k = 0; k < word.length; k++) {
      const bob = Math.round(Math.sin(this.time * 3 + k * 0.7) * 1.2);
      drawBlockText(ctx, word[k], x + 1, y + bob + 1, this.pal.shadow, sc);
      drawBlockText(ctx, word[k], x, y + bob, this.sandCss[(k % 5) + 1][0], sc);
      x += 4 * sc;
    }
  }

  drawStart(ctx) {
    this.drawLogo(ctx, 50);
    if (Math.floor(this.time * 2) % 2 === 0) this.txt('KLIK / TAP UNTUK MULAI', LW / 2, 110, this.pal.text, 1, 'center');
  }

  drawTitle(ctx, ui) {
    const P = this.pal;
    this.drawLogo(ctx, 24);
    this.txt('TETRIS PASIR YANG BISA MIRING', LW / 2, 46, P.dim, 1, 'center');
    const items = (ui.titleItems || ['play', 'board', 'ach', 'settings']).map((id) => [id, this.menuLabel(id, ui)]);
    this.menu(ctx, ui, items, 64, 84, items.length > 3 ? 14 : 15);
    this.txt(`TERBAIK: ${ui.best}`, LW / 2, 124, P.accent, 1, 'center');
    if (ui.playerName) this.txt(`PEMAIN: ${ui.playerName}`, LW / 2, 132, P.dim, 1, 'center');
    if (ui.touch) {
      this.txt('A PUTAR  B BALIK  ^ JATUH', LW / 2, 146, P.dim, 1, 'center');
      this.txt('TAHAN L / R UNTUK MIRING', LW / 2, 154, P.dim, 1, 'center');
    } else {
      this.txt('<- -> GESER   ^ PUTAR   SPASI JATUH', LW / 2, 146, P.dim, 1, 'center');
      this.txt('TAHAN Q / E MIRING   P JEDA', LW / 2, 154, P.dim, 1, 'center');
    }
    if (ui.soundMode && ui.soundMode !== 'all') {
      this.txt(ui.soundMode === 'off' ? 'SUARA: MATI' : 'MUSIK: MATI', LW / 2, 165, P.dim, 1, 'center');
    }
  }

  // Label menu bersama (judul, jeda, pengaturan).
  menuLabel(id, ui) {
    const SOUND = { all: 'SEMUA', sfx: 'EFEK SAJA', off: 'MATI' };
    switch (id) {
      case 'play': return 'MAIN';
      case 'board': return 'PERINGKAT';
      case 'ach': return 'PRESTASI';
      case 'settings': return 'PENGATURAN';
      case 'resume': return 'LANJUT';
      case 'restart': return 'ULANG';
      case 'menu': return 'MENU UTAMA';
      case 'back': return 'KEMBALI';
      case 'sound': return `SUARA: ${SOUND[ui.soundMode] || 'SEMUA'}`;
      case 'theme': return `TEMA: ${ui.theme === 'retro' ? 'RETRO' : 'KLASIK'}`;
      default: return id.toUpperCase();
    }
  }

  drawPause(ctx, ui) {
    this.dim(ctx);
    this.txt('JEDA', LW / 2, 40, this.pal.text, 2, 'center');
    const items = (ui.menuItems || ['resume', 'restart', 'menu']).map((id) => [id, this.menuLabel(id, ui)]);
    this.menu(ctx, ui, items, 62, 96, 15);
  }

  drawSettings(ctx, ui) {
    this.dim(ctx, 0.6);
    this.txt('PENGATURAN', LW / 2, 30, this.pal.text, 2, 'center');
    const items = (ui.menuItems || ['sound', 'back']).map((id) => [id, this.menuLabel(id, ui)]);
    this.menu(ctx, ui, items, 60, 96, 15);
    this.txt(ui.touch ? 'SAAT MAIN: MENU = JEDA & PENGATURAN' : 'M = SUARA   P = JEDA SAAT MAIN', LW / 2, 140, this.pal.dim, 1, 'center');
  }

  drawOver(ctx, ui) {
    const P = this.pal, o = ui.over || {};
    this.dim(ctx, 0.86);
    this.txt('GAME OVER', LW / 2, 12, P.danger, 2, 'center');
    let y = 34;
    const row = (k, v, col = P.text) => {
      this.txt(k, 24, y, P.dim);
      this.txt(v, 136, y, col, 1, 'right');
      y += 9;
    };
    row('SKOR', o.score ?? 0, P.accent);
    row('CHAIN TERBAIK', o.bestChain ?? 0);
    row('LEVEL', o.level ?? 1);
    row('BUTIR DIHAPUS', o.grains ?? 0);
    row('DURASI', `${o.duration ?? 0} DTK`);
    y += 3;
    if (o.newBest) { this.txt('REKOR PRIBADI BARU!', LW / 2, y, P.accent, 1, 'center'); y += 9; }
    if (ui.lbStatus) { this.txt(ui.lbStatus, LW / 2, y, ui.lbStatusColor || P.text, 1, 'center'); y += 9; }
    if (o.newAch > 0) this.txt(`${o.newAch} PRESTASI BARU`, LW / 2, y, P.dim, 1, 'center');
    this.menu(ctx, ui, [['restart', 'MAIN LAGI'], ['board', 'PERINGKAT'], ['menu', 'MENU']], 120);
  }

  drawLeaderboard(ctx, ui) {
    const P = this.pal, lb = ui.lb || {};
    if (ui.fromOver) this.dim(ctx, 0.92);
    this.txt('PERINGKAT', LW / 2, 4, P.text, 2, 'center');
    this.button(ctx, 'tabWeekly', 'MINGGU INI', 6, 20, 72, 11, lb.tab === 'weekly');
    this.button(ctx, 'tabAll', 'SEPANJANG MASA', 82, 20, 72, 11, lb.tab === 'alltime');

    let y = 37;
    if (lb.loading) {
      this.txt('MEMUAT...', LW / 2, 80, P.dim, 1, 'center');
    } else if (!lb.rows || lb.rows.length === 0) {
      this.txt('BELUM ADA SKOR', LW / 2, 70, P.dim, 1, 'center');
      this.txt('JADILAH YANG PERTAMA!', LW / 2, 80, P.dim, 1, 'center');
    } else {
      const top = lb.rows.slice(0, 10);
      top.forEach((r, k) => {
        if (r.me) { ctx.fillStyle = P.frame; ctx.fillRect(6, y - 2, 148, 9); }
        this.txt(k + 1, 17, y, k < 3 ? P.accent : P.dim, 1, 'right');
        this.txt((r.name || '?').slice(0, 16), 22, y, k === 0 ? P.accent : P.text);
        this.txt(r.score, 153, y, k === 0 ? P.accent : P.text, 1, 'right');
        y += 10;
      });
      if (lb.mine && !top.some((r) => r.me)) {
        y += 2;
        ctx.fillStyle = P.frame; ctx.fillRect(6, y - 2, 148, 9);
        this.txt(`#${lb.mine.rank}`, 21, y, P.accent, 1, 'right');
        this.txt((lb.mine.name || 'KAMU').slice(0, 16), 24, y, P.text);
        this.txt(lb.mine.score, 153, y, P.text, 1, 'right');
      }
    }
    const info = lb.offline ? 'OFFLINE - SKOR LOKAL' : (lb.tab === 'weekly' && lb.resetIn ? `RESET DALAM ${lb.resetIn}` : '');
    if (info) this.txt(info, LW / 2, 149, lb.offline ? P.danger : P.dim, 1, 'center');
    this.menu(ctx, { focus: 0 }, [['back', 'KEMBALI']], 160, 60);
  }

  drawAchievements(ctx, ui) {
    const P = this.pal;
    this.dim(ctx, 0.6);
    this.txt('PRESTASI', LW / 2, 4, P.text, 2, 'center');
    const list = ui.ach || [];
    this.txt(`TROFI ${list.filter((a) => a.unlocked).length}/${list.length}`, LW / 2, 18, P.dim, 1, 'center');
    let y = 27;
    for (const a of list) {
      const show = a.unlocked || !a.hidden;
      this.drawTrophy(ctx, a.unlocked ? a.tier : 'locked', 4, y - 1);
      this.txt(show ? a.name : '???', 19, y - 0.5, a.unlocked ? P.text : P.dim);
      this.txt(show ? a.desc : 'RAHASIA', 19, y + 4.5, P.dim);
      y += 11;
    }
    this.menu(ctx, { focus: 0 }, [['back', 'KEMBALI']], 160, 60);
  }

  drawToast(ctx, dt) {
    const t = this.toast;
    if (!t) return;
    t.t += dt;
    if (t.t > 2.6) { this.toast = null; return; }
    this.layer();
    const P = this.pal;
    const slide = Math.min(1, t.t * 6, (2.6 - t.t) * 6);
    const y = Math.round(-16 + 18 * slide);
    const iconW = t.icon ? 15 : 0;
    const w = Math.ceil(Math.max(this.tw(t.name), this.tw(t.title))) + 10 + iconW;
    const x = Math.floor((LW - w) / 2);
    ctx.fillStyle = P.accent; ctx.fillRect(x, y, w, 16);
    ctx.fillStyle = P.shadow; ctx.fillRect(x + 1, y + 1, w - 2, 14);
    if (t.icon) {
      // trofi berkilau sebentar saat muncul
      const bob = t.t < 0.6 ? Math.round(Math.sin(t.t * 20) * 1) : 0;
      this.drawTrophy(ctx, t.icon, x + 3, y + 2.5 + bob);
    }
    const cx = x + iconW + (w - iconW) / 2;
    this.txt(t.title, cx, y + 2, P.accent, 1, 'center');
    this.txt(t.name, cx, y + 8.5, P.text, 1, 'center');
  }
}
