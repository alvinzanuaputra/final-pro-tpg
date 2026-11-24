# final-pro-tpg — SandTilt

Final Project Teknik Pengembangan Game: tetris pasir yang bisa dimiringkan.
Piece hancur jadi pasir. Sambungkan satu warna dari dinding kiri ke kanan untuk menghapusnya, lalu picu reaksi berantai.
Rancangan lengkap ada di [docs/GDD-azhar.md](docs/GDD-azhar.md).

## Menjalankan di laptop

Butuh PHP (untuk API leaderboard). Dari folder ini:

```
php -S localhost:8000
```

Lalu buka http://localhost:8000. Tanpa konfigurasi database, API otomatis memakai SQLite lokal (`api/database_simulasi.sqlite`).

URL berguna untuk tes:
- `?seed=123` — urutan piece tetap (bisa direproduksi)
- Di console: `render_game_to_text()`, `advanceTime(ms)`, `sandtilt.startGame()`

## Kontrol

| Aksi | Keyboard | Layar sentuh |
|---|---|---|
| Geser | ← → / A D | ◀ ▶ |
| Putar | ↑ / X / W (Z berlawanan) | PUTAR |
| Soft drop | ↓ / S | ▼ |
| Hard drop | Spasi | JATUH |
| Miring kiri/kanan (tahan) | Q / E | MIRING KIRI / KANAN |
| Jeda | P / Esc | II |
| Suara / layar penuh | M / F | — |

## Struktur

```
index.html, style.css
js/
  config.js        semua angka tuning
  sim.js           simulasi pasir + deteksi jembatan (BFS)
  pieces.js        tetromino + 7-bag
  game.js          aturan game (tanpa DOM/canvas)
  render.js        gambar pixel art + efek
  font.js          bitmap font 3x5
  audio.js         SFX sintesis WebAudio
  input.js         keyboard + tombol sentuh → aksi
  achievements.js  prestasi & easter egg
  leaderboard.js   klien API + fallback offline
  main.js          loop, layar menu, wiring
api/
  leaderboard.php        get / submit / claim_name
  db_config.example.php  salin jadi db_config.php di server
database.sql             tabel leaderboard (prefix NRP)
```

## Upload ke gameedukasi.com

1. Salin `api/db_config.example.php` menjadi `api/db_config.php`, isi `DB_HOST`, `DB_USER`, `DB_PASS` server. **Jangan commit file ini.**
2. Pastikan prefix NRP di `database.sql` sama dengan `TABLE_LEADERBOARD` di `db_config.php`.
3. Zip: `index.html`, `style.css`, `js/`, `api/` (tanpa file `.sqlite`), `database.sql`.
