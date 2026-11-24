# final-pro-tpg — SandTilt

Final Project Teknik Pengembangan Game: tetris pasir yang bisa dimiringkan.
Piece hancur jadi pasir. Sambungkan satu warna dari dinding kiri ke kanan untuk menghapusnya, lalu picu reaksi berantai.
Rancangan lengkap ada di [docs/GDD-azhar.md](docs/GDD-azhar.md).

## Menjalankan di laptop

Dengan PHP (game + API leaderboard):

```
php -S localhost:8000
```

Tanpa PHP (game saja, leaderboard otomatis mode offline):

```
python3 -m http.server 8001
```

Lalu buka http://localhost:8000 (atau :8001). Tanpa konfigurasi database, API otomatis memakai SQLite lokal (`api/database_simulasi.sqlite`).

URL berguna untuk tes:
- `?seed=123` — urutan piece tetap (bisa direproduksi)
- Di console: `render_game_to_text()`, `advanceTime(ms)`, `sandtilt.startGame()`, `sandtilt.audio()`

## Tombol sentuh

Di perangkat layar sentuh, tombol muncul dengan **posisi** ala konsol genggam (gayanya tetap pixel datar seperti UI game):
- **HP tegak:** game di atas, D-pad kiri & A/B kanan di bawahnya, L/R di pojok atas, SELECT/START paling bawah.
- **HP miring:** D-pad kiri, game di tengah, A/B kanan, L/R di pojok atas, SELECT/START di bawah D-pad.
- Di desktop (keyboard) tombol disembunyikan. Paksa tampil untuk tes: `?pad=1`.

## Kontrol

| Aksi | Keyboard | Tombol sentuh |
|---|---|---|
| Geser | ← → / A D | D-pad ◀ ▶ |
| Soft drop | ↓ / S | D-pad ▼ |
| Hard drop | Spasi | D-pad ▲ |
| Putar | ↑ / X / W | A |
| Putar balik | Z | B |
| Miring kiri/kanan (tahan) | Q / E | L / R |
| Jeda | P / Esc | START |
| Suara (semua → efek saja → mati) | M | SELECT |
| Menu: pilih / kembali | Enter / Esc | A atau START / B |
| Layar penuh | F | — |

## Audio

- Efek suara dari paket Kenney (CC0) + angin buatan sendiri, dipicu per kejadian: mendarat per material (pasir/batu/mesiu, posisi stereo sesuai letak di papan), hard drop, miring, clear (nada naik per chain), ledakan, gempa, angin, papan miring paksa, detak jantung saat bahaya, jingle naik level, game over, dan trofi per tingkat.
- Musik chiptune orisinal: `title` di menu, `game` saat bermain; teredam saat pasir melewati garis bahaya, meredup sesaat saat ledakan/jingle.
- Detail sumber & lisensi: [assets/CREDITS.md](assets/CREDITS.md).

## Struktur

```
index.html, style.css      layar game + tombol sentuh (portrait/landscape)
assets/
  sfx/  music/  image/  font/   aset game (lihat assets/CREDITS.md)
tools/                     skrip pembuat aset (SFX, musik, ikon trofi)
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
