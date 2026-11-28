// Membuat zip siap upload ke gameedukasi.com: dist/sandtilt-gameedukasi.zip
// Hanya file yang dibutuhkan game yang ikut. Skrip pengembangan (tools/*.sh, *.py, *.mjs),
// js/, server/, node_modules/ tidak ikut, karena gameedukasi menolak zip yang berisi
// ekstensi "berbahaya" seperti .sh.
//
// Pemakaian: node tools/build-upload.mjs   (atau: npm run upload)

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const STAGE = join(DIST, 'sandtilt');
const ZIP = join(DIST, 'sandtilt-gameedukasi.zip');

// Ekstensi yang biasa diblokir uploader hosting. Kalau ada yang lolos ke staging, build gagal.
const BLOCKED = new Set(['.sh', '.bash', '.py', '.bat', '.cmd', '.ps1', '.exe', '.dll', '.mjs',
  '.cgi', '.pl', '.jar', '.vbs', '.msi', '.com', '.scr', '.sqlite']);

// 1. Bundle js/ → script.js
execFileSync(process.execPath, [join(ROOT, 'tools', 'build-bundle.mjs')], { stdio: 'inherit' });

// 2. Salin file yang dibutuhkan ke dist/sandtilt/
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(STAGE, 'api'), { recursive: true });
for (const f of ['index.html', 'style.css', 'script.js', 'database.sql']) cpSync(join(ROOT, f), join(STAGE, f));
cpSync(join(ROOT, 'assets'), join(STAGE, 'assets'), { recursive: true });
cpSync(join(ROOT, 'api', 'leaderboard.php'), join(STAGE, 'api', 'leaderboard.php'));
if (existsSync(join(ROOT, 'api', 'db_config.php'))) {
  cpSync(join(ROOT, 'api', 'db_config.php'), join(STAGE, 'api', 'db_config.php'));
} else {
  console.warn('PERINGATAN: api/db_config.php belum ada. Salin dari db_config.example.php dan isi kredensial MySQL, lalu jalankan ulang.');
}

// 3. Pastikan tidak ada ekstensi terlarang
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const bad = walk(STAGE).filter((p) => BLOCKED.has(extname(p).toLowerCase()));
if (bad.length) {
  console.error('Ada file berekstensi terlarang:\n' + bad.map((p) => '  ' + relative(STAGE, p)).join('\n'));
  process.exit(1);
}

// 4. Zip (isi folder langsung di akar zip, index.html di paling atas)
if (process.platform === 'win32') {
  // tar.exe bawaan Windows (bsdtar) bisa membuat zip dengan path bergaya "/".
  execFileSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'),
    ['-a', '-c', '-f', ZIP, '-C', STAGE, ...readdirSync(STAGE)], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-q', ZIP, '.'], { cwd: STAGE, stdio: 'inherit' });
}
console.log(`Selesai: ${relative(ROOT, ZIP)}`);
