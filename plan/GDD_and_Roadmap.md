# GDD dan Roadmap Solo

## Ringkasan

Puzzle balok jatuh untuk browser dengan satu mode endless. Balok pecah menjadi partikel saat mendarat. Komponen partikel berwarna sama yang tersambung dari dinding kiri ke dinding kanan akan bersih dan memberi skor. Bentuk balok menentukan titik pendaratan, sedangkan material menentukan ke mana partikel bergerak setelahnya.

- **Referensi gameplay.** Sandtrix+ menjadi acuan transisi balok menjadi butiran dan sambungan warna antardinding. Identitas proyek dibangun lewat empat material, charge dan Dye, serta tampilan dan audio sendiri. [Sandtrix+ di Steam](https://store.steampowered.com/app/2546310/Sandtrix/)
- **Tujuan belajar.** Pemain memprediksi perilaku pasir, air, dan benda padat, lalu memilih posisi jatuh berdasarkan prediksi itu. Material diperkenalkan satu per satu seiring level sehingga tutorial cukup berupa satu ilustrasi sambungan dan legenda material yang menyorot material baru.
- **Arah visual.** Pixel art dengan arena gelap, HUD ringkas, dan tiga warna partikel yang berbeda kecerahannya agar tetap terbaca oleh pemain buta warna. Tekstur membedakan material, warna menentukan sambungan. [Mockup gameplay](../mock/gameplay_mockup.png)
- **Urutan aset.** Game dibuat dan diuji dulu dengan visual Canvas/CSS dan nada sementara. Kebutuhan gambar dan audio final ditentukan dari hasil uji main, lalu dipasang pada M4.

## Pilihan teknologi

| Opsi | Simulasi dan render | Pengerjaan solo dan distribusi |
| --- | --- | --- |
| **Vanilla JavaScript + Canvas 2D** | Loop CPU langsung pada typed array. Grid digambar ke kanvas kecil lewat satu `putImageData`, lalu diperbesar dengan `drawImage` tanpa smoothing. | Satu bahasa untuk simulasi, kontrol, dan HUD. Tanpa build step. Rilis berupa situs statis dengan ES modules dan jalur relatif. [Standar HTML Canvas](https://html.spec.whatwg.org/multipage/canvas.html) |
| Rust + WebAssembly | Berpotensi mempercepat loop CPU. Keuntungannya kecil untuk grid 3.456 sel, sementara render tetap lewat Canvas di sisi JS. | Tambahan toolchain Rust, binding JS, dan artefak `.wasm`. [Dokumentasi wasm-pack](https://rustwasm.github.io/docs/wasm-pack/commands/build.html) |
| Godot 4 Web Export | Automata tetap perlu grid dan aturan buatan sendiri. Ekspor web membutuhkan WebAssembly dan WebGL 2. | Editor membantu UI dan efek, tetapi paket membawa runtime engine berukuran besar dan waktu muat lebih lama. [Dokumentasi Godot](https://docs.godotengine.org/en/4.4/tutorials/export/exporting_for_web.html) |
| Phaser.js | Menyediakan loop dan renderer. Automata tetap berjalan pada grid sendiri, dan CanvasTexture perlu diunggah ulang setiap perubahan. | Input, audio, dan scene siap pakai, tetapi menambah runtime dan API yang perlu dipelajari. [Dokumentasi Phaser](https://docs.phaser.io/) · [CanvasTexture](https://docs.phaser.io/api-documentation/class/textures-canvastexture) |

**Keputusan: Vanilla JavaScript + Canvas 2D**, HTML/CSS untuk HUD, dan Web Audio untuk efek. Grid 48 × 72 hanya berisi 3.456 sel, sehingga pemindaian linear per tick jauh di bawah anggaran frame 60 FPS tanpa Wasm atau engine. Tidak ada build step, jadi waktu dari edit ke uji hanya sebatas reload browser, dan paket rilis tetap berukuran kecil. Target 60 FPS tetap dibuktikan dengan profil pada perangkat uji (lihat [Target performa](#target-performa-dan-pengemasan)).

## Core game loop

1. **Spawn.** Tampilkan skor, level, preview satu balok berikutnya, dan meter charge. Ambil bentuk dari bag berisi I, L, T, O (masing-masing satu, diacak ulang setelah habis). Setiap balok memiliki satu material dan satu warna. Material diambil dari tabel bobot level aktif.
2. **Kendalikan.** Geser kiri/kanan, rotasi searah jarum jam, percepat turun, atau jatuhkan langsung. Satu kotak tetromino berukuran 4 × 4 sel. Geser dan jatuh bergerak satu sel per langkah. Rotasi diterima hanya jika seluruh posisi hasil berada di arena dan kosong (tanpa wall kick). Hard drop diuji per langkah agar tidak menembus partikel. Grid tidak disimulasikan selama balok dikendalikan.
3. **Mendarat.** Saat langkah turun berikutnya terhalang, tulis jejak balok ke grid sebagai partikel. Jalankan aksi pendaratan (ledakan mesiu atau Dye) bila ada, lalu masuk fase resolusi. Input balok ditahan selama resolusi, dan pemain melihat partikel bergerak.
4. **Resolusi per gelombang.** Simulasikan grid sampai satu tick tanpa perpindahan atau batas tick gelombang tercapai. Lalu cari komponen: BFS dari sel terisi di tepi kiri, ikuti tetangga empat arah dengan ID warna sama. Diagonal saja tidak menyambung. Material berbeda boleh menyambung jika warnanya sama.
5. **Clear dan kombo.** Tandai semua komponen yang mencapai tepi kanan, lalu hapus semuanya sekaligus, termasuk cabangnya. Ulangi langkah 4 sebagai gelombang berikutnya. Spawn balok berikutnya ketika satu gelombang tidak menemukan sambungan. Jika jejak spawn terhalang, tampilkan game over dan tombol ulang.

**Skor.** Skor per gelombang = jumlah sel yang dihapus × nomor gelombang (×1 untuk gelombang pertama setiap pendaratan). Satu komponen yang bersih mengisi satu segmen charge. Skor dan charge hanya berasal dari sambungan. Skor terbaik disimpan di `localStorage` dan dibaca dengan aman bila storage tidak tersedia.

**Level.** Level naik setiap 4 komponen bersih. Setiap level mempercepat jatuh balok dan dapat membuka material baru. Restart mengosongkan grid, skor, level, charge, antrean, dan efek.

### Parameter awal (`config.js`)

Semua angka di bawah ini adalah titik awal balancing dan hanya diubah di `config.js`.

| Parameter | Nilai awal |
| --- | --- |
| Grid | 48 × 72 sel, kotak tetromino 4 × 4 sel, skala render bilangan bulat |
| Tick simulasi | 60 Hz, batas 72 tick per gelombang, maksimal 3 tick catch-up per frame |
| Jatuh balok | 12 tick per sel di level 1, dikali 0,9 tiap level, minimal 2 tick per sel. Soft drop 2 tick per sel |
| Warna | 3 warna sejak MVP |
| Bobot material | L1: pasir 100. L2: pasir 75, air 25. L3: pasir 60, air 25, batu 15. L4+: pasir 55, air 20, batu 15, mesiu 10 |
| Charge | 3 segmen, satu Dye tertunda |
| Radius ledakan / Dye | 6 sel / 6 sel dari titik tengah kotak pembatas jejak balok saat mendarat |

### Aturan cellular automata

Simpan `material` dan `color` dalam dua `Uint8Array` datar dengan indeks `y * width + x`. Material 0 berarti kosong. ID material dan warna selalu dipindahkan bersama. Proses baris dari bawah ke atas, balik arah horizontal setiap tick, dan pakai array penanda agar satu partikel bergerak paling banyak sekali per tick. Dinding dan dasar membatasi semua gerakan, dan tujuan gerak harus kosong.

| Material | Aturan |
| --- | --- |
| Pasir | Turun lurus. Jika terhalang, coba diagonal bawah sesuai arah scan tick, lalu diagonal lainnya. Jika semua penuh, diam dan membentuk gundukan. |
| Air | Turun lurus, lalu diagonal bawah. Jika terhalang, cari sel kosong di kiri dan kanan sejauh maksimal 6 sel yang memiliki ruang kosong di bawahnya. Bergerak satu sel ke arah bukaan terdekat, memakai arah scan bila seri. Tanpa bukaan, air diam sehingga grid bisa stabil. |
| Batu | Padat. Setelah mendarat, sel tetap di tempat sampai hilang lewat clear atau ledakan, termasuk saat tidak ditopang. |
| Mesiu | Saat balok mesiu mendarat, hapus semua sel terisi dalam radius ledakan, termasuk sel mesiu di dalamnya. Area dipotong di batas grid. Sisa mesiu di luar radius berperilaku seperti pasir. Sel yang hancur karena ledakan memberi 0 skor dan 0 charge. |

### Charge, Dye, dan efek

- Saat meter penuh, keping berikutnya di antrean ditandai sebagai **Dye** dan terlihat di preview. Status ini bertahan melewati gelombang kombo. Charge dikosongkan saat Dye spawn. Segmen yang diperoleh selama meter penuh tidak ditabung.
- Dye memakai bentuk dan warna antrean dengan material pasir. Saat mendarat, Dye mengubah ID warna semua sel terisi dalam radius Dye menjadi warnanya tanpa mengubah material. Resolusi biasa berjalan sesudahnya.
- Saat clear, simpan posisi komponen sebelum dihapus dan tampilkan kilatan lokal sekitar 120 ms di posisi itu, ditambah shake arena singkat. Pengaturan "kurangi gerakan" mematikan shake. Efek boleh masih terlihat saat keping berikutnya muncul.
- Audio dipicu oleh kejadian `land`, `clear`, `combo`, `charge-full`, `explode`, dan `game-over`. Mulai dengan nada sintetis Web Audio, lalu ganti dengan klip final pada kejadian yang sama. Kombo menaikkan pitch clear dalam rentang sempit. Audio dibuka setelah interaksi pertama, dan tersedia tombol bisu.

## Struktur proyek

```text
index.html            Halaman, HUD, dialog, dan tombol sentuh
style.css             Tata letak responsif dan tampilan pixel-art
package.json          Skrip test/serve saja, tanpa dependency
src/
  main.js             Bootstrap, loop frame, dan jeda saat tab tersembunyi
  game.js             Fase ronde, antrean, level, skor, charge, dan resolusi
  config.js           Parameter balancing, palet, dan bobot material
  rng.js              RNG ber-seed untuk bag, warna, dan material
  pieces.js           Bentuk, rotasi, tabrakan, dan penulisan jejak ke grid
  board.js            Grid, fisika material, ledakan, dan Dye
  connections.js      Pencarian komponen warna tepi ke tepi
  input.js            Keyboard dan tombol sentuh ke aksi permainan
  render.js           Canvas, HUD, preview, dan efek
  audio.js            Pemutaran kejadian dan bisu
  debug.js            Overlay FPS/waktu tick dan papan uji, aktif lewat ?debug=1
tests/                Uji aturan papan, balok, dan sambungan dengan node --test
assets/
  image/              Gambar dan sprite terpilih
  audio/              Klip audio terpilih
  font/               Font lokal jika digunakan
mock/                 Referensi visual
plan/                 GDD dan aturan pengembangan
```

**Alur data.** `main.js` memakai `requestAnimationFrame` untuk render dan accumulator untuk tick 60 Hz. `game.js` mengatur fase dan mengeluarkan daftar kejadian per tick. `render.js` dan `audio.js` hanya membaca state serta kejadian tersebut. `board.js`, `pieces.js`, `connections.js`, dan `rng.js` bebas DOM sehingga dapat diuji langsung dengan Node.

**Alat bantu pengembangan.** Jalankan `npm run serve` (atau `python3 -m http.server`) untuk uji di browser dan `npm test` untuk uji aturan. Parameter `?seed=123` mengulang urutan keping yang sama. Parameter `?debug=1` menampilkan FPS, waktu update/render, dan tombol untuk memuat papan uji atau memaksa material keping berikutnya.

## Roadmap solo

Perkiraan **25–34 jam** kerja inti, ditambah buffer sekitar 4 jam untuk debugging. Setiap milestone selesai dengan build yang bisa dimainkan. Centang item saat sudah terverifikasi agar sesi berikutnya tahu posisi terakhir.

**Status build.** Arus Butir dapat dimainkan dari paket ZIP dengan visual Canvas/CSS dan nada sintetis. Satu ronde sampai game over dan restart sudah diuji di Chromium desktop serta emulasi sentuh Chromium dan WebKit. Uji pemain, pengukuran pada ponsel fisik, dan konfirmasi format GameEdukasi masih terjadwal.

### M0 — Fondasi (2–3 jam)

- [x] `index.html`, `style.css`, loop fixed tick, dan grid yang diskalakan dengan bilangan bulat di desktop dan emulasi ponsel.
- [x] `package.json` dengan `npm test`, plus overlay `?debug=1` yang menampilkan FPS.
- [ ] Konfirmasi format unggah, batas ukuran, dan kebutuhan embed GameEdukasi lewat kanal resmi atau pengampu.
- [x] Uji ZIP dengan `index.html` di root paket dan jalankan hasil ekstraksi dari subfolder server statis.

**Selesai bila:** grid tampil tajam di desktop dan ponsel, `npm test` lulus, dan format paket rilis sudah diketahui atau dicatat sebagai asumsi.

### M1 — MVP pasir (7–9 jam)

- [x] Bag empat bentuk, geser, rotasi, soft drop, hard drop, dan preview.
- [x] Pendaratan menjadi partikel pasir tiga warna, lalu resolusi sampai stabil.
- [x] BFS empat arah, clear serentak, kombo, skor, level, dan kecepatan jatuh.
- [x] Game over, restart, skor terbaik, dan tombol sentuh dasar.
- [x] Uji: sambungan berliku clear, kontak diagonal saja gagal, dua komponen clear serentak, spawn terhalang.

**Selesai bila:** satu ronde dimainkan dari awal sampai game over dan restart di desktop dan ponsel.

### M2 — Elemental Physics (6–8 jam)

- [x] Aturan air, batu, dan mesiu dengan uji papan kecil.
- [x] Tabel bobot material per level dan sorotan legenda saat material baru muncul.
- [x] Charge tiga segmen, penanda Dye di preview, dan aksi Dye saat mendarat.
- [x] Uji: air mengisi cekungan dan berhenti, batu menggantung, ledakan di tepi grid, tepat satu Dye saat meter penuh selama kombo.

**Selesai bila:** keempat material muncul sesuai level dalam satu ronde dan semua uji papan lulus.

### M3 — Game Juice (3–5 jam)

- [x] Kilatan komponen, shake ringan, dan pengaturan kurangi gerakan.
- [x] Nada sintetis untuk kejadian audio, pitch kombo, dan tombol bisu.
- [ ] Uji main oleh 2–3 orang. Catat material atau status yang sulit dibaca dan kejadian yang perlu bunyi lebih jelas. Minta pemain menjelaskan syarat sambungan dan menunjukkan penempatan yang berubah karena air.
- [ ] Susun daftar aset final dari catatan uji main.

**Selesai bila:** daftar aset final tersusun dan tidak ada temuan uji main yang menghambat pemahaman aturan.

### M4 — Aset, Polish, dan Rilis (7–9 jam)

- [ ] Pasang aset pilihan pemilik proyek, lalu cari atau buat aset yang masih kurang. Catat sumber, lisensi, dan atribusi di `assets/CREDITS.md`.
- [x] Layar judul singkat, legenda material, dan layout layar kecil.
- [ ] Periksa fokus keyboard dan kontrol sentuh pada konteks embed GameEdukasi bila digunakan.
- [ ] Profil performa sesuai target, lalu perbaiki bagian yang terukur lambat.
- [ ] Buat paket rilis, uji dari subfolder bersih di desktop dan satu perangkat sentuh, lalu unggah.

**Selesai bila:** paket rilis memenuhi target performa dan ukuran, serta satu ronde, restart, dan audio mulai/bisu berjalan dari paket.

### Prioritas cakupan

| Tingkat | Isi |
| --- | --- |
| Wajib | Core loop, empat material, charge dan Dye, kilatan clear, audio dengan bisu, kontrol sentuh, paket rilis |
| Sebaiknya | Shake dan pengaturannya, skor terbaik, layar judul, sorotan material baru, aset final untuk semua kejadian |
| Bonus | Warna keempat di level tinggi, variasi klip audio, partikel debu kecil saat ledakan |

Jika jadwal tertinggal, potong dari baris Bonus, lalu Sebaiknya. Isi baris Wajib tidak dipotong. Penyederhanaan diperbolehkan, misalnya memakai nada sintetis sebagai audio final.

### Risiko dan cadangan

| Risiko | Cadangan |
| --- | --- |
| Aturan air terus bergerak atau sulit stabil | Batas tick gelombang tetap mengakhiri resolusi. Jika perlu, air yang tidak turun selama 30 tick berhenti mencari bukaan. |
| FPS ponsel di bawah target | Profil dulu. Lewati render saat grid tidak berubah, lalu turunkan grid ke 40 × 60 bila masih kurang. |
| Persyaratan GameEdukasi berbeda dari asumsi | Dikonfirmasi pada M0. Paket statis dengan jalur relatif mudah disesuaikan ke bentuk zip atau embed. |
| Lisensi aset pihak ketiga tidak jelas | Gunakan aset CC0 atau buatan sendiri, dan pertahankan nada sintetis sebagai cadangan. |

## Target performa dan pengemasan

- Di layar 60 Hz, profil 30 detik pada desktop dan satu ponsel sasaran dengan papan padat, air, clear, dan efek aktif. Catat perangkat, browser, FPS, persentil ke-95 waktu update + render, dan lonjakan frame. Target: 60 FPS dengan p95 di bawah 12 ms per frame.
- Pengukuran awal paket di Chromium headless pada Apple M1 Pro selama 30 detik dengan papan air dan clear yang dimuat berulang mencapai 60 FPS dan p95 waktu kerja JavaScript update + render 0,70 ms. Pengukuran pada ponsel fisik masih diperlukan.
- Paket rilis berisi `index.html`, CSS, modul `src/`, dan aset yang dipakai. `debug.js` dimuat lewat dynamic import hanya saat `?debug=1`, sehingga boleh dikeluarkan dari paket. `tests/`, `plan/`, `mock/`, dan `package.json` tidak ikut. Anggaran ukuran awal ≤2 MB terkompresi.
- Jalankan dari server HTTP statis dengan jalur relatif. Periksa MIME modul JS, fokus keyboard, sentuh, dan audio pada konteks embed bila platform memakainya. [GameEdukasi](https://gameedukasi.com/)
