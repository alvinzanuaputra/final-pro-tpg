import React from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Backdrop, BOARD, Flash, Footage, Logo, SlamText, SRC_H, SRC_W } from './components';
import { landings, SHOT } from './footage';
import { C, PIXEL_FONT, sec } from './theme';

// Draft 1 (uji pipeline): shot "crumble" + penutup logo.
// Shot lain dari storyboard docs/TRAILER-plan.md ditambahkan setelah direkam.

const CRUMBLE = SHOT.crumble;
const CRUMBLE_LEN = Math.min(CRUMBLE.frames, sec(6));
const OUTRO_LEN = sec(4);
export const TRAILER_FRAMES = CRUMBLE_LEN + OUTRO_LEN;

const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) } as const;

// Kamera: mulai close-up di dasar papan (piece pecah), lalu mundur memperlihatkan papan + panel.
const crumbleCam = (f: number) => {
  const t = interpolate(f, [sec(1.6), sec(3.4)], [0, 1], ease);
  const boardBottom = { x: BOARD.x + BOARD.w / 2, y: BOARD.y + BOARD.h * 0.78, zoom: 2.4 };
  const full = { x: SRC_W / 2 - 270, y: SRC_H / 2, zoom: 1 };   // game bergeser ke kanan, kiri untuk teks
  return {
    x: interpolate(t, [0, 1], [boardBottom.x, full.x]),
    y: interpolate(t, [0, 1], [boardBottom.y, full.y]),
    zoom: interpolate(t, [0, 1], [boardBottom.zoom, full.zoom]),
  };
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const sub = interpolate(frame, [sec(0.9), sec(1.3)], [0, 1], ease);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={230} />
      <div style={{ fontFamily: PIXEL_FONT, color: C.text, fontSize: 64, marginTop: 40, opacity: sub,
        transform: `translateY(${(1 - sub) * 20}px)` }}>
        PLAY FREE IN YOUR BROWSER
      </div>
      <div style={{ fontFamily: PIXEL_FONT, color: C.yellow, fontSize: 48, marginTop: 18, opacity: sub }}>
        sandtilt.vercel.app
      </div>
    </AbsoluteFill>
  );
};

export const Trailer: React.FC = () => {
  const frame = useCurrentFrame();
  const musicVol = interpolate(frame, [0, 10, TRAILER_FRAMES - sec(1.5), TRAILER_FRAMES], [0, 0.55, 0.55, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Backdrop />
      <Audio src={staticFile('game/music/game.mp3')} volume={musicVol} />

      <Sequence durationInFrames={CRUMBLE_LEN} name="crumble">
        <Footage name="crumble" frames={CRUMBLE.frames} cam={crumbleCam} height={1040} />
        {landings(CRUMBLE).map((f, i) => (
          <Sequence key={f} from={f} durationInFrames={sec(1)}>
            <Audio src={staticFile(`game/sfx/land-sand-${i % 3}.mp3`)} volume={0.9} />
          </Sequence>
        ))}
        <Sequence from={sec(3.6)} durationInFrames={CRUMBLE_LEN - sec(3.6)}>
          <SlamText text="TETRIS THAT CRUMBLES" x={70} y={540} size={84} align="left" hold={sec(2.1)} />
        </Sequence>
      </Sequence>

      <Sequence from={CRUMBLE_LEN} durationInFrames={OUTRO_LEN} name="outro">
        <Flash />
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
