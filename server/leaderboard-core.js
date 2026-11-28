// =============================================================================
// INTI API LEADERBOARD — SANDTILT (dipakai Vercel Function api/leaderboard.js dan tes lokal)
// Tidak bergantung pada database tertentu: cukup objek db dengan query(sql, params) → rows.
// SQL ditulis supaya jalan di Postgres (Neon) dan SQLite (tes lokal). Placeholder: $1, $2, ...
//
// Protokol (sama persis dengan api/leaderboard.php):
//   GET  ?action=get&tab=weekly|alltime[&pid=<public id>]
//   POST ?action=start_run   {token}                         → run_id (dipanggil saat game mulai)
//   POST ?action=claim_name  {token, player_name}
//   POST ?action=submit      {token, player_name, run_id, score, max_chain, level, clears, duration_sec}
//
// Keamanan:
// - token = rahasia milik pemain (hanya di localStorage). Server menyimpan hash-nya saja.
// - Yang tampil di papan hanya public_id (hash lain dari token), jadi token tidak pernah bocor.
// - Skor hanya diterima untuk run yang dibuka server (start_run), sekali pakai, dan durasinya
//   dicek dengan jam server. Pembukaan run dibatasi per IP.
// =============================================================================

import { createHash, randomBytes } from 'node:crypto';

export const BOARD_LIMIT = 100;
const RUN_TTL_SEC = 8 * 24 * 3600;      // run boleh dikirim (termasuk kirim ulang offline) sampai 8 hari
const RUN_RATE_WINDOW = 600;             // detik
const RUN_RATE_MAX = 30;                 // run baru per IP per jendela
const DURATION_SLACK = 5;                // detik toleransi durasi klien vs jam server
// Batas anti-injeksi (lihat plausible): skor & jumlah clear harus terikat ke waktu nyata.
const MAX_CLEARS_PER_SEC = 5;            // lantai hitstop: 1 clear mustahil < CLEAR_FLASH_FAST (0,2 dtk)
const CLEAR_SLACK = 5;                   // toleransi aditif untuk game sangat singkat / pembulatan
const MAX_POINTS_PER_SEC = 20000;        // plafon laju skor RATA-RATA; jauh di atas kemampuan manusia (tunable)

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sandtilt_players (
    public_id  TEXT PRIMARY KEY,
    key_hash   TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    name_lower TEXT NOT NULL UNIQUE,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sandtilt_scores (
    player_id    TEXT NOT NULL,
    week_start   TEXT NOT NULL,
    score        INTEGER NOT NULL,
    max_chain    INTEGER NOT NULL DEFAULT 0,
    level        INTEGER NOT NULL DEFAULT 1,
    clears       INTEGER NOT NULL DEFAULT 0,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    updated_at   BIGINT NOT NULL,
    PRIMARY KEY (player_id, week_start)
  )`,
  `CREATE INDEX IF NOT EXISTS sandtilt_scores_week ON sandtilt_scores (week_start, score)`,
  `CREATE TABLE IF NOT EXISTS sandtilt_runs (
    run_id     TEXT PRIMARY KEY,
    key_hash   TEXT NOT NULL,
    ip_hash    TEXT NOT NULL,
    started_at BIGINT NOT NULL,
    used_at    BIGINT
  )`,
  `CREATE INDEX IF NOT EXISTS sandtilt_runs_ip ON sandtilt_runs (ip_hash, started_at)`,
];

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const keyHash = (token) => sha256('sandtilt-key:' + token);
export const publicId = (token) => sha256('sandtilt-public:' + token).slice(0, 16);

export function cleanToken(t) {
  t = String(t ?? '').trim();
  return /^[A-Za-z0-9-]{16,64}$/.test(t) ? t : '';
}
export function cleanName(n) {
  n = String(n ?? '').replace(/\s+/g, ' ').trim();
  return /^[A-Za-z0-9 _-]{2,16}$/.test(n) ? n : '';
}
const int = (v, d = 0) => { const x = Math.trunc(Number(v)); return Number.isFinite(x) ? x : d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Minggu dihitung di WIB (UTC+7, tanpa DST): Senin 00:00.
export function weekInfo(nowSec) {
  const local = new Date((nowSec + 7 * 3600) * 1000);
  const day = (local.getUTCDay() + 6) % 7;            // 0 = Senin
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day) / 1000;
  const weekStart = new Date(monday * 1000).toISOString().slice(0, 10);
  const nextMondayUtc = monday + 7 * 86400 - 7 * 3600;
  return { weekStart, resetIn: nextMondayUtc - nowSec };
}

// Batas skor wajar (anti-curang, sama dengan versi PHP).
// Kunci: skor & clears client-authoritative, jadi keduanya WAJIB terikat ke waktu nyata
// (duration sudah diverifikasi lawan jam server di handle()). Tanpa ini, clears yang tak dibatasi
// bisa melar plafon tanpa batas dan skor berapa pun lolos dalam hitungan detik.
export function plausible({ score, level, clears, duration }) {
  const maxPerClear = 80 * 160 * 8 * (1 + 0.1 * (level - 1)) * 2;
  const maxByClears = clears * maxPerClear + duration * 200 + 1000;
  const maxByTime = duration * MAX_POINTS_PER_SEC + 1000;            // #2: skor terikat waktu nyata
  const maxScore = Math.min(maxByClears, maxByTime);
  const clearsOk = clears <= duration * MAX_CLEARS_PER_SEC + CLEAR_SLACK;   // #1: clears terikat waktu nyata
  const levelOk = level <= 1 + Math.floor(clears / 5);
  return score >= 0 && score <= maxScore && clearsOk && levelOk && duration >= 5 && duration <= 6 * 3600;
}

const fail = (message, code) => ({ success: false, message, ...(code ? { code } : {}) });

async function one(db, sql, params) { return (await db.query(sql, params))[0] ?? null; }

async function nameTaken(db, name, pid) {
  return !!(await one(db, 'SELECT public_id FROM sandtilt_players WHERE name_lower = $1 AND public_id <> $2', [name.toLowerCase(), pid]));
}

// Buat pemain atau ganti namanya. Mengembalikan pesan gagal, atau null kalau berhasil.
async function upsertPlayer(db, token, name, now) {
  const pid = publicId(token);
  if (await nameTaken(db, name, pid)) return fail(`Nama '${name}' sudah dipakai pemain lain.`, 'NAME_TAKEN');
  try {
    await db.query(`INSERT INTO sandtilt_players (public_id, key_hash, name, name_lower, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (public_id) DO UPDATE SET name = excluded.name, name_lower = excluded.name_lower`,
    [pid, keyHash(token), name, name.toLowerCase(), now]);
  } catch (e) {
    if (/unique|duplicate/i.test(String(e?.message))) return fail(`Nama '${name}' sudah dipakai pemain lain.`, 'NAME_TAKEN');
    throw e;
  }
  return null;
}

async function allTimeRank(db, best) {
  const r = await one(db, `SELECT COUNT(*) AS n FROM (SELECT player_id, MAX(score) AS best FROM sandtilt_scores
    GROUP BY player_id) t WHERE t.best > $1`, [best]);
  return 1 + int(r?.n);
}

const rowOut = (r) => ({
  player_id: r.player_id, player_name: r.player_name,
  score: int(r.score), max_chain: int(r.max_chain), level: int(r.level),
});

// ---------------------------------------------------------------------------
// handle({ method, action, query, body, ip, now }) → objek JSON jawaban
// ---------------------------------------------------------------------------
export async function handle(db, { method, action, query = {}, body = {}, ip = '', now = Math.floor(Date.now() / 1000), ipSalt = 'sandtilt' }) {
  const { weekStart, resetIn } = weekInfo(now);
  action = action || (method === 'POST' ? 'submit' : 'get');

  // ------------------------------------------------------------------ GET
  if (action === 'get') {
    const tab = query.tab === 'alltime' ? 'alltime' : 'weekly';
    const pid = /^[0-9a-f]{16}$/.test(String(query.pid ?? '')) ? String(query.pid) : '';
    let rows; let mine = null;
    if (tab === 'weekly') {
      rows = await db.query(`SELECT s.player_id, p.name AS player_name, s.score, s.max_chain, s.level
        FROM sandtilt_scores s JOIN sandtilt_players p ON p.public_id = s.player_id
        WHERE s.week_start = $1 ORDER BY s.score DESC, s.duration_sec ASC LIMIT ${BOARD_LIMIT}`, [weekStart]);
      if (pid) {
        const me = await one(db, `SELECT p.name AS player_name, s.score FROM sandtilt_scores s
          JOIN sandtilt_players p ON p.public_id = s.player_id WHERE s.player_id = $1 AND s.week_start = $2`, [pid, weekStart]);
        if (me) {
          const r = await one(db, 'SELECT COUNT(*) AS n FROM sandtilt_scores WHERE week_start = $1 AND score > $2', [weekStart, int(me.score)]);
          mine = { player_name: me.player_name, score: int(me.score), rank: 1 + int(r?.n) };
        }
      }
    } else {
      rows = await db.query(`SELECT s.player_id, MAX(p.name) AS player_name, MAX(s.score) AS score,
          MAX(s.max_chain) AS max_chain, MAX(s.level) AS level
        FROM sandtilt_scores s JOIN sandtilt_players p ON p.public_id = s.player_id
        GROUP BY s.player_id ORDER BY score DESC LIMIT ${BOARD_LIMIT}`, []);
      if (pid) {
        const me = await one(db, `SELECT MAX(p.name) AS player_name, MAX(s.score) AS score FROM sandtilt_scores s
          JOIN sandtilt_players p ON p.public_id = s.player_id WHERE s.player_id = $1`, [pid]);
        if (me && me.score !== null) mine = { player_name: me.player_name, score: int(me.score), rank: await allTimeRank(db, int(me.score)) };
      }
    }
    return { success: true, tab, week_start: weekStart, reset_in_sec: resetIn, data: rows.map(rowOut), mine };
  }

  if (method !== 'POST') return fail('Gunakan POST.');
  const token = cleanToken(body.token ?? body.player_uuid);
  if (!token) return fail('Token pemain tidak valid.', 'BAD_TOKEN');
  const pid = publicId(token);

  // ------------------------------------------------------------ START RUN
  if (action === 'start_run') {
    const ipHash = sha256(ipSalt + ':' + ip).slice(0, 32);
    const r = await one(db, 'SELECT COUNT(*) AS n FROM sandtilt_runs WHERE ip_hash = $1 AND started_at > $2', [ipHash, now - RUN_RATE_WINDOW]);
    if (int(r?.n) >= RUN_RATE_MAX) return fail('Terlalu banyak permainan baru, coba lagi sebentar.', 'RATE_LIMIT');
    await db.query('DELETE FROM sandtilt_runs WHERE started_at < $1', [now - RUN_TTL_SEC]);
    const runId = randomBytes(16).toString('hex');
    await db.query('INSERT INTO sandtilt_runs (run_id, key_hash, ip_hash, started_at) VALUES ($1, $2, $3, $4)', [runId, keyHash(token), ipHash, now]);
    return { success: true, run_id: runId, player_id: pid };
  }

  const name = cleanName(body.player_name);
  if (!name) return fail('Nama harus 2-16 karakter (huruf, angka, spasi, _ atau -).', 'BAD_NAME');

  // ----------------------------------------------------------- CLAIM NAME
  if (action === 'claim_name') {
    const err = await upsertPlayer(db, token, name, now);
    return err ?? { success: true, player_name: name, player_id: pid };
  }

  // --------------------------------------------------------------- SUBMIT
  if (action === 'submit') {
    const runId = /^[0-9a-f]{32}$/.test(String(body.run_id ?? '')) ? String(body.run_id) : '';
    if (!runId) return fail('Permainan ini tidak terdaftar di server.', 'NO_RUN');
    const s = {
      score: int(body.score), chain: clamp(int(body.max_chain), 0, 255), level: clamp(int(body.level, 1), 1, 999),
      clears: Math.max(0, int(body.clears)), duration: Math.max(0, int(body.duration_sec)),
    };

    // Nama dulu: kalau nama bentrok, run belum terpakai dan klien bisa kirim ulang dengan nama lain.
    const err = await upsertPlayer(db, token, name, now);
    if (err) return err;

    // Pakai run (sekali saja, harus milik token ini, belum kedaluwarsa).
    const run = await one(db, `UPDATE sandtilt_runs SET used_at = $1
      WHERE run_id = $2 AND key_hash = $3 AND used_at IS NULL AND started_at > $4 RETURNING started_at`,
    [now, runId, keyHash(token), now - RUN_TTL_SEC]);
    if (!run) return fail('Permainan ini tidak terdaftar atau sudah dikirim.', 'INVALID_RUN');
    const elapsed = now - int(run.started_at);
    if (s.duration > elapsed + DURATION_SLACK || !plausible({ ...s })) return fail('Skor tidak valid.', 'INVALID_SCORE');

    const up = await db.query(`INSERT INTO sandtilt_scores (player_id, week_start, score, max_chain, level, clears, duration_sec, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (player_id, week_start) DO UPDATE SET score = excluded.score, max_chain = excluded.max_chain,
        level = excluded.level, clears = excluded.clears, duration_sec = excluded.duration_sec, updated_at = excluded.updated_at
      WHERE excluded.score > sandtilt_scores.score
         OR (excluded.score = sandtilt_scores.score AND excluded.duration_sec < sandtilt_scores.duration_sec)
      RETURNING score`, [pid, weekStart, s.score, s.chain, s.level, s.clears, s.duration, now]);
    const newBest = up.length > 0;

    const best = int((await one(db, 'SELECT score FROM sandtilt_scores WHERE player_id = $1 AND week_start = $2', [pid, weekStart]))?.score);
    const rw = await one(db, 'SELECT COUNT(*) AS n FROM sandtilt_scores WHERE week_start = $1 AND score > $2', [weekStart, best]);
    const allBest = int((await one(db, 'SELECT MAX(score) AS m FROM sandtilt_scores WHERE player_id = $1', [pid]))?.m);
    return {
      success: true, new_best: newBest, rank_weekly: 1 + int(rw?.n), rank_alltime: await allTimeRank(db, allBest),
      week_start: weekStart, player_id: pid,
    };
  }

  return fail('Aksi tidak dikenal.');
}
