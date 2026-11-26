# Rencana Trailer — SandTilt

Target: trailer gaya **Steam / showcase** (halaman toko, itch.io, presentasi kelas, festival indie).

## 1. Acuan format

| | Keputusan | Alasan |
|---|---|---|
| Durasi | **~60 detik** (versi utama) + **15 detik** (cutdown vertikal untuk sosmed) | Penonton Steam sering berhenti di 30–45 dtk; 60 dtk cukup untuk 3 mekanik |
| Resolusi | **1920×1080, 60 fps**, H.264, audio AAC, ~-14 LUFS | Spesifikasi aman Steam/YouTube; pasir bergerak halus di 60 fps |
| Pembuka | **Gameplay di 3 detik pertama**, logo di akhir | Aturan utama trailer Steam: jangan buka dengan logo/tim |
| Teks | Kalimat pendek (2–4 kata), bahasa Inggris untuk Steam; versi Indonesia opsional untuk kelas | Bisa dibaca tanpa suara (autoplay Steam = mute) |
| Musik | `assets/music/game.mp3` (orisinal) + SFX game asli | Bebas lisensi, identitas game konsisten |
| Penutup | Logo SANDTILT + "Play free in your browser" + URL `sandtilt.vercel.app` | CTA jelas |

## 2. Storyboard

> **Versi yang dirender (draft 1, 46 dtk, 26 bar musik 132 BPM):** crumble (close-up → TETRIS THAT CRUMBLES) · tilt (TILT THE BOARD) ·
> bridge (CONNECT WALL TO WALL) · chain ×4 + trofi (CHAIN REACTIONS, angka X2-X4) · mesiu (GUNPOWDER GOES BOOM) ·
> gempa / angin / papan miring (masing-masing 1,5 bar) · kartu 12 ACHIEVEMENTS / GLOBAL LEADERBOARD / KEYBOARD OR TOUCH ·
> nyaris kalah (ONE PIECE FROM DEFEAT, detak jantung) · logo. Timeline lengkap: `trailer/src/Trailer.tsx` (`BEATS`).
> Tabel di bawah adalah rencana awal 60 dtk.

### Rencana awal (60 dtk, mengikuti ketukan musik)

| Waktu | Shot | Teks di layar | Audio |
|---|---|---|---|
| 0–3 | Close-up: tetromino mendarat → **pecah jadi pasir** (zoom 2–3×) | — | `land-sand` keras, musik masuk |
| 3–8 | Papan penuh warna, pasir longsor | **TETRIS THAT CRUMBLES** | |
| 8–15 | Pemain menahan Q/E, papan miring ±3°, pasir mengalir ke dinding | **TILT THE WORLD** | `tilt-slide` |
| 15–22 | Jembatan warna menyentuh kiri–kanan → kedip putih → larut | **BRIDGE WALL TO WALL** | `clear` |
| 22–30 | **Chain** ×2 → ×3 → ×4, angka chain membesar | **CHAIN REACTIONS** | nada `chain` naik |
| 30–38 | Mesiu menyala → **ledakan** (shake + flash), batu meluncur | **GUNPOWDER. STONE.** | `explode`, `quake-rumble` |
| 38–46 | Montase cepat event: angin, gempa, miring paksa, level-up (cut tiap 1 ketukan) | **CHAOS EVERY LEVEL** | `wind`, `jingle-level` |
| 46–52 | Trofi muncul, leaderboard online, tombol sentuh di HP | **ACHIEVEMENTS · GLOBAL LEADERBOARD · PLAY ANYWHERE** | `trophy-gold` |
| 52–56 | Momen paling dramatis (garis bahaya + heartbeat → clear besar menyelamatkan) | — | `heartbeat` → hening → `explode` |
| 56–60 | Logo SANDTILT persis layar judul game (hujan pasir, huruf blok) + CTA + kredit kecil (Azhar & Alvin) | **PLAY FREE IN YOUR BROWSER** | musik ditutup |

Cutdown 15 dtk (9:16): shot 0–3, 8–15, 22–30 (dipendekkan), 30–38, logo.

## 3. Pipeline teknis

```
game (seed + advanceTime)  ──Playwright──▶  frame PNG per shot (1:1 deterministik, tanpa drop frame)
                                              │
                                              ▼
                     trailer/ (Remotion, React)  ◀── musik + SFX dari assets/
                     teks kinetik, zoom/pan, shake, transisi, logo
                                              │
                                              ▼
                        render MP4 1080p60  ──ffmpeg──▶  cek loudness, cutdown 9:16, GIF Steam
```

1. **Rekam footage** — skrip Playwright (`trailer/capture/`) membuka game dengan `?seed=N`, memainkan input yang sudah ditulis (skrip "demo replay"), memanggil `advanceTime(1000/60)` per frame dan menyimpan canvas. Hasil: gameplay sempurna 60 fps tanpa lag perekam, dan bisa direkam ulang kapan saja.
   - Perlu seed + urutan input yang menghasilkan momen bagus (chain ×4, ledakan mesiu). Bisa juga dibantu "mode trailer" kecil di game (`?trailer=1`): sembunyikan HUD tertentu, papan diisi skenario siap pakai.
2. **Komposisi** — proyek Remotion di `trailer/` (terpisah dari game; dimasukkan ke `.vercelignore`, tidak ikut zip gameedukasi). Logo, warna, dan huruf diambil langsung dari kode game, lihat [BRAND.md](BRAND.md).
3. **Finishing** — ffmpeg-skill: normalisasi -14 LUFS, cek spesifikasi YouTube, buat versi vertikal 15 dtk dan GIF/WebM pendek untuk deskripsi Steam.

## 4. Skill & agent yang dipakai

| Komponen | Untuk |
|---|---|
| `develop-web-game` (sudah ada) | Klien Playwright + hook `advanceTime`/`render_game_to_text` untuk merekam |
| `remotion` (**baru**) | Komposisi video React: sequence, teks animasi, transisi, audio |
| `ffmpeg-skill` (**baru**) | Loudness, export per platform, cutdown, contact sheet untuk cek hasil |
| agent `video-editor` (**baru**) | Asisten potong/transisi/color berbasis FFmpeg |
| agent `game-designer` (sudah ada) | Memilih momen paling "menjual" dan menyusun skenario demo |

## 5. Yang perlu disiapkan

- [ ] **FFmpeg** belum terpasang di laptop (`winget install Gyan.FFmpeg`). Remotion membawa ffmpeg sendiri, jadi ini hanya untuk tahap finishing.
- [ ] Python 3.13 sudah ada (syarat ffmpeg-skill ≥ 3.10). Node 24 sudah ada.
- [ ] Playwright + Chromium untuk perekaman (`npm i -D playwright` di `trailer/`).
- [ ] Keputusan: bahasa teks (EN / ID / dua versi), dan apakah boleh menambah `?trailer=1` di kode game.

## 6. Urutan kerja

1. Setup `trailer/` (Remotion + Playwright), tambahkan ke `.vercelignore`.
2. Skrip rekam + 1 shot uji (pasir pecah, 3 dtk) → cek kualitas.
3. Cari seed/skenario untuk tiap shot di storyboard, rekam semua.
4. Rakit di Remotion mengikuti ketukan musik; render draft.
5. Review bersama Alvin → revisi → render final + cutdown + GIF.
