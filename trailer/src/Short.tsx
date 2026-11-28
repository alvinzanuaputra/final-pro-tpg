import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, BOARD, Flash, GameText, SlamText } from './components';
import { GameLogo, SandRain } from './gameLogo';
import { eventFrames, SHOTS_BY_LANG } from './footage';
import { BAR, Beat, bars, buildCut, CutAudio, ease, ev, fit, lastHit } from './Trailer';
import { C, sec } from './theme';
import { COPY, Lang } from './copy';

// ----------------------------------------------------------------------------------------------------------------
// Versi vertikal 15 detik untuk sosmed (Reels / TikTok / Shorts), 1080x1920.
// Rekaman, SFX, dan teks sama dengan trailer utama; potongan lebih rapat, hanya papan yang ditampilkan (besar).
// ----------------------------------------------------------------------------------------------------------------
export const SHORT_W = 1080;
export const SHORT_H = 1920;
const TARGET = sec(15);

// papan di layar
const K = 1.62;                                     // skala piksel rekaman -> layar
const BW = Math.round(BOARD.w * K), BH = Math.round(BOARD.h * K);
const BL = Math.round((SHORT_W - BW) / 2), BT = 480;

type ShotBeat = Extract<Beat, { kind: 'shot' }>;
const shot = (b: Omit<ShotBeat, 'kind' | 'side'>): ShotBeat => ({ kind: 'shot', side: 'right', ...b });

// Tiap adegan dimulai tepat sebelum aksinya dan berhenti +-0.7 dtk setelah momen terakhir.
const AFTER = sec(0.7);
const shotsFor = (L: Lang): ShotBeat[] => [
  shot({ shot: 'crumble', from: 22, bars: fit(22, 120), textAt: 0 }),
  shot({ shot: 'tilt', from: 32, bars: fit(32, lastHit(L, 'tilt') + AFTER), textAt: 0, flashIn: true }),
  // rekaman chain tanpa toast trofi (toast game melebar keluar area papan yang dipotong)
  shot({ shot: 'chain-quiet', from: 30, bars: fit(30, lastHit(L, 'chain-quiet') + AFTER), textAt: 0, counter: true }),
  shot({ shot: 'gunpowder', from: 34, bars: fit(34, lastHit(L, 'gunpowder') + AFTER), textAt: 0, flashIn: true }),
  shot({ shot: 'save', from: 0, bars: fit(0, lastHit(L, 'save') + AFTER), textAt: 0,
    heartbeatUntil: ev(L, 'save', 'clear')[0], flashIn: true, accent: C.danger }),
];
function beatsFor(L: Lang): Beat[] {
  const shots = shotsFor(L);
  const used = shots.reduce((a, b) => a + bars(b.bars), 0);
  return [...shots, { kind: 'outro', bars: (TARGET - used) / BAR }];   // sisa waktu untuk logo
}
const CUTS = { en: buildCut(beatsFor('en'), 'en'), id: buildCut(beatsFor('id'), 'id') };
export const SHORT_FRAMES: Record<Lang, number> = { en: CUTS.en.total, id: CUTS.id.total };

// ----------------------------------------------------------------------------------------------------------------
/** Hanya area papan dari rekaman, diperbesar; zoom kecil saat chain/ledakan, dorongan pelan sepanjang adegan. */
const Board: React.FC<{ b: ShotBeat; lang: Lang }> = ({ b, lang }) => {
  const f = useCurrentFrame();
  const meta = SHOTS_BY_LANG[lang][b.shot];
  const len = bars(b.bars);
  const idx = Math.min(meta.frames - 1, b.from + f);
  const hits = [...eventFrames(meta, 'clear', (d) => Number(d.chain) >= 2), ...eventFrames(meta, 'explode')].map((h) => h - b.from);
  let punch = 0;
  for (const h of hits) if (f >= h && f < h + 18) punch = Math.max(punch, 0.04 * (1 - (f - h) / 18));
  const scale = interpolate(f, [0, len], [1, 1.03]) + punch;
  return (
    <div style={{ position: 'absolute', left: BL, top: BT, width: BW, height: BH, overflow: 'hidden',
      transform: `scale(${scale})`, transformOrigin: '50% 60%' }}>
      <Img src={staticFile(`footage/${lang}/${b.shot}/${String(idx).padStart(4, '0')}.png`)}
        style={{ position: 'absolute', left: -BOARD.x * K, top: -BOARD.y * K, width: 800 * K, height: 880 * K, imageRendering: 'pixelated' }} />
    </div>
  );
};

/** Angka chain di tengah, di bawah teks. */
const Counter: React.FC<{ frames: number[] }> = ({ frames }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = frames.filter((c) => c <= f).length;
  if (k < 2) return null;
  const p = spring({ frame: f - frames[k - 1], fps, config: { damping: 10, stiffness: 260 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', top: 360 }}>
      <GameText text={`X${k}`} px={13} color={C.accent} style={{ transform: `scale(${interpolate(p, [0, 1], [1.8, 1])})` }} />
    </AbsoluteFill>
  );
};

const textPx = (text: string) => Math.min(12, Math.floor(960 / (Math.max(...text.split('\n').map((l) => l.length)) * 6)));

const ShortShot: React.FC<{ b: ShotBeat; lang: Lang }> = ({ b, lang }) => {
  const len = bars(b.bars);
  const clears = eventFrames(SHOTS_BY_LANG[lang][b.shot], 'clear').map((f) => f - b.from).filter((f) => f >= 0);
  const text = COPY[lang].shots[b.shot] || '';
  return (
    <AbsoluteFill>
      <Board b={b} lang={lang} />
      <SlamText text={text} colors={[C.text, b.accent || C.accent]} x={SHORT_W / 2} y={b.counter ? 150 : 240}
        px={textPx(text)} align="center" hold={len - 6} />
      {b.counter && <Counter frames={clears} />}
      {b.flashIn && <Flash len={8} />}
    </AbsoluteFill>
  );
};

const ShortOutro: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame();
  const sub = interpolate(f, [sec(0.6), sec(1)], [0, 1], ease);
  return (
    <AbsoluteFill>
      <SandRain unit={8} />
      <GameLogo unit={10} y={720} />
      <AbsoluteFill style={{ alignItems: 'center', top: 1010, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
        <GameText text={COPY[lang].play} px={lang === 'en' ? 6 : 7} color={C.text} />
        <GameText text="SANDTILT.VERCEL.APP" px={6} color={C.accent} style={{ marginTop: 34 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------------------------------------------------------
export const Short: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => (
  <AbsoluteFill>
    <Backdrop />
    <CutAudio cut={CUTS[lang]} />
    {CUTS[lang].beats.map((b, i) => (
      <Sequence key={i} from={CUTS[lang].starts[i]} durationInFrames={bars(b.bars)} name={b.kind === 'shot' ? b.shot : b.kind}>
        {b.kind === 'shot' && <ShortShot b={b} lang={lang} />}
        {b.kind === 'outro' && (<><Flash /><ShortOutro lang={lang} /></>)}
      </Sequence>
    ))}
  </AbsoluteFill>
);
