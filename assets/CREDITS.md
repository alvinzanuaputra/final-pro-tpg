# Kredit & Lisensi Aset

| Folder | Isi | Sumber | Lisensi |
|---|---|---|---|
| `sfx/` | Efek suara (menu, mendarat, ledakan, gemuruh, derit, jingle 8-bit) | Kenney — *Impact Sounds*, *Interface Sounds*, *Sci-fi Sounds*, *Digital Audio*, *Music Jingles* (kenney.nl) | CC0 1.0 (domain publik) |
| `sfx/wind.mp3`, `sfx/tilt-slide.mp3` | Angin & pasir meluncur | Dibuat sendiri dengan ffmpeg (`tools/build-sfx.sh`) | Milik tim |
| `music/` | Soundtrack chiptune `title.mp3` & `game.mp3` | Komposisi orisinal (`tools/compose-music.mjs`) | Milik tim |
| `image/trophy-*.svg` | Ikon trofi pixel art | Dibuat sendiri (`tools/make-trophies.mjs`) | Milik tim |
| `font/` | Kenney Mini Square, Kenney Pixel | Kenney — *Kenney Fonts* (kenney.nl) | CC0 1.0 (domain publik) |

Aset Kenney berlisensi CC0, bebas dipakai tanpa wajib atribusi. Kami tetap mencantumkannya sebagai bentuk terima kasih.

## Membangun ulang aset

```
tools/build-sfx.sh <folder paket Kenney yang sudah di-unzip>
node tools/compose-music.mjs
node tools/make-trophies.mjs assets/image
```

Butuh `ffmpeg` (dengan `libmp3lame`) dan Node.js.
