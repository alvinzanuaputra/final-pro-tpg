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
  }

  reset() {
    this.cells.fill(0);
    this.mat.fill(0);
    this.shade.fill(0);
    this.tick = 0;
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

  // Satu langkah simulasi. tiltDir: -1 kiri, 0 normal, 1 kanan.
  // jitter: peluang butir yang diam bergeser acak ke samping (event gempa). Mengembalikan jumlah butir yang bergerak.
  step(tiltDir, jitter = 0) {
    const c = this.cells, m = this.mat, rng = this.rng;
    this.tick++;
    let moved = 0;
    // Saat tilt, scan berlawanan arah tilt supaya butir yang bergeser tidak diproses dua kali.
    const ltr = tiltDir !== 0 ? tiltDir < 0 : (this.tick & 1) === 0;

    for (let y = H - 1; y >= 0; y--) {
      const row = y * W;
      const hasBelow = y < H - 1;
      const below = row + W;
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k;
        const i = row + x;
        if (c[i] === 0) continue;

        // 1. Turun lurus (semua material, termasuk batu)
        if (hasBelow && c[below + x] === 0) { this.move(i, below + x); moved++; continue; }

        // Batu berat: hanya jatuh lurus, tidak longsor, tidak terdorong tilt/gempa.
        if (m[i] === MAT_STONE) continue;

        if (hasBelow) {
          // 2. Diagonal bawah
          let d1, d2;
          if (tiltDir !== 0) { d1 = tiltDir; d2 = 0; }
          else { d1 = rng() < 0.5 ? -1 : 1; d2 = -d1; }
          let nx = x + d1;
          if (nx >= 0 && nx < W && c[below + nx] === 0) { this.move(i, below + nx); moved++; continue; }
          if (d2 !== 0) {
            nx = x + d2;
            if (nx >= 0 && nx < W && c[below + nx] === 0) { this.move(i, below + nx); moved++; continue; }
          }
        }

        // 3. Saat tilt: meluncur ke samping
        if (tiltDir !== 0) {
          const nx = x + tiltDir;
          if (nx >= 0 && nx < W && c[row + nx] === 0 && rng() < 0.85) { this.move(i, row + nx); moved++; continue; }
        }

        // 4. Gempa: butir di permukaan bergoyang ke samping
        if (jitter > 0 && rng() < jitter) {
          const nx = x + (rng() < 0.5 ? -1 : 1);
          if (nx >= 0 && nx < W && c[row + nx] === 0) { this.move(i, row + nx); moved++; }
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
    const c = this.cells;
    for (let i = 0; i < c.length; i++) if (c[i] !== 0) return false;
    return true;
  }

  count() {
    let n = 0;
    const c = this.cells;
    for (let i = 0; i < c.length; i++) if (c[i] !== 0) n++;
    return n;
  }
}

