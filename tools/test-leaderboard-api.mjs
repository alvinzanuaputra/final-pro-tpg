// Tes logika API leaderboard pusat (server/leaderboard-core.js) tanpa Neon: pakai SQLite bawaan Node.
// Pemakaian: node tools/test-leaderboard-api.mjs
//
// Opsional, tes juga versi PHP dengan skenario yang sama:
//   php -S 127.0.0.1:8765   (di folder root, dengan SQLite fallback)
//   node tools/test-leaderboard-api.mjs http://127.0.0.1:8765/api/leaderboard.php

import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { handle, SCHEMA, publicId } from '../server/leaderboard-core.js';

const phpUrl = process.argv[2];
let clock = 1_764_000_000;          // detik palsu supaya bisa "memajukan waktu"

let call;
if (phpUrl) {
  // Versi PHP tidak bisa dipercepat jamnya: durasi diuji dengan permainan singkat yang sudah ditunggu.
  call = async (method, action, data = {}) => {
    const url = method === 'GET' ? `${phpUrl}?action=${action}&${new URLSearchParams(data)}` : `${phpUrl}?action=${action}`;
    const r = await fetch(url, method === 'GET' ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return r.json();
  };
} else {
  const sqlite = new DatabaseSync(':memory:');
  for (const s of SCHEMA) sqlite.exec(s);
  const db = { query: async (sql, params = []) => sqlite.prepare(sql.replace(/\$(\d+)/g, '?$1')).all(...params) };
  call = (method, action, data = {}) => handle(db, method === 'GET'
    ? { method, action, query: data, ip: '1.2.3.4', now: clock }
    : { method, action, body: data, ip: '1.2.3.4', now: clock });
}
const wait = async (sec) => { if (phpUrl) await new Promise((r) => setTimeout(r, sec * 1000)); else clock += sec; };

const tag = Math.random().toString(36).slice(2, 6);
const A = { token: `aaaaaaaa-test-${tag}-0000-000000000001`, name: `Ani${tag}` };
const B = { token: `bbbbbbbb-test-${tag}-0000-000000000002`, name: `Budi${tag}` };
const C = { token: `cccccccc-test-${tag}-0000-000000000003`, name: `Cici${tag}` };
const ok = (r, msg) => assert.equal(r.success, true, `${msg}: ${JSON.stringify(r)}`);
const code = (r, c, msg) => assert.equal(r.code, c, `${msg}: ${JSON.stringify(r)}`);
const game = { score: 500, max_chain: 2, level: 1, clears: 2, duration_sec: 6 };

// 1. klaim nama
ok(await call('POST', 'claim_name', { token: A.token, player_name: A.name }), 'A klaim nama');
code(await call('POST', 'claim_name', { token: B.token, player_name: A.name.toUpperCase() }), 'NAME_TAKEN', 'B pakai nama A');

// 2. submit tanpa run ditolak
code(await call('POST', 'submit', { token: A.token, player_name: A.name, ...game }), 'NO_RUN', 'submit tanpa run');

// 3. run normal
let run = await call('POST', 'start_run', { token: A.token });
ok(run, 'start_run');
assert.equal(run.player_id, publicId(A.token));
code(await call('POST', 'submit', { token: A.token, player_name: A.name, run_id: run.run_id, ...game }), 'INVALID_SCORE', 'durasi melebihi jam server');
run = await call('POST', 'start_run', { token: A.token });
await wait(2);
code(await call('POST', 'submit', { token: B.token, player_name: B.name, run_id: run.run_id, ...game }), 'INVALID_RUN', 'run milik orang lain');
let r = await call('POST', 'submit', { token: A.token, player_name: A.name, run_id: run.run_id, ...game });
ok(r, 'submit A');
assert.equal(r.new_best, true);
const rankA = r.rank_weekly;
if (!phpUrl) assert.equal(rankA, 1);          // DB PHP bisa berisi data tes sebelumnya
code(await call('POST', 'submit', { token: A.token, player_name: A.name, run_id: run.run_id, ...game }), 'INVALID_RUN', 'run dipakai dua kali');

// 4. nama bentrok saat submit tidak menghabiskan run
run = await call('POST', 'start_run', { token: B.token });
await wait(2);
code(await call('POST', 'submit', { token: B.token, player_name: A.name, run_id: run.run_id, ...game, score: 900 }), 'NAME_TAKEN', 'B submit dengan nama A');
r = await call('POST', 'submit', { token: B.token, player_name: B.name, run_id: run.run_id, ...game, score: 900 });
ok(r, 'B submit ulang dengan nama sendiri');
assert.ok(r.rank_weekly <= rankA, 'B (900) di atas A (500)');

// 5. skor tidak wajar
run = await call('POST', 'start_run', { token: A.token });
await wait(2);
code(await call('POST', 'submit', { token: A.token, player_name: A.name, run_id: run.run_id, ...game, score: 99_999_999 }), 'INVALID_SCORE', 'skor mustahil');

// 5b. REGRESI anti-injeksi: skor & clears client-authoritative WAJIB terikat waktu nyata.
// run yang gagal INVALID_SCORE tetap terpakai, jadi tiap percobaan butuh run baru.
const freshRun = async (who) => { const x = await call('POST', 'start_run', { token: who.token }); await wait(6); return x.run_id; };

// Exploit lama: clears digelembungkan → plafon melar → skor 2 miliar. Dulu DITERIMA, kini harus ditolak.
code(await call('POST', 'submit', { token: A.token, player_name: A.name, run_id: await freshRun(A),
  score: 2_000_000_000, max_chain: 255, level: 999, clears: 200_000, duration_sec: 6 }), 'INVALID_SCORE', 'injeksi: clears raksasa');

// Fix #1: clears melebihi ~5/detik ditolak walau skor kecil (6 dtk → maks ~35 clears).
code(await call('POST', 'submit', { token: A.token, player_name: A.name, run_id: await freshRun(A),
  score: 1000, max_chain: 2, level: 1, clears: 100, duration_sec: 6 }), 'INVALID_SCORE', 'injeksi: clears > waktu');

// Fix #2: skor melebihi plafon laju waktu ditolak walau clears masih dalam batas (6 dtk → maks ~121k).
code(await call('POST', 'submit', { token: A.token, player_name: A.name, run_id: await freshRun(A),
  score: 5_000_000, max_chain: 8, level: 7, clears: 30, duration_sec: 6 }), 'INVALID_SCORE', 'injeksi: skor > laju waktu');

// Pemain jujur dengan skor jauh lebih tinggi dari skor dasar tes TETAP diterima (bukan false-positive).
r = await call('POST', 'submit', { token: C.token, player_name: C.name, run_id: await freshRun(C),
  score: 40_000, max_chain: 5, level: 3, clears: 10, duration_sec: 6 });
ok(r, 'jujur: skor wajar diterima');

// 6. papan tidak membocorkan token
for (const tab of ['weekly', 'alltime']) {
  const g = await call('GET', 'get', { tab, pid: publicId(A.token) });
  ok(g, `get ${tab}`);
  const text = JSON.stringify(g);
  assert.ok(!text.includes(A.token) && !text.includes(B.token), 'token bocor di papan');
  const mineRows = g.data.filter((x) => x.player_id === publicId(A.token) || x.player_id === publicId(B.token));
  assert.equal(mineRows.length, 2, `${tab}: dua pemain tes ada di papan`);
  assert.equal(g.mine.player_name, A.name);
  assert.ok(g.mine.rank >= 2, `${tab}: A di bawah B`);
}

// 7. pembatasan run per IP (hanya versi Node: PHP tes lokal memakai IP yang sama untuk semua tes)
if (!phpUrl) {
  let last;
  for (let i = 0; i < 40; i++) last = await call('POST', 'start_run', { token: A.token });
  code(last, 'RATE_LIMIT', 'banjir start_run');
}

console.log(`OK — semua tes leaderboard lulus (${phpUrl ? 'PHP ' + phpUrl : 'Node + SQLite'})`);
