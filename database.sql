-- =============================================================================
-- DATABASE LEADERBOARD — SANDTILT
-- Mata Kuliah : Teknik Pengembangan Game (TPG)
-- Prefix tabel: NRP pengunggah. Ganti 5025231131 kalau yang mengunggah berbeda,
-- dan samakan dengan TABLE_LEADERBOARD di api/db_config.php.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `5025231131_sandtilt_leaderboard` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `player_uuid`  VARCHAR(64) NOT NULL,
    `player_name`  VARCHAR(16) NOT NULL,
    `week_start`   DATE NOT NULL,                 -- Senin 00:00 WIB, dihitung di server
    `score`        INT NOT NULL,
    `max_chain`    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `level`        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `clears`       INT NOT NULL DEFAULT 0,
    `duration_sec` INT NOT NULL DEFAULT 0,
    `last_submit`  INT NOT NULL DEFAULT 0,        -- unix time, untuk rate limit
    `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_player_week` (`player_uuid`, `week_start`),
    INDEX `idx_week_score` (`week_start`, `score`),
    INDEX `idx_player_name` (`player_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catatan:
-- 1 baris per pemain per minggu, berisi skor terbaiknya minggu itu.
-- Peringkat all-time = MAX(score) per player_uuid dari semua minggu.
