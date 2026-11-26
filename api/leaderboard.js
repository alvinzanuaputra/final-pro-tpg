// =============================================================================
// VERCEL FUNCTION — API LEADERBOARD PUSAT SANDTILT
// URL: https://sandtilt.vercel.app/api/leaderboard?action=...
// Database: Postgres dari Neon (Vercel → Storage → Neon). Variabel DATABASE_URL terisi otomatis.
// Tabel dibuat otomatis saat pertama kali dipanggil (lihat server/schema.sql).
//
// Variabel lingkungan (opsional):
//   ALLOWED_ORIGINS  daftar origin tambahan yang boleh memanggil API, pisahkan dengan koma
//                    (mis. "https://nama.itch.io,https://contoh.github.io")
//   IP_SALT          garam untuk hash IP (pembatasan jumlah permainan per IP)
// =============================================================================

import { neon } from '@neondatabase/serverless';
import { handle, SCHEMA } from '../server/leaderboard-core.js';

// Origin bawaan yang boleh memanggil API dari browser. Origin milik deployment ini sendiri
// (termasuk preview *.vercel.app) selalu diizinkan.
const DEFAULT_ORIGINS = [
  'https://sandtilt.vercel.app',
  'https://gameedukasi.com', 'https://www.gameedukasi.com',
  'http://gameedukasi.com', 'http://www.gameedukasi.com',
];
const PATTERNS = [
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,     // tes lokal
  /^https:\/\/[a-z0-9-]+\.itch\.zone$/,             // game HTML di itch.io
];

function originAllowed(origin, host) {
  if (!origin) return true;                          // bukan dari browser lintas situs (curl, server)
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (DEFAULT_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  if (PATTERNS.some((re) => re.test(origin))) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

let db = null;
let ready = null;
function getDb() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (!db) {
    const sql = neon(url);
    db = { query: (text, params = []) => sql.query(text, params) };
    ready = (async () => { for (const s of SCHEMA) await sql.query(s); })();
    ready.catch(() => { db = null; ready = null; });   // coba lagi di permintaan berikutnya
  }
  return db;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  if (!originAllowed(origin, req.headers.host)) {
    return res.status(403).json({ success: false, message: 'Origin tidak diizinkan.', code: 'FORBIDDEN_ORIGIN' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  const database = getDb();
  if (!database) return res.status(200).json({ success: false, message: 'Database tidak tersedia.', code: 'NO_DB' });

  let body = req.body ?? {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();

  try {
    await ready;
    const out = await handle(database, {
      method: req.method, action: String(req.query.action || ''), query: req.query, body,
      ip, ipSalt: process.env.IP_SALT || 'sandtilt',
    });
    return res.status(200).json(out);
  } catch (e) {
    console.error('SandTilt leaderboard:', e);
    return res.status(200).json({ success: false, message: 'Terjadi kesalahan server.', code: 'SERVER_ERROR' });
  }
}
