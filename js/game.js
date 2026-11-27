import { BLOCK, COLS, W, H, CFG, MAT_SAND, MAT_STONE, MAT_GUN, colorsForLevel, levelConfig, clearFlash, bossEventType } from './config.js';
import { makeRng } from './util.js';
import { Sand } from './sim.js';
import { SHAPES, Bag } from './pieces.js';

// Logika game murni: tidak menyentuh canvas, DOM, atau audio.
// Komunikasi ke luar lewat event (this.events.emit).
export class Game {
  constructor(events) {
    this.events = events;
    this.reset(1);
  }

  reset(seed) {
    this.seed = seed >>> 0;
    // Aturan yang bisa dimatikan mode tutorial (lihat tutorial.js). Game normal: semua aktif.
    // fall: null = kecepatan level, 0 = piece melayang (tidak jatuh sendiri), > 0 = detik per baris.
    // controls: false = input pemain diabaikan (tutorial sedang memperagakan sesuatu).
    this.rules = { events: true, danger: true, level: true, spawn: true, fall: null, controls: true };
    this.rng = makeRng(this.seed);
    this.sand = new Sand(this.rng);
    this.bag = new Bag(this.rng);

    this.state = 'play';            // 'play' | 'over'
    this.time = 0;
    this.score = 0;
    this.level = 1;
    this.numColors = colorsForLevel(1);
    this.clears = 0;                // jumlah jembatan yang sudah di-clear
    this.chain = 0;
    this.bestChain = 0;
    this.grainsCleared = 0;
    this.piecesPlaced = 0;
    this.breather = 0;
    this.explosions = 0;
    this.lastSpecial = 0;

    this.tilt = { meter: 1, dir: 0, active: false, used: 0, cool: 0 };
    this.prevWant = 0;
    this.lastTiltAt = -99;

    this.event = null;              // { type: 'quake'|'wind'|'force', dir, phase: 'warn'|'active', t }
    this.eventTimer = this.randRange(CFG.EVENT_FIRST);
    this.eventsSurvived = 0;
    this.eventBag = [];             // kantong jenis event: tiap 3 event pasti berisi gempa, angin, papan miring
    this.bossEvent = null;          // jenis event yang pasti muncul karena baru masuk level boss

    this.danger = 0;
    this.overflow = [];             // butir piece yang terkunci di atas papan, menunggu dituang masuk
    this.pending = null;            // piece berikutnya yang menunggu tempat muncul kosong
    this.spawnWait = 0;
    this.clearing = null;
    this.dirty = false;
    this.checkTimer = 0;

    this.piece = null;
    this.next = this.makeSpec();
    this.spawn();
  }

  randRange([a, b]) { return a + this.rng() * (b - a); }

  makeSpec() {
    const type = this.bag.next();
    const color = 1 + Math.floor(this.rng() * this.numColors);
    const roll = this.rng();
    // Material khusus muncul sesekali (tetap punya warna), tidak dua kali berturut-turut.
    // Karena aturan "tidak berturut-turut", peluang undian dinaikkan supaya peluang NYATA per piece
    // sama dengan tabel: kalau target total T, undian p = T / (1 − T).
    const { stone, gun } = levelConfig(this.level);
    const total = stone + gun;
    const k = total > 0 ? 1 / (1 - total) : 0;
    let mat = MAT_SAND;
    if (this.lastSpecial === MAT_SAND) {
      if (roll < gun * k) mat = MAT_GUN;
      else if (roll >= 1 - stone * k) mat = MAT_STONE;
    }
    this.lastSpecial = mat;
    return { type, color, mat };
  }

  // Ruang napas (warna baru masuk): kecepatan memakai level sebelumnya selama CFG.BREATHER detik.
  gravityInterval() {
    if (this.rules.fall) return this.rules.fall;
    return levelConfig(Math.max(1, this.level - (this.breather > 0 ? 1 : 0))).fall;
  }

  blocksOf(p, rot = p.rot) { return SHAPES[p.type].rots[rot]; }

  // Apakah piece di posisi (x, y, rot) menabrak dinding, lantai, atau pasir?
  collides(p, x, y, rot) {
    const c = this.sand.cells;
    for (const [bx, by] of this.blocksOf(p, rot)) {
      const cx = x + bx * BLOCK, cy = y + by * BLOCK;
      if (cx < 0 || cx + BLOCK > W || cy + BLOCK > H) return true;
      for (let yy = Math.max(0, cy); yy < cy + BLOCK; yy++) {
        const row = yy * W;
        for (let xx = cx; xx < cx + BLOCK; xx++) if (c[row + xx] !== 0) return true;
      }
    }
    return false;
  }

  // Munculkan piece tertentu (tutorial), menggantikan piece yang sedang jatuh.
  spawnSpec(spec) {
    this.next = { mat: MAT_SAND, ...spec };
    this.lastSpecial = MAT_SAND;
    this.piece = null;
    this.spawn();
  }

  spawn() {
    this.pending = this.next;
    this.next = this.makeSpec();
    this.spawnWait = 0;
    this.trySpawn();
  }

  // Munculkan piece yang menunggu. Kalau tempat muncul masih tertutup pasir yang sedang runtuh
  // (atau masih ada butir antre di atas papan), tunggu dulu; baru kalah kalau tertutup terus
  // selama CFG.SPAWN_WAIT detik (lihat update).
  trySpawn() {
    const spec = this.pending;
    const size = SHAPES[spec.type].size;
    const p = {
      type: spec.type, color: spec.color, mat: spec.mat, rot: 0,
      x: Math.floor((COLS - size) / 2) * BLOCK,
      y: spec.type === 'I' ? -BLOCK : 0,
      fall: 0, lock: 0, lockResets: 0, softCells: 0,
    };
    if (this.overflow.length || this.collides(p, p.x, p.y, 0)) { this.piece = null; return false; }
    this.piece = p;
    this.pending = null;
    this.events.emit('spawn', p);
    return true;
  }

  // Y terendah yang bisa dicapai piece (untuk ghost & hard drop).
  dropY(p = this.piece) {
    let y = p.y;
    while (!this.collides(p, p.x, y + 1, p.rot)) y++;
    return y;
  }

  tryMove(dx) {
    const p = this.piece;
    if (!p || this.collides(p, p.x + dx, p.y, p.rot)) return false;
    p.x += dx;
    this.touchLock();
    this.events.emit('move', dx);
    return true;
  }

  tryRotate(dir) {
    const p = this.piece;
    if (!p) return false;
    const rot = (p.rot + (dir > 0 ? 1 : 3)) % 4;
    // Wall kick sederhana: geser kiri/kanan/atas sedikit kalau tabrakan.
    const kicks = [[0, 0], [-BLOCK, 0], [BLOCK, 0], [-2 * BLOCK, 0], [2 * BLOCK, 0], [0, -BLOCK / 2], [0, -BLOCK]];
    for (const [kx, ky] of kicks) {
      if (!this.collides(p, p.x + kx, p.y + ky, rot)) {
        p.x += kx; p.y += ky; p.rot = rot;
        this.touchLock();
        this.events.emit('rotate', dir);
        return true;
      }
    }
    return false;
  }

  touchLock() {
    const p = this.piece;
    if (p.lock > 0 && p.lockResets < CFG.LOCK_RESETS) { p.lock = 0; p.lockResets++; }
  }

  hardDrop() {
    const p = this.piece;
    if (!p) return;
    const y = this.dropY();
    const rows = Math.floor((y - p.y) / BLOCK);
    this.score += rows * 2;
    p.y = y;
    this.events.emit('hardDrop', { rows });
    this.lockPiece(true);
  }

  // Tilt pemain: aktif selama Q/E ditahan dan meter masih ada. want: -1 kiri, 0 lepas, 1 kanan.
  updateTilt(dt, want) {
    const t = this.tilt;
    const rising = want !== 0 && want !== this.prevWant;
    this.prevWant = want;
    if (rising) this.events.emit('tiltAttempt', want);

    const canRun = t.active ? t.meter > 0 : t.meter >= CFG.TILT_MIN_START;
    if (want !== 0 && canRun) {
      if (!t.active || t.dir !== want) {
        t.active = true;
        t.dir = want;
        t.used++;
        this.events.emit('tiltStart', want);
      }
      t.meter = Math.max(0, t.meter - dt / CFG.TILT_CAPACITY);
      t.cool = CFG.TILT_REFILL_DELAY;
      this.lastTiltAt = this.time;
      this.dirty = true;
      if (t.meter <= 0) { t.active = false; this.events.emit('tiltEnd', { empty: true }); }
      return;
    }
    if (t.active) { t.active = false; this.events.emit('tiltEnd', { empty: false }); }
    if (rising) this.events.emit('tiltFail');
    if (want === 0) {
      if (t.cool > 0) t.cool -= dt;
      else t.meter = Math.min(1, t.meter + dt / CFG.TILT_REFILL);
    }
  }

  // Arah miring efektif: tilt pemain digabung event "miring paksa". Melawan arah = saling meniadakan.
  effectiveTilt() {
    const p = this.tilt.active ? this.tilt.dir : 0;
    const e = this.event;
    const f = e && e.phase === 'active' && e.type === 'force' ? e.dir : 0;
    if (f !== 0 && p === -f) return 0;
    return f || p;
  }

  // Event pengganggu: peringatan dulu, lalu aktif beberapa detik.
  updateEvent(dt) {
    if (!this.rules.events) return;
    if (!this.event) {
      this.eventTimer -= dt;
      if (this.eventTimer > 0) return;
      const type = this.nextEventType();
      this.event ={ type, dir: this.rng() < 0.5 ? -1 : 1, phase: 'warn', t: CFG.EVENT_WARN, push: 0 };
      this.events.emit('eventWarn', this.event);
      return;
    }
    const e = this.event;
    e.t -= dt;
    if (e.phase === 'warn') {
      if (e.t <= 0) {
        e.phase = 'active';
        e.t = e.type === 'quake' ? CFG.QUAKE_DURATION : e.type === 'wind' ? CFG.WIND_DURATION : CFG.FORCE_DURATION;
        this.dirty = true;
        this.events.emit('eventStart', e);
      }
      return;
    }
    if (e.type === 'wind' && this.piece) {
      e.push += dt;
      if (e.push >= CFG.WIND_PUSH_EVERY) {
        e.push = 0;
        const p = this.piece;
        if (!this.collides(p, p.x + e.dir * CFG.MOVE_STEP, p.y, p.rot)) { p.x += e.dir * CFG.MOVE_STEP; this.events.emit('windPush', e.dir); }
      }
    }
    if (e.t <= 0) {
      this.eventsSurvived++;
      this.events.emit('eventEnd', { ...e, survived: this.eventsSurvived });
      this.event = null;
      const gap = this.randRange(levelConfig(this.level).eventGap);
      // Event boss yang tertunda (level boss tercapai saat event lain berjalan) menyusul cepat.
      this.eventTimer = this.bossEvent ? Math.min(gap, CFG.BOSS_EVENT_DELAY) : gap;
    }
  }

  // Jenis event berikutnya. Event boss memakai jenis gilirannya dan diambil dari kantong
  // kalau masih ada di sana, supaya jaminan "tiap 3 event ada semua jenis" tetap terjaga.
  nextEventType() {
    if (this.eventBag.length === 0) {
      const bag = ['quake', 'wind', 'force'];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.eventBag = bag;
    }
    if (this.bossEvent) {
      const type = this.bossEvent;
      this.bossEvent = null;
      const i = this.eventBag.indexOf(type);
      if (i >= 0) this.eventBag.splice(i, 1);
      return type;
    }
    return this.eventBag.pop();
  }

  // Masuk level boss: event jenis gilirannya pasti muncul BOSS_EVENT_DELAY detik lagi.
  queueBossEvent(level) {
    this.bossEvent = bossEventType(level);
    if (!this.event) this.eventTimer = CFG.BOSS_EVENT_DELAY;
  }

  // Piece hancur jadi pasir.
  lockPiece(hard = false) {
    // Chain = clear beruntun yang dipicu SATU penempatan. Piece baru mendarat → hitungan mulai lagi,
    // jadi menjatuhkan piece terus-menerus (spam) tidak bisa menaikkan pengali chain.
    if (this.chain > 0) { this.events.emit('chainEnd', this.chain); this.chain = 0; }
    const p = this.piece;
    const c = this.sand.cells, s = this.sand.shade, m = this.sand.mat;
    for (const [bx, by] of this.blocksOf(p)) {
      const cx = p.x + bx * BLOCK, cy = p.y + by * BLOCK;
      for (let yy = cy; yy < cy + BLOCK; yy++) {
        if (yy < 0) {
          // Bagian piece di atas papan tidak langsung kalah: butirnya antre dan dituang masuk begitu
          // ada ruang (lihat pourOverflow). Kalah/tidaknya diputuskan garis bahaya seperti biasa.
          for (let xx = cx; xx < cx + BLOCK; xx++) this.overflow.push({ x: xx, color: p.color, mat: p.mat });
          continue;
        }
        const row = yy * W;
        for (let xx = cx; xx < cx + BLOCK; xx++) {
          c[row + xx] = p.color;
          m[row + xx] = p.mat;
          s[row + xx] = (this.rng() * 4) | 0;
        }
      }
    }
    this.score += Math.floor(p.softCells / BLOCK);
    this.piecesPlaced++;
    this.dirty = true;
    this.events.emit('land', { x: p.x, y: p.y, color: p.color, mat: p.mat, hard });
    this.piece = null;
    if (this.rules.spawn) this.spawn();
  }

  // Tuang butir antrean (bagian piece yang terkunci di atas papan) ke baris teratas yang kosong.
  pourOverflow() {
    if (!this.overflow.length) return;
    const c = this.sand.cells, s = this.sand.shade, m = this.sand.mat;
    this.overflow = this.overflow.filter((g) => {
      if (c[g.x] !== 0) return true;
      c[g.x] = g.color; m[g.x] = g.mat; s[g.x] = (this.rng() * 4) | 0;
      this.dirty = true;
      return false;
    });
  }

  startClear(res) {
    // Mesiu yang tersentuh clear ikut meledak.
    const blast = this.sand.explode(res.cells, CFG.BLAST_RADIUS);
    if (blast) {
      if (blast.extra.length) res = { ...res, cells: res.cells.concat(blast.extra) };
      this.explosions++;
      this.events.emit('explode', { centers: blast.centers, grains: blast.extra.length, stones: blast.stones });
    }
    this.chain++;
    this.bestChain = Math.max(this.bestChain, this.chain);
    const grains = res.cells.length;
    const mLevel = 1 + 0.1 * (this.level - 1);
    const mChain = Math.min(this.chain, CFG.MAX_CHAIN_MULT);
    const mMulti = 1 + 0.5 * (res.bridges - 1);
    const points = Math.round(grains * mLevel * mChain * mMulti);
    this.score += points;
    this.grainsCleared += grains;
    this.clears += res.bridges;

    const dur = clearFlash(this.chain);
    this.clearing = { cells: res.cells, t: dur, t0: dur };
    this.events.emit('clear', {
      points, grains, chain: this.chain, bridges: res.bridges, colors: res.colors,
      cells: res.cells, inDanger: this.sand.anyAbove(CFG.DANGER_Y + CFG.NEAR_MISS),
      sinceTilt: this.time - this.lastTiltAt,
    });

    const newLevel = 1 + Math.floor(this.clears / CFG.CLEARS_PER_LEVEL);
    if (newLevel > this.level && this.rules.level) {
      this.level = newLevel;
      const lc = levelConfig(newLevel);
      if (lc.colors > this.numColors) { this.numColors = lc.colors; this.breather = CFG.BREATHER; }
      // Level boss: event pasti muncul sebentar lagi. Level lembah: hitung mundur langsung
      // dilonggarkan ke jeda lembah (event yang sedang berjalan tidak diganggu).
      if (lc.boss && this.rules.events) this.queueBossEvent(newLevel);
      else if (lc.trough && !this.event) this.eventTimer = Math.max(this.eventTimer, this.randRange(lc.eventGap));
      this.events.emit('levelUp', { level: this.level, colors: this.numColors, boss: lc.boss, tiltsUsed: this.tilt.used });
    }
  }

  finishClear() {
    const c = this.sand.cells;
    const cl = this.clearing;
    // Simpan warna dulu supaya renderer bisa membuat partikel berwarna.
    const m = this.sand.mat;
    const colors = new Uint8Array(cl.cells.length);
    for (let k = 0; k < cl.cells.length; k++) {
      const i = cl.cells[k];
      colors[k] = c[i]; c[i] = 0; m[i] = 0;
    }
    this.clearing = null;
    this.dirty = true;
    this.events.emit('cleared', { cells: cl.cells, colors });
    if (this.sand.isEmpty()) this.events.emit('boardClear');
  }

  gameOver(reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.events.emit('gameOver', this.stats(reason));
  }

  stats(reason = '') {
    return {
      reason, score: this.score, level: this.level, clears: this.clears,
      bestChain: this.bestChain, grains: this.grainsCleared,
      pieces: this.piecesPlaced, duration: Math.round(this.time), seed: this.seed, explosions: this.explosions,
    };
  }

  // Satu tick simulasi (dt tetap = 1/60). input: { actions: string[], soft: boolean }
  update(dt, input) {
    if (this.state !== 'play') return;
    this.time += dt;

    if (this.breather > 0) this.breather -= dt;

    // Hitstop: selama kedip clear, piece & pasir berhenti dan tombol DIABAIKAN (tidak ditumpuk),
    // supaya setelah kedip piece tidak meloncat karena tekanan yang menumpuk. Tombol yang ditahan
    // (turun pelan, miring) dibaca lagi dari keadaannya setelah kedip selesai.
    if (this.clearing) {
      this.clearing.t -= dt;
      if (this.clearing.t <= 0) this.finishClear();
      return;
    }

    let actions = input.actions;
    if (!this.rules.controls) { actions = []; input = { actions, soft: false, tilt: 0 }; }

    this.updateTilt(dt, input.tilt || 0);
    this.updateEvent(dt);
    // Melawan Papan Miring: tahan tilt ke arah sebaliknya cukup lama → event 'counterForce' (prestasi rahasia).
    const ev = this.event;
    if (ev && ev.phase === 'active' && ev.type === 'force' && !ev.countered
        && this.tilt.active && this.tilt.dir === -ev.dir) {
      ev.counter = (ev.counter || 0) + dt;
      if (ev.counter >= CFG.COUNTER_TIME) { ev.countered = true; this.events.emit('counterForce'); }
    }

    for (const a of actions) {
      if (this.state !== 'play' || !this.piece) break;
      switch (a) {
        case 'left': this.tryMove(-CFG.MOVE_STEP); break;
        case 'right': this.tryMove(CFG.MOVE_STEP); break;
        case 'rotCW': this.tryRotate(1); break;
        case 'rotCCW': this.tryRotate(-1); break;
        case 'hardDrop': this.hardDrop(); break;
      }
    }
    if (this.state !== 'play') return;

    // Gravitasi piece
    const p = this.piece;
    if (p) {
      const normal = BLOCK / this.gravityInterval();
      const speed = input.soft ? Math.max(normal, CFG.SOFT_DROP_SPEED) : normal;
      // fall 0 (tutorial): piece melayang sampai pemain menurunkannya sendiri
      if (this.rules.fall !== 0 || input.soft) p.fall += speed * dt;
      while (p.fall >= 1) {
        p.fall -= 1;
        if (!this.collides(p, p.x, p.y + 1, p.rot)) {
          p.y++;
          if (input.soft) p.softCells++;
        } else { p.fall = 0; break; }
      }
      if (this.collides(p, p.x, p.y + 1, p.rot)) {
        p.lock += dt;
        if (p.lock >= CFG.LOCK_DELAY) this.lockPiece();
      } else p.lock = 0;
      if (this.state !== 'play') return;
    }

    // Simulasi pasir
    const e = this.event;
    const quaking = e && e.phase === 'active' && e.type === 'quake';
    const jitter = quaking ? CFG.QUAKE_JITTER : 0;
    if (quaking && this.sand.quakeMix(CFG.QUAKE_SWAPS) > 0) this.dirty = true;
    const moved = this.sand.step(this.effectiveTilt(), jitter);
    if (moved > 0) this.dirty = true;
    this.pourOverflow();

    // Piece berikutnya menunggu tempat muncul kosong (pasir yang baru runtuh belum turun).
    if (this.pending && this.rules.spawn && !this.trySpawn()) {
      this.spawnWait += dt;
      if (this.spawnWait >= CFG.SPAWN_WAIT) { this.gameOver('spawn'); return; }
    }

    // Cek jembatan
    this.checkTimer++;
    if (this.dirty && (this.checkTimer >= CFG.CHECK_EVERY || moved === 0)) {
      this.checkTimer = 0;
      this.dirty = false;
      const res = this.sand.findBridges(CFG.CONNECT_8);
      if (res.bridges > 0) { this.startClear(res); return; }
    }
    // Pasir sudah diam dan tidak ada clear lagi → rangkaian chain selesai.
    if (!this.dirty && moved === 0 && this.chain > 0) {
      this.events.emit('chainEnd', this.chain);
      this.chain = 0;
    }

    // Garis bahaya
    if (this.rules.danger && (this.overflow.length || this.sand.anyAbove(CFG.DANGER_Y))) {
      this.danger += dt;
      if (this.danger >= CFG.DANGER_GRACE) this.gameOver('danger');
    } else this.danger = 0;
  }
}
