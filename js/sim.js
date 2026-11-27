import { W, H, MAT_STONE, MAT_GUN } from './config.js';

// Simulasi pasir (cellular automata) + deteksi jembatan kiri-ke-kanan.
// cells[i]: 0 = kosong, 1..5 = id warna.
// mat[i]:   material butir (MAT_SAND / MAT_STONE / MAT_GUN). Setiap warna bisa berupa material apa pun.
// shade[i]: variasi 0..3 untuk tekstur.
export class Sand {
  constructor(rng) {
    this.rng = rng;
    this.cells = new Uint8Array(W * H);
    this.mat = new Uint8Array(W * H);
    this.shade = new Uint8Array(W * H);
    this.visited = new Int32Array(W * H);
    this.queue = new Int32Array(W * H);
    this.stamp = 0;
    this.tick = 0;
    // Butir yang sedang melayang (lemparan tilt). Tidak ada di grid: tidak dihitung jembatan maupun
    // garis bahaya sampai mendarat. { x, y, vx, vy, c, m, s, t } dalam satuan butir & detik.
    this.airborne = [];
    // Sel yang ditempati piece yang sedang jatuh (diisi game tiap tick, null = tidak ada).
    // Diperlakukan seperti dinding: pasir & batu tidak boleh masuk, supaya piece tidak "nyangkut"
    // di udara dan butirnya tidak tertimpa saat piece terkunci.
    this.block = null;
  }

  // Sel kosong yang boleh dimasuki butir.
  free(j) { return this.cells[j] === 0 && (this.block === null || this.block[j] === 0); }

  reset() {
    this.cells.fill(0);
    this.mat.fill(0);
    this.shade.fill(0);
    this.tick = 0;
    this.airborne = [];
  }

  // Lempar butir permukaan dari sisi yang menumpuk (berlawanan dengan dir) ke arah dir.
  // strength 0..1. Diambil lapis demi lapis dari kolom dekat dinding ke tengah. Batu tidak ikut.
  // Mengembalikan jumlah butir yang terangkat.
  toss(dir, strength, count, opt) {
    const c = this.cells, m = this.mat, s = this.shade, rng = this.rng;
    const cols = [];
    for (let k = 0; k < W / 2; k++) cols.push(dir > 0 ? k : W - 1 - k);
    let taken = 0;
    for (let layer = 0; layer < 4 && taken < count; layer++) {
      for (const x of cols) {
        if (taken >= count) break;
        let y = 0;
        while (y < H && c[y * W + x] === 0) y++;
        if (y >= H) continue;
        const i = y * W + x;
        if (m[i] === MAT_STONE) continue;
        const h = opt.height * (0.4 + 0.6 * strength) * (0.6 + 0.4 * rng());
        const vx = dir * opt.speed * (0.4 + 0.6 * strength) * (0.6 + 0.6 * rng());
        this.airborne.push({ x: x + 0.5, y: y + 0.5, vx, vy: -Math.sqrt(2 * opt.gravity * h), c: c[i], m: m[i], s: s[i], t: 0 });
        c[i] = 0; m[i] = 0;
        taken++;
      }
    }
    return taken;
  }

  // Gerakkan butir yang melayang. solid(i): sel piece yang sedang jatuh.
  // Butir mendarat (masuk grid lagi) saat tertahan pasir atau lantai. Butir yang jatuh di atas piece
  // tetap melayang dan "menumpang" sampai piece pergi/terkunci; kalau masuk grid di atas piece,
  // simulasi pasir akan menjatuhkannya menembus piece. Mengembalikan jumlah yang mendarat.
  stepAirborne(dt, gravity, solid) {
    const c = this.cells, air = this.airborne;
    const out = (x, y) => x < 0 || x >= W || y >= H;
    const sand = (x, y) => out(x, y) || (y >= 0 && c[y * W + x] !== 0);
    const piece = (x, y) => !out(x, y) && y >= 0 && solid(y * W + x);
    let landed = 0;
    for (let k = air.length - 1; k >= 0; k--) {
      const p = air[k];
      p.t += dt;
      // Piece bergeser/berputar menimpa butir → dorong butir ke atas piece.
      let px = Math.floor(p.x);
      while (p.y >= 1 && piece(px, Math.floor(p.y))) { p.y -= 1; p.vy = Math.min(p.vy, 0); }
      p.vy += gravity * dt;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) * dt));
      let down = false;
      for (let st = 0; st < n; st++) {
        const nx = p.x + (p.vx * dt) / n, ny = p.y + (p.vy * dt) / n;
        const ix = Math.floor(nx), iy = Math.floor(ny), cy = Math.floor(p.y);
        px = Math.floor(p.x);
        if (ix !== px && (sand(ix, cy) || piece(ix, cy))) { p.vx = -p.vx * 0.25; continue; }   // pantul pelan dari dinding/tumpukan/piece
        if (sand(ix, iy)) {
          if (p.vy > 0) { p.x = Math.min(W - 0.01, Math.max(0, nx)); down = true; break; }
          p.vy = 0; continue;
        }
        if (piece(ix, iy)) {
          if (p.vy > 0) { p.vy = 0; p.vx *= 0.5; break; }   // menumpang di atas piece
          p.vy = 0; continue;                                // terbentur dari bawah → jatuh lagi
        }
        p.x = nx; p.y = Math.max(0, ny);
        if (ny < 0) p.vy = Math.max(0, p.vy);
      }
      if (down || (p.t > 5 && !piece(Math.floor(p.x), Math.floor(p.y) + 1))) { this.land(p, solid); air.splice(k, 1); landed++; }
    }
    return landed;
  }

  // Taruh butir yang mendarat di sel kosong terdekat (naik di kolomnya dulu, lalu kolom tetangga).
  land(p, solid) {
    const c = this.cells;
    const x0 = Math.min(W - 1, Math.max(0, Math.floor(p.x)));
    const y0 = Math.min(H - 1, Math.max(0, Math.floor(p.y)));
    for (let r = 0; r < W; r++) {
      for (const x of r === 0 ? [x0] : [x0 - r, x0 + r]) {
        if (x < 0 || x >= W) continue;
        for (let y = y0; y >= 0; y--) {
          const i = y * W + x;
          if (c[i] === 0 && !solid(i)) { c[i] = p.c; this.mat[i] = p.m; this.shade[i] = p.s; return true; }
        }
      }
    }
    return false;   // papan penuh total (tidak mungkin terjadi saat masih bermain)
  }

  // Kocok: tukar butir di lapisan permukaan (sedalam depth dari butir teratas tiap kolom) dengan
  // tetangga dekat, termasuk sel kosong tepat di atasnya. Batu tidak ikut.
  surfaceMix(swaps, depth) {
    const c = this.cells, m = this.mat, rng = this.rng;
    let done = 0;
    for (let k = 0; k < swaps; k++) {
      const x = (rng() * W) | 0;
      let top = 0;
      while (top < H && c[top * W + x] === 0) top++;
      if (top >= H) continue;
      const y = top + ((rng() * depth) | 0);
      if (y >= H) continue;
      const i = y * W + x;
      if (c[i] === 0 || m[i] === MAT_STONE) continue;
      const nx = x + ((rng() * 5) | 0) - 2, ny = y + ((rng() * 3) | 0) - 1;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx;
      if (j === i || m[j] === MAT_STONE || (c[j] !== 0 && c[j] === c[i])) continue;
      if (this.block !== null && (this.block[j] !== 0 || this.block[i] !== 0)) continue;
      this.swap(i, j);
      done++;
    }
    return done;
  }

  move(i, j) {
    const c = this.cells, m = this.mat, s = this.shade;
    c[j] = c[i]; m[j] = m[i]; s[j] = s[i];
    c[i] = 0; m[i] = 0;
  }

  swap(i, j) {
    const c = this.cells, m = this.mat, s = this.shade;
    let t = c[i]; c[i] = c[j]; c[j] = t;
    t = m[i]; m[i] = m[j]; m[j] = t;
    t = s[i]; s[i] = s[j]; s[j] = t;
  }

  // Batu sebagai benda kaku. Setiap kelompok batu yang saling menyentuh (4 arah) dihitung sebagai satu blok
  // dan bergerak utuh: jatuh lurus; kalau tertahan dan tanah miring, meluncur diagonal lalu ke samping.
  // Blok diproses dari bawah ke atas supaya yang di bawah bergerak lebih dulu. Mengembalikan jumlah blok yang bergerak.
  stepStones(tiltDir) {
    const c = this.cells, m = this.mat, s = this.shade, vis = this.visited, q = this.queue, rng = this.rng;
    const N = W * H;
    const st = ++this.stamp;
    const bodies = [];

    // 1. Kumpulkan kelompok batu (BFS 4 arah, lintas warna).
    for (let i = 0; i < N; i++) {
      if (c[i] === 0 || m[i] !== MAT_STONE || vis[i] === st) continue;
      let head = 0, tail = 1;
      q[0] = i; vis[i] = st;
      while (head < tail) {
        const j = q[head++];
        const x = j % W, y = (j - x) / W;
        for (let d = 0; d < 4; d++) {
          let k;
          if (d === 0) { if (x === 0) continue; k = j - 1; }
          else if (d === 1) { if (x === W - 1) continue; k = j + 1; }
          else if (d === 2) { if (y === 0) continue; k = j - W; }
          else { if (y === H - 1) continue; k = j + W; }
          if (c[k] !== 0 && m[k] === MAT_STONE && vis[k] !== st) { vis[k] = st; q[tail++] = k; }
        }
      }
      let bottom = 0;
      for (let k = 0; k < tail; k++) { const r = (q[k] - (q[k] % W)) / W; if (r > bottom) bottom = r; }
      bodies.push({ cells: q.slice(0, tail), bottom });
    }
    if (bodies.length === 0) return 0;
    bodies.sort((a, b) => b.bottom - a.bottom);

    // 2. Coba geser satu blok utuh. Semua sel tujuan harus kosong atau milik blok itu sendiri.
    const tryMove = (cells, dx, dy) => {
      const bs = ++this.stamp;
      for (let k = 0; k < cells.length; k++) vis[cells[k]] = bs;
      for (let k = 0; k < cells.length; k++) {
        const j = cells[k], x = j % W, y = (j - x) / W;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) return false;
        const t = j + dy * W + dx;
        if ((c[t] !== 0 && vis[t] !== bs) || (this.block !== null && this.block[t] !== 0)) return false;
      }
      const n = cells.length;
      const cv = new Uint8Array(n), mv = new Uint8Array(n), sv = new Uint8Array(n);
      for (let k = 0; k < n; k++) {
        const j = cells[k];
        cv[k] = c[j]; mv[k] = m[j]; sv[k] = s[j];
        c[j] = 0; m[j] = 0; s[j] = 0;
      }
      for (let k = 0; k < n; k++) {
        const t = cells[k] + dy * W + dx;
        c[t] = cv[k]; m[t] = mv[k]; s[t] = sv[k];
      }
      return true;
    };

    let moved = 0;
    for (const b of bodies) {
      if (tryMove(b.cells, 0, 1)) { moved++; continue; }
      if (tiltDir !== 0) {
        if (tryMove(b.cells, tiltDir, 1)) { moved++; continue; }
        if (rng() < 0.3 && tryMove(b.cells, tiltDir, 0)) { moved++; continue; }
      }
    }
    return moved;
  }

  // Satu langkah simulasi. tiltDir: -1 kiri, 0 normal, 1 kanan.
  // jitter: peluang butir yang diam bergeser acak ke samping (event gempa). Mengembalikan jumlah butir yang bergerak.
  step(tiltDir, jitter = 0) {
    const c = this.cells, m = this.mat, rng = this.rng;
    this.tick++;
    // Batu bergerak dulu sebagai blok kaku; pasir di sekitarnya dihitung setelahnya.
    let moved = this.stepStones(tiltDir);
    // Saat tilt, scan berlawanan arah tilt supaya butir yang bergeser tidak diproses dua kali.
    const ltr = tiltDir !== 0 ? tiltDir < 0 : (this.tick & 1) === 0;

    for (let y = H - 1; y >= 0; y--) {
      const row = y * W;
      const hasBelow = y < H - 1;
      const below = row + W;
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k;
        const i = row + x;
        // Batu ditangani stepStones; di sini hanya pasir dan mesiu.
        if (c[i] === 0 || m[i] === MAT_STONE) continue;

        // 1. Turun lurus
        if (hasBelow && this.free(below + x)) { this.move(i, below + x); moved++; continue; }

        if (hasBelow) {
          // 2. Diagonal bawah
          let d1, d2;
          if (tiltDir !== 0) { d1 = tiltDir; d2 = 0; }
          else { d1 = rng() < 0.5 ? -1 : 1; d2 = -d1; }
          let nx = x + d1;
          if (nx >= 0 && nx < W && this.free(below + nx)) { this.move(i, below + nx); moved++; continue; }
          if (d2 !== 0) {
            nx = x + d2;
            if (nx >= 0 && nx < W && this.free(below + nx)) { this.move(i, below + nx); moved++; continue; }
          }
        }

        // 3. Saat tilt: meluncur ke samping
        if (tiltDir !== 0) {
          const nx = x + tiltDir;
          if (nx >= 0 && nx < W && this.free(row + nx) && rng() < 0.85) { this.move(i, row + nx); moved++; continue; }
        }

        // 4. Gempa: butir di permukaan bergoyang ke samping
        if (jitter > 0 && rng() < jitter) {
          const nx = x + (rng() < 0.5 ? -1 : 1);
          if (nx >= 0 && nx < W && this.free(row + nx)) { this.move(i, row + nx); moved++; }
        }
      }
    }
    return moved;
  }

  // Gempa: tukar butir acak dengan tetangganya (radius 2), termasuk di dalam tumpukan.
  // Warna di tengah tumpukan teracak, sambungan bisa putus atau terbentuk. Batu tidak ikut.
  quakeMix(swaps) {
    const c = this.cells, m = this.mat, rng = this.rng, N = W * H;
    let done = 0;
    for (let k = 0; k < swaps; k++) {
      const i = (rng() * N) | 0;
      if (c[i] === 0 || m[i] === MAT_STONE) continue;
      const x = i % W, y = (i - x) / W;
      const nx = x + ((rng() * 5) | 0) - 2, ny = y + ((rng() * 5) | 0) - 2;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx;
      if (j === i || m[j] === MAT_STONE || (c[j] !== 0 && c[j] === c[i])) continue;
      if (this.block !== null && (this.block[j] !== 0 || this.block[i] !== 0)) continue;
      this.swap(i, j);
      done++;
    }
    return done;
  }

  // BFS dari setiap butir di kolom paling kiri. Kelompok warna sama yang menyentuh kolom kanan = jembatan.
  // Material tidak berpengaruh: batu merah & mesiu merah ikut menyambung jembatan merah.
  findBridges(connect8) {
    const c = this.cells, vis = this.visited, q = this.queue;
    const st = ++this.stamp;
    const cells = [];
    const colors = [];
    let bridges = 0;

    for (let y = 0; y < H; y++) {
      const start = y * W;
      const col = c[start];
      if (col === 0 || vis[start] === st) continue;

      let head = 0, tail = 0;
      q[tail++] = start; vis[start] = st;
      let touchesRight = false;

      while (head < tail) {
        const i = q[head++];
        const x = i % W, yy = (i - x) / W;
        if (x === W - 1) touchesRight = true;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = yy + dy;
          if (ny < 0 || ny >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (!connect8 && dx !== 0 && dy !== 0) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= W) continue;
            const j = ny * W + nx;
            if (c[j] === col && vis[j] !== st) { vis[j] = st; q[tail++] = j; }
          }
        }
      }

      if (touchesRight) {
        bridges++;
        if (!colors.includes(col)) colors.push(col);
        for (let k = 0; k < tail; k++) cells.push(q[k]);
      }
    }
    return { bridges, cells, colors };
  }

  // Mesiu (warna apa pun) yang ikut di-clear atau bersentuhan dengan butir yang di-clear menyala,
  // api merambat ke semua mesiu yang tersambung, lalu meledak: semua butir dalam radius ikut hancur, termasuk batu.
  // Mengembalikan null kalau tidak ada mesiu yang menyala.
  explode(clearCells, radius) {
    const c = this.cells, m = this.mat, vis = this.visited, q = this.queue;
    let st = ++this.stamp;
    for (let k = 0; k < clearCells.length; k++) vis[clearCells[k]] = st;

    let tail = 0;
    const tryPush = (j) => { if (m[j] === MAT_GUN && c[j] !== 0 && vis[j] !== st) { vis[j] = st; q[tail++] = j; } };
    const spread = (i) => {
      const x = i % W, y = (i - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < W) tryPush(ny * W + nx);
        }
      }
    };
    for (let k = 0; k < clearCells.length; k++) {
      const i = clearCells[k];
      if (m[i] === MAT_GUN) q[tail++] = i;
      spread(i);
    }
    if (tail === 0) return null;
    for (let head = 0; head < tail; head++) spread(q[head]);
    const ignited = tail;

    st = ++this.stamp;
    for (let k = 0; k < clearCells.length; k++) vis[clearCells[k]] = st;
    const extra = [];
    const centers = [];
    const r2 = radius * radius;
    const stride = Math.max(1, Math.floor(ignited / 120));
    const every = Math.max(1, Math.floor(ignited / 6));
    for (let k = 0; k < ignited; k += stride) {
      const i = q[k], cx = i % W, cy = (i - cx) / W;
      if (centers.length < 6 && k % every < stride) centers.push([cx, cy]);
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= W) continue;
          const j = ny * W + nx;
          if (c[j] !== 0 && vis[j] !== st) { vis[j] = st; extra.push(j); }
        }
      }
    }
    let stones = 0;
    for (let k = 0; k < extra.length; k++) if (m[extra[k]] === MAT_STONE) stones++;
    for (let k = 0; k < clearCells.length; k++) if (m[clearCells[k]] === MAT_STONE) stones++;
    return { extra, centers, ignited, stones };
  }

  countMat(mt) {
    let n = 0;
    const c = this.cells, m = this.mat;
    for (let i = 0; i < c.length; i++) if (c[i] !== 0 && m[i] === mt) n++;
    return n;
  }

  anyAbove(yLimit) {
    const c = this.cells, end = yLimit * W;
    for (let i = 0; i < end; i++) if (c[i] !== 0) return true;
    return false;
  }

  isEmpty() {
    if (this.airborne.length) return false;
    const c = this.cells;
    for (let i = 0; i < c.length; i++) if (c[i] !== 0) return false;
    return true;
  }

  count() {
    let n = this.airborne.length;
    const c = this.cells;
    for (let i = 0; i < c.length; i++) if (c[i] !== 0) n++;
    return n;
  }
}

