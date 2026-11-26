# Trailer SandTilt

Gameplay direkam frame per frame dari game asli (Playwright), lalu dirakit jadi video dengan Remotion.
Rencana & storyboard: [../docs/TRAILER-plan.md](../docs/TRAILER-plan.md).

```
cd trailer
npm install
npx playwright install chromium     # sekali saja
npm run capture                     # rekam semua shot -> public/footage/<shot>/
npm run capture -- crumble          # rekam satu shot
npm run studio                      # pratinjau & edit di browser
npm run render                      # -> out/sandtilt-trailer.mp4 (1920x1080, 60 fps)
```

- `capture/shots.mjs` — daftar shot: seed, durasi, dan input per frame (`tap`/`down`/`up` + kode tombol).
  Jam browser dibekukan dan `Math.random` dibuat tetap, jadi hasil rekaman selalu sama.
- `capture/scenario.js` — disuntikkan ke halaman saat rekam (kode game tidak diubah): menyusun papan
  (`rect`, `mound`), mengganti piece, level, skor, memicu event, dan mencatat event game per frame ke `meta.json`.
  `node capture/capture.mjs <shot> --dry` menjalankan skenario tanpa menyimpan frame dan mencetak kapan clear/chain/ledakan terjadi.
- `capture/sheet.mjs` — contact sheet untuk mengecek rekaman: `node capture/sheet.mjs cek.png chain:0,40,90 tilt:0,78`.
- Shot yang ada: `crumble` (pecah jadi pasir), `tilt` (miring -> clear), `chain` (x4 + naik level + trofi),
  `gunpowder` (ledakan + batu hancur), `quake`, `wind`, `force` (event), `save` (nyaris kalah -> selamat).
- `src/Trailer.tsx` — urutan adegan, kamera (zoom/pan), teks, dan SFX. SFX mendarat dipasang otomatis
  dari `meta.json` rekaman.
- Logo, warna, dan huruf wajib dari kode game: [../docs/BRAND.md](../docs/BRAND.md).
- Footage, aset game yang disalin (`public/game/`), dan hasil render tidak di-commit.
