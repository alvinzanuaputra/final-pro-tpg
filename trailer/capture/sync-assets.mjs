// Salin musik dan SFX game ke public/game/ supaya bisa dipakai Remotion (staticFile).
// Sumber tetap di assets/ game; folder tujuan di-gitignore.
import { cp, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', '..', 'assets');
const DST = resolve(HERE, '..', 'public', 'game');
await rm(DST, { recursive: true, force: true });
for (const d of ['music', 'sfx']) await cp(resolve(SRC, d), resolve(DST, d), { recursive: true });
console.log('aset game disalin ke public/game/');
