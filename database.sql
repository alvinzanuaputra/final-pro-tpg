-- =============================================================================
-- DATABASE LEADERBOARD — SANDTILT (versi gameedukasi, MySQL)
-- Mata Kuliah : Teknik Pengembangan Game (TPG)
-- Prefix tabel: NRP pengunggah (sekarang 5025231064) + "_sandtilt".
-- Samakan dengan TABLE_PREFIX di api/db_config.php.
--
-- Catatan: leaderboard UTAMA ada di server pusat (Vercel + Neon, lihat server/schema.sql).
-- Tabel di sini dipakai kalau server pusat tidak bisa dihubungi dari gameedukasi.
-- =============================================================================

-- Pemain. Token rahasia pemain hanya disimpan sebagai hash; papan hanya menampilkan public_id.
CREATE TABLE IF NOT EXISTS `5025231064_sandtilt_players` (
    `public_id`  CHAR(16) NOT NULL PRIMARY KEY,
    `key_hash`   CHAR(64) NOT NULL,
    `name`       VARCHAR(16) NOT NULL,
    `name_lower` VARCHAR(16) NOT NULL,
    `created_at` INT NOT NULL,                     -- unix detik
    UNIQUE KEY `uq_key` (`key_hash`),
    UNIQUE KEY `uq_name` (`name_lower`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Skor terbaik per pemain per minggu (Senin 00:00 WIB). All-time = MAX(score) per pemain.
CREATE TABLE IF NOT EXISTS `5025231064_sandtilt_scores` (
    `player_id`    CHAR(16) NOT NULL,
    `week_start`   DATE NOT NULL,
    `score`        INT NOT NULL,
    `max_chain`    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `level`        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `clears`       INT NOT NULL DEFAULT 0,
    `duration_sec` INT NOT NULL DEFAULT 0,
    `updated_at`   INT NOT NULL,
    PRIMARY KEY (`player_id`, `week_start`),
    INDEX `idx_week_score` (`week_start`, `score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Satu baris per permainan yang dimulai. Skor hanya diterima untuk run yang belum dipakai,
-- dan durasinya dicek dengan jam server.
CREATE TABLE IF NOT EXISTS `5025231064_sandtilt_runs` (
    `run_id`     CHAR(32) NOT NULL PRIMARY KEY,
    `key_hash`   CHAR(64) NOT NULL,
    `ip_hash`    CHAR(32) NOT NULL,
    `started_at` INT NOT NULL,
    `used_at`    INT NULL,
    INDEX `idx_ip_time` (`ip_hash`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
