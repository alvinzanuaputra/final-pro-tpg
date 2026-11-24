<?php
// =============================================================================
// KONFIGURASI DATABASE — SANDTILT
// Salin file ini menjadi db_config.php lalu isi kredensial server.
// db_config.php TIDAK di-commit ke git (lihat .gitignore).
// Kalau DB_HOST kosong / MySQL gagal, otomatis pakai SQLite lokal untuk tes.
// =============================================================================

define('DB_HOST', '');            // contoh di server: 'localhost'
define('DB_NAME', 'tpg_game');
define('DB_USER', '');
define('DB_PASS', '');
define('DB_PORT', 3306);

// Prefix tabel = NRP pengunggah (lihat database.sql)
define('TABLE_LEADERBOARD', '5025231131_sandtilt_leaderboard');

function getDBConnection()
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $opts = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    // 1. MySQL (server gameedukasi)
    if (DB_HOST !== '') {
        try {
            $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $opts + [PDO::ATTR_TIMEOUT => 2, PDO::ATTR_EMULATE_PREPARES => false]);
            $pdo->exec("SET time_zone = '+07:00'");
            return $pdo;
        } catch (PDOException $e) {
            error_log('SandTilt MySQL gagal: ' . $e->getMessage());
        }
    }

    // 2. SQLite lokal untuk pengujian
    try {
        $pdo = new PDO('sqlite:' . __DIR__ . '/database_simulasi.sqlite', null, null, $opts);
        $pdo->exec('CREATE TABLE IF NOT EXISTS `' . TABLE_LEADERBOARD . '` (
            `id` INTEGER PRIMARY KEY AUTOINCREMENT,
            `player_uuid` TEXT NOT NULL,
            `player_name` TEXT NOT NULL,
            `week_start` TEXT NOT NULL,
            `score` INTEGER NOT NULL,
            `max_chain` INTEGER NOT NULL DEFAULT 0,
            `level` INTEGER NOT NULL DEFAULT 1,
            `clears` INTEGER NOT NULL DEFAULT 0,
            `duration_sec` INTEGER NOT NULL DEFAULT 0,
            `last_submit` INTEGER NOT NULL DEFAULT 0,
            `created_at` TEXT DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (`player_uuid`, `week_start`)
        )');
        return $pdo;
    } catch (Exception $e) {
        error_log('SandTilt SQLite gagal: ' . $e->getMessage());
        return null;
    }
}
