# final-pro-tpg — SandTilt

Final Project Teknik Pengembangan Game: tetris pasir yang bisa dimiringkan.
Piece hancur jadi pasir. Sambungkan satu warna dari dinding kiri ke kanan untuk menghapusnya, lalu picu reaksi berantai.
Rancangan lengkap ada di [docs/GDD-azhar.md](docs/GDD-azhar.md).

## Menjalankan di laptop

**Paling mudah:** klik ganda `index.html`. Game langsung jalan di browser (Chrome, Safari, Edge) tanpa server; leaderboard otomatis mode offline.

Dengan PHP (game + API leaderboard):

```
php -S localhost:8000
```

Tanpa PHP (game saja, leaderboard offline):

```
python3 -m http.server 8001
```

### Setelah mengubah kode di `js/`

`index.html` memuat **`sandtilt.js`**, yaitu gabungan semua file `js/` dalam satu skrip biasa. Ini yang membuat game bisa dibuka lewat klik ganda (browser memblokir ES module di `file://`). Setiap kali ada file di `js/` yang diubah, bangun ulang:

```
node tools/build-bundle.mjs
```

Skrip yang sama juga membuat `assets/audio-data.js` (semua audio dalam base64), yang hanya dipakai saat dibuka lewat `file://` karena browser juga memblokir `fetch()` ke file lokal.

URL berguna untuk tes:
- `?seed=123` — urutan piece tetap (bisa direproduksi)
- `?pad=1` — paksa tombol sentuh tampil di desktop
- Di console: `render_game_to_text()`, `advanceTime(ms)`, `sandtilt.startGame()`, `sandtilt.audio()`

## Tombol sentuh

Di layar sentuh muncul tombol bergaya konsol genggam (D-pad salib, A/B bulat, bahu L/R, MENU), posisinya disesuaikan agar besar dan pas di jempol:

| Tombol | Saat bermain | Di menu |
|---|---|---|
| D-pad ▲ | jatuh instan | naik |
| D-pad ◀ ▶ | geser | ganti tab |
| D-pad ▼ | turun pelan (tahan) | turun |
| A | putar | pilih |
| B | putar balik | kembali |
| L / R (tahan) | miring kiri / kanan | — |
| MENU | jeda + pengaturan (lanjut, ulang, suara, tema, menu utama) | kembali |

- **HP tegak:** game di atas; L di atas D-pad, R di atas A/B (sejajar); MENU di tengah bawah. **HP miring:** [L + D-pad] | game | [R + A/B], MENU di bawah D-pad.
- Ukuran D-pad & A/B menyesuaikan lebar dan tinggi layar, jadi game tetap besar di layar pendek.
- Tinggi halaman mengikuti area yang benar-benar terlihat (`visualViewport`) plus safe area, jadi tombol tidak tertutup bilah Safari/Chrome di iOS maupun Android.
- Desktop dengan keyboard: tombol disembunyikan (`?pad=1` untuk memaksa tampil). Layar judul punya menu **PENGATURAN** (suara, tema).

## Kontrol keyboard

| Aksi | Tombol |
|---|---|
| Geser | ← → / A D |
| Turun pelan | ↓ / S |
| Jatuh instan | Spasi |
| Putar / putar balik | ↑ X W / Z |
| Miring kiri/kanan (tahan) | Q / E |
| Jeda | P / Esc |
| Suara (semua → efek saja → mati) | M |
| Layar penuh | F |

## Audio

- Efek suara dari paket Kenney (CC0) + angin buatan sendiri, dipicu per kejadian: mendarat per material (pasir/batu/mesiu, posisi stereo sesuai letak di papan), hard drop, miring, clear (nada naik per chain), ledakan, gempa, angin, papan miring paksa, detak jantung saat bahaya, jingle naik level, game over, dan trofi per tingkat.
- Musik chiptune orisinal: `title` di menu, `game` saat bermain; teredam saat pasir melewati garis bahaya, meredup sesaat saat ledakan/jingle.
- Detail sumber & lisensi: [assets/CREDITS.md](assets/CREDITS.md).

## Struktur

```
index.html, style.css      layar game + tombol sentuh (portrait/landscape)
sandtilt.js                gabungan js/ (otomatis, jangan diedit) → bisa dibuka lewat klik ganda
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
3. Jalankan `node tools/build-bundle.mjs`, lalu zip: `index.html`, `style.css`, `sandtilt.js`, `assets/`, `api/` (tanpa file `.sqlite`), `database.sql`. Folder `js/` tidak wajib ikut (sumber kode).
