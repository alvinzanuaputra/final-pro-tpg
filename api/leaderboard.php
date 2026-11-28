<?php
// =============================================================================
// API LEADERBOARD — SANDTILT (versi PHP untuk gameedukasi.com)
// Protokolnya sama persis dengan API pusat di Vercel (api/leaderboard.js + server/leaderboard-core.js),
// jadi klien bisa berpindah ke sini kalau server pusat tidak bisa dihubungi.
//
//   GET  ?action=get&tab=weekly|alltime[&pid=<public id>]
//   POST ?action=start_run   JSON: token                    → run_id (dipanggil saat game mulai)
//   POST ?action=claim_name  JSON: token, player_name
//   POST ?action=submit      JSON: token, player_name, run_id, score, max_chain, level, clears, duration_sec
//
// token = rahasia pemain (hanya di localStorage). Server menyimpan hash-nya; papan hanya memuat public_id.
// Minggu dihitung di server (Asia/Jakarta, mulai Senin 00:00).
// =============================================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }

$cfg = file_exists(__DIR__ . '/db_config.php') ? __DIR__ . '/db_config.php' : __DIR__ . '/db_config.example.php';
require_once $cfg;

date_default_timezone_set('Asia/Jakarta');

const BOARD_LIMIT = 100;
const RUN_TTL_SEC = 691200;       // 8 hari
const RUN_RATE_WINDOW = 600;
const RUN_RATE_MAX = 30;
const DURATION_SLACK = 5;
const MAX_CLEARS_PER_SEC = 5;     // lantai hitstop: 1 clear mustahil < 0,2 dtk (anti-injeksi, lihat SUBMIT)
const CLEAR_SLACK = 5;            // toleransi aditif untuk game sangat singkat / pembulatan
const MAX_POINTS_PER_SEC = 20000; // plafon laju skor RATA-RATA; jauh di atas kemampuan manusia (tunable)

function respond($data) { echo json_encode($data); exit; }
function fail($message, $code = null) {
    $out = ['success' => false, 'message' => $message];
    if ($code) $out['code'] = $code;
    respond($out);
}
function readJson() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}
function cleanToken($t) {
    $t = trim((string)$t);
    return preg_match('/^[A-Za-z0-9-]{16,64}$/', $t) ? $t : '';
}
function cleanName($n) {
    $n = trim(preg_replace('/\s+/', ' ', (string)$n));
    return preg_match('/^[A-Za-z0-9 _-]{2,16}$/', $n) ? $n : '';
}
function keyHash($token) { return hash('sha256', 'sandtilt-key:' . $token); }
function publicId($token) { return substr(hash('sha256', 'sandtilt-public:' . $token), 0, 16); }

// Nama tabel: prefix NRP pengunggah + nama tabel (lihat database.sql).
$prefix = defined('TABLE_PREFIX') ? TABLE_PREFIX : '5025231064_sandtilt';
$T_PLAYERS = '`' . $prefix . '_players`';
$T_SCORES = '`' . $prefix . '_scores`';
$T_RUNS = '`' . $prefix . '_runs`';

$pdo = getDBConnection();
if (!$pdo) fail('Database tidak tersedia.', 'NO_DB');

// SQLite (tes lokal): buat tabel otomatis. MySQL di server: jalankan database.sql.
if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
    $pdo->exec("CREATE TABLE IF NOT EXISTS $T_PLAYERS (public_id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL, name_lower TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS $T_SCORES (player_id TEXT NOT NULL, week_start TEXT NOT NULL,
        score INTEGER NOT NULL, max_chain INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 1,
        clears INTEGER NOT NULL DEFAULT 0, duration_sec INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL,
        PRIMARY KEY (player_id, week_start))");
    $pdo->exec("CREATE TABLE IF NOT EXISTS $T_RUNS (run_id TEXT PRIMARY KEY, key_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL, started_at INTEGER NOT NULL, used_at INTEGER)");
}

// Jalankan query; nilai integer di-bind sebagai integer (SQLite membandingkan angka vs teks dengan salah).
function q($pdo, $sql, $params = []) {
    $st = $pdo->prepare($sql);
    foreach ($params as $k => $v) $st->bindValue($k, $v, is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR);
    $st->execute();
    return $st;
}

function allTimeRank($pdo, $T_SCORES, $best) {
    return 1 + (int)q($pdo, "SELECT COUNT(*) FROM (SELECT player_id, MAX(score) AS best FROM $T_SCORES GROUP BY player_id) t
        WHERE t.best > :s", [':s' => (int)$best])->fetchColumn();
}

// Buat pemain atau ganti namanya; nama bentrok → langsung kirim jawaban NAME_TAKEN.
function upsertPlayer($pdo, $T_PLAYERS, $token, $name) {
    $pid = publicId($token);
    $lower = strtolower($name);
    if (q($pdo, "SELECT 1 FROM $T_PLAYERS WHERE name_lower = :n AND public_id <> :p", [':n' => $lower, ':p' => $pid])->fetch()) {
        fail("Nama '$name' sudah dipakai pemain lain.", 'NAME_TAKEN');
    }
    try {
        if (q($pdo, "SELECT 1 FROM $T_PLAYERS WHERE public_id = :p", [':p' => $pid])->fetch()) {
            q($pdo, "UPDATE $T_PLAYERS SET name = :n, name_lower = :l WHERE public_id = :p", [':n' => $name, ':l' => $lower, ':p' => $pid]);
        } else {
            q($pdo, "INSERT INTO $T_PLAYERS (public_id, key_hash, name, name_lower, created_at) VALUES (:p, :k, :n, :l, :t)",
                [':p' => $pid, ':k' => keyHash($token), ':n' => $name, ':l' => $lower, ':t' => time()]);
        }
    } catch (PDOException $e) {
        if (stripos($e->getMessage(), 'unique') !== false || stripos($e->getMessage(), 'duplicate') !== false) {
            fail("Nama '$name' sudah dipakai pemain lain.", 'NAME_TAKEN');
        }
        throw $e;
    }
    return $pid;
}

$now = new DateTime('now');
$nowTs = $now->getTimestamp();
$monday = (clone $now)->modify('monday this week')->setTime(0, 0, 0);
$weekStart = $monday->format('Y-m-d');
$resetIn = (clone $monday)->modify('+7 days')->getTimestamp() - $nowTs;

$action = $_GET['action'] ?? ($method === 'POST' ? 'submit' : 'get');

try {
    // ---------------------------------------------------------------- GET
    if ($action === 'get') {
        $tab = ($_GET['tab'] ?? 'weekly') === 'alltime' ? 'alltime' : 'weekly';
        $pid = preg_match('/^[0-9a-f]{16}$/', (string)($_GET['pid'] ?? '')) ? $_GET['pid'] : '';
        $mine = null;

        if ($tab === 'weekly') {
            $rows = q($pdo, "SELECT s.player_id, p.name AS player_name, s.score, s.max_chain, s.level
                FROM $T_SCORES s JOIN $T_PLAYERS p ON p.public_id = s.player_id
                WHERE s.week_start = :w ORDER BY s.score DESC, s.duration_sec ASC LIMIT " . BOARD_LIMIT, [':w' => $weekStart])->fetchAll();
            if ($pid) {
                $me = q($pdo, "SELECT p.name AS player_name, s.score FROM $T_SCORES s JOIN $T_PLAYERS p ON p.public_id = s.player_id
                    WHERE s.player_id = :p AND s.week_start = :w", [':p' => $pid, ':w' => $weekStart])->fetch();
                if ($me) {
                    $n = (int)q($pdo, "SELECT COUNT(*) FROM $T_SCORES WHERE week_start = :w AND score > :s",
                        [':w' => $weekStart, ':s' => (int)$me['score']])->fetchColumn();
                    $mine = ['player_name' => $me['player_name'], 'score' => (int)$me['score'], 'rank' => 1 + $n];
                }
            }
        } else {
            $rows = q($pdo, "SELECT s.player_id, MAX(p.name) AS player_name, MAX(s.score) AS score,
                    MAX(s.max_chain) AS max_chain, MAX(s.level) AS level
                FROM $T_SCORES s JOIN $T_PLAYERS p ON p.public_id = s.player_id
                GROUP BY s.player_id ORDER BY score DESC LIMIT " . BOARD_LIMIT)->fetchAll();
            if ($pid) {
                $me = q($pdo, "SELECT MAX(p.name) AS player_name, MAX(s.score) AS score FROM $T_SCORES s
                    JOIN $T_PLAYERS p ON p.public_id = s.player_id WHERE s.player_id = :p", [':p' => $pid])->fetch();
                if ($me && $me['score'] !== null) {
                    $mine = ['player_name' => $me['player_name'], 'score' => (int)$me['score'], 'rank' => allTimeRank($pdo, $T_SCORES, $me['score'])];
                }
            }
        }

        $data = array_map(fn($r) => [
            'player_id' => $r['player_id'], 'player_name' => $r['player_name'],
            'score' => (int)$r['score'], 'max_chain' => (int)$r['max_chain'], 'level' => (int)$r['level'],
        ], $rows);
        respond(['success' => true, 'tab' => $tab, 'week_start' => $weekStart, 'reset_in_sec' => $resetIn, 'data' => $data, 'mine' => $mine]);
    }

    if ($method !== 'POST') fail('Gunakan POST.');
    $in = readJson();
    $token = cleanToken($in['token'] ?? ($in['player_uuid'] ?? ''));
    if (!$token) fail('Token pemain tidak valid.', 'BAD_TOKEN');
    $pid = publicId($token);

    // ----------------------------------------------------------- START RUN
    if ($action === 'start_run') {
        $salt = defined('IP_SALT') ? IP_SALT : 'sandtilt';
        $ipHash = substr(hash('sha256', $salt . ':' . ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 32);
        $n = (int)q($pdo, "SELECT COUNT(*) FROM $T_RUNS WHERE ip_hash = :i AND started_at > :t",
            [':i' => $ipHash, ':t' => $nowTs - RUN_RATE_WINDOW])->fetchColumn();
        if ($n >= RUN_RATE_MAX) fail('Terlalu banyak permainan baru, coba lagi sebentar.', 'RATE_LIMIT');
        q($pdo, "DELETE FROM $T_RUNS WHERE started_at < :t", [':t' => $nowTs - RUN_TTL_SEC]);
        $runId = bin2hex(random_bytes(16));
        q($pdo, "INSERT INTO $T_RUNS (run_id, key_hash, ip_hash, started_at) VALUES (:r, :k, :i, :t)",
            [':r' => $runId, ':k' => keyHash($token), ':i' => $ipHash, ':t' => $nowTs]);
        respond(['success' => true, 'run_id' => $runId, 'player_id' => $pid]);
    }

    $name = cleanName($in['player_name'] ?? '');
    if (!$name) fail('Nama harus 2-16 karakter (huruf, angka, spasi, _ atau -).', 'BAD_NAME');

    // ---------------------------------------------------------- CLAIM NAME
    if ($action === 'claim_name') {
        upsertPlayer($pdo, $T_PLAYERS, $token, $name);
        respond(['success' => true, 'player_name' => $name, 'player_id' => $pid]);
    }

    // -------------------------------------------------------------- SUBMIT
    if ($action === 'submit') {
        $runId = preg_match('/^[0-9a-f]{32}$/', (string)($in['run_id'] ?? '')) ? $in['run_id'] : '';
        if (!$runId) fail('Permainan ini tidak terdaftar di server.', 'NO_RUN');
        $score = (int)($in['score'] ?? 0);
        $chain = max(0, min(255, (int)($in['max_chain'] ?? 0)));
        $level = max(1, min(999, (int)($in['level'] ?? 1)));
        $clears = max(0, (int)($in['clears'] ?? 0));
        $duration = max(0, (int)($in['duration_sec'] ?? 0));

        // Nama dulu: kalau bentrok, run belum terpakai dan klien bisa kirim ulang dengan nama lain.
        upsertPlayer($pdo, $T_PLAYERS, $token, $name);

        // Pakai run: sekali saja, harus milik token ini, belum kedaluwarsa.
        $used = q($pdo, "UPDATE $T_RUNS SET used_at = :n WHERE run_id = :r AND key_hash = :k AND used_at IS NULL AND started_at > :t",
            [':n' => $nowTs, ':r' => $runId, ':k' => keyHash($token), ':t' => $nowTs - RUN_TTL_SEC])->rowCount();
        if ($used !== 1) fail('Permainan ini tidak terdaftar atau sudah dikirim.', 'INVALID_RUN');
        $startedAt = (int)q($pdo, "SELECT started_at FROM $T_RUNS WHERE run_id = :r", [':r' => $runId])->fetchColumn();

        // Validasi kewajaran + durasi tidak boleh melebihi jam server.
        // Kunci: skor & clears client-authoritative, jadi keduanya WAJIB terikat ke waktu nyata
        // (duration sudah dicek lawan jam server). Tanpa ini, clears tak dibatasi melar plafon
        // tanpa batas dan skor berapa pun lolos dalam hitungan detik. (Sinkron dgn leaderboard-core.js.)
        $maxPerClear = 80 * 160 * 8 * (1 + 0.1 * ($level - 1)) * 2;
        $maxByClears = $clears * $maxPerClear + $duration * 200 + 1000;
        $maxByTime = $duration * MAX_POINTS_PER_SEC + 1000;                   // #2: skor terikat waktu nyata
        $maxScore = min($maxByClears, $maxByTime);
        $clearsOk = $clears <= $duration * MAX_CLEARS_PER_SEC + CLEAR_SLACK;  // #1: clears terikat waktu nyata
        $levelOk = $level <= 1 + intdiv($clears, 5);
        if ($score < 0 || $score > $maxScore || !$clearsOk || !$levelOk || $duration < 5 || $duration > 6 * 3600
            || $duration > $nowTs - $startedAt + DURATION_SLACK) {
            fail('Skor tidak valid.', 'INVALID_SCORE');
        }

        $row = q($pdo, "SELECT score, duration_sec FROM $T_SCORES WHERE player_id = :p AND week_start = :w",
            [':p' => $pid, ':w' => $weekStart])->fetch();
        $vals = [':s' => $score, ':c' => $chain, ':l' => $level, ':cl' => $clears, ':d' => $duration, ':t' => $nowTs, ':p' => $pid, ':w' => $weekStart];
        $newBest = false;
        if (!$row) {
            q($pdo, "INSERT INTO $T_SCORES (player_id, week_start, score, max_chain, level, clears, duration_sec, updated_at)
                VALUES (:p, :w, :s, :c, :l, :cl, :d, :t)", $vals);
            $newBest = true;
        } elseif ($score > (int)$row['score'] || ($score === (int)$row['score'] && $duration < (int)$row['duration_sec'])) {
            q($pdo, "UPDATE $T_SCORES SET score = :s, max_chain = :c, level = :l, clears = :cl, duration_sec = :d, updated_at = :t
                WHERE player_id = :p AND week_start = :w", $vals);
            $newBest = true;
        }

        $best = $newBest ? $score : (int)$row['score'];
        $rankWeekly = 1 + (int)q($pdo, "SELECT COUNT(*) FROM $T_SCORES WHERE week_start = :w AND score > :s",
            [':w' => $weekStart, ':s' => $best])->fetchColumn();
        $allBest = (int)q($pdo, "SELECT MAX(score) FROM $T_SCORES WHERE player_id = :p", [':p' => $pid])->fetchColumn();

        respond(['success' => true, 'new_best' => $newBest, 'rank_weekly' => $rankWeekly,
            'rank_alltime' => allTimeRank($pdo, $T_SCORES, $allBest), 'week_start' => $weekStart, 'player_id' => $pid]);
    }

    fail('Aksi tidak dikenal.');
} catch (PDOException $e) {
    error_log('SandTilt leaderboard: ' . $e->getMessage());
    fail('Terjadi kesalahan server.', 'SERVER_ERROR');
}
