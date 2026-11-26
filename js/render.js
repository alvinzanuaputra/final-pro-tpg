import { W, H, BLOCK, CFG, MAT_STONE, MAT_GUN, isBossLevel } from './config.js';
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
    boss: '#ff4d5e',                                     // angka LEVEL saat level boss
  },
  retro: {
    bg: '#0d170d', boardA: '#132213', boardB: '#162716', frame: '#3f6f3f', text: '#c8f5b0',
    dim: '#5f9a5a', accent: '#e8ff9a', danger: '#f0ff70', shadow: '#081008',
    sand: ['#f0ffd8', '#a9e47c', '#6fbd4f', '#3f8a32', '#d2d36a'],
    speck: '#ffff9a', boss: '#ff8a5c',
  },
  // ---- tema tambahan (gratis / hadiah prestasi, lihat THEMES di main.js) ----
  senja: {
    bg: '#1e1220', boardA: '#2a1826', boardB: '#2f1b2b', frame: '#7a4a5e', text: '#ffe9d6',
    dim: '#c08a8a', accent: '#ffb347', danger: '#ff4d4d', shadow: '#120a12',
    sand: ['#ff6b5a', '#ffc15e', '#e8dcae', '#5fb8a8', '#9a6fd0'],
    speck: '#fff0a0', overlay: '18,10,16', boss: '#ff4d6d',
  },
  neon: {
    bg: '#05050a', boardA: '#0a0a14', boardB: '#0d0d1a', frame: '#2f2f5a', text: '#f0f6ff',
    dim: '#7a86b8', accent: '#39ff88', danger: '#ff2e6e', shadow: '#000000',
    sand: ['#ff3ea5', '#ffe53b', '#39ff88', '#2ee6ff', '#a46bff'],
    speck: '#ffffff', overlay: '0,0,4', boss: '#ff2e6e',
  },
  kertas: {   // tema terang
    bg: '#efe6d2', boardA: '#e6dcc4', boardB: '#e0d5ba', frame: '#a8977a', text: '#3b3046',
    dim: '#7d6f82', accent: '#d9573b', danger: '#c8283c', shadow: '#fbf6ea',
    sand: ['#e0685a', '#e8b04a', '#5aa77f', '#5a86c8', '#9a72c2'],
    speck: '#5a3a1a', overlay: '239,230,210', boss: '#2456c8',   // biru: aksen tema ini sudah merah
  },
  kontras: {  // warna Okabe-Ito: tetap bisa dibedakan oleh penderita buta warna
    bg: '#000000', boardA: '#0b0b0b', boardB: '#141414', frame: '#5a5a5a', text: '#ffffff',
    dim: '#b4b4b4', accent: '#ffd400', danger: '#ff3030', shadow: '#000000',
    sand: ['#d55e00', '#f0e442', '#009e73', '#56b4e9', '#cc79a7'],
    speck: '#ffffff', overlay: '0,0,0', boss: '#ff3030',
  },
};

const SHADES = [1.12, 1.0, 0.91, 0.82];
// warna garis tepi kartu prestasi per tingkat trofi (emas memakai warna aksen palet)
const TIER_COLOR = { bronze: '#d08a4c', silver: '#c9cbe0', secret: '#b45ce0' };
// panah pixel 5x5 untuk tombol keyboard di petunjuk kontrol
const KEY_ARROWS = {
  left: ['..#..', '.#...', '#####', '.#...', '..#..'],
  right: ['..#..', '...#.', '#####', '...#.', '..#..'],
  up: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  down: ['..#..', '..#..', '#.#.#', '.###.', '..#..'],
  // simbol spasi ␣ (dipusatkan di tombol panjang)
  space: ['.....', '.....', '#.......#', '#.......#', '#########'],
};
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
    ev.on('levelUp', (d) => this.addFloat(`LEVEL ${d.level}!`, BX + W / 2, BY + 50, d.boss ? this.pal.boss : this.pal.accent, 1.6));
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
    this.texts.push({ str: String(str), x: x + this.ox, y: y + this.oy, color, px: this.px(size), align, alpha: 1, shadow, clip: this.clipRect });
  }
  // Pecah teks per kata supaya lebarnya <= maxW (piksel logis).
  wrap(str, maxW, size = 1) {
    const lines = [];
    let cur = '';
    for (const word of String(str).split(' ')) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && this.tw(next, size) > maxW) { lines.push(cur); cur = word; } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  // ukuran titik glyph (piksel layar); size boleh pecahan untuk mengecilkan teks yang kepanjangan
  px(size = 1) { return Math.max(1, Math.floor(this.tp * size)); }
  tw(str, size = 1) { return textWidthPx(String(str).toUpperCase(), this.px(size)) / this.k; }
  th(size = 1) { return (7 * this.px(size)) / this.k; }

  // ---------- gambar ----------
  draw(dt, ui) {
    this.time += dt;
    this.dt = dt;
    const g = ui.game;
    const ctx = this.lctx, P = this.pal;
    this.buttons = [];
    this.texts = [];
    this.scrollArea = null;

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

    if (ui.screen === 'title' || ui.screen === 'ach' || ui.screen === 'settings' || ui.screen === 'start' || ui.screen === 'help' || (ui.screen === 'board' && !ui.fromOver)) {
      this.drawRain(ctx, dt);
    } else {
      this.drawBoard(ctx, g);
      if (ui.tutView) { this.drawTutorialMarks(ctx, ui.tutView); this.drawTutorialPanel(ctx, ui.tutView, ui); }
      else this.drawPanel(ctx, g, ui);
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
      case 'help': this.drawHelp(ctx, ui); break;
      case 'tutDone': this.drawTutDone(ctx, ui); break;
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
      if (t.clip) {
        out.save();
        out.beginPath();
        out.rect(t.clip.x * k, t.clip.y * k, t.clip.w * k, t.clip.h * k);
        out.clip();
      }
      if (t.shadow) drawText(out, t.str, t.x * k + t.px, t.y * k + t.px, shadow, t.px, t.align);
      drawText(out, t.str, t.x * k, t.y * k, t.color, t.px, t.align);
      if (t.clip) out.restore();
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
    // level boss: angka LEVEL memakai warna boss tema (kontras >= 5:1 dengan latar, beda dari teks & aksen)
    label('LEVEL'); value(g.level + (g.breather > 0 ? ' ~' : ''), isBossLevel(g.level) ? P.boss : P.text);
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

    // Petunjuk tombol keyboard hanya di desktop; di HP tombolnya sudah terlihat di layar.
    if (this.k >= 2 && !ui.touch) {   // di layar sangat kecil teks bantuan tidak muat
      this.txt('TAHAN Q/E MIRING', PX, 144, P.dim);
      this.txt('P JEDA  M SUARA', PX, 151, P.dim);
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
    // banner tidak boleh lebih lebar dari papan: teks diperkecil kalau perlu
    const natural = Math.max(this.tw(line1), this.tw(line2));
    const size = Math.min(1, (W - 6) / natural);
    const w = Math.min(W + 2, Math.ceil(Math.max(this.tw(line1, size), this.tw(line2, size))) + 8);
    const h = line2 ? 17 : 10;
    const x = Math.round(BX + (W - w) / 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.shadow; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    this.txt(line1, BX + W / 2, y + 2.5, col, size, 'center');
    if (line2) this.txt(line2, BX + W / 2, y + 9.5, P.text, size, 'center');
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

  // ---------- daftar yang bisa digulir (peringkat, prestasi) ----------
  // ui.scroll = { pos, target }: posisi gulir dalam piksel logis. main.js mengubah target
  // (roda mouse, seret, tombol ▲▼); di sini target dibatasi lalu pos mengejarnya dengan halus.
  // Isi di antara beginScroll/endScroll (grafis & teks) terpotong di dalam kotak x,y,w,h.
  beginScroll(ctx, ui, x, y, w, h, contentH) {
    const s = ui.scroll || (ui.scroll = { pos: 0, target: 0 });
    const max = Math.max(0, Math.ceil(contentH - h));
    s.target = Math.max(0, Math.min(max, s.target));
    s.pos += (s.target - s.pos) * Math.min(1, (this.dt || 0) * 16);
    if (Math.abs(s.target - s.pos) < 0.3) s.pos = s.target;
    this.scrollArea = { x, y, w, h, max };
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = this.pal.bg;   // latar polos supaya hujan pasir tidak terlihat di sela baris
    ctx.fillRect(x, y, w, h);
    this.clipRect = { x, y, w, h };
    return Math.round(s.pos);
  }

  // Tutup area gulir + gambar scrollbar pixel di sisi kanannya (hanya kalau isinya lebih panjang).
  endScroll(ctx, ui) {
    ctx.restore();
    this.clipRect = null;
    const a = this.scrollArea, s = ui.scroll;
    if (!a || a.max <= 0) return;
    const bx = a.x + a.w + 2;
    ctx.fillStyle = this.pal.shadow;
    ctx.fillRect(bx, a.y, 2, a.h);
    const th = Math.max(6, Math.round((a.h * a.h) / (a.h + a.max)));
    const ty = a.y + Math.round((a.h - th) * (s.pos / a.max));
    ctx.fillStyle = this.pal.dim;
    ctx.fillRect(bx, ty, 2, th);
  }

  // ---------- petunjuk kontrol: tombol keyboard pixel ----------
  // Tombol 9 px tinggi: tepi terang bersudut terpotong, muka, dan bibir bawah gelap (kesan 3D).
  drawKey(ctx, x, y, w, label) {
    const P = this.pal, h = 9;
    ctx.fillStyle = P.dim;
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = P.shadow;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = P.frame;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 3);
    const arrow = KEY_ARROWS[label];
    if (arrow) {
      ctx.fillStyle = P.text;
      const aw = Math.max(...arrow.map((row) => row.length));
      const ax = x + Math.floor((w - aw) / 2);
      arrow.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(ax + rx, y + 1 + ry, 1, 1);
      });
    } else {
      this.txt(label, x + w / 2, y + 1.6, P.text, 1, 'center', false);
    }
  }

  // parts: 'TEKS' | { k: 'Q' | 'left' | 'right' | 'up' | 'down', w? } | angka (jarak tambahan).
  // Baris dipusatkan di layar, atau rata kiri mulai x0 kalau diberikan.
  keyHints(ctx, y, parts, x0 = null) {
    const keyW = (p) => p.w || (KEY_ARROWS[p.k] ? 9 : Math.max(9, Math.ceil(this.tw(p.k)) + 5));
    const width = (p) => (typeof p === 'number' ? p : typeof p === 'string' ? this.tw(p) : keyW(p));
    const total = parts.reduce((s, p, i) => s + width(p) + (i && typeof p !== 'number' ? 2 : 0), 0);
    let x = x0 ?? Math.round((LW - total) / 2);
    parts.forEach((p, i) => {
      if (i && typeof p !== 'number') x += 2;
      if (typeof p === 'number') x += p;
      else if (typeof p === 'string') { this.txt(p, x, y + 2.3, this.pal.dim); x += this.tw(p); }
      else { x = Math.round(x); this.drawKey(ctx, x, y, keyW(p), p.k); x += keyW(p); }
    });
  }

  dim(ctx, a = 0.82) {
    this.layer();
    ctx.fillStyle = `rgba(${this.pal.overlay || '8,7,14'},${a})`;
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
    this.helpIcon(ctx, ui);
    const items = (ui.titleItems || ['play', 'board', 'ach', 'settings']).map((id) => [id, this.menuLabel(id, ui)]);
    // 5 item (dengan KREDIT): mulai sedikit lebih atas & lebih rapat supaya tidak menabrak teks TERBAIK
    this.menu(ctx, ui, items, items.length > 4 ? 58 : 64, 84, items.length > 4 ? 13 : items.length > 3 ? 14 : 15);
    this.txt(`TERBAIK: ${ui.best}`, LW / 2, 124, P.accent, 1, 'center');
    if (ui.playerName) this.txt(`PEMAIN: ${ui.playerName}`, LW / 2, 132, P.dim, 1, 'center');
    // Petunjuk tombol keyboard hanya di desktop; di HP tombolnya sudah terlihat di layar.
    if (!ui.touch) {
      const space = { k: 'space', w: 25 };
      this.keyHints(ctx, 143, [{ k: 'left' }, { k: 'right' }, 'GESER', 5, { k: 'up' }, 'PUTAR', 5, space, 'JATUH']);
      this.keyHints(ctx, 155, ['TAHAN', { k: 'Q' }, '/', { k: 'E' }, 'MIRING', 5, { k: 'P' }, 'JEDA']);
    }
    if (ui.soundMode && ui.soundMode !== 'all') {
      this.txt(ui.soundMode === 'off' ? 'SUARA: MATI' : 'MUSIK: MATI', LW / 2, 168, P.dim, 1, 'center');
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
      case 'credits': return 'KREDIT';
      case 'tutorial': return 'MAIN TUTORIAL';
      case 'skipTut': return 'LEWATI TUTORIAL';
      case 'resume': return 'LANJUT';
      case 'restart': return 'ULANG';
      case 'menu': return 'MENU UTAMA';
      case 'back': return 'KEMBALI';
      case 'sound': return `SUARA: ${SOUND[ui.soundMode] || 'SEMUA'}`;
      case 'theme': return `TEMA: ${ui.themeName || 'KLASIK'}`;
      default: return id.toUpperCase();
    }
  }

  // Tombol bantuan "?" di pojok kanan atas layar judul (keyboard: H).
  helpIcon(ctx, ui) {
    const P = this.pal, x = LW - 15, y = 4, s = 11;
    this.buttons.push({ id: 'help', x: x - 3, y: y - 3, w: s + 6, h: s + 6 });   // area sentuh sedikit lebih besar
    ctx.fillStyle = P.frame;
    ctx.fillRect(x + 1, y, s - 2, s);
    ctx.fillRect(x, y + 1, s, s - 2);
    ctx.fillStyle = P.shadow;
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    this.txt('?', x + s / 2, y + (s - this.th()) / 2, P.accent, 1, 'center');
    if (!ui.touch) this.txt('H', x - 3, y + (s - this.th()) / 2, P.dim, 1, 'right');
  }

  // CARA MAIN: ringkasan satu layar + tombol ke tutorial interaktif.
  drawHelp(ctx, ui) {
    const P = this.pal;
    this.dim(ctx, 0.75);
    this.txt('CARA MAIN', LW / 2, 4, P.text, 2, 'center');
    const tilt = ui.touch ? 'TAHAN L / R' : 'TAHAN Q / E';
    const rows = [
      ['1', 'BALOK YANG MENDARAT HANCUR JADI PASIR.'],
      ['2', 'SAMBUNG SATU WARNA DARI DINDING KIRI KE KANAN: JEMBATAN HILANG, DAPAT SKOR.'],
      ['3', `${tilt} UNTUK MEMIRINGKAN PAPAN. PASIR IKUT MENGALIR.`],
      ['4', 'PASIR LEWAT GARIS MERAH ATAS = KALAH.'],
    ];
    const X = 12, TX = 20, MW = LW - TX - 8;
    let y = 22;
    for (const [n, text] of rows) {
      this.txt(n, X, y, P.accent);
      for (const line of this.wrap(text, MW)) { this.txt(line, TX, y, P.text); y += 7; }
      y += 3;
      if (n === '2') { this.drawBridgeDemo(ctx, Math.round(LW / 2 - 28), y); y += 23; }
    }
    this.txt('RUNTUHAN JADI JEMBATAN BARU = CHAIN!', LW / 2, y + 1, P.dim, 1, 'center');
    const items = ui.menuItems || ['tutorial', 'back'];
    const bw = [78, 52], gap = 4, total = bw[0] + bw[1] + gap;
    let bx = Math.floor((LW - total) / 2);
    items.forEach((id, k) => {
      this.button(ctx, id, this.menuLabel(id, ui), bx, Math.min(158, Math.round(y) + 16), bw[k], 11, ui.focus === k);
      bx += bw[k] + gap;
    });
  }

  // Ilustrasi kecil jembatan: papan mini, pita merah dari dinding kiri ke kanan berkedip lalu hilang.
  drawBridgeDemo(ctx, x, y) {
    const P = this.pal, w = 56, h = 18;
    ctx.fillStyle = P.frame; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = P.boardA; ctx.fillRect(x, y, w, h);
    for (let bx = 0; bx < w; bx += 4) {           // alas bergaris
      ctx.fillStyle = this.sandCss[(bx / 4) % 2 ? 3 : 2][1];
      ctx.fillRect(x + bx, y + h - 6, 4, 6);
    }
    const t = this.time % 2.4;                     // 0-1.6 terlihat, lalu kedip, lalu kosong
    if (t < 2.0) {
      const blink = t > 1.6 && Math.floor(this.time * 16) % 2 === 0;
      for (let bx = 0; bx < w; bx++) {
        const top = y + h - 10 - Math.round(1.5 + Math.sin(bx * 0.35) * 1.5);
        ctx.fillStyle = blink ? '#ffffff' : this.sandCss[1][(bx >> 1) % 4];
        ctx.fillRect(x + bx, top, 1, y + h - 6 - top);
      }
    }
    // dinding kiri & kanan ditandai
    ctx.fillStyle = P.accent;
    ctx.fillRect(x - 3, y + 2, 2, h - 4);
    ctx.fillRect(x + w + 1, y + 2, 2, h - 4);
  }

  // Penanda di papan saat tutorial: dinding kiri & kanan menyala, panah ke target.
  drawTutorialMarks(ctx, v) {
    const m = v.mark;
    if (!m) return;
    const P = this.pal, on = Math.floor(this.time * 4) % 2 === 0;
    if (m.walls) {
      ctx.fillStyle = on ? P.accent : P.frame;
      ctx.fillRect(BX - 2, BY + CFG.DANGER_Y, 2, H - CFG.DANGER_Y + 2);
      ctx.fillRect(BX + W, BY + CFG.DANGER_Y, 2, H - CFG.DANGER_Y + 2);
    }
    const bob = Math.round(Math.sin(this.time * 6) * 1.5);
    ctx.fillStyle = P.accent;
    if (m.arrowX != null) {
      // panah ke bawah di atas lubang
      const x = BX + m.arrowX, y = BY + m.arrowY + bob;
      ctx.fillRect(x - 1, y - 6, 2, 4);
      for (let r = 0; r < 4; r++) ctx.fillRect(x - 4 + r, y - 2 + r, 8 - 2 * r, 1);
    }
    if (m.push) {
      // tiga panah ke kanan menuju dinding kanan
      const shift = Math.floor(this.time * 8) % 4;
      for (let k = 0; k < 3; k++) {
        const x = BX + W - 24 + k * 6 + shift, y = BY + m.arrowY;
        for (let r = 0; r < 4; r++) ctx.fillRect(x + r, y - 3 + r, 1, 7 - 2 * r);
      }
    }
  }

  // Panel samping saat tutorial (menggantikan skor/level).
  drawTutorialPanel(ctx, v, ui) {
    const P = this.pal, MW = LW - PX - 4;
    this.txt('TUTORIAL', PX, 10, P.dim);
    for (let k = 0; k < v.total; k++) {           // titik kemajuan
      ctx.fillStyle = k < v.n - 1 || (k === v.n - 1 && v.good) ? P.accent : k === v.n - 1 ? P.text : P.frame;
      ctx.fillRect(PX + k * 6, 19, 4, 4);
    }
    let y = 28;
    this.txt(v.title, PX, y, v.good ? P.accent : P.text, 1.5);
    y += this.th(1.5) + 4;
    const lines = this.wrap(v.body, MW);
    lines.forEach((line, i) => {
      this.txt(line, PX, y, v.retry && i === 0 ? P.danger : P.text);
      y += 7;
    });
    y += 4;
    for (const row of v.keys) { this.keyHints(ctx, y, row, PX); y += 12; }
    this.txt(ui.touch ? 'MENU: LEWATI' : 'ESC: LEWATI', PX, 158, P.dim);
    this.txt('SANDTILT', PX, 165, P.frame, 1, 'left', false);
  }

  drawTutDone(ctx, ui) {
    const P = this.pal;
    this.dim(ctx, 0.86);
    this.txt('SIAP MAIN!', LW / 2, 24, P.accent, 2, 'center');
    let y = 48;
    const lines = [
      'JANGAN BIARKAN PASIR LEWAT GARIS MERAH ATAS.',
      'MATERIAL DAN GANGGUAN BARU DIJELASKAN SAAT MUNCUL.',
    ];
    for (const text of lines) {
      for (const line of this.wrap(text, LW - 24)) { this.txt(line, LW / 2, y, P.text, 1, 'center'); y += 8; }
      y += 5;
    }
    const items = (ui.menuItems || ['play', 'menu']).map((id) => [id, id === 'play' ? 'MAIN SEKARANG' : this.menuLabel(id, ui)]);
    this.menu(ctx, ui, items, 110, 96, 15);
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
    if (ui.themeHint) this.txt(ui.themeHint, LW / 2, 130, this.pal.dim, 1, 'center');
    if (!ui.touch) this.txt('M = SUARA   P = JEDA SAAT MAIN', LW / 2, 140, this.pal.dim, 1, 'center');
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

    if (lb.loading) {
      this.txt('MEMUAT...', LW / 2, 80, P.dim, 1, 'center');
    } else if (!lb.rows || lb.rows.length === 0) {
      this.txt('BELUM ADA SKOR', LW / 2, 70, P.dim, 1, 'center');
      this.txt('JADILAH YANG PERTAMA!', LW / 2, 80, P.dim, 1, 'center');
    } else {
      // Sampai 100 baris, bisa digulir. Kalau pemain di luar daftar (peringkat 100+),
      // barisnya ditaruh langsung di bawah baris terakhir, dipisah titik-titik.
      const LX = 6, LY = 35, LWD = 144, LHT = 110, ROW = 10, SEP = 7;
      const rows = lb.rows;
      const pinned = lb.mine && !rows.some((r) => r.me) ? lb.mine : null;
      const contentH = rows.length * ROW + (pinned ? SEP + ROW : 0) - 1;
      const s = ui.scroll || (ui.scroll = { pos: 0, target: 0 });
      if (s.revealMe) {
        // dibuka dari game over: gulir otomatis ke baris pemain
        const i = rows.findIndex((r) => r.me);
        const meY = i >= 0 ? i * ROW : pinned ? rows.length * ROW + SEP : -1;
        if (meY >= 0) s.target = meY + ROW / 2 - LHT / 2;
        s.revealMe = false;
      }
      const off = this.beginScroll(ctx, ui, LX, LY, LWD, LHT, contentH);
      const row = (rank, r, ry, k) => {
        if (ry + ROW <= LY || ry >= LY + LHT) return;
        if (r.me) ctx.fillStyle = P.frame;
        else ctx.fillStyle = k % 2 ? P.boardB : P.boardA;
        ctx.fillRect(LX, ry, LWD, ROW - 1);
        const gold = k === 0;
        this.txt(rank, LX + 16, ry + 2, k < 3 ? P.accent : P.dim, 1, 'right');
        this.txt((r.name || '?').slice(0, 16), LX + 20, ry + 2, gold ? P.accent : P.text);
        this.txt(r.score, LX + LWD - 5, ry + 2, gold ? P.accent : P.text, 1, 'right');
      };
      let y = LY - off;
      rows.forEach((r, k) => { row(k + 1, r, y, k); y += ROW; });
      if (pinned) {
        ctx.fillStyle = P.dim;
        for (let dx = -6; dx <= 6; dx += 6) ctx.fillRect(LX + LWD / 2 + dx, y + 2, 1, 1);
        y += SEP;
        row(pinned.rank, { name: pinned.name || 'KAMU', score: pinned.score, me: true }, y, pinned.rank - 1);
      }
      this.endScroll(ctx, ui);
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
    // Satu kartu per prestasi: trofi di kiri, nama + deskripsi (dibungkus kalau kepanjangan).
    // Yang sudah terbuka diberi garis warna tingkat trofinya di tepi kiri.
    const LX = 6, LY = 27, LWD = 144, LHT = 127, GAP = 3, TX = LX + 20;
    const cards = list.map((a) => {
      const show = a.unlocked || !a.hidden;
      // Kartu maksimal 3 baris: nama + deskripsi + hadiah. Deskripsi boleh 2 baris hanya kalau tidak ada hadiah;
      // kalau tetap kepanjangan, deskripsi diperkecil jadi satu baris (cadangan, deskripsi idealnya <= 30 huruf).
      const desc = show ? a.desc : 'RAHASIA', maxW = LX + LWD - 3 - TX;
      let lines = this.wrap(desc, maxW);
      if (lines.length > (a.reward ? 1 : 2)) lines = [{ text: desc, size: Math.min(1, maxW / this.tw(desc)) }];
      // hadiah (mis. tema) selalu ditulis, juga untuk prestasi rahasia → pemain tahu ada yang bisa dikejar
      if (a.reward) lines.push({ reward: `HADIAH: ${a.reward}` });
      return { a, show, lines, h: 10 + lines.length * 7 };
    });
    const contentH = cards.reduce((sum, c) => sum + c.h + GAP, -GAP);
    let y = LY - this.beginScroll(ctx, ui, LX, LY, LWD, LHT, contentH);
    for (const { a, show, lines, h } of cards) {
      if (y + h > LY && y < LY + LHT) {
        ctx.fillStyle = a.unlocked ? P.boardB : P.boardA;
        ctx.fillRect(LX, y, LWD, h);
        if (a.unlocked) {
          ctx.fillStyle = a.tier === 'gold' ? P.accent : TIER_COLOR[a.tier] || P.dim;
          ctx.fillRect(LX, y, 2, h);
        }
        this.drawTrophy(ctx, a.unlocked ? a.tier : 'locked', LX + 5, y + Math.floor((h - 11) / 2));
        this.txt(show ? a.name : '???', TX, y + 3, a.unlocked ? P.text : P.dim);
        lines.forEach((ln, i) => {
          if (ln.reward) this.txt(ln.reward, TX, y + 9.5 + i * 7, a.unlocked ? P.accent : P.text);
          else if (ln.text) this.txt(ln.text, TX, y + 9.5 + i * 7, P.dim, ln.size);
          else this.txt(ln, TX, y + 9.5 + i * 7, P.dim);
        });
      }
      y += h + GAP;
    }
    this.endScroll(ctx, ui);
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
    // Teks terlalu panjang untuk layar → perkecil ukurannya supaya kotak notifikasi selalu muat.
    const maxW = LW - 6;
    const natural = Math.max(this.tw(t.name), this.tw(t.title));
    const size = Math.min(1, (maxW - 10 - iconW) / natural);
    const w = Math.min(maxW, Math.ceil(Math.max(this.tw(t.name, size), this.tw(t.title, size))) + 10 + iconW);
    const x = Math.floor((LW - w) / 2);
    ctx.fillStyle = P.accent; ctx.fillRect(x, y, w, 16);
    ctx.fillStyle = P.shadow; ctx.fillRect(x + 1, y + 1, w - 2, 14);
    if (t.icon) {
      // trofi berkilau sebentar saat muncul
      const bob = t.t < 0.6 ? Math.round(Math.sin(t.t * 20) * 1) : 0;
      this.drawTrophy(ctx, t.icon, x + 3, y + 2.5 + bob);
    }
    const cx = x + iconW + (w - iconW) / 2;
    this.txt(t.title, cx, y + 2, P.accent, size, 'center');
    this.txt(t.name, cx, y + 8.5, P.text, size, 'center');
  }
}
