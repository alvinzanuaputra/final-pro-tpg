# Aturan Pengembangan AI

Acuan teknis untuk setiap sesi pengembangan. Urutan prioritas: permintaan terbaru pemilik proyek, lalu file ini, lalu [GDD dan Roadmap](./GDD_and_Roadmap.md). Tanyakan dulu kepada pemilik proyek bila sebuah perubahan mengubah cakupan, stack, atau aturan inti.

## Memulai sesi

1. Baca GDD, lalu cari milestone aktif, yaitu milestone pertama yang masih punya item belum dicentang.
2. Periksa `git status` dan kode yang relevan. Lanjutkan perubahan lokal yang belum selesai sebelum memulai item baru.
3. Pilih satu item terkecil dari milestone aktif yang bisa diuji lewat jalur bermain normal. Item milestone berikutnya baru dikerjakan bila diminta.

## Stack dan cakupan

- Vanilla JavaScript (ES modules), HTML, CSS, Canvas 2D, dan Web Audio. Tanpa build step. Rilis harus berjalan dari server HTTP statis dengan jalur relatif dan aset lokal.
- Runtime bebas dependency. `package.json` hanya berisi skrip `test` dan `serve` tanpa `dependencies`. Framework, bundler, TypeScript, Wasm, worker, atau WebGL hanya boleh masuk dengan persetujuan pemilik proyek dan data pengukuran.
- Cakupan rilis: satu arena, satu mode endless, empat bentuk (I, L, T, O), tiga warna, empat material, dan satu keping spesial Dye. Ikuti tabel prioritas cakupan di GDD saat memotong fitur.
- Di luar cakupan: multiplayer, akun, leaderboard daring, backend, level editor, mode kampanye, hold piece, wall kick, keping spesial tambahan, dan sistem save selain skor terbaik.

## Arsitektur

- Modul mengikuti struktur proyek di GDD. Tambah file baru hanya bila ada tanggung jawab baru yang jelas, dan catat di GDD.
- `board.js`, `pieces.js`, `connections.js`, dan `rng.js` bebas dari DOM, Canvas, audio, dan `window`, sehingga bisa diuji dengan `node --test`.
- `game.js` memegang seluruh state ronde dan mengeluarkan kejadian (`land`, `clear`, `combo`, `charge-full`, `explode`, `game-over`). `render.js` dan `audio.js` hanya membaca state dan kejadian. Efek presentasi dilarang mengubah aturan, skor, atau isi grid.
- Semua angka balancing, palet, dan bobot material berada di `config.js`. Hindari angka ajaib di modul lain.
- Gunakan fungsi langsung dan objek sederhana. Hindari class hierarchy, sistem ECS, event bus generik, dan state manager. Identifier ditulis dalam bahasa Inggris.
- Semua keacakan lewat `rng.js` agar `?seed=` dapat mengulang ronde.

## Invarian simulasi

- Simulasi berjalan pada fixed tick 60 Hz, terlepas dari refresh rate. Catch-up dibatasi 3 tick per frame, dan accumulator di-reset saat tab kembali aktif.
- Grid berupa dua `Uint8Array` (`material`, `color`) dengan indeks `y * width + x`. Keduanya selalu dipindahkan bersama. Setiap gerak memeriksa batas dan okupansi. Satu partikel bergerak paling banyak sekali per tick.
- Grid hanya disimulasikan selama fase resolusi. Deteksi sambungan dijalankan setelah grid stabil atau batas tick gelombang tercapai.
- Komponen sambungan memakai tetangga empat arah dengan ID warna sama dan harus menyentuh kedua dinding. Tandai semua komponen satu gelombang sebelum menghapus. Skor dan charge dihitung sekali dari sel yang dihapus clear, bukan dari ledakan.
- Loop grid dilarang mengalokasikan objek per sel, memakai rekursi, membuat objek partikel, atau menyentuh DOM. Antrean BFS dan buffer penanda dialokasikan sekali dan dipakai ulang.
- Render memakai satu `ImageData` dengan view `Uint32Array` dan lookup palet. Unggah ke kanvas hanya saat grid berubah. Keping aktif dan efek digambar sebagai lapisan saat komposisi frame.
- Optimasi hanya dilakukan setelah ada pengukuran di `?debug=1` yang menunjukkan bagian lambat. Catat perangkat dan angkanya.

## Aset visual dan audio

- Sebelum M4, pakai visual Canvas/CSS sederhana dan nada sintetis. Mockup di `mock/` menjadi acuan tata letak dan efek.
- Pemutaran audio dan gambar dipetakan per kejadian atau per material lewat `config.js`, sehingga aset final bisa dipasang tanpa mengubah logika game.
- Pada M4, prioritaskan file pilihan pemilik proyek di `assets/image/` dan `assets/audio/`, lalu cari atau buat aset yang masih kurang. Catat sumber, lisensi, dan atribusi aset pihak ketiga di `assets/CREDITS.md`.
- Sandtrix+ hanya menjadi referensi mekanik. Nama, tampilan, dan audio harus milik proyek sendiri.

## Definisi selesai

Sebuah item dianggap selesai bila:

1. Fitur bekerja lewat jalur bermain normal di browser melalui HTTP, tanpa error di console.
2. Mekanik grid punya minimal satu uji papan kecil di `tests/` dengan hasil yang diketahui, termasuk kasus batas yang relevan (diagonal saja, tepi arena, clear serentak, Dye saat kombo, spawn terhalang), dan `npm test` lulus.
3. Perubahan presentasi diuji pada resize, input keyboard dan sentuh, serta pengaturan yang terdampak.
4. Item dicentang di GDD. Bila mekanik atau parameter berubah atas persetujuan pemilik proyek, GDD ikut diperbarui.

## Laporan akhir sesi

Laporkan perubahan, verifikasi yang dijalankan beserta hasilnya, asumsi baru, dan pekerjaan yang masih tertunda. Pisahkan angka target dari angka hasil pengukuran. Jangan menyatakan target performa tercapai tanpa data profil.
