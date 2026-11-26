// Data rekaman dari capture.mjs (jalankan `npm run capture` dulu).
import crumble from '../public/footage/crumble/meta.json';
import tilt from '../public/footage/tilt/meta.json';
import bridge from '../public/footage/bridge/meta.json';
import chain from '../public/footage/chain/meta.json';
import gunpowder from '../public/footage/gunpowder/meta.json';
import save from '../public/footage/save/meta.json';
import quake from '../public/footage/quake/meta.json';
import wind from '../public/footage/wind/meta.json';
import force from '../public/footage/force/meta.json';
import type { GameEvent } from './sfx';

export type FrameLog = { score: number; chain: number; clears: number; grains: number; explosions: number; ev: GameEvent[] };
export type ShotMeta = { name: string; frames: number; log: FrameLog[] };

export const SHOT = { crumble, tilt, bridge, chain, gunpowder, save, quake, wind, force } as unknown as Record<string, ShotMeta>;

/** Frame (dalam rekaman) saat event `name` terjadi, opsional disaring. */
export function eventFrames(meta: ShotMeta, name: string, filter?: (d: GameEvent[1]) => boolean): number[] {
  const out: number[] = [];
  meta.log.forEach((st, i) => st.ev.forEach(([n, d]) => { if (n === name && (!filter || filter(d))) out.push(i); }));
  return out;
}
