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
- `src/Trailer.tsx` — urutan adegan, kamera (zoom/pan), teks, dan SFX. SFX mendarat dipasang otomatis
  dari `meta.json` rekaman.
- Logo, warna, dan huruf wajib dari kode game: [../docs/BRAND.md](../docs/BRAND.md).
- Footage, aset game yang disalin (`public/game/`), dan hasil render tidak di-commit.
