// Contact sheet: beberapa frame tiap shot dalam satu PNG, untuk mengecek hasil rekaman.
//   node capture/sheet.mjs out.png tilt:20,60,80,120 chain:10,40,80,130
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'footage');
const [out, ...specs] = process.argv.slice(2);
const rows = specs.map((s) => {
  const [name, list] = s.split(':');
  return { name, frames: list.split(',').map(Number) };
});
const img = (n, f) => 'data:image/png;base64,' + readFileSync(`${ROOT}/${n}/${String(f).padStart(4, '0')}.png`).toString('base64');
const html = '<body style="margin:0;background:#000;font:14px monospace;color:#fff">' + rows.map((r) =>
  `<div style="display:flex;gap:4px;margin-bottom:4px">${r.frames.map((f) =>
    `<div><div>${r.name} #${f}</div><img src="${img(r.name, f)}" style="width:240px;height:264px;image-rendering:pixelated"></div>`).join('')}</div>`).join('') + '</body>';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 4 * 244, height: 100 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
