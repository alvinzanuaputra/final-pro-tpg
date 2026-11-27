// Data rekaman dari capture.mjs (jalankan `npm run capture -- --lang=en` dan `--lang=id` dulu).
// Rekaman tiap bahasa UI game ada di public/footage/<lang>/<shot>. Momen gameplay (clear, chain, ledakan) identik
// di kedua bahasa; yang berbeda hanya teks game dan timing geser/putar piece.
import en_crumble from '../public/footage/en/crumble/meta.json';
import en_tilt from '../public/footage/en/tilt/meta.json';
import en_bridge from '../public/footage/en/bridge/meta.json';
import en_chain from '../public/footage/en/chain/meta.json';
import en_chain_quiet from '../public/footage/en/chain-quiet/meta.json';
import en_gunpowder from '../public/footage/en/gunpowder/meta.json';
import en_save from '../public/footage/en/save/meta.json';
import en_quake from '../public/footage/en/quake/meta.json';
import en_wind from '../public/footage/en/wind/meta.json';
import en_force from '../public/footage/en/force/meta.json';
import id_crumble from '../public/footage/id/crumble/meta.json';
import id_tilt from '../public/footage/id/tilt/meta.json';
import id_bridge from '../public/footage/id/bridge/meta.json';
import id_chain from '../public/footage/id/chain/meta.json';
import id_chain_quiet from '../public/footage/id/chain-quiet/meta.json';
import id_gunpowder from '../public/footage/id/gunpowder/meta.json';
import id_save from '../public/footage/id/save/meta.json';
import id_quake from '../public/footage/id/quake/meta.json';
import id_wind from '../public/footage/id/wind/meta.json';
import id_force from '../public/footage/id/force/meta.json';
import type { GameEvent } from './sfx';
import type { Lang } from './copy';

export type FrameLog = { score: number; chain: number; clears: number; grains: number; explosions: number; ev: GameEvent[] };
export type ShotMeta = { name: string; frames: number; log: FrameLog[] };

export const SHOTS_BY_LANG = {
  en: { 'crumble': en_crumble, 'tilt': en_tilt, 'bridge': en_bridge, 'chain': en_chain, 'chain-quiet': en_chain_quiet, 'gunpowder': en_gunpowder, 'save': en_save, 'quake': en_quake, 'wind': en_wind, 'force': en_force },
  id: { 'crumble': id_crumble, 'tilt': id_tilt, 'bridge': id_bridge, 'chain': id_chain, 'chain-quiet': id_chain_quiet, 'gunpowder': id_gunpowder, 'save': id_save, 'quake': id_quake, 'wind': id_wind, 'force': id_force },
} as unknown as Record<Lang, Record<string, ShotMeta>>;

/** Untuk timing potongan (sama di kedua bahasa). */
export const SHOT = SHOTS_BY_LANG.id;

/** Frame (dalam rekaman) saat event `name` terjadi, opsional disaring. */
export function eventFrames(meta: ShotMeta, name: string, filter?: (d: GameEvent[1]) => boolean): number[] {
  const out: number[] = [];
  meta.log.forEach((st, i) => st.ev.forEach(([n, d]) => { if (n === name && (!filter || filter(d))) out.push(i); }));
  return out;
}
