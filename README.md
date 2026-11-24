# Arus Butir

Game puzzle balok jatuh untuk proyek final Teknik Pengembangan Game. Balok berubah menjadi partikel ketika mendarat. Sambungkan warna yang sama dari dinding kiri ke kanan untuk mencetak skor, mengisi charge Dye, dan membuka material.

## Main lokal

Jalankan `npm run serve` dari root proyek, lalu buka [Arus Butir](http://localhost:8000/). Server membutuhkan Python 3. Game menggunakan HTML, CSS, Canvas 2D, dan JavaScript tanpa dependensi runtime.

- Panah kiri dan kanan menggeser balok, panah atas memutar, dan panah bawah mempercepat turun.
- Spasi menjatuhkan balok langsung. P atau Esc menjeda permainan.
- Gunakan tombol di bawah arena pada perangkat sentuh.

## Uji dan paket web

- Jalankan `npm test` untuk menguji aturan simulasi dengan Node.js.
- Tambahkan `?seed=123` pada URL untuk mengulang urutan keping. Tambahkan `?debug=1` untuk melihat FPS, memuat papan uji, dan memilih material keping berikutnya.
- Ekstrak `dist/arus-butir.zip` ke server HTTP statis. `index.html` berada di root paket. Persyaratan unggah final mengikuti GameEdukasi.
- Untuk membuat ulang paket dari root proyek, jalankan `mkdir -p dist && zip -q -9 dist/arus-butir.zip index.html style.css src/*.js`.
- Versi uji main memakai visual Canvas/CSS dan nada sintetis. Rencana aset dan rilis ada di [GDD dan Roadmap](plan/GDD_and_Roadmap.md).
