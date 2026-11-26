import React, { useLayoutEffect, useRef } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
// Logo digambar dengan kode font game itu sendiri -> selalu identik dengan layar judul game.
import { blockTextWidth, drawBlockText } from '../../js/font.js';
import { P, SAND } from './theme';

// Butir hujan pasir seperti layar judul game: 1x2 piksel game, 20-60 piksel game/detik, shade 2.
function makeRain(count: number, w: number, h: number) {
  let s = 1234567;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: count }, () => ({ x: rnd() * w, y0: rnd() * h, v: 20 + rnd() * 40, c: 1 + ((rnd() * 5) | 0) }));
}

/** Hujan pasir layar judul game. `unit` = ukuran 1 piksel game dalam piksel video. */
export const SandRain: React.FC<{ unit?: number; density?: number }> = ({ unit = 8, density = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    const gw = Math.ceil(width / unit), gh = Math.ceil(height / unit) + 4;
    ctx.save();
    ctx.scale(unit, unit);
    for (const r of makeRain(Math.round((gw * gh * density) / 260), gw, gh)) {
      ctx.fillStyle = SAND(r.c, 2);
      ctx.fillRect(Math.round(r.x), Math.round((r.y0 + r.v * (frame / fps)) % gh) - 2, 1, 2);
    }
    ctx.restore();
  }, [frame, fps, width, height, unit, density]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
};

/**
 * Logo SANDTILT persis seperti game: font blok 3x5 skala 3, warna pasir 1..5 (shade terang),
 * bayangan 1 piksel game, bob pelan. Tambahan trailer: huruf jatuh masuk satu per satu.
 */
export const GameLogo: React.FC<{ unit?: number; y?: number }> = ({ unit = 8, y = 330 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    const t = frame / fps;
    const gw = Math.ceil(width / unit);
    const word = 'SANDTILT', sc = 3;
    let x = Math.floor((gw - blockTextWidth(word, sc)) / 2);
    const gy = Math.round(y / unit);
    ctx.save();
    ctx.scale(unit, unit);
    for (let k = 0; k < word.length; k++) {
      const drop = spring({ frame: frame - k * 4, fps, config: { damping: 11, stiffness: 170 } });
      const fall = Math.round((1 - drop) * -(gy + 20));
      const bob = Math.round(Math.sin(t * 3 + k * 0.7) * 1.2);
      drawBlockText(ctx, word[k], x + 1, gy + bob + fall + 1, P.shadow, sc);
      drawBlockText(ctx, word[k], x, gy + bob + fall, SAND((k % 5) + 1, 0), sc);
      x += 4 * sc;
    }
    ctx.restore();
  }, [frame, fps, width, height, unit, y]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
};
