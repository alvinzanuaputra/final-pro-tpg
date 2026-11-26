# Brand Guideline — SandTilt

**Sumber kebenaran = game itu sendiri.** Semua materi promosi (trailer, thumbnail, poster, halaman toko, slide presentasi)
harus memakai logo, warna, dan huruf yang sama persis dengan game. Jangan membuat versi baru.
Kalau tampilan game berubah, materi promosi ikut berubah, bukan sebaliknya.

## Logo

- Kata **SANDTILT**, huruf kapital, font **blok 3×5** milik game (`drawBlockText` di `js/font.js`), skala 3, jarak 1 kotak antarhuruf.
- Warna per huruf berurutan mengikuti 5 warna pasir (shade terang ×1.12): **merah, kuning, hijau, biru, ungu**, lalu
  berulang: S merah · A kuning · N hijau · D biru · T ungu · I merah · L kuning · T hijau.
- Bayangan: salinan logo warna `shadow` digeser 1 piksel game ke kanan-bawah.
- Gerak (video): naik-turun pelan per huruf, `sin(t·3 + k·0.7) × 1.2` piksel game, seperti layar judul.
- Latar logo: warna `bg` + hujan butir pasir 1×2 piksel (shade gelap ×0.91), seperti layar judul.
- Selalu tajam (*pixelated*), skala bilangan bulat. Jangan di-blur, diberi gradien, outline, atau efek 3D.

## Warna (palet `default`, `js/render.js`)

| Peran | Kode | Hex |
|---|---|---|
| Latar | `bg` | `#14121f` |
| Teks utama | `text` | `#ece8f5` |
| Teks redup | `dim` | `#8a84a8` |
| Aksen / sorotan | `accent` | `#f2c14e` |
| Bahaya | `danger` | `#ff4d5e` |
| Bingkai papan | `frame` | `#4a4470` |
| Bayangan | `shadow` | `#0b0a12` |
| Pasir 1–5 | `sand` | `#e8505b` `#f2c14e` `#3fbf8f` `#4c8bf5` `#b45ce0` |

Tema lain (hadiah prestasi) hanya muncul sebagai isi gameplay, bukan untuk identitas brand.

## Huruf

- Semua teks memakai font **bitmap 5×7** milik game (`drawText` di `js/font.js`), huruf kapital, dengan bayangan 1 titik warna `shadow`.
- Teks biasa = `text`; kata/baris yang disorot = `accent`. Tidak ada font luar.

## Untuk kode trailer

- `trailer/src/theme.ts` mengimpor `PALETTES` dari game; jangan menulis hex baru di trailer.
- Logo: komponen `GameLogo` / `SandRain`; teks: `GameText` / `SlamText`. Semuanya memanggil kode font game.
- Pengecualian: kilat putih `#fff` (sama dengan kilat clear di game).
