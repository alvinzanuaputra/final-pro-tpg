-- =============================================================================
-- SKEMA LEADERBOARD PUSAT — SANDTILT (Postgres / Neon, dipakai Vercel Function)
-- Tidak wajib dijalankan manual: api/leaderboard.js membuat tabel ini otomatis.
-- Versi MySQL untuk gameedukasi ada di database.sql (root).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sandtilt_players (
    public_id  TEXT PRIMARY KEY,          -- hash token (16 hex), satu-satunya ID yang tampil di papan
    key_hash   TEXT NOT NULL UNIQUE,      -- sha256 token rahasia pemain
    name       TEXT NOT NULL,
    name_lower TEXT NOT NULL UNIQUE,      -- nama unik tanpa beda huruf besar/kecil
    created_at BIGINT NOT NULL            -- unix detik
);

CREATE TABLE IF NOT EXISTS sandtilt_scores (
    player_id    TEXT NOT NULL,           -- = sandtilt_players.public_id
    week_start   TEXT NOT NULL,           -- 'YYYY-MM-DD', Senin 00:00 WIB
    score        INTEGER NOT NULL,
    max_chain    INTEGER NOT NULL DEFAULT 0,
    level        INTEGER NOT NULL DEFAULT 1,
    clears       INTEGER NOT NULL DEFAULT 0,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    updated_at   BIGINT NOT NULL,
    PRIMARY KEY (player_id, week_start)
);
CREATE INDEX IF NOT EXISTS sandtilt_scores_week ON sandtilt_scores (week_start, score);

-- Satu baris per permainan yang dimulai; skor hanya diterima untuk run yang belum dipakai.
CREATE TABLE IF NOT EXISTS sandtilt_runs (
    run_id     TEXT PRIMARY KEY,
    key_hash   TEXT NOT NULL,
    ip_hash    TEXT NOT NULL,
    started_at BIGINT NOT NULL,
    used_at    BIGINT
);
CREATE INDEX IF NOT EXISTS sandtilt_runs_ip ON sandtilt_runs (ip_hash, started_at);
