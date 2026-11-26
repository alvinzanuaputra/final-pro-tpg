// Data rekaman dari capture.mjs (jalankan `npm run capture` dulu).
import crumble from '../public/footage/crumble/meta.json';

export type ShotLog = { score: number; chain: number; clears: number; grains: number; explosions: number }[];
export type ShotMeta = { name: string; frames: number; log: ShotLog };

export const SHOT = { crumble } as Record<string, ShotMeta>;

/** Frame-frame saat piece mendarat (jumlah butir pasir melonjak) -> untuk SFX yang pas. */
export function landings(meta: ShotMeta, minJump = 200): number[] {
  const out: number[] = [];
  for (let i = 1; i < meta.log.length; i++) if (meta.log[i].grains - meta.log[i - 1].grains >= minJump) out.push(i);
  return out;
}
