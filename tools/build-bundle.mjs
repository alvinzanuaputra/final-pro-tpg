// Menggabungkan semua ES module di js/ menjadi SATU skrip biasa: script.js (di root).
// Kenapa: browser memblokir <script type="module"> dan import antar-file kalau index.html dibuka
// lewat klik ganda (file://). Skrip biasa tidak kena aturan itu.
//
// Pemakaian: node tools/build-bundle.mjs
// Jalankan ulang setiap kali ada file di js/ yang diubah.
//
// Cara kerja: tiap module dibungkus fungsi sendiri (scope terpisah, jadi nama variabel antar
// module tidak bentrok). `import { a, b as c } from './x.js'` → ambil dari hasil module x;
// `export ...` → nama itu dikembalikan module. Urutan module mengikuti ketergantungan.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'js');
const ENTRY = 'main';

const IMPORT_RE = /^\s*import\s*\{([^}]*)\}\s*from\s*['"]\.\/([\w-]+)\.js['"]\s*;?\s*$/;
const EXPORT_DECL_RE = /^(\s*)export\s+(async\s+function|function|class|const|let|var)\s+/;

function parse(name) {
  const lines = readFileSync(join(SRC, `${name}.js`), 'utf8').split('\n');
  const deps = [];
  const exportsList = [];
  const out = [];
  for (const line of lines) {
    const im = IMPORT_RE.exec(line);
    if (im) {
      const from = im[2];
      deps.push(from);
      const bindings = im[1].split(',').map((s) => s.trim()).filter(Boolean)
        .map((b) => { const [a, as] = b.split(/\s+as\s+/); return as ? `${a.trim()}: ${as.trim()}` : a.trim(); });
      out.push(`const { ${bindings.join(', ')} } = __mod[${JSON.stringify(from)}];`);
      continue;
    }
    if (/^\s*import\s/.test(line)) throw new Error(`${name}.js: bentuk import tidak didukung → ${line.trim()}`);
    const ex = EXPORT_DECL_RE.exec(line);
    if (ex) {
      const kind = ex[2];
      const rest = line.slice(ex[0].length);
      if (kind === 'const' || kind === 'let' || kind === 'var') {
        // bisa beberapa nama sekaligus: export const A = 1, B = 2;
        const names = [...rest.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]);
        exportsList.push(...names);
      } else {
        exportsList.push(/^([A-Za-z_$][\w$]*)/.exec(rest)[1]);
      }
      out.push(line.replace(/export\s+/, ''));
      continue;
    }
    if (/^\s*export\s/.test(line)) throw new Error(`${name}.js: bentuk export tidak didukung → ${line.trim()}`);
    out.push(line);
  }
  return { name, deps, exportsList, body: out.join('\n') };
}

// urutkan module: dependensi dulu
const modules = new Map();
const order = [];
function visit(name, stack = []) {
  if (order.includes(name)) return;
  if (stack.includes(name)) throw new Error(`Import melingkar: ${[...stack, name].join(' → ')}`);
  const m = modules.get(name) || parse(name);
  modules.set(name, m);
  for (const d of m.deps) visit(d, [...stack, name]);
  order.push(name);
}
visit(ENTRY);

const unused = readdirSync(SRC).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).filter((n) => !order.includes(n));

let code = `/* SandTilt — bundel otomatis dari js/*.js (JANGAN diedit langsung).
   Dibuat oleh: node tools/build-bundle.mjs
   Urutan module: ${order.join(', ')} */
(function () {
'use strict';
const __mod = {};
`;
for (const name of order) {
  const m = modules.get(name);
  code += `
// ===================================================================== js/${name}.js
__mod[${JSON.stringify(name)}] = (function () {
${m.body}
return { ${m.exportsList.join(', ')} };
})();
`;
}
code += '})();\n';

writeFileSync(join(ROOT, 'script.js'), code);

// ---- audio-data.js: semua audio sebagai base64, khusus untuk mode file:// (lihat js/audio.js)
const sfxDir = join(ROOT, 'assets', 'sfx'), musicDir = join(ROOT, 'assets', 'music');
const data = { sfx: {}, music: {}, loops: JSON.parse(readFileSync(join(musicDir, 'loops.json'), 'utf8')) };
for (const f of readdirSync(sfxDir).filter((f) => f.endsWith('.mp3'))) data.sfx[f.slice(0, -4)] = readFileSync(join(sfxDir, f)).toString('base64');
for (const f of readdirSync(musicDir).filter((f) => f.endsWith('.mp3'))) data.music[f.slice(0, -4)] = readFileSync(join(musicDir, f)).toString('base64');
const audioJs = `/* Audio SandTilt dalam base64 — hanya dipakai saat index.html dibuka lewat file://. Dibuat oleh tools/build-bundle.mjs */\nwindow.SANDTILT_AUDIO = ${JSON.stringify(data)};\n`;
writeFileSync(join(ROOT, 'assets', 'audio-data.js'), audioJs);
console.log(`assets/audio-data.js: ${Object.keys(data.sfx).length} sfx + ${Object.keys(data.music).length} musik, ${(audioJs.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`script.js: ${order.length} module (${order.join(' → ')}), ${(code.length / 1024).toFixed(1)} KB`);
if (unused.length) console.log(`Catatan: tidak dipakai oleh main.js → ${unused.join(', ')}`);
