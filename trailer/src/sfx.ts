// Pemetaan event game -> suara, mengikuti js/audio.js (file, volume, pitch, duck musik) supaya suara trailer = suara game.
// Event berasal dari meta.json rekaman (dicatat per frame oleh capture.mjs).

export type GameEvent = [string, Record<string, number | boolean | string>];
export type Sound = { file: string; vol: number; rate?: number; delay?: number };   // delay dalam detik
export type Duck = { depth: number; dur: number };                                  // musik turun ke `depth` selama `dur` detik

let n = 0;   // pilih varian bergiliran (pengganti pick() acak di game, supaya render deterministik)
const pick = (base: string, k: number) => `${base}-${n++ % k}`;

export function soundsFor([name, d]: GameEvent): { sounds: Sound[]; duck?: Duck } {
  switch (name) {
    case 'land': {
      const s: Sound[] = [];
      if (d.hard) s.push({ file: 'harddrop', vol: 0.8 });
      if (d.mat === 1) s.push({ file: pick('land-stone', 2), vol: 0.75 });
      else if (d.mat === 2) s.push({ file: 'land-gun', vol: 0.8 });
      else s.push({ file: pick('land-sand', 3), vol: 0.9 });
      return { sounds: s };
    }
    case 'move':
      return { sounds: [{ file: 'move', vol: 0.35 }] };
    case 'rotate':
      return { sounds: [{ file: 'rotate', vol: 0.5 }] };
    case 'tiltStart':
      return { sounds: [{ file: 'tilt-slide', vol: 0.8 }, { file: 'force-creak', vol: 0.25, rate: 1.4 }] };
    case 'clear': {
      const chain = Number(d.chain || 1);
      const rate = Math.min(2, 1 + 0.09 * (chain - 1));
      const s: Sound[] = [{ file: 'clear', vol: 0.75, rate }];
      if (chain > 1) s.push({ file: 'chain', vol: 0.55, rate, delay: 0.08 });
      return { sounds: s, duck: { depth: 0.55, dur: 0.3 } };
    }
    case 'cleared':
      return { sounds: [{ file: pick('land-sand', 3), vol: 0.45, rate: 1.6 }] };
    case 'explode': {
      const s: Sound[] = [{ file: pick('explode', 3), vol: 1 }, { file: 'explode-low', vol: 0.9, delay: 0.02 }];
      if (Number(d.stones) > 0) s.push({ file: pick('land-stone', 2), vol: 0.7, rate: 0.8, delay: 0.12 });
      return { sounds: s, duck: { depth: 0.25, dur: 0.8 } };
    }
    case 'eventWarn':
      return { sounds: [{ file: 'jingle-warn', vol: 0.7 }] };
    case 'eventStart':
      if (d.type === 'quake') return { sounds: [{ file: 'quake-rumble', vol: 1 }, { file: 'explode-low', vol: 0.6, rate: 0.7 }], duck: { depth: 0.4, dur: 1.4 } };
      if (d.type === 'wind') return { sounds: [{ file: 'wind', vol: 0.9 }] };
      if (d.type === 'force') return { sounds: [{ file: 'force-creak', vol: 0.9, rate: 0.8 }, { file: 'tilt-slide', vol: 0.7, rate: 0.7, delay: 0.15 }] };
      return { sounds: [] };
    case 'windPush':
      return { sounds: [{ file: 'wind-push', vol: 0.45 }] };
    case 'levelUp':
      return { sounds: [{ file: 'jingle-level', vol: 0.8 }], duck: { depth: 0.3, dur: 0.9 } };
    default:
      return { sounds: [] };
  }
}

export const trophySound = (tier: 'bronze' | 'silver' | 'gold' | 'secret'): { sounds: Sound[]; duck: Duck } =>
  ({ sounds: [{ file: `trophy-${tier}`, vol: 0.85 }], duck: { depth: 0.3, dur: 0.7 } });

export const heartbeat = (): Sound[] => [{ file: 'heartbeat', vol: 0.9, rate: 0.75 }, { file: 'heartbeat', vol: 0.6, rate: 0.7, delay: 0.18 }];
