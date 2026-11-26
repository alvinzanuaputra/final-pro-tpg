import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, LOGO_COLORS, PIXEL_FONT } from './theme';

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

/** Latar gelap dengan garis-garis halus bergerak pelan, seperti latar game. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const off = (frame * 0.4) % 48;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        backgroundImage: `repeating-linear-gradient(135deg, ${C.bgLine} 0 24px, ${C.bg} 24px 48px)`,
        backgroundPosition: `${off}px ${off}px`,
      }}
    />
  );
};

/** Judul besar yang "menghantam" masuk per kata, lalu memudar keluar. */
export const SlamText: React.FC<{
  text: string;
  color?: string;
  size?: number;
  x?: number | string;
  y?: number | string;
  align?: 'left' | 'center' | 'right';
  hold: number;           // lama tampil (frame) sebelum keluar
}> = ({ text, color = C.text, size = 120, x = '50%', y = '50%', align = 'center', hold }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  const out = interpolate(frame, [hold, hold + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, transform: `translate(${tx}, -50%)`,
        fontFamily: PIXEL_FONT, fontSize: size, lineHeight: 1, color, opacity: out,
        whiteSpace: 'nowrap', textShadow: `0 ${size / 16}px 0 rgba(0,0,0,.55)`, letterSpacing: size * 0.04,
      }}
    >
      {words.map((w, i) => {
        const p = spring({ frame: frame - i * 5, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: size * 0.3,
            transform: `scale(${interpolate(p, [0, 1], [2.2, 1])})`, opacity: Math.min(1, p * 3) }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Logo SANDTILT: tiap huruf jatuh seperti piece lalu memantul, warna mengikuti logo game. */
export const Logo: React.FC<{ size?: number }> = ({ size = 220 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', fontFamily: PIXEL_FONT, fontSize: size, lineHeight: 1 }}>
      {'SANDTILT'.split('').map((ch, i) => {
        const p = spring({ frame: frame - i * 4, fps, config: { damping: 9, stiffness: 160 } });
        return (
          <span key={i} style={{ color: LOGO_COLORS[i], display: 'inline-block',
            transform: `translateY(${interpolate(p, [0, 1], [-700, 0])}px)`,
            textShadow: `0 ${size / 14}px 0 rgba(0,0,0,.5)` }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
};

/** Kilat putih singkat (pemanis potongan / ledakan). */
export const Flash: React.FC<{ len?: number }> = ({ len = 8 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, len], [0.85, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  return <AbsoluteFill style={{ backgroundColor: '#fff', opacity: o }} />;
};
