# Trailer SandTilt

Gameplay direkam frame per frame dari game asli (Playwright), lalu dirakit jadi video dengan Remotion.
Rencana & storyboard: [../docs/TRAILER-plan.md](../docs/TRAILER-plan.md).

```
cd trailer
npm install
npx playwright install chromium     # sekali saja
npm run capture -- --lang=en        # rekam semua shot dengan UI game berbahasa Inggris -> public/footage/en/<shot>/
npm run capture -- --lang=id        # ... berbahasa Indonesia -> public/footage/id/<shot>/
npm run capture -- crumble          # rekam satu shot
npm run studio                      # pratinjau & edit di browser
npm run render                      # -> out/sandtilt-trailer.mp4 (Inggris, 1920x1080, 60 fps)
npm run render:id                   # -> out/sandtilt-trailer-id.mp4 (Indonesia)
npm run render:short                # -> out/sandtilt-short.mp4 (vertikal 1080x1920, 15 dtk, Inggris)
npm run render:short-id             # -> out/sandtilt-short-id.mp4 (vertikal, Indonesia)
```

- `capture/shots.mjs` — daftar shot: seed, durasi, dan input per frame (`tap`/`down`/`up` + kode tombol).
  Jam browser dibekukan dan `Math.random` dibuat tetap, jadi hasil rekaman selalu sama.
- **Papan alami.** Papan setiap shot dibangun dengan menjatuhkan piece tetris sungguhan (simulasi game yang
  menghancurkannya jadi pasir), bukan menggambar pasir. Urutan piece-nya dicari otomatis:
  `node capture/search.mjs <goal> [jumlah papan] [seed] [tag]` -> `capture/plans/<goal>[-tag].json`.
  Goal: `chain` (chain terpanjang), `gunpowder` (ledakan + batu hancur), `tilt` (clear karena dimiringkan),
  `save` (pasir lewat garis bahaya lalu diselamatkan), `board` (papan biasa untuk event). Pencarian berjalan di
  Node memakai modul game langsung (tanpa browser); satu papan + semua kemungkinan piece pemicu sekitar 3 detik.
- `capture/scenario.js` — membangun papan dari plan, lalu memainkan pemicunya: piece diarahkan dengan tombol ke
  posisi target dan dijatuhkan, atau tilt ditahan. Tepat sebelum pemicu, seluruh keadaan game (rng, tick, timer)
  dikembalikan ke keadaan saat pencarian, jadi chain/ledakan di rekaman sama persis dengan hasil pencarian.
  Event game per frame dicatat ke `meta.json` untuk SFX.
- `node capture/capture.mjs <shot> --dry` menjalankan shot tanpa menyimpan frame dan mencetak kapan clear/chain/ledakan terjadi.
- `capture/sheet.mjs` — contact sheet untuk mengecek rekaman: `node capture/sheet.mjs cek.png chain:0,40,90 tilt:0,78`.
- `src/copy.ts` — semua teks trailer per bahasa (`en`, `id`); istilah Indonesia mengikuti game.
- `src/Short.tsx` — versi vertikal 15 dtk untuk Reels/TikTok/Shorts: papan saja (besar), teks di atas, potongan lebih rapat.
- `src/Trailer.tsx` — urutan adegan, kamera (zoom/pan), teks, dan SFX. SFX mendarat dipasang otomatis
  dari `meta.json` rekaman.
- Logo, warna, dan huruf wajib dari kode game: [../docs/BRAND.md](../docs/BRAND.md).
- Footage, aset game yang disalin (`public/game/`), dan hasil render tidak di-commit.
