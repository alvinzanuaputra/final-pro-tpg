<?php
// =============================================================================
// API LEADERBOARD — SANDTILT
// action=get        (GET)  tab=weekly|alltime, uuid
// action=submit     (POST) JSON: player_uuid, player_name, score, max_chain, level, clears, duration_sec
// action=claim_name (POST) JSON: player_uuid, player_name
// Minggu dihitung di server (Asia/Jakarta, mulai Senin 00:00).
// =============================================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }

$cfg = file_exists(__DIR__ . '/db_config.php') ? __DIR__ . '/db_config.php' : __DIR__ . '/db_config.example.php';
require_once $cfg;

date_default_timezone_set('Asia/Jakarta');

function respond($data) { echo json_encode($data); exit; }
function fail($message, $code = null) {
    $out = ['success' => false, 'message' => $message];
    if ($code) $out['code'] = $code;
    respond($out);
}
function readJson() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function cleanUuid($u) {
    $u = trim((string)$u);
    return preg_match('/^[A-Za-z0-9-]{8,64}$/', $u) ? $u : '';
}
function cleanName($n) {
    $n = trim(preg_replace('/\s+/', ' ', (string)$n));
    return preg_match('/^[A-Za-z0-9 _-]{2,16}$/', $n) ? $n : '';
}

// Peringkat all-time: jumlah pemain dengan skor terbaik lebih tinggi + 1.
// Nilai di-bind sebagai integer: tanpa ini SQLite membandingkan angka vs teks dan hasilnya salah.
function allTimeRank($pdo, $table, $score) {
    $st = $pdo->prepare("SELECT COUNT(*) FROM (SELECT MAX(score) AS best FROM $table GROUP BY player_uuid) t WHERE t.best > :s");
    $st->bindValue(':s', (int)$score, PDO::PARAM_INT);
    $st->execute();
    return 1 + (int)$st->fetchColumn();
}

$pdo = getDBConnection();
if (!$pdo) fail('Database tidak tersedia.', 'NO_DB');

$table = '`' . TABLE_LEADERBOARD . '`';
$now = new DateTime('now');
$monday = (clone $now)->modify('monday this week')->setTime(0, 0, 0);
$weekStart = $monday->format('Y-m-d');
$nextMonday = (clone $monday)->modify('+7 days');
$resetIn = $nextMonday->getTimestamp() - $now->getTimestamp();

$action = $_GET['action'] ?? ($method === 'POST' ? 'submit' : 'get');

try {
    // ---------------------------------------------------------------- GET
    if ($action === 'get') {
        $tab = ($_GET['tab'] ?? 'weekly') === 'alltime' ? 'alltime' : 'weekly';
        $uuid = cleanUuid($_GET['uuid'] ?? '');
        $mine = null;

        if ($tab === 'weekly') {
            $st = $pdo->prepare("SELECT player_uuid, player_name, score, max_chain, level
                FROM $table WHERE week_start = :w ORDER BY score DESC, duration_sec ASC LIMIT 10");
            $st->execute([':w' => $weekStart]);
            $rows = $st->fetchAll();

            if ($uuid) {
                $st = $pdo->prepare("SELECT player_name, score FROM $table WHERE player_uuid = :u AND week_start = :w");
                $st->execute([':u' => $uuid, ':w' => $weekStart]);
                if ($me = $st->fetch()) {
                    $st = $pdo->prepare("SELECT COUNT(*) FROM $table WHERE week_start = :w AND score > :s");
                    $st->execute([':w' => $weekStart, ':s' => $me['score']]);
                    $mine = ['player_name' => $me['player_name'], 'score' => (int)$me['score'], 'rank' => 1 + (int)$st->fetchColumn()];
                }
            }
        } else {
            $rows = $pdo->query("SELECT player_uuid, MAX(player_name) AS player_name, MAX(score) AS score,
                    MAX(max_chain) AS max_chain, MAX(level) AS level
                FROM $table GROUP BY player_uuid ORDER BY score DESC LIMIT 10")->fetchAll();

            if ($uuid) {
                $st = $pdo->prepare("SELECT MAX(player_name) AS player_name, MAX(score) AS score FROM $table WHERE player_uuid = :u");
                $st->execute([':u' => $uuid]);
                $me = $st->fetch();
                if ($me && $me['score'] !== null) {
                    $mine = ['player_name' => $me['player_name'], 'score' => (int)$me['score'], 'rank' => allTimeRank($pdo, $table, $me['score'])];
                }
            }
        }

        foreach ($rows as &$r) { $r['score'] = (int)$r['score']; $r['max_chain'] = (int)$r['max_chain']; $r['level'] = (int)$r['level']; }
        respond(['success' => true, 'tab' => $tab, 'week_start' => $weekStart, 'reset_in_sec' => $resetIn, 'data' => $rows, 'mine' => $mine]);
    }

    if ($method !== 'POST') fail('Gunakan POST.');
    $in = readJson();
    $uuid = cleanUuid($in['player_uuid'] ?? '');
    $name = cleanName($in['player_name'] ?? '');
    if (!$uuid) fail('UUID pemain tidak valid.');
    if (!$name) fail('Nama harus 2-16 karakter (huruf, angka, spasi, _ atau -).', 'BAD_NAME');

    // Nama tidak boleh dipakai UUID lain.
    $st = $pdo->prepare("SELECT 1 FROM $table WHERE LOWER(player_name) = LOWER(:n) AND player_uuid <> :u LIMIT 1");
    $st->execute([':n' => $name, ':u' => $uuid]);
    if ($st->fetch()) fail("Nama '$name' sudah dipakai pemain lain.", 'NAME_TAKEN');

    // ---------------------------------------------------------- CLAIM NAME
    if ($action === 'claim_name') {
        $st = $pdo->prepare("UPDATE $table SET player_name = :n WHERE player_uuid = :u");
        $st->execute([':n' => $name, ':u' => $uuid]);
        respond(['success' => true, 'player_name' => $name]);
    }

    // -------------------------------------------------------------- SUBMIT
    if ($action === 'submit') {
        $score = (int)($in['score'] ?? 0);
        $chain = max(0, min(255, (int)($in['max_chain'] ?? 0)));
        $level = max(1, min(999, (int)($in['level'] ?? 1)));
        $clears = max(0, (int)($in['clears'] ?? 0));
        $duration = max(0, (int)($in['duration_sec'] ?? 0));

        // Validasi kewajaran (anti-curang ringan).
        $maxPerClear = 80 * 160 * 8 * (1 + 0.1 * ($level - 1)) * 2;
        $maxScore = $clears * $maxPerClear + $duration * 200 + 1000;
        $levelOk = $level <= 1 + intdiv($clears, 5);
        if ($score < 0 || $score > $maxScore || !$levelOk || $duration < 5 || $duration > 6 * 3600) {
            fail('Skor tidak valid.', 'INVALID_SCORE');
        }

        $st = $pdo->prepare("SELECT id, score, duration_sec, last_submit FROM $table WHERE player_uuid = :u AND week_start = :w");
        $st->execute([':u' => $uuid, ':w' => $weekStart]);
        $row = $st->fetch();
        $nowTs = time();

        if ($row && $nowTs - (int)$row['last_submit'] < 10) fail('Terlalu cepat, coba lagi sebentar.', 'RATE_LIMIT');

        $newBest = false;
        if (!$row) {
            $st = $pdo->prepare("INSERT INTO $table (player_uuid, player_name, week_start, score, max_chain, level, clears, duration_sec, last_submit)
                VALUES (:u, :n, :w, :s, :c, :l, :cl, :d, :t)");
            $st->execute([':u' => $uuid, ':n' => $name, ':w' => $weekStart, ':s' => $score, ':c' => $chain, ':l' => $level, ':cl' => $clears, ':d' => $duration, ':t' => $nowTs]);
            $newBest = true;
        } elseif ($score > (int)$row['score'] || ($score === (int)$row['score'] && $duration < (int)$row['duration_sec'])) {
            $st = $pdo->prepare("UPDATE $table SET player_name = :n, score = :s, max_chain = :c, level = :l, clears = :cl,
                duration_sec = :d, last_submit = :t, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            $st->execute([':n' => $name, ':s' => $score, ':c' => $chain, ':l' => $level, ':cl' => $clears, ':d' => $duration, ':t' => $nowTs, ':id' => $row['id']]);
            $newBest = true;
        } else {
            $st = $pdo->prepare("UPDATE $table SET player_name = :n, last_submit = :t WHERE id = :id");
            $st->execute([':n' => $name, ':t' => $nowTs, ':id' => $row['id']]);
        }
        // Samakan nama di semua minggu milik pemain ini.
        $st = $pdo->prepare("UPDATE $table SET player_name = :n WHERE player_uuid = :u");
        $st->execute([':n' => $name, ':u' => $uuid]);

        $best = $newBest ? $score : (int)$row['score'];
        $st = $pdo->prepare("SELECT COUNT(*) FROM $table WHERE week_start = :w AND score > :s");
        $st->execute([':w' => $weekStart, ':s' => $best]);
        $rankWeekly = 1 + (int)$st->fetchColumn();

        $st = $pdo->prepare("SELECT MAX(score) FROM $table WHERE player_uuid = :u");
        $st->execute([':u' => $uuid]);
        $rankAll = allTimeRank($pdo, $table, (int)$st->fetchColumn());

        respond(['success' => true, 'new_best' => $newBest, 'rank_weekly' => $rankWeekly, 'rank_alltime' => $rankAll, 'week_start' => $weekStart]);
    }

    fail('Aksi tidak dikenal.');
} catch (PDOException $e) {
    error_log('SandTilt leaderboard: ' . $e->getMessage());
    fail('Terjadi kesalahan server.', 'SERVER_ERROR');
}
