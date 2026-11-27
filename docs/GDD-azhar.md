# Game Design Document — SandTilt *(judul sementara)*

> Versi rencana **Azhar**. Akan dibandingkan dan digabung dengan rencana Alvin.
> Final Project Teknik Pengembangan Game (TPG) · Tim: Azhar & Alvin Zanua Putra
> Target playable: **Senin, 8 Desember 2026 (Pertemuan 14)**

---

## 1. Ringkasan

| | |
|---|---|
| **Pitch** | Tetris yang hancur jadi pasir. Miringkan papan untuk mengalirkan pasir, sambungkan satu warna dari dinding kiri ke kanan, lalu picu reaksi berantai. |
| **Genre** | Puzzle / arcade, endless |
| **Game acuan** | Tetris klasik + simulasi *falling sand* (cellular automata) |
| **Peningkatan utama** | (1) **Kaskade berantai**, (2) **Tilt** (memiringkan papan), (3) **Material Mesiu & Batu**, (4) **Event pengganggu**, (5) **Achievement & easter egg**, (6) **Leaderboard online mingguan & all-time** |
| **Platform** | Web (HTML5 Canvas), di-upload ke gameedukasi.com (file web + API PHP + database MySQL) |
| **Kontrol** | Keyboard (utama) + layar sentuh (tombol on-screen) |
| **Durasi sesi** | 3–8 menit per run |
| **Gaya visual** | Pixel art, palet terbatas, latar gelap |

---

## 2. Core Gameplay Loop

```
Lihat NEXT piece → geser/putar → piece mendarat → hancur jadi pasir
      ↑                                                    ↓
   skor & chain  ← kaskade ← pasir runtuh ← CLEAR ← (tilt untuk merapikan)
```

- **Detik ke detik:** atur piece, tilt untuk mengalirkan pasir ke celah, dan bentuk jembatan warna.
- **Per run:** mode Endless, level naik setiap 5 clear. Run selesai saat game over, lalu muncul layar hasil.
- **Meta:** high score, chain terbaik, achievement, dan palet warna yang sudah terbuka (disimpan di `localStorage`), plus **peringkat di leaderboard mingguan dan all-time** (online, lihat bagian 6).

---

## 3. Mekanik

### 3.1 Piece & Pasir
- 7 tetromino standar (I, O, T, S, Z, J, L). Setiap piece punya **satu warna** acak dari warna yang sedang aktif.
- Urutan bentuk memakai sistem *7-bag* (adil, tidak ada kekeringan piece I).
- 1 blok = **8×8 butir**. Papan = 10×20 blok = **80×160 butir**.
- Saat menyentuh pasir atau lantai, piece **langsung hancur jadi butir pasir** yang mewarisi warnanya. Setiap butir diberi variasi gelap/terang acak (*shade* 0–3) sebagai tekstur.
- Aturan butir per tick: turun ke bawah → kalau terhalang, coba diagonal bawah (sisi diacak) → kalau tidak bisa, diam.

### 3.2 Clear (Jembatan)
- Satu kelompok butir **warna sama** yang tersambung (8 arah, termasuk diagonal) dan menyentuh **dinding kiri dan kanan** akan dihapus.
- Animasi clear: kelompok berkedip putih (~300 ms, sim di-pause), lalu larut jadi partikel.

### 3.3 Kaskade / Chain
- Setelah clear, pasir di atasnya runtuh. Kalau runtuhan itu membentuk jembatan baru, terjadi **chain** berikutnya.
- Chain dihitung terus sampai pasir diam tanpa clear baru.
- Saat chain berlangsung, piece berikutnya **ditahan** sampai pasir diam.

### 3.4 Tilt (Memiringkan Papan)
- **Tahan** **Q** (kiri) / **E** (kanan). Selama ditahan, gravitasi pasir condong ke sisi itu: butir meluncur diagonal dan ke samping.
- Dibatasi **meter miring**: penuh = 2 detik miring. Meter terisi lagi (penuh dalam 4 detik) mulai 0,4 detik setelah tombol dilepas. Minimal 10% untuk mulai miring.
- Kegunaan: mendorong warna sampai menyentuh dinding (syarat jembatan), meratakan gundukan yang mendekati garis bahaya, memancing kaskade, dan **melawan event Miring Paksa**.
- Tilt **tidak** menggeser piece yang sedang jatuh, hanya pasir.
- Visual: papan berotasi ±3° dengan *easing*; meter di panel berkedip saat aktif.
- **Lempar pasir:** tahan Q lalu langsung ganti ke E (atau sebaliknya, jeda ≤ 0,15 detik) → butir permukaan di sisi yang menumpuk **terangkat** dan terbang melengkung ke arah baru, lalu jatuh lagi.
  - Kekuatan mengikuti lama tahan arah sebelumnya (momentum): 12 butir untuk tahan sebentar sampai 100 butir untuk tahan ≥ 0,6 detik. Tinggi lemparan maksimal ±2 blok.
  - Hanya pasir & mesiu; batu terlalu berat dan tidak ikut terangkat.
  - Selama melayang, butir **tidak** dihitung jembatan maupun garis bahaya (tidak bisa membuat kalah). Butir yang jatuh di atas piece ikut menumpang sampai piece terkunci.
  - Setiap ganti arah memotong **8% meter** di luar pemakaian biasa.
- **Kocok:** spam kiri-kanan (≥ 3 ganti arah dalam 1,2 detik) → lapisan permukaan (±2 blok dari atas tiap kolom) teracak pelan seperti mengocok gelas berisi pasir (25 tukaran/tick, gempa 400). Berlanjut 0,4 detik setelah ganti arah terakhir. Dengan meter penuh, spam habis setelah sekitar 7 ganti arah.
- Angka-angkanya ada di `CFG` (`FLIP_*`, `TOSS_*`, `SLOSH_*`).

### 3.5 Material Khusus
Setiap piece punya **warna** (3–5 warna aktif) **dan material**. Material khusus muncul sesekali (tidak pernah dua kali berturut-turut). Teksturnya sudah terlihat di **preview NEXT** (plus label "BATU"/"MESIU") supaya pemain bisa bersiap. Saat pertama kali muncul di sebuah perangkat, toast memperkenalkan material itu.

| Material | Mulai muncul | Peluang | Tampilan | Perilaku |
|---|---|---|---|---|
| **Pasir** | — | sisanya | Butiran warna | Longsor diagonal, ikut tilt, gempa, dan papan miring. |
| **Mesiu** | Level 2 | 8% → 14% (lihat 4.2) | Warna sangat gelap + bintik api oranye | Longsor seperti pasir dan **ikut jembatan warnanya**. Kalau **ikut di-clear atau bersentuhan dengan butir yang di-clear**, mesiu menyala, api merambat ke seluruh mesiu yang tersambung (warna apa pun), lalu **meledak**: semua butir dalam radius 7 butir ikut hancur, termasuk batu. |
| **Batu** | Level 7 | 3% → maks 10% (lihat 4.2) | Blok warna gelap padat: tepi atas terang, tepi bawah gelap, retakan | **Benda kaku**: setiap kelompok batu yang menyentuh bergerak **utuh sebagai satu blok** (bentuknya tidak pernah hancur atau tercerai). Jatuh lurus; kalau tertahan dan tanah miring, **meluncur** diagonal lalu ke samping mengikuti kemiringan. Tidak terdorong gempa. **Ikut jembatan warnanya** (batu merah menyambung jembatan merah). Selain lewat jembatan, hanya hancur oleh ledakan mesiu. |

- Butir yang ikut hancur karena ledakan dihitung ke skor clear dengan multiplier yang sama.
- Efek: layar bergetar kuat, kilat, percikan api oranye, teks "LEDAKAN!" / "BATU HANCUR!", dan bunyi ledakan.
- Prestasi baru: **BOOM!** (ledakan pertama) dan **PENGHANCUR BATU** (batu hancur oleh ledakan).

### 3.6 Event Pengganggu
- Event **pasti muncul** (diatur timer, bukan peluang). Event pertama 35–50 detik setelah mulai; jeda berikutnya = rata-rata level itu ±20% (tabel 4.2). Jeda level normal **tidak pernah bertambah lama**: makin tinggi level, makin sering.
- **Level boss** (5, 10, 15, …): event **pasti** muncul 3 detik setelah masuk level (`BOSS_EVENT_DELAY`), jenisnya bergiliran gempa → papan miring → angin (L5 gempa, L10 papan miring, L15 angin, L20 gempa, …).
- **Kantong jenis event** (mirip 7-bag Tetris): setiap 3 event berisi 1 gempa, 1 angin, 1 papan miring dengan urutan acak, jadi tidak ada jenis yang lama tidak muncul.
- Selalu ada **peringatan 3 detik** (banner + bunyi bip) sebelum event aktif.

| Event | Durasi | Efek | Cara menanggapi |
|---|---|---|---|
| **Gempa** | 1,6 dtk | Butir di permukaan bergoyang ke samping (gundukan merata) **dan butir di dalam tumpukan saling bertukar posisi** (radius 2), sehingga warna di tengah teracak. Batu tidak ikut. Layar bergetar | Sambungan bisa putus atau malah terbentuk jembatan baru: kadang merusak, kadang memberi clear gratis |
| **Angin** ◀/▶ | 5 dtk | Piece yang jatuh terdorong 1 blok tiap 0,45 detik | Koreksi posisi dengan geser |
| **Papan Miring** ◀/▶ | 5 dtk | Pasir dipaksa meluncur ke satu sisi (papan miring 4°) | Tahan tilt ke arah **berlawanan** untuk menahan (saling meniadakan, menghabiskan meter) |

### 3.7 Kalah
- Ada **garis bahaya** di atas papan (2 blok dari atas).
- Kalah kalau ada pasir di atas garis itu selama lebih dari **1,5 detik** berturut-turut, atau kalau piece baru tidak bisa muncul.
- Selama pasir di atas garis: border berdenyut merah dan terdengar bunyi detak.

### 3.8 Menang
- Tidak ada kondisi menang (Endless). Tujuannya adalah high score, chain terbaik, dan membuka achievement.

### 3.9 Tutorial (pemain baru)
- **Otomatis** saat pertama kali menekan MAIN di perangkat itu (`tutorialDone` di `localStorage`). Durasi ±1,5 menit.
- Tidak menambah tombol menu: di layar judul hanya ada **ikon ? di pojok kanan atas** (keyboard: **H**) yang membuka **modal CARA MAIN** di atas layar judul (teks rata tengah): ringkasan 5 poin + ilustrasi jembatan + tombol **MAIN TUTORIAL** / **KEMBALI**. Klik di luar kotak = tutup.
- **Pilih bahasa (Indonesia / Inggris):** ikon **globe** di kiri ikon ? (keyboard: **L**; label "H" tidak lagi ditampilkan, tombol H tetap membuka bantuan), atau **Pengaturan → BAHASA**. Keduanya membuka **modal BAHASA** berisi daftar bahasa (ditulis dalam bahasanya sendiri: BAHASA INDONESIA, ENGLISH), bahasa aktif ditandai titik. Pilih = langsung ganti lalu kembali ke layar asal; klik di luar kotak / Esc = tutup. Ikon globe & ? adalah glyph font setinggi 13 titik dengan garis 1 titik, jadi ukuran dan ketebalannya sama. Bawaan Indonesia; pilihan disimpan di perangkat. Semua teks ikut berganti: menu, panel, banner event, tutorial, prestasi, toast, tombol sentuh, kotak nama, dan KREDIT. Kamus ada di `js/i18n.js` (kunci = teks Indonesia, `t('MAIN')` → `PLAY`).
- 6 langkah interaktif. Langkah berikutnya baru muncul setelah aksi dilakukan. Petunjuk ada di panel samping (menggantikan skor), dengan tombol keyboard **atau** tombol sentuh sesuai perangkat:

| # | Langkah | Papan | Selesai saat |
|---|---|---|---|
| 1 | GERAK | kosong, piece melayang (tidak jatuh sendiri) | **semua** tombol sudah dicoba: geser kiri, geser kanan, putar, putar balik |
| 2 | JATUHKAN | piece jatuh pelan | turun pelan **dan** jatuh instan sudah dicoba, lalu piece mendarat → "JADI PASIR!" |
| 3 | JEMBATAN | disiapkan: lapisan merah dengan celah 2 blok + panah ke celah, dinding kiri/kanan menyala | clear pertama (piece merah I) |
| 4 | MIRING | disiapkan: pasir merah berhenti 2 blok sebelum dinding kanan + panah ke kanan | clear lewat tilt |
| 5 | BATU | lubang sedalam papan diapit dua pilar batu. Game dulu menjatuhkan balok **pasir** kuning otomatis → rontok ke lubang. Lalu pemain menjatuhkan balok **batu** merah (I) | batu tetap utuh di atas lubang, menyambung lapisan merah → clear |
| 6 | MESIU | jembatan bercelah + tumpukan batu 4×4 blok di kiri yang dialiri mesiu (dasar + 2 urat), ditandai kotak putus-putus | celah diisi piece merah → clear menyalakan mesiu → tumpukan batu meledak |

- Tombol yang sudah dicoba ditampilkan **pudar** (opacity rendah) di panel, sehingga pemain tahu tombol mana yang belum dicoba. Di langkah 5–6 contoh tekstur materialnya tampil di samping judul. Selama peragaan pasir di langkah 5, input pemain diabaikan (`rules.controls = false`).
- Gagal (tidak terjadi clear ±2 detik setelah mencoba) → papan disiapkan ulang + teks **COBA LAGI**.
- Selama tutorial: tanpa event, garis bahaya, naik level, prestasi, dan skor tidak dikirim ke peringkat.
- Bisa dilewati: Esc/P/MENU → **LEWATI TUTORIAL** (langsung main). Keluar ke menu utama juga dianggap selesai.
- Akhir: layar **SIAP MAIN!** (ingatkan garis merah; material & event baru dijelaskan toast saat pertama muncul) → MAIN SEKARANG / MENU UTAMA.

---

## 4. Skor & Progresi

### 4.1 Rumus Skor
```
skor_clear = butir_dihapus × M_level × M_chain × M_multi
M_level = 1 + 0,1 × (level − 1)
M_chain = nomor chain (1, 2, 3, … maks 8)
M_multi = 1 + 0,5 × (jumlah jembatan bersamaan − 1)
```
- Hard drop: +2 poin per baris blok yang dilewati.
- Soft drop: +1 poin per baris blok.
- Contoh: 900 butir, level 3, chain ke-2 → 900 × 1,2 × 2 = **2.160**.

### 4.2 Level & Kesulitan
- Naik level setiap **5 clear** (bukan skor), mirip Tetris modern yang naik tiap 10 baris. Dua jembatan sekaligus = 2 clear.
- Kurvanya **bergerigi**, bukan naik terus: setiap **level ke-5 adalah level boss** (event jauh lebih sering, kecepatan tidak ikut naik), dan level sesudahnya adalah **lembah** (kecepatan turun sedikit, jeda event kembali ke level normal sebelum boss) supaya pemain sempat bernapas tanpa event jadi lebih jarang dari sebelumnya.
- Di level boss, angka LEVEL di panel samping berwarna khusus (warna `boss` di tiap tema; kontras ≥ 5:1 dengan latar dan berbeda dari warna teks & aksen). Tidak ada banner.
- Kecepatan berhenti di **0,10 detik/baris** (level 40). Setelah itu kesulitan tetap naik pelan lewat event yang makin rapat dan batu yang makin sering.
- Peluang batu & mesiu di tabel adalah peluang **nyata** per piece (kode sudah mengoreksi aturan "tidak dua material khusus berturut-turut").

| Level | Tipe | Jatuh (dtk/baris) | Warna | Batu | Mesiu | Jeda event rata-rata (dtk, ±20%) |
|---|---|---|---|---|---|---|
| 1 | normal | 0,80 | 3 | – | – | 50 (event pertama 35–50) |
| 2 | normal | 0,72 | 3 | – | 8% | 48,5 |
| 3 | normal | 0,65 | 3 | – | 8% | 47 |
| 4 | normal | 0,58 | **4** | – | 8% | 45,5 |
| 5 | **boss** | 0,58 | 4 | – | 8% | **22** + event pasti (gempa) |
| 6 | lembah | 0,55 | 4 | – | 10% | 45,5 |
| 7–9 | normal | 0,50 → 0,41 | 4 | **3%** | 10% | 41 → 38 |
| 10 | **boss** | 0,41 | 4 | 3% | 10% | **18** + event pasti (papan miring) |
| 11 | lembah | 0,38 | 4 | 3% | 12% | 38 |
| 12–14 | normal | 0,35 → 0,29 | **5** | 4% | 12% | 33,5 → 30,5 |
| 15 | **boss** | 0,29 | 5 | 4% | 12% | **14,5** + event pasti (angin) |
| 16 | lembah | 0,27 | 5 | 4% | 14% | 30,5 |
| 17–19 | normal | 0,25 → 0,21 | 5 | 4% | 14% | 26 → 23 |
| 20 | **boss** | 0,21 | 5 | 4% | 14% | **11** + event pasti (gempa) |
| 21–25 | pola sama | 0,20 → 0,17 | 5 | 5% | 14% | normal 20 → 19, boss 9,5, lembah 23 |
| 26–30 | pola sama | 0,16 → **0,12** (turun 0,01/level) | 5 | 5% | 14% | normal 18,75 → 18, boss 9, lembah 19 |
| 31–34 | pola sama | 0,12 | 5 | 6% | 14% | normal 17,5 → 16,75, lembah 18 |
| 35–39 | pola sama | **0,11** | 5 | 6% | 14% | normal 16,25 → 15, boss 9 |
| 40+ | pola sama | **0,10** (minimum) | 5 | +1% tiap 10 level (L41 7% … **L71+ 10%**) | 14% | normal turun 0,25/level sampai **min 12** (L53), boss 9, lembah = normal 2 level sebelumnya |

- **Ruang napas:** saat warna baru masuk (level 4 dan 12), kecepatan memakai angka level sebelumnya selama 30 detik.
- Rumus jeda (`eventGap`): normal = 50 − 1,5 × (level − 1) sampai 20 dtk (L21), lalu −0,25/level sampai minimum 12 dtk. Boss = ½ normal (min 9) + event pasti. Lembah = normal level sebelum boss.
- Saat masuk level boss, event pasti muncul 3 detik lagi; saat masuk lembah, hitung mundur langsung dilonggarkan ke jeda lembah.
- **Mode uji** (tidak menyimpan skor/prestasi): `?jatuh=0.15` memaksa kecepatan, `?level=12` mulai di level tertentu.

### 4.3 Angka yang Bisa Di-tuning (semua di `config`)
`BLOCK_SIZE`, `CONNECT_8`, `TILT_DURATION`, `TILT_CHARGES`, `TILT_RECHARGE`, `DANGER_GRACE`, `CLEARS_PER_LEVEL`, dan tabel kesulitan per level (`levelConfig` di `js/config.js`: kecepatan, warna, batu, mesiu, jeda event).

---

## 5. Achievement & Easter Egg

Disimpan di `localStorage`. Saat terbuka muncul toast kecil, dan beberapa achievement membuka **palet warna pasir baru** (hadiah kosmetik).

### 5.1 Target (terlihat sejak awal)
| Nama | Syarat | Hadiah | Prioritas |
|---|---|---|---|
| Jembatan Pertama | Clear pertama kali | — | MVP |
| Reaksi Berantai | Chain ×3 | Palet "Senja" | MVP |
| Badai Pasir | Chain ×5 | Palet "Neon" | Nice |
| Ahli Miring | Clear < 1 detik setelah tilt | — | MVP |
| Tangan Kosong | Capai level 5 tanpa sekali pun tilt | — | Nice |
| Nyaris! | Clear saat pasir sampai ≤ 1 blok di bawah garis bahaya (atau melewatinya) | — | MVP |
| Maraton | Capai level 10 | Palet "Es" | Nice |
| Papan Bersih | Papan kosong total setelah clear | — | MVP |

### 5.2 Easter Egg (tampil "???" sampai terbuka)
| Nama | Syarat | Efek |
|---|---|---|
| Gempa | Tilt kiri-kanan 6× dalam 2 detik | Layar berguncang hebat |
| Pelangi | Semua warna aktif ter-clear dalam satu rangkaian chain | Partikel pelangi |
| Lawan Arus | Saat event Papan Miring, tahan miring ke arah **berlawanan** selama 1,5 detik (bisa di HP & desktop; banner event sudah memberi petunjuk) | Membuka menu **TEMA** di layar judul: Klasik ↔ Retro (hijau monokrom) |
| Jam Pasir | Diam 30 detik di layar judul | Pasir membentuk logo game |

---

## 6. Leaderboard Mingguan & All-Time

Tujuan: memberi alasan "main sekali lagi" di mode Endless. Reset mingguan memberi peluang pemain baru, all-time menyimpan rekor legendaris.

Pola teknisnya mengikuti game sebelumnya (Cyber Rune Hunter) yang sudah terbukti jalan di gameedukasi.com: **JS → `api/leaderboard.php` → MySQL**, dengan fallback SQLite untuk tes lokal.

### 6.1 Identitas Pemain
- **`player_uuid`**: dibuat sekali dengan `crypto.randomUUID()`, disimpan di `localStorage`. Tidak perlu login.
- **Nickname**: 2–16 karakter, diminta saat pertama kali skor akan dikirim (bisa diganti di menu).
  - Nickname **unik antar UUID**: kalau sudah dipakai pemain lain, pemain diminta pilih nama lain.
  - Tidak meminta data pribadi apa pun.
- Keterbatasan yang diterima: hapus data browser / ganti perangkat = UUID baru.

### 6.2 Aturan Periode
- **Mingguan:** periode dimulai **Senin 00:00 WIB**. Disimpan sebagai `week_start` = tanggal Senin (`YYYY-MM-DD`).
- `week_start` **dihitung di server** (PHP, zona waktu `Asia/Jakarta`), bukan dari jam browser, supaya tidak bisa diakali.
- **All-time:** skor maksimum tiap `player_uuid` dari semua minggu (tidak perlu tabel terpisah).
- Setiap pemain hanya punya **1 baris per minggu**, berisi skor terbaiknya minggu itu.

### 6.3 Tabel Database (`database.sql`)
Nama tabel diberi prefix NRP pengunggah dan nama game supaya tidak bentrok dengan tabel game lain:

```sql
CREATE TABLE IF NOT EXISTS `<NRP>_sandtilt_leaderboard` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `player_uuid`  VARCHAR(64)  NOT NULL,
  `player_name`  VARCHAR(16)  NOT NULL,
  `week_start`   DATE         NOT NULL,
  `score`        INT          NOT NULL,
  `max_chain`    TINYINT      NOT NULL DEFAULT 0,
  `level`        SMALLINT     NOT NULL DEFAULT 1,
  `clears`       INT          NOT NULL DEFAULT 0,
  `duration_sec` INT          NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_player_week` (`player_uuid`, `week_start`),
  INDEX `idx_week_score` (`week_start`, `score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 6.4 API (`api/leaderboard.php`)
| Aksi | Method | Input | Output |
|---|---|---|---|
| `get` | GET | `tab=weekly\|alltime`, `uuid` | Top 10 + baris & peringkat pemain sendiri + `week_start` aktif |
| `submit` | POST (JSON) | `player_uuid`, `player_name`, `score`, `max_chain`, `level`, `clears`, `duration_sec` | `{ saved, new_best, rank_weekly, rank_alltime }` |
| `claim_name` | POST (JSON) | `player_uuid`, `player_name` | `{ ok }` atau `NAME_TAKEN` |

- `submit` hanya memperbarui baris minggu ini kalau skor baru **lebih tinggi** (seri → durasi lebih singkat menang).
- Semua query pakai **prepared statement**.
- Pesan error database **tidak** dikirim ke browser, cukup dicatat di log server.

### 6.5 Validasi Skor (anti-curang ringan)
- Skor ditolak kalau melebihi batas kasar: `clears × 12.800 × 8 × 2 × M_level maks` atau kalau `duration_sec` terlalu pendek untuk level yang dicapai.
- Maksimal 1 `submit` per 10 detik per UUID.
- Ini bukan anti-cheat sempurna, tapi cukup untuk tugas kuliah.

### 6.6 Mode Offline
- Kalau API tidak bisa dihubungi, game tetap jalan dan leaderboard menampilkan **rekor lokal** (`localStorage`) dengan label "OFFLINE".
- Skor yang gagal terkirim disimpan dan dicoba kirim ulang saat game dibuka berikutnya.

### 6.7 Tampilan
- Layar **Leaderboard** dengan dua tab: **MINGGU INI** dan **SEPANJANG MASA**.
- Top 10 + baris pemain sendiri disorot ("KAMU #23") kalau di luar Top 10.
- Hitung mundur reset: "Reset dalam 2h 14j".
- Di layar Game Over: "REKOR MINGGU INI!" kalau skor baru jadi terbaik pemain minggu itu, plus peringkatnya.

### 6.8 Seed Mingguan *(nice-to-have)*
- Urutan piece memakai seed dari `week_start`, jadi semua pemain di minggu yang sama mendapat urutan piece yang sama. Leaderboard jadi lebih adil.

---

## 7. Kontrol

| Aksi | Keyboard | Layar sentuh |
|---|---|---|
| Geser kiri/kanan | ← / → (atau A / D) | D-pad ◀ / ▶ |
| Turun pelan | ↓ / S (tahan) | D-pad ▼ (tahan) |
| Jatuh instan | Spasi | D-pad ▲ |
| Putar / putar balik | ↑ / X / W, Z | A / B |
| Tilt kiri/kanan | **Tahan** Q / E | **Tahan** L / R |
| Jeda + pengaturan | P / Esc (M = suara) | MENU |
| Fullscreen | F | — |

- Geser dengan tombol ditahan memakai *auto-repeat* (delay ~150 ms, ulang tiap ~50 ms).
- Overlay **"Klik / Tap untuk mulai"** supaya iframe dapat fokus keyboard dan audio bisa menyala.
- *(Nice-to-have)* Tilt dengan sensor kemiringan HP.

---

## 8. Arah Visual (Pixel Art)

### 8.1 Prinsip
- **Seluruh game digambar di resolusi kecil lalu diperbesar dengan skala bulat** (×3/×4, tanpa smoothing). Pasir, UI, dan teks otomatis terlihat pixel yang konsisten.
- Resolusi logis layar desktop: **160 × 176 px**.
  - Papan 80×160 di kiri (dengan bingkai 1–2 px)
  - Panel samping lebar ~56 px: NEXT, SKOR, LEVEL, CHAIN, ikon tilt
- Mode HP (portrait): HUD satu baris di atas papan, tombol sentuh (HTML) di bawah papan.
- **Tidak perlu menggambar sprite.** Hampir semua elemen dibuat lewat kode: kotak, bingkai, ikon kecil 5×5/7×7 yang ditulis sebagai array piksel.

### 8.2 Palet
- Latar gelap kebiruan, papan sedikit lebih terang, bingkai satu warna aksen.
- 5 warna pasir dengan kontras **nilai terang** yang berbeda (bukan hanya beda hue), dan masing-masing punya 4 shade.
- Ambil dasar palet dari koleksi palet gratis (misalnya situs **Lospec**), cek lisensinya, lalu sesuaikan.
- *(Nice-to-have)* Palet ramah buta warna + pola titik berbeda per warna.

### 8.3 Teks
- Bitmap font 5×7 buatan sendiri (tanpa file font eksternal), digambar **langsung di resolusi layar**, bukan di kanvas kecil. Satu titik glyph ≈ setengah piksel papan, jadi teks lebih kecil dan mudah dibaca tapi tetap bergaya pixel.
- Logo memakai font kotak 3×5 yang besar.
- Angka skor bergerak naik (*count-up*) saat bertambah.

### 8.4 Tombol Sentuh
- Bergaya konsol genggam (D-pad salib, A/B bulat emas, bahu L/R, MENU berbentuk pil), tapi **posisinya disesuaikan** untuk jempol: L tepat di atas D-pad, R tepat di atas A/B, keduanya sejajar.
- D-pad: ▲ jatuh instan, ◀ ▶ geser, ▼ turun pelan. A putar, B putar balik. Tahan L/R untuk miring.
- **Satu tombol MENU** menggantikan jeda/suara terpisah: saat main membuka layar JEDA berisi LANJUT, ULANG, SUARA, TEMA (jika terbuka), MENU UTAMA. Layar judul punya PENGATURAN (suara, tema).
- **Portrait:** game di atas, kontrol di bawah. **Landscape:** [L + D-pad] | game | [R + A/B].
- Ukuran D-pad (116–186 px) dan A/B (54–84 px) mengikuti lebar & tinggi layar; tinggi aplikasi mengikuti `visualViewport` + safe area agar tidak tertutup bilah browser.

### 8.5 Layar
1. **Judul:** logo dari pasir yang berjatuhan, "Tekan / Tap untuk mulai", tombol Achievement
2. **Main:** papan + panel samping
3. **Pause:** overlay gelap transparan, Lanjut / Ulang / Keluar
4. **Game Over:** skor, chain terbaik, total butir, achievement baru, status rekor & peringkat mingguan, Main Lagi
5. **Achievement:** grid ikon (terbuka/terkunci/???)
6. **Leaderboard:** tab Minggu Ini / Sepanjang Masa, hitung mundur reset
7. **Input Nickname:** muncul sekali saat skor pertama akan dikirim
8. **Cara Main (modal):** dibuka dari ikon ? di layar judul, kotak di atas layar judul berisi ringkasan + tombol MAIN TUTORIAL
9. **Tutorial selesai:** SIAP MAIN! → MAIN SEKARANG / MENU UTAMA

---

## 9. Game Juice & Audio

Urutan pengerjaan berdasarkan dampak dibanding usaha:

1. Kilatan putih merambat dari kiri ke kanan sepanjang jembatan, berkedip, lalu butir larut jadi partikel
2. Hitstop 60–120 ms saat clear (makin lama di chain tinggi)
3. SFX sintesis (ZzFX): "kresek" saat mendarat, denting saat clear dengan nada naik per chain, "whoosh" saat tilt
4. Screen shake sebanding jumlah butir (maks 6 px)
5. Teks skor melayang: "+2.160 CHAIN ×2!"
6. Peringatan bahaya: border merah berdenyut + detak
7. Papan berotasi ±3° saat tilt
8. Musik latar *(paling akhir, opsional)*

---


### 9.1 Audio (implementasi)
- Semua SFX berupa file di `assets/sfx/` (paket Kenney CC0 + angin/pasir buatan ffmpeg), bukan sintesis JavaScript.
- Pemetaan kejadian → suara:

| Kejadian | Suara |
|---|---|
| Mendarat: pasir / batu / mesiu | kresek pasir (3 variasi) / benturan batu (2 variasi) / gemerisik mesiu — posisi stereo mengikuti kolom |
| Hard drop | hentakan + suara mendarat |
| Miring (L/R, Q/E) | pasir meluncur + derit papan, stereo ke arah miring |
| Clear / chain | nada "power-up" yang naik setiap chain + zap untuk chain ≥ 2; butir larut berbunyi kresek tinggi |
| Ledakan mesiu | ledakan acak (3 variasi) + dentuman rendah; batu pecah jika ada batu; musik meredup |
| Peringatan event | jingle peringatan 8-bit |
| Gempa / Angin / Papan miring | gemuruh 1,9 dtk / angin 5 dtk (stereo) + desir tiap dorongan / derit papan + pasir meluncur |
| Bahaya | detak jantung + musik teredam (low-pass) |
| Naik level / game over / material baru | jingle 8-bit naik / turun / pendek |
| Trofi | jingle berbeda per tingkat (perunggu, perak, emas, rahasia) |
| Menu | kursor, konfirmasi, kembali, jeda/lanjut, ganti mode suara |

- Musik: chiptune orisinal `title` (96 BPM) dan `game` (132 BPM, A minor), loop mulus.
- SELECT / M: musik + efek → efek saja → mati.

### 9.2 Trofi
- Setiap prestasi punya tingkat: **perunggu**, **perak**, **emas**, atau **rahasia**, dengan ikon piala pixel art (`assets/image/trophy-*.svg`).
- Layar Prestasi menampilkan ikon per baris (abu-abu terkunci jika belum didapat). Notifikasi saat terbuka: "TROFI EMAS!" + nama + ikon + jingle.

## 10. Teknis

| Hal | Keputusan |
|---|---|
| Stack | Canvas 2D tanpa engine. Vite + TypeScript **atau** JS murni (diputuskan bersama Alvin). Hasil akhir: `index.html` + canvas |
| Grid | `Uint8Array` 80×160 (id warna) + `Uint8Array` shade |
| Render | Offscreen canvas 1 sel = 1 piksel, tulis lewat `Uint32Array` di atas `ImageData`, lalu `drawImage` skala bulat, `imageSmoothingEnabled = false` |
| Update | Bawah → atas, arah kolom bergantian tiap tick, fixed timestep 60 tick/s (maks 4 tick per frame) |
| Clear | BFS flood fill dari kolom kiri, 8 arah, dijalankan saat pasir diam (fallback tiap 8 tick) |
| Audio | ZzFX (~1 KB), `AudioContext` dibuka pada interaksi pertama |
| Simpan lokal | `localStorage`: UUID, nickname, high score, achievement, palet terpilih, antrean skor offline |
| Backend | PHP (`api/leaderboard.php`) + MySQL; `api/db_config.php` fallback ke SQLite (`api/database_simulasi.sqlite`) untuk tes lokal |
| Tes lokal | `php -S localhost:8000` dari folder game (PHP 8.4 sudah terinstall) |
| Deploy | Path relatif, tanpa CDN/font eksternal. Zip berisi `index.html`, JS/CSS, aset, `database.sql`, folder `api/` |
| Rahasia | Password DB **tidak** di-commit: repo hanya berisi `db_config.example.php`, `db_config.php` asli masuk `.gitignore` |
| Debug | RNG ber-seed (`?seed=123`), `window.render_game_to_text()`, `window.advanceTime(ms)` |

**Kontrak antar modul** (berguna saat menggabung pekerjaan dua orang):
- `Game.update(actions)` → logika game
- `Game.view` (read-only) → data untuk renderer
- Event: `land`, `clear`, `chain`, `tilt`, `levelUp`, `gameOver`, `achievement` → untuk SFX, efek, dan achievement

**Target performa:** 60 FPS stabil di laptop biasa. Estimasi simulasi + render < 2 ms per frame.

---

## 11. Scope

### MVP (wajib jadi 8 Desember)
- [ ] Piece jatuh, geser, putar, soft/hard drop, preview NEXT
- [ ] Piece hancur jadi pasir + simulasi pasir
- [ ] Clear kiri-ke-kanan (BFS)
- [ ] Kaskade / chain + skor + level
- [ ] Tilt dengan charge
- [ ] Game over dengan garis bahaya
- [ ] Juice dasar: flash, partikel, hitstop, shake, SFX
- [ ] Layar judul, pause, game over
- [ ] Kontrol keyboard + tombol sentuh
- [ ] High score + 5 achievement MVP
- [ ] Leaderboard online mingguan & all-time + nickname + fallback offline
- [ ] Build yang sudah dites di subfolder (termasuk API PHP)

### Nice-to-have
- [ ] Achievement sisanya + 4 easter egg
- [ ] Palet yang bisa dibuka & dipilih
- [ ] Gesture swipe & tilt pakai sensor HP
- [ ] Palet ramah buta warna
- [ ] Musik latar
- [ ] Seed mingguan (urutan piece sama untuk semua pemain dalam satu minggu)
- [ ] Hitung mundur reset di leaderboard

---

## 12. Roadmap (24 Nov – 8 Des 2026)

| Tanggal | Target |
|---|---|
| 24–26 Nov | Rencana Azhar & Alvin dibandingkan, GDD gabungan disepakati, setup repo |
| 27–29 Nov | Grid pasir + renderer, piece jatuh & collision, input keyboard |
| **30 Nov** | **Checkpoint: clear + skor + game over jalan. Upload percobaan ke gameedukasi.com, termasuk `database.sql` + API leaderboard sederhana** |
| 1–2 Des | Chain/kaskade, tilt, kurva level, HUD, API leaderboard lengkap (validasi, peringkat) |
| 3–4 Des | Juice & SFX, layar menu & leaderboard, input nickname, tombol sentuh, achievement MVP |
| **5 Des** | **Feature freeze** — setelah ini hanya bug fix & balancing |
| 6–7 Des | Playtest, balancing, tes di HP, build final |
| **8 Des** | **Playable untuk dites & dikomentari** |

---

## 13. Risiko

| Risiko | Mitigasi |
|---|---|
| Collision piece vs pasir terasa aneh | Prototipe paling awal, collision pakai mask blok 8×8 |
| Clear terlalu mudah/sulit | Semua angka di `config`, playtest tiap hari |
| Performa di HP | Skala ×3, batasi partikel, chunking kalau perlu |
| Iframe: fokus keyboard, scroll, audio | Overlay klik untuk mulai, `preventDefault` tombol panah/spasi |
| Path rusak di hosting | Path relatif, uji build dari subfolder, upload percobaan 30 Nov |
| Scope creep | Patuhi daftar MVP, freeze 5 Des |
| Skor palsu dikirim ke API | Validasi batas skor di server, rate limit per UUID |
| API/database gagal di server | Fallback leaderboard lokal + antrean kirim ulang; uji di server sejak 30 Nov |
| Password DB bocor ke GitHub | `db_config.php` asli di `.gitignore`, repo hanya simpan versi contoh |
| Tabel bentrok dengan game lain | Nama tabel `<NRP>_sandtilt_leaderboard` |

---

## 14. Keputusan yang Masih Terbuka
- Judul final game
- Vite + TypeScript atau JS murni (tunggu hasil perbandingan dengan Alvin)
- Pembagian tugas final antara Azhar & Alvin
- Palet warna final dan font
- NRP siapa yang dipakai sebagai prefix tabel (tergantung akun pengunggah)
- Kredensial database untuk game ini sama dengan game sebelumnya, atau berbeda per game?
