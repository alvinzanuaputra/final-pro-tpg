# Rencana proyek final TPG

**Status usulan MVP untuk dibahas tim.** Targetnya adalah game puzzle 2D yang bisa dimainkan di browser dan dikemas untuk pengumpulan di GameEdukasi. Tim maksimal dua orang. Brief tugas meminta peningkatan keseruan yang terasa dari game klasik. Puzzle balok jatuh menjadi dasar klasiknya, dan **Sandtris** menjadi acuan untuk perilaku pasir. [Brainstorming Gemini](https://gemini.google.com/share/25c31349c4c5)

## Konsep yang diusulkan

Pemain menggeser dan memutar keping berwarna sebelum mendaratkannya. Setelah mendarat, keping terurai menjadi butiran yang mengisi celah. Sekelompok butiran sewarna hilang ketika tersambung dari tepi kiri ke tepi kanan. Tumpukan yang tersisa akan turun dan bisa memicu kombo.

**Peningkatan utama yang diusulkan adalah keping pewarna.** Setiap kali pemain membersihkan komponen warna, meter energi terisi. Saat penuh, pemain dapat menyimpan energi atau mengaktifkannya untuk mewarnai ulang butiran di sekitar keping aktif ketika keping mendarat. Ini memberi pilihan antara memakai energi segera untuk membuat kombo atau menyimpannya untuk menyelamatkan tumpukan yang mulai tinggi.

Gemini mengusulkan balok spesial yang muncul otomatis saat meter penuh. Rencana ini memakai aktivasi manual supaya pemain bisa memilih momen dan posisi untuk menggunakan pewarna. Material berbeda, bom, bor, angin, gempa, papan miring, kartu upgrade, dan misi artefak masuk daftar ide untuk dipertimbangkan setelah uji main MVP. Gunakan nama, tampilan, dan aset orisinal untuk proyek.

## Aturan awal untuk prototipe

- Mulai dengan satu mode endless, tiga warna, dan empat bentuk keping. Tampilkan skor, meter energi, dan satu keping berikutnya. Ronde berakhir saat keping baru gagal muncul karena ruang spawn terisi.
- Setelah keping mendarat, jalankan simulasi sampai papan stabil. Cari komponen sewarna dengan koneksi atas, bawah, kiri, dan kanan. Hapus semua komponen yang menyentuh kedua sisi pada putaran yang sama, lalu ulangi proses sampai stabil. Skor dihitung dari jumlah butiran yang dihapus, dengan bonus untuk gelombang berikutnya dalam satu kombo.
- Sebagai nilai awal, isi satu tingkat energi per komponen yang dibersihkan, termasuk komponen dari kombo, dengan kapasitas tiga tingkat. Saat penuh, pemain bisa mengaktifkan pewarna untuk keping aktif. Gunakan satu meter penuh ketika keping itu mendarat. Ubah warna butiran dalam radius pendek di sekitar keping menjadi warna keping tersebut sebelum simulasi runtuhan. Tampilkan status aktif dan pratinjau area saat pemain menggeser keping. Sesuaikan ambang energi dan radius setelah uji main.
- Sediakan kontrol keyboard dan tombol sentuh untuk geser, rotasi, jatuh cepat, dan aktivasi pewarna. Tambahkan kilatan pada jalur yang tersambung, suara runtuhan, serta nada yang naik saat kombo. Mulai audio setelah interaksi pertama dan sediakan tombol bisu.

## Implementasi web

Repo saat ini berisi README. Untuk prototipe, usulannya adalah **HTML5 Canvas dan JavaScript** dengan HUD dan tombol berbasis HTML. Gunakan grid resolusi rendah yang diperbesar saat dirender. Simulasi memakai langkah waktu tetap dan pembaruan dari bawah ke atas. Deteksi komponen dijalankan setelah papan stabil supaya waktu resolusi konsisten dan aturan mudah diuji.

Pisahkan logika papan dan pewarnaan dari render serta input agar aturan bisa diuji dengan papan kecil yang hasilnya sudah diketahui. Simpan parameter seperti ukuran grid, kecepatan, dan ambang energi di satu tempat untuk balancing. Targetkan build statis dengan `index.html` sebagai titik masuk. Format unggah, batas ukuran, dan persyaratan platform perlu dikonfirmasi sebelum pengemasan final. [GameEdukasi](https://gameedukasi.com/)

## Tahapan dan pembagian kerja

| Tahap | Pengerjaan | Hasil yang bisa dicek |
| --- | --- | --- |
| 1. Prototipe | Anggota A mengerjakan grid, input keyboard, pendaratan, dan pasir. Anggota B membuat rancangan HUD dan kontrol sentuh. | Satu ronde bisa dimulai, dimainkan, berakhir, dan diulang. |
| 2. Aturan inti | A mengerjakan deteksi sambungan, penghapusan, kombo, dan skor. B mengintegrasikan HUD, instruksi singkat, dan kontrol sentuh. | Pemain bisa memahami dan membuat sambungan warna tanpa penjelasan lisan. |
| 3. Peningkatan utama | A mengerjakan energi dan pewarna. B menambahkan indikator area, kilatan, dan audio. Keduanya mencoba papan yang sama dengan pewarna aktif dan nonaktif. | Penguji bisa menunjukkan satu penempatan yang berubah karena pilihan memakai atau menyimpan pewarna. |
| 4. Balancing dan pengumpulan | A memeriksa aturan, performa, dan build. B memeriksa keterbacaan, aset, audio, dan persyaratan GameEdukasi. Keduanya menguji build final. | Build statis dapat dimulai dari paket pengumpulan dan dimainkan penuh di browser desktop serta di satu perangkat sentuh. |

## Kriteria siap demo

- Uji sambungan warna yang berliku, sambungan diagonal saja, dua komponen yang bersih bersamaan, kombo setelah runtuhan, dan spawn yang terhalang.
- Uji penggunaan pewarna dekat dinding, indikator energi saat penuh, pengurangan energi saat keping aktif mendarat, serta reset skor dan energi saat memulai ulang.
- Jalankan beberapa ronde termasuk saat papan hampir penuh. Periksa respons input, terbaca atau tidaknya warna, kelancaran simulasi, serta perilaku audio dan bisu.
- Uji dua ronde pendek dengan urutan keping yang sama, satu dengan pewarna dan satu dengan aturan dasar. Catat apakah pewarna mengubah keputusan penempatan, memicu kombo yang disengaja, dan membuat penguji ingin bermain lagi. Minta penguji menjelaskan cara membuat sambungan dan alasan mereka memakai atau menyimpan energi. Gunakan hasilnya untuk memperbaiki keterbacaan dan balancing sebelum menambah fitur.

Sebelum implementasi, sepakati mekanik pewarna, pembagian anggota A dan B, serta tenggat tugas. Pekerjaan proyek menggunakan branch `dev/alvin`.
