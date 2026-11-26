import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, BOARD, Flash, Footage, GameText, SlamText, SRC_H, SRC_W } from './components';
import { GameLogo, SandRain } from './gameLogo';
import { eventFrames, SHOT } from './footage';
import { Duck, heartbeat, Sound, soundsFor, trophySound } from './sfx';
import { C, FPS, sec } from './theme';

// ----------------------------------------------------------------------------------------------------------------
// Trailer SandTilt (~45 dtk). Semua potongan jatuh di batas bar musik game (132 BPM -> 1 bar = 4 ketuk).
// Storyboard: docs/TRAILER-plan.md. Brand: docs/BRAND.md (logo, warna, huruf dari kode game).
// ----------------------------------------------------------------------------------------------------------------
const BAR = (4 * 60 / 132) * FPS;                       // 109.09 frame
const bars = (n: number) => Math.round(n * BAR);

type Side = 'right' | 'left';                            // posisi GAME di layar; teks di sisi sebaliknya
type Beat =
  | { kind: 'shot'; shot: string; from: number; bars: number; side: Side; text?: string; textAt?: number;
      closeup?: boolean; counter?: boolean; trophy?: { at: number; tier: 'silver' }; heartbeatUntil?: number; flashIn?: boolean }
  | { kind: 'card'; bars: number }
  | { kind: 'outro'; bars: number };

const BEATS: Beat[] = [
  // berhenti sebelum clear pertama di rekaman (frame 277), supaya papan masih berisi saat teks muncul
  { kind: 'shot', shot: 'crumble', from: 0, bars: 2.5, side: 'right', closeup: true, text: 'TETRIS THAT\nCRUMBLES', textAt: bars(1.3) },
  { kind: 'shot', shot: 'tilt', from: 10, bars: 2.5, side: 'left', text: 'TILT\nTHE BOARD', textAt: 12, flashIn: true },
  { kind: 'shot', shot: 'bridge', from: 0, bars: 2, side: 'right', text: 'CONNECT\nWALL TO WALL', textAt: 4 },
  { kind: 'shot', shot: 'chain', from: 0, bars: 3.5, side: 'left', text: 'CHAIN\nREACTIONS', textAt: 4, counter: true,
    trophy: { at: 66, tier: 'silver' } },
  { kind: 'shot', shot: 'gunpowder', from: 0, bars: 3, side: 'right', text: 'GUNPOWDER\nGOES BOOM', textAt: 26, flashIn: true },
  { kind: 'shot', shot: 'quake', from: 0, bars: 1.5, side: 'left', text: 'THE GROUND\nSHAKES', textAt: 8 },
  { kind: 'shot', shot: 'wind', from: 15, bars: 1.5, side: 'right', text: 'THE WIND\nPUSHES', textAt: 4 },
  { kind: 'shot', shot: 'force', from: 30, bars: 1.5, side: 'left', text: 'THE BOARD\nTIPS OVER', textAt: 4 },
  { kind: 'card', bars: 1.5 },
  { kind: 'shot', shot: 'save', from: 0, bars: 3, side: 'right', text: 'ONE PIECE\nFROM DEFEAT', textAt: 2, heartbeatUntil: 49,
    flashIn: true },
  { kind: 'outro', bars: 3 },
];

// posisi mulai tiap beat
const STARTS: number[] = [];
let acc = 0;
for (const b of BEATS) { STARTS.push(acc); acc += bars(b.bars); }
export const TRAILER_FRAMES = acc;

// ----------------------------------------------------------------------------------------------------------------
// suara: SFX dari event rekaman + duck musik (seperti game)
type Cue = { at: number; s: Sound };
const CUES: Cue[] = [];
const DUCKS: { at: number; d: Duck }[] = [];
BEATS.forEach((b, i) => {
  if (b.kind === 'card') {
    const t = trophySound('gold');
    t.sounds.forEach((s) => CUES.push({ at: STARTS[i] + 30, s }));
    DUCKS.push({ at: STARTS[i] + 30, d: t.duck });
    return;
  }
  if (b.kind !== 'shot') return;
  const meta = SHOT[b.shot];
  const len = bars(b.bars);
  for (let f = b.from; f < Math.min(meta.frames, b.from + len); f++) {
    for (const e of meta.log[f].ev) {
      const { sounds, duck } = soundsFor(e);
      const at = STARTS[i] + f - b.from;
      sounds.forEach((s) => CUES.push({ at, s }));
      if (duck) DUCKS.push({ at, d: duck });
    }
  }
  if (b.trophy) {
    const t = trophySound(b.trophy.tier);
    t.sounds.forEach((s) => CUES.push({ at: STARTS[i] + b.trophy!.at - b.from, s }));
    DUCKS.push({ at: STARTS[i] + b.trophy.at - b.from, d: t.duck });
  }
  if (b.heartbeatUntil) {
    for (let f = 0; f < b.heartbeatUntil - b.from - 10; f += 45) heartbeat().forEach((s) => CUES.push({ at: STARTS[i] + f, s }));
  }
});

const MUSIC = 0.5;
function musicVolume(f: number) {
  let v = 1;
  for (const { at, d } of DUCKS) {
    const end = at + sec(d.dur);
    if (f < at - 2 || f > end + sec(0.25)) continue;
    const k = f < at ? (at - f) / 2 : f <= end ? 0 : (f - end) / sec(0.25);   // 0 = turun penuh
    v = Math.min(v, d.depth + (1 - d.depth) * Math.min(1, k));
  }
  const fade = interpolate(f, [0, 6, TRAILER_FRAMES - sec(2), TRAILER_FRAMES], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return MUSIC * v * fade;
}

// ----------------------------------------------------------------------------------------------------------------
// kamera
const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SHIFT = 270;   // geser game ke samping (koordinat rekaman) supaya ada ruang teks

function camFor(b: Extract<Beat, { kind: 'shot' }>) {
  const meta = SHOT[b.shot];
  // "punch": zoom kecil setiap chain >= 2 dan ledakan
  const hits = [...eventFrames(meta, 'clear', (d) => Number(d.chain) >= 2), ...eventFrames(meta, 'explode')].map((f) => f - b.from);
  const len = bars(b.bars);
  const baseX = SRC_W / 2 + (b.side === 'right' ? -SHIFT : SHIFT - 40);
  return (f: number) => {
    let punch = 0;
    for (const h of hits) if (f >= h && f < h + 18) punch = Math.max(punch, 0.05 * (1 - (f - h) / 18));
    const drift = interpolate(f, [0, len], [1, 1.035]);   // dorongan pelan supaya gambar hidup
    if (b.closeup) {
      const t = interpolate(f, [bars(0.9), bars(1.3)], [0, 1], { ...ease, easing: (x) => x * x * (3 - 2 * x) });
      return {
        x: interpolate(t, [0, 1], [BOARD.x + BOARD.w / 2, baseX]),
        y: interpolate(t, [0, 1], [BOARD.y + BOARD.h * 0.8, SRC_H / 2]),
        zoom: interpolate(t, [0, 1], [2.6, 1]) * (t < 1 ? 1 : drift) + punch,
      };
    }
    return { x: baseX, y: SRC_H / 2, zoom: drift + punch };
  };
}

// ----------------------------------------------------------------------------------------------------------------
// komponen per beat
const textX = (side: Side) => (side === 'right' ? 90 : 1240);
const textPx = (text: string) => Math.min(10, Math.floor(640 / (Math.max(...text.split('\n').map((l) => l.length)) * 6)));

/** Angka chain besar yang ikut naik setiap clear (x2, x3, x4). */
const ChainCounter: React.FC<{ frames: number[]; x: number }> = ({ frames, x }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = frames.filter((c) => c <= f).length;
  if (k < 2) return null;
  const p = spring({ frame: f - frames[k - 1], fps, config: { damping: 10, stiffness: 260 } });
  return (
    <div style={{ position: 'absolute', left: x, top: 640, transform: `scale(${interpolate(p, [0, 1], [1.8, 1])})`, transformOrigin: 'left center' }}>
      <GameText text={`X${k}`} px={22} color={C.accent} />
    </div>
  );
};

const ShotBeat: React.FC<{ b: Extract<Beat, { kind: 'shot' }> }> = ({ b }) => {
  const meta = SHOT[b.shot];
  const len = bars(b.bars);
  const clears = eventFrames(meta, 'clear').map((f) => f - b.from).filter((f) => f >= 0);
  const text = b.text || '';
  return (
    <AbsoluteFill>
      <Footage name={b.shot} frames={meta.frames} startAt={b.from} cam={camFor(b)} height={1040} />
      {text && (
        <Sequence from={b.textAt || 0} durationInFrames={len - (b.textAt || 0)}>
          <SlamText text={text} colors={[C.text, C.accent]} x={textX(b.side)} y={b.counter ? 440 : 540} px={textPx(text)}
            align="left" hold={len - (b.textAt || 0) - 8} />
        </Sequence>
      )}
      {b.counter && <ChainCounter frames={clears} x={textX(b.side)} />}
      {b.flashIn && <Flash len={10} />}
    </AbsoluteFill>
  );
};

/** Kartu fitur: trofi (ikon dari game) + leaderboard + kontrol. */
const Card: React.FC<{ len: number }> = ({ len }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tiers = ['bronze', 'silver', 'gold', 'secret'];
  const lines: [string, string][] = [['12 ACHIEVEMENTS', C.text], ['GLOBAL LEADERBOARD', C.accent], ['KEYBOARD OR TOUCH', C.dim]];
  const out = interpolate(f, [len - 8, len], [1, 0], ease);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <SandRain unit={8} density={0.6} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 36 }}>
        <div style={{ display: 'flex', gap: 48 }}>
          {tiers.map((t, i) => {
            const p = spring({ frame: f - 6 - i * 6, fps, config: { damping: 9, stiffness: 200 } });
            return <Img key={t} src={staticFile(`game/image/trophy-${t}.svg`)}
              style={{ width: 150, height: 150, imageRendering: 'pixelated', transform: `scale(${p})` }} />;
          })}
        </div>
        {lines.map(([t, c], i) => {
          const p = interpolate(f, [30 + i * 10, 40 + i * 10], [0, 1], ease);
          return <GameText key={t} text={t} px={i === 0 ? 9 : 7} color={c} style={{ opacity: p, transform: `translateY(${(1 - p) * 16}px)` }} />;
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Penutup = layar judul game: hujan pasir + logo, lalu ajakan main (font & warna game).
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const sub = interpolate(frame, [sec(0.9), sec(1.3)], [0, 1], ease);
  const credit = interpolate(frame, [sec(1.6), sec(2)], [0, 1], ease);
  return (
    <AbsoluteFill>
      <SandRain unit={8} />
      <GameLogo unit={8} y={330} />
      <AbsoluteFill style={{ alignItems: 'center', top: 560, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
        <GameText text="PLAY FREE IN YOUR BROWSER" px={7} color={C.text} />
        <GameText text="SANDTILT.VERCEL.APP" px={6} color={C.accent} style={{ marginTop: 30 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 70, opacity: credit }}>
        <GameText text="MADE BY AZHAR AND ALVIN" px={4} color={C.dim} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------------------------------------------------------
export const Trailer: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <Audio src={staticFile('game/music/game.mp3')} volume={musicVolume} loop />
    {BEATS.map((b, i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={bars(b.bars)} name={b.kind === 'shot' ? b.shot : b.kind}>
        {b.kind === 'shot' && <ShotBeat b={b} />}
        {b.kind === 'card' && <Card len={bars(b.bars)} />}
        {b.kind === 'outro' && (<><Flash /><Outro /></>)}
      </Sequence>
    ))}
    {CUES.map((c, i) => (
      <Sequence key={`s${i}`} from={c.at + Math.round((c.s.delay || 0) * FPS)} durationInFrames={sec(3)} layout="none">
        <Audio src={staticFile(`game/sfx/${c.s.file}.mp3`)} volume={c.s.vol} playbackRate={c.s.rate || 1} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
