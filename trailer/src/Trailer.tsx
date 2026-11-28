import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, BOARD, Flash, Footage, GameText, SlamText, SRC_H, SRC_W } from './components';
import { GameLogo, SandRain } from './gameLogo';
import { eventFrames, SHOTS_BY_LANG } from './footage';
import { Duck, heartbeat, Sound, soundsFor, trophySound } from './sfx';
import { C, FPS, sec } from './theme';
import { COPY, Lang } from './copy';

// ----------------------------------------------------------------------------------------------------------------
// Trailer SandTilt. Potongan jatuh di ketukan musik game (132 BPM -> 1 bar = 4 ketuk).
// Storyboard: docs/TRAILER-plan.md. Brand: docs/BRAND.md (logo, warna, huruf dari kode game).
// ----------------------------------------------------------------------------------------------------------------
export const BAR = (4 * 60 / 132) * FPS;                // 109.09 frame
export const bars = (n: number) => Math.round(n * BAR);

export type Side = 'right' | 'left';                            // posisi GAME di layar; teks di sisi sebaliknya
export type Beat =
  | { kind: 'shot'; shot: string; from: number; bars: number; side: Side; textAt?: number;
      closeup?: boolean; counter?: boolean; trophy?: { at: number; tier: 'silver' }; heartbeatUntil?: number; flashIn?: boolean;
      accent?: string }   // warna baris kedua teks (default aksen kuning)
  | { kind: 'card'; bars: number }
  | { kind: 'outro'; bars: number };

// Tempo cepat: tiap adegan selesai +-1 detik setelah momen utamanya (clear/ledakan terakhir), lalu langsung pindah.
// Panjang dibulatkan ke atas ke ketukan musik (1/4 bar) supaya potongan tetap di irama.
export const fit = (from: number, end: number) => Math.ceil((end - from) / (BAR / 4)) / 4;     // -> jumlah bar
export const AFTER = sec(1);
// Timing dihitung dari rekaman bahasa masing-masing (timing geser/putar piece bisa menggeser momen beberapa frame).
export const ev = (lang: Lang, shot: string, name: string, filter?: (d: Record<string, unknown>) => boolean) =>
  eventFrames(SHOTS_BY_LANG[lang][shot], name, filter);
export const lastHit = (lang: Lang, shot: string) => Math.max(...ev(lang, shot, 'clear'), ...ev(lang, shot, 'explode'));

const beatsFor = (L: Lang): Beat[] => [
  // intro: dua piece mendarat (close-up lalu mundur), berhenti sebelum clear pertama di rekaman
  { kind: 'shot', shot: 'crumble', from: 20, bars: fit(20, 196), side: 'right', closeup: true, textAt: 108 },
  { kind: 'shot', shot: 'tilt', from: 0, bars: fit(0, lastHit(L, 'tilt') + AFTER), side: 'left', textAt: 4, flashIn: true },
  { kind: 'shot', shot: 'bridge', from: 0, bars: fit(0, ev(L, 'bridge', 'clear')[0] + AFTER), side: 'right', textAt: 4 },
  { kind: 'shot', shot: 'chain', from: 0, bars: fit(0, lastHit(L, 'chain') + AFTER), side: 'left', textAt: 4, counter: true,
    trophy: { at: ev(L, 'chain', 'clear', (d) => d.chain === 3)[0], tier: 'silver' } },
  { kind: 'shot', shot: 'gunpowder', from: 0, bars: fit(0, lastHit(L, 'gunpowder') + AFTER), side: 'right', textAt: 4, flashIn: true },
  { kind: 'shot', shot: 'quake', from: 0, bars: fit(0, ev(L, 'quake', 'eventStart')[0] + sec(1.2)), side: 'left', textAt: 4 },
  { kind: 'shot', shot: 'wind', from: 0, bars: fit(0, ev(L, 'wind', 'windPush')[1] + sec(0.4)), side: 'right', textAt: 4 },
  { kind: 'shot', shot: 'force', from: 0, bars: fit(0, lastHit(L, 'force') + sec(0.6)), side: 'left', textAt: 4 },
  { kind: 'card', bars: 1.5 },
  { kind: 'shot', shot: 'save', from: 0, bars: fit(0, lastHit(L, 'save') + AFTER), side: 'right', textAt: 2,
    heartbeatUntil: ev(L, 'save', 'clear')[0], flashIn: true, accent: C.danger },   // merah = warna garis bahaya di game
  { kind: 'outro', bars: 2.5 },
];

// ----------------------------------------------------------------------------------------------------------------
// Satu "cut" = daftar beat -> posisi mulai, durasi total, SFX (dari event rekaman) dan volume musik (duck seperti game).
// Dipakai versi horizontal (Trailer) dan vertikal (Short).
type Cue = { at: number; s: Sound };
export type Cut = { beats: Beat[]; starts: number[]; total: number; cues: Cue[]; musicVolume: (f: number) => number };

const MUSIC = 0.5;
export function buildCut(beats: Beat[], lang: Lang): Cut {
  const starts: number[] = [];
  let acc = 0;
  for (const b of beats) { starts.push(acc); acc += bars(b.bars); }
  const total = acc;
  const cues: Cue[] = [];
  const ducks: { at: number; d: Duck }[] = [];
  beats.forEach((b, i) => {
    if (b.kind === 'card') {
      const t = trophySound('gold');
      t.sounds.forEach((s) => cues.push({ at: starts[i] + 30, s }));
      ducks.push({ at: starts[i] + 30, d: t.duck });
      return;
    }
    if (b.kind !== 'shot') return;
    const meta = SHOTS_BY_LANG[lang][b.shot];     // SFX dari rekaman bahasa ini (timing geser/putar bisa beda)
    const len = bars(b.bars);
    for (let f = b.from; f < Math.min(meta.frames, b.from + len); f++) {
      for (const e of meta.log[f].ev) {
        const { sounds, duck } = soundsFor(e);
        const at = starts[i] + f - b.from;
        sounds.forEach((s) => cues.push({ at, s }));
        if (duck) ducks.push({ at, d: duck });
      }
    }
    if (b.trophy && b.trophy.at >= b.from && b.trophy.at < b.from + len) {
      const t = trophySound(b.trophy.tier);
      t.sounds.forEach((s) => cues.push({ at: starts[i] + b.trophy!.at - b.from, s }));
      ducks.push({ at: starts[i] + b.trophy.at - b.from, d: t.duck });
    }
    if (b.heartbeatUntil) {
      for (let f = 0; f < b.heartbeatUntil - b.from - 10; f += 45) heartbeat().forEach((s) => cues.push({ at: starts[i] + f, s }));
    }
  });
  const musicVolume = (f: number) => {
    let v = 1;
    for (const { at, d } of ducks) {
      const end = at + sec(d.dur);
      if (f < at - 2 || f > end + sec(0.25)) continue;
      const k = f < at ? (at - f) / 2 : f <= end ? 0 : (f - end) / sec(0.25);   // 0 = turun penuh
      v = Math.min(v, d.depth + (1 - d.depth) * Math.min(1, k));
    }
    const fade = interpolate(f, [0, 6, total - sec(2), total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return MUSIC * v * fade;
  };
  return { beats, starts, total, cues, musicVolume };
}

/** Musik game + semua SFX dari sebuah cut. */
export const CutAudio: React.FC<{ cut: Cut }> = ({ cut }) => (
  <>
    <Audio src={staticFile('game/music/game.mp3')} volume={cut.musicVolume} loop />
    {cut.cues.map((c, i) => (
      <Sequence key={`s${i}`} from={c.at + Math.round((c.s.delay || 0) * FPS)} durationInFrames={sec(3)} layout="none">
        <Audio src={staticFile(`game/sfx/${c.s.file}.mp3`)} volume={c.s.vol} playbackRate={c.s.rate || 1} />
      </Sequence>
    ))}
  </>
);

const CUTS: Record<Lang, Cut> = { en: buildCut(beatsFor('en'), 'en'), id: buildCut(beatsFor('id'), 'id') };
export const TRAILER_FRAMES: Record<Lang, number> = { en: CUTS.en.total, id: CUTS.id.total };

// ----------------------------------------------------------------------------------------------------------------
// kamera
export const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SHIFT = 270;   // geser game ke samping (koordinat rekaman) supaya ada ruang teks

function camFor(b: Extract<Beat, { kind: 'shot' }>, lang: Lang) {
  const meta = SHOTS_BY_LANG[lang][b.shot];
  // "punch": zoom kecil setiap chain >= 2 dan ledakan
  const hits = [...eventFrames(meta, 'clear', (d) => Number(d.chain) >= 2), ...eventFrames(meta, 'explode')].map((f) => f - b.from);
  const len = bars(b.bars);
  const baseX = SRC_W / 2 + (b.side === 'right' ? -SHIFT : SHIFT - 40);
  return (f: number) => {
    let punch = 0;
    for (const h of hits) if (f >= h && f < h + 18) punch = Math.max(punch, 0.05 * (1 - (f - h) / 18));
    const drift = interpolate(f, [0, len], [1, 1.035]);   // dorongan pelan supaya gambar hidup
    if (b.closeup) {
      const t = interpolate(f, [76, 110], [0, 1], { ...ease, easing: (x) => x * x * (3 - 2 * x) });
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
export const ChainCounter: React.FC<{ frames: number[]; x: number; top?: number; px?: number; origin?: string }> = ({
  frames, x, top = 640, px = 22, origin = 'left center' }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = frames.filter((c) => c <= f).length;
  if (k < 2) return null;
  const p = spring({ frame: f - frames[k - 1], fps, config: { damping: 10, stiffness: 260 } });
  return (
    <div style={{ position: 'absolute', left: x, top, transform: `scale(${interpolate(p, [0, 1], [1.8, 1])})`, transformOrigin: origin }}>
      <GameText text={`X${k}`} px={px} color={C.accent} />
    </div>
  );
};

const ShotBeat: React.FC<{ b: Extract<Beat, { kind: 'shot' }>; lang: Lang }> = ({ b, lang }) => {
  const meta = SHOTS_BY_LANG[lang][b.shot];
  const len = bars(b.bars);
  const clears = eventFrames(meta, 'clear').map((f) => f - b.from).filter((f) => f >= 0);
  const text = COPY[lang].shots[b.shot] || '';
  return (
    <AbsoluteFill>
      <Footage name={`${lang}/${b.shot}`} frames={meta.frames} startAt={b.from} cam={camFor(b, lang)} height={1040} />
      {text && (
        <Sequence from={b.textAt || 0} durationInFrames={len - (b.textAt || 0)}>
          <SlamText text={text} colors={[C.text, b.accent || C.accent]} x={textX(b.side)} y={b.counter ? 440 : 540} px={textPx(text)}
            align="left" hold={len - (b.textAt || 0) - 8} />
        </Sequence>
      )}
      {b.counter && <ChainCounter frames={clears} x={textX(b.side)} />}
      {b.flashIn && <Flash len={10} />}
    </AbsoluteFill>
  );
};

/** Kartu fitur: trofi (ikon dari game) + leaderboard + kontrol. */
const Card: React.FC<{ len: number; lang: Lang }> = ({ len, lang }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tiers = ['bronze', 'silver', 'gold', 'secret'];
  const [l1, l2, l3] = COPY[lang].card;
  const lines: [string, string][] = [[l1, C.text], [l2, C.accent], [l3, C.dim]];
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
const Outro: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const sub = interpolate(frame, [sec(0.9), sec(1.3)], [0, 1], ease);
  return (
    <AbsoluteFill>
      <SandRain unit={8} />
      <GameLogo unit={8} y={330} />
      <AbsoluteFill style={{ alignItems: 'center', top: 560, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
        <GameText text={COPY[lang].play} px={7} color={C.text} />
        <GameText text="SANDTILT.VERCEL.APP" px={6} color={C.accent} style={{ marginTop: 30 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------------------------------------------------------
/** lang: 'en' (komposisi Trailer) atau 'id' (komposisi TrailerID). Potongan, rekaman, dan suara identik. */
export const Trailer: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => (
  <AbsoluteFill>
    <Backdrop />
    <CutAudio cut={CUTS[lang]} />
    {CUTS[lang].beats.map((b, i) => (
      <Sequence key={i} from={CUTS[lang].starts[i]} durationInFrames={bars(b.bars)} name={b.kind === 'shot' ? b.shot : b.kind}>
        {b.kind === 'shot' && <ShotBeat b={b} lang={lang} />}
        {b.kind === 'card' && <Card len={bars(b.bars)} lang={lang} />}
        {b.kind === 'outro' && (<><Flash /><Outro lang={lang} /></>)}
      </Sequence>
    ))}
  </AbsoluteFill>
);
