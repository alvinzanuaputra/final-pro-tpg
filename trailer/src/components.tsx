import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
// Teks memakai font 5x7 milik game (bukan font luar), lihat docs/BRAND.md
import { drawText, GLYPH_H, textWidthPx } from '../../js/font.js';
import { C } from './theme';

// Ukuran asli frame rekaman game (canvas 160x176 x5)
export const SRC_W = 800;
export const SRC_H = 880;
// Area papan di dalam frame rekaman (untuk close-up)
export const BOARD = { x: 20, y: 40, w: 420, h: 820 };

type Cam = { x: number; y: number; zoom: number };   // pusat kamera (koordinat frame rekaman) + zoom

/**
 * Footage gameplay hasil capture.mjs, diputar sebagai urutan PNG.
 * `cam` boleh berubah per frame (fungsi) untuk zoom/pan. Pixel art dijaga tajam (image-rendering: pixelated).
 */
export const Footage: React.FC<{
  name: string;
  frames: number;
  startAt?: number;
  cam?: (f: number) => Cam;
  height?: number;           // tinggi tampilan frame rekaman pada zoom 1
  shake?: (f: number) => number;
}> = ({ name, frames, startAt = 0, cam, height = 1000, shake }) => {
  const frame = useCurrentFrame();
  const { width, height: H } = useVideoConfig();
  const idx = Math.min(frames - 1, Math.max(0, startAt + frame));
  const c = cam ? cam(frame) : { x: SRC_W / 2, y: SRC_H / 2, zoom: 1 };
  const k = (height / SRC_H) * c.zoom;
  const s = shake ? shake(frame) : 0;
  const sx = s ? Math.sin(frame * 2.3) * s : 0;
  const sy = s ? Math.cos(frame * 3.1) * s : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={staticFile(`footage/${name}/${String(idx).padStart(4, '0')}.png`)}
        style={{
          position: 'absolute',
          width: SRC_W * k,
          height: SRC_H * k,
          left: width / 2 - c.x * k + sx,
          top: H / 2 - c.y * k + sy,
          imageRendering: 'pixelated',
        }}
      />
    </AbsoluteFill>
  );
};

/** Latar polos warna bg game (sama dengan latar di dalam rekaman, jadi tepi footage menyatu). */
export const Backdrop: React.FC = () => <AbsoluteFill style={{ backgroundColor: C.bg }} />;

/** Satu baris teks dengan font 5x7 game, digambar di canvas. px = ukuran satu titik glyph. */
export const GameText: React.FC<{ text: string; px: number; color?: string; shadow?: boolean; style?: React.CSSProperties }> = ({
  text, px, color = C.text, shadow = true, style,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = textWidthPx(text, px) + (shadow ? px : 0);
  const h = GLYPH_H * px + (shadow ? px : 0);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    if (shadow) drawText(ctx, text, px, px, C.shadow, px);
    drawText(ctx, text, 0, 0, color, px);
  }, [text, px, color, shadow, w, h]);
  return <canvas ref={ref} width={w} height={h} style={{ display: 'block', imageRendering: 'pixelated', ...style }} />;
};

/**
 * Judul yang "menghantam" masuk per kata (font game), lalu memudar keluar.
 * Baris dipisah dengan '\n'; `colors[i]` = warna baris ke-i (default teks game).
 */
export const SlamText: React.FC<{
  text: string;
  colors?: string[];
  px?: number;               // ukuran titik glyph
  x?: number;
  y?: number;
  align?: 'left' | 'center' | 'right';
  hold: number;              // lama tampil (frame) sebelum keluar
}> = ({ text, colors = [], px = 10, x = 960, y = 540, align = 'center', hold }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [hold, hold + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  const items = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  let n = 0;   // urutan kata global, untuk jeda masuk
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${tx}, -50%)`, opacity: out,
      display: 'flex', flexDirection: 'column', alignItems: items, gap: px * 3 }}>
      {text.split('\n').map((line, li) => (
        <div key={li} style={{ display: 'flex', gap: px * 6 }}>
          {line.split(' ').map((w, i) => {
            const p = spring({ frame: frame - n++ * 5, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
            return (
              <GameText key={i} text={w} px={px} color={colors[li] || C.text}
                style={{ transform: `scale(${interpolate(p, [0, 1], [2.2, 1])})`, opacity: Math.min(1, p * 3) }} />
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Kilat putih singkat (seperti kilat clear di game). */
export const Flash: React.FC<{ len?: number }> = ({ len = 8 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, len], [0.85, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  return <AbsoluteFill style={{ backgroundColor: '#fff', opacity: o }} />;
};
