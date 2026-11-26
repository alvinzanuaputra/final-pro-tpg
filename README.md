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

`index.html` memuat **`script.js`**, yaitu gabungan semua file `js/` dalam satu skrip biasa. Ini yang membuat game bisa dibuka lewat klik ganda (browser memblokir ES module di `file://`). Setiap kali ada file di `js/` yang diubah, bangun ulang:

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
script.js                  gabungan js/ (otomatis, jangan diedit) → bisa dibuka lewat klik ganda
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
  leaderboard.js         API PUSAT (Vercel Function, Node) — dipakai semua platform
  leaderboard.php        API cadangan untuk gameedukasi (protokol sama)
  db_config.example.php  salin jadi db_config.php di server gameedukasi
server/
  leaderboard-core.js    logika API pusat (tanpa ketergantungan database tertentu)
  schema.sql             tabel Postgres/Neon (dibuat otomatis)
database.sql             tabel MySQL gameedukasi (prefix NRP)
package.json             dependensi Vercel Function (@neondatabase/serverless)
```

## Leaderboard

Satu papan peringkat untuk semua platform, dilayani **API pusat di Vercel**: `https://sandtilt.vercel.app/api/leaderboard`.

| Game dibuka dari | Server yang dipakai |
|---|---|
| `*.vercel.app` | `/api/leaderboard` di domain itu sendiri |
| gameedukasi.com & platform lain | API pusat; kalau tidak bisa dihubungi → `api/leaderboard.php` lokal → offline |
| `localhost` / `127.0.0.1` | `api/leaderboard.php` lokal saja (tes tidak mengotori papan pusat) |
| klik ganda (`file://`) | offline |

Paksa satu server dengan `?lb=central`, `?lb=php`, atau `?lb=off`.

**Keamanan & anti-curang** (sama di versi Node dan PHP):
- Tiap pemain punya **token rahasia** di localStorage. Server hanya menyimpan hash-nya; papan hanya menampilkan `public_id`, jadi identitas pemain lain tidak bisa dicuri dari papan.
- Saat game mulai, klien membuka **run** di server (`start_run`). Skor hanya diterima untuk run itu, **sekali pakai**, dan durasi permainan dicek dengan jam server.
- Pembukaan run dibatasi **30 per 10 menit per IP**, ditambah uji kewajaran skor (skor vs jumlah clear, level, durasi).
- API pusat hanya menerima panggilan browser dari origin yang diizinkan (CORS): domain Vercel sendiri, gameedukasi.com, itch.io (`*.itch.zone`), localhost. Tambah origin lain lewat variabel `ALLOWED_ORIGINS`.
- Catatan jujur: skor dari game browser tidak bisa 100% aman (kode klien bisa diubah). Lapisan di atas membuat curang jauh lebih repot.

### Menyiapkan API pusat di Vercel (sekali saja)

1. Buka project **sandtilt** di dashboard Vercel → **Storage** → **Create Database** → **Neon** (paket gratis) → hubungkan ke project ini untuk semua environment. Variabel `DATABASE_URL` terisi otomatis.
2. (Opsional) **Settings → Environment Variables**: `IP_SALT` = teks acak; `ALLOWED_ORIGINS` = origin tambahan, pisahkan koma (mis. `https://user.github.io`).
3. **Redeploy.** Tabel dibuat otomatis saat API pertama kali dipanggil (skema: `server/schema.sql`).
4. Cek: buka `https://sandtilt.vercel.app/api/leaderboard?action=get` → harus `{"success":true,...}`. Kalau `NO_DB`, langkah 1 belum tersambung.

`.vercelignore` membuang file PHP dari deploy Vercel (Vercel tidak menjalankan PHP; tanpa ini source-nya tersaji sebagai teks).

### Tes API

```
node tools/test-leaderboard-api.mjs                                    # logika Node + SQLite
php -S 127.0.0.1:8765                                                  # lalu, di terminal lain:
node tools/test-leaderboard-api.mjs http://127.0.0.1:8765/api/leaderboard.php
```

## Upload ke gameedukasi.com

Versi gameedukasi memakai API pusat yang sama (satu papan dengan Vercel); PHP + MySQL di sana jadi cadangan.

1. Salin `api/db_config.example.php` menjadi `api/db_config.php`, isi `DB_HOST`, `DB_USER`, `DB_PASS` server, dan ganti `IP_SALT`. **Jangan commit file ini.**
2. Pastikan prefix di `database.sql` sama dengan `TABLE_PREFIX` di `db_config.php`, lalu jalankan `database.sql` (3 tabel: `_players`, `_scores`, `_runs`).
3. Jalankan `node tools/build-bundle.mjs`, lalu zip: `index.html`, `style.css`, `script.js`, `assets/`, `api/` (hanya `leaderboard.php` dan `db_config.php`, tanpa `.sqlite` dan `leaderboard.js`), `database.sql`. Folder `js/`, `server/`, `tools/`, `node_modules/`, dan `package.json` tidak perlu ikut.
4. Kalau alamat gameedukasi bukan `gameedukasi.com` / `www.gameedukasi.com`, tambahkan origin-nya ke `ALLOWED_ORIGINS` di Vercel. Kalau tidak, game di sana memakai papan PHP lokal.
