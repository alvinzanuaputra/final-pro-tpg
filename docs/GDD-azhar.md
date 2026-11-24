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
| **Peningkatan utama** | (1) **Kaskade berantai**, (2) **Tilt** (memiringkan papan), (3) **Achievement & easter egg** |
| **Platform** | Web (HTML5 Canvas), di-upload ke gameedukasi.com sebagai static web |
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
- **Meta:** high score, chain terbaik, achievement, dan palet warna yang sudah terbuka (disimpan di `localStorage`).

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
- Tombol **Q** (kiri) / **E** (kanan). Selama **0,4 detik**, gravitasi pasir condong ke sisi itu dan butir lebih memilih bergerak diagonal ke arah tersebut.
- Jatah **3 charge**, isi ulang **1 charge per 4 detik**. Ditampilkan sebagai 3 ikon di HUD.
- Tilt **tidak** menggeser piece yang sedang jatuh, hanya pasir.
- Visual: canvas papan berotasi ±3° dengan *easing*.

### 3.5 Kalah
- Ada **garis bahaya** di atas papan (2 blok dari atas).
- Kalah kalau ada pasir di atas garis itu selama lebih dari **1,5 detik** berturut-turut, atau kalau piece baru tidak bisa muncul.
- Selama pasir di atas garis: border berdenyut merah dan terdengar bunyi detak.

### 3.6 Menang
- Tidak ada kondisi menang (Endless). Tujuannya adalah high score, chain terbaik, dan membuka achievement.

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
| Level | Interval jatuh piece | Jumlah warna |
|---|---|---|
| 1 | 800 ms | 3 |
| 4 | ~491 ms | **4** |
| 8 | ~256 ms | **5** |
| 10+ | ~185 ms (min 80 ms) | 5 |

- Interval = `max(80, 800 × 0,85^(level−1))` ms.
- Naik level setiap **5 clear**.
- **Ruang napas:** saat warna baru masuk, kecepatan diturunkan setara 1 level selama 30 detik.

### 4.3 Angka yang Bisa Di-tuning (semua di `config`)
`BLOCK_SIZE`, `CONNECT_8`, `TILT_DURATION`, `TILT_CHARGES`, `TILT_RECHARGE`, `DANGER_GRACE`, `CLEARS_PER_LEVEL`, rumus kecepatan, dan jumlah warna per level.

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
| Nyaris! | Clear saat pasir di atas garis bahaya | — | MVP |
| Maraton | Capai level 10 | Palet "Es" | Nice |
| Papan Bersih | Papan kosong total setelah clear | — | MVP |

### 5.2 Easter Egg (tampil "???" sampai terbuka)
| Nama | Syarat | Efek |
|---|---|---|
| Gempa | Tilt kiri-kanan 6× dalam 2 detik | Layar berguncang hebat |
| Pelangi | Semua warna aktif ter-clear dalam satu rangkaian chain | Partikel pelangi |
| Kode Rahasia | Ketik `PASIR` di layar judul | Palet "Retro" (hijau monokrom) |
| Jam Pasir | Diam 30 detik di layar judul | Pasir membentuk logo game |

---

## 6. Kontrol

| Aksi | Keyboard | Layar sentuh |
|---|---|---|
| Geser kiri/kanan | ← / → (atau A / D) | Tombol ◀ ▶ |
| Putar | ↑ / X (searah jarum jam), Z (berlawanan) | Tombol ⟳ |
| Soft drop | ↓ / S | Tombol ▼ (tahan) |
| Hard drop | Spasi | Tombol ⤓ |
| Tilt kiri/kanan | Q / E | Tombol ⤺ ⤻ |
| Pause | P / Esc | Tombol ❚❚ |
| Fullscreen | F | — |

- Geser dengan tombol ditahan memakai *auto-repeat* (delay ~150 ms, ulang tiap ~50 ms).
- Overlay **"Klik / Tap untuk mulai"** supaya iframe dapat fokus keyboard dan audio bisa menyala.
- *(Nice-to-have)* Tilt dengan sensor kemiringan HP.

---

## 7. Arah Visual (Pixel Art)

### 7.1 Prinsip
- **Seluruh game digambar di resolusi kecil lalu diperbesar dengan skala bulat** (×3/×4, tanpa smoothing). Pasir, UI, dan teks otomatis terlihat pixel yang konsisten.
- Resolusi logis layar desktop: **160 × 176 px**.
  - Papan 80×160 di kiri (dengan bingkai 1–2 px)
  - Panel samping lebar ~56 px: NEXT, SKOR, LEVEL, CHAIN, ikon tilt
- Mode HP (portrait): HUD satu baris di atas papan, tombol sentuh (HTML) di bawah papan.
- **Tidak perlu menggambar sprite.** Hampir semua elemen dibuat lewat kode: kotak, bingkai, ikon kecil 5×5/7×7 yang ditulis sebagai array piksel.

### 7.2 Palet
- Latar gelap kebiruan, papan sedikit lebih terang, bingkai satu warna aksen.
- 5 warna pasir dengan kontras **nilai terang** yang berbeda (bukan hanya beda hue), dan masing-masing punya 4 shade.
- Ambil dasar palet dari koleksi palet gratis (misalnya situs **Lospec**), cek lisensinya, lalu sesuaikan.
- *(Nice-to-have)* Palet ramah buta warna + pola titik berbeda per warna.

### 7.3 Teks
- Font pixel kecil (tinggi ±5–7 px). Pilihan:
  - Font pixel gratis dengan lisensi bebas (cek lisensi sebelum dipakai), disimpan lokal di folder game
  - Atau bitmap font buatan sendiri (array glyph A–Z, 0–9) supaya tanpa file tambahan
- Angka skor bergerak naik (*count-up*) saat bertambah.

### 7.4 Layar
1. **Judul:** logo dari pasir yang berjatuhan, "Tekan / Tap untuk mulai", tombol Achievement
2. **Main:** papan + panel samping
3. **Pause:** overlay gelap transparan, Lanjut / Ulang / Keluar
4. **Game Over:** skor, chain terbaik, total butir, achievement baru, Main Lagi
5. **Achievement:** grid ikon (terbuka/terkunci/???)

---

## 8. Game Juice & Audio

Urutan pengerjaan berdasarkan dampak dibanding usaha:

1. Jalur jembatan berkedip putih, butir larut jadi partikel
2. Hitstop 60–120 ms saat clear (makin lama di chain tinggi)
3. SFX sintesis (ZzFX): "kresek" saat mendarat, denting saat clear dengan nada naik per chain, "whoosh" saat tilt
4. Screen shake sebanding jumlah butir (maks 6 px)
5. Teks skor melayang: "+2.160 CHAIN ×2!"
6. Peringatan bahaya: border merah berdenyut + detak
7. Papan berotasi ±3° saat tilt
8. Musik latar *(paling akhir, opsional)*

---

## 9. Teknis

| Hal | Keputusan |
|---|---|
| Stack | Canvas 2D tanpa engine. Vite + TypeScript **atau** JS murni (diputuskan bersama Alvin). Hasil akhir: `index.html` + canvas |
| Grid | `Uint8Array` 80×160 (id warna) + `Uint8Array` shade |
| Render | Offscreen canvas 1 sel = 1 piksel, tulis lewat `Uint32Array` di atas `ImageData`, lalu `drawImage` skala bulat, `imageSmoothingEnabled = false` |
| Update | Bawah → atas, arah kolom bergantian tiap tick, fixed timestep 60 tick/s (maks 4 tick per frame) |
| Clear | BFS flood fill dari kolom kiri, 8 arah, dijalankan saat pasir diam (fallback tiap 8 tick) |
| Audio | ZzFX (~1 KB), `AudioContext` dibuka pada interaksi pertama |
| Simpan | `localStorage`: high score, achievement, palet terpilih |
| Deploy | Path relatif, tanpa CDN/font eksternal, zip isi folder build |
| Debug | RNG ber-seed (`?seed=123`), `window.render_game_to_text()`, `window.advanceTime(ms)` |

**Kontrak antar modul** (berguna saat menggabung pekerjaan dua orang):
- `Game.update(actions)` → logika game
- `Game.view` (read-only) → data untuk renderer
- Event: `land`, `clear`, `chain`, `tilt`, `levelUp`, `gameOver`, `achievement` → untuk SFX, efek, dan achievement

**Target performa:** 60 FPS stabil di laptop biasa. Estimasi simulasi + render < 2 ms per frame.

---

## 10. Scope

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
- [ ] Build statis yang sudah dites di subfolder

### Nice-to-have
- [ ] Achievement sisanya + 4 easter egg
- [ ] Palet yang bisa dibuka & dipilih
- [ ] Gesture swipe & tilt pakai sensor HP
- [ ] Palet ramah buta warna
- [ ] Musik latar
- [ ] Daily seed

---

## 11. Roadmap (24 Nov – 8 Des 2026)

| Tanggal | Target |
|---|---|
| 24–26 Nov | Rencana Azhar & Alvin dibandingkan, GDD gabungan disepakati, setup repo |
| 27–29 Nov | Grid pasir + renderer, piece jatuh & collision, input keyboard |
| **30 Nov** | **Checkpoint: clear + skor + game over jalan. Upload percobaan ke gameedukasi.com** |
| 1–2 Des | Chain/kaskade, tilt, kurva level, HUD |
| 3–4 Des | Juice & SFX, layar menu, tombol sentuh, achievement MVP |
| **5 Des** | **Feature freeze** — setelah ini hanya bug fix & balancing |
| 6–7 Des | Playtest, balancing, tes di HP, build final |
| **8 Des** | **Playable untuk dites & dikomentari** |

---

## 12. Risiko

| Risiko | Mitigasi |
|---|---|
| Collision piece vs pasir terasa aneh | Prototipe paling awal, collision pakai mask blok 8×8 |
| Clear terlalu mudah/sulit | Semua angka di `config`, playtest tiap hari |
| Performa di HP | Skala ×3, batasi partikel, chunking kalau perlu |
| Iframe: fokus keyboard, scroll, audio | Overlay klik untuk mulai, `preventDefault` tombol panah/spasi |
| Path rusak di hosting | Path relatif, uji build dari subfolder, upload percobaan 30 Nov |
| Scope creep | Patuhi daftar MVP, freeze 5 Des |

---

## 13. Keputusan yang Masih Terbuka
- Judul final game
- Vite + TypeScript atau JS murni (tunggu hasil perbandingan dengan Alvin)
- Pembagian tugas final antara Azhar & Alvin
- Palet warna final dan font
