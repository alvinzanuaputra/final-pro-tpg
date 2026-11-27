import { store } from './util.js';

// Ganti bahasa: Indonesia (bawaan) ↔ Inggris.
// Kunci terjemahan = teks Indonesia aslinya, jadi kode tetap mudah dibaca: t('MAIN') → 'PLAY'.
// Bagian yang berubah ditulis {nama} dan diisi lewat vars: t('TERBAIK: {n}', { n: 120 }).
// Teks yang tidak ada di kamus tampil apa adanya (nama pemain, angka, dll.).

export const LANGS = ['id', 'en'];
export const LANG_NAMES = { id: 'INDONESIA', en: 'ENGLISH' };

let lang = LANGS.includes(store.get('lang', 'id')) ? store.get('lang', 'id') : 'id';
const listeners = [];

export function getLang() { return lang; }
export function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l;
  store.set('lang', l);
  for (const fn of listeners) fn(l);
}
export function nextLang() { setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]); return lang; }
export function onLangChange(fn) { listeners.push(fn); }

export function t(key, vars) {
  let s = lang === 'en' && EN[key] !== undefined ? EN[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}

// Teks di index.html (tombol sentuh, kotak nama, kredit). Elemen bertanda data-i18n="kunci" diisi
// textContent; data-i18n-aria / data-i18n-ph / data-i18n-alt mengisi aria-label / placeholder / alt.
// Teks Indonesia aslinya disimpan di elemen saat pertama kali dibaca, lalu dipakai sebagai kunci.
export function applyDom(root = document) {
  document.documentElement.lang = lang;
  for (const [attr, prop] of [['i18n', null], ['i18nAria', 'aria-label'], ['i18nPh', 'placeholder'], ['i18nAlt', 'alt']]) {
    const sel = `[data-${attr.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`;
    for (const el of root.querySelectorAll(sel)) {
      const keyAttr = attr + 'Key';
      if (!el.dataset[keyAttr]) el.dataset[keyAttr] = prop ? el.getAttribute(prop) : el.innerHTML.trim();
      const key = el.dataset[keyAttr];
      if (prop) el.setAttribute(prop, t(key));
      else el.innerHTML = t(key);
    }
  }
}

const EN = {
  // ---------------------------------------------------------------- layar judul & menu
  'KLIK / TAP UNTUK MULAI': 'CLICK / TAP TO START',
  'TETRIS PASIR YANG BISA MIRING': 'SAND TETRIS THAT TILTS',
  'TERBAIK: {n}': 'BEST: {n}',
  'PEMAIN: {name}': 'PLAYER: {name}',
  'GESER': 'MOVE',
  'PUTAR': 'ROTATE',
  'JATUH': 'DROP',
  'TAHAN': 'HOLD',
  'MIRING': 'TILT',
  'JEDA': 'PAUSE',
  'SUARA: MATI': 'SOUND: OFF',
  'MUSIK: MATI': 'MUSIC: OFF',
  'MAIN': 'PLAY',
  'PERINGKAT': 'LEADERBOARD',
  'PRESTASI': 'ACHIEVEMENTS',
  'PENGATURAN': 'SETTINGS',
  'KREDIT': 'CREDITS',
  'MAIN TUTORIAL': 'PLAY TUTORIAL',
  'LEWATI TUTORIAL': 'SKIP TUTORIAL',
  'LANJUT': 'RESUME',
  'ULANG': 'RESTART',
  'MENU UTAMA': 'MAIN MENU',
  'KEMBALI': 'BACK',
  'NAMA: {name}': 'NAME: {name}',
  'ISI NAMA': 'SET NAME',
  'SUARA: {v}': 'SOUND: {v}',
  'SEMUA': 'ALL',
  'EFEK SAJA': 'SFX ONLY',
  'MATI': 'OFF',
  'TEMA: {v}': 'THEME: {v}',
  'BAHASA: {v}': 'LANGUAGE: {v}',
  'BAHASA': 'LANGUAGE',
  'KLASIK': 'CLASSIC',
  'SENJA': 'DUSK',
  'KONTRAS': 'CONTRAST',
  'KERTAS': 'PAPER',
  '{n} TEMA LAGI: HADIAH PRESTASI': '{n} MORE THEMES FROM TROPHIES',

  // ---------------------------------------------------------------- CARA MAIN
  'CARA MAIN': 'HOW TO PLAY',
  'TAHAN L / R': 'HOLD L / R',
  'TAHAN Q / E': 'HOLD Q / E',
  'BALOK YANG MENDARAT HANCUR JADI PASIR.': 'BLOCKS CRUMBLE INTO SAND WHEN THEY LAND.',
  'SAMBUNG SATU WARNA DARI DINDING KIRI KE KANAN: JEMBATAN HILANG, DAPAT SKOR.': 'LINK ONE COLOR FROM THE LEFT WALL TO THE RIGHT: THE BRIDGE CLEARS FOR POINTS.',
  '{tilt} UNTUK MEMIRINGKAN PAPAN. PASIR IKUT MENGALIR.': '{tilt} TO TILT THE BOARD. THE SAND FLOWS WITH IT.',
  'MESIU MELEDAK SAAT KENA CLEAR. BATU KAKU, TIDAK LONGSOR.': 'GUNPOWDER EXPLODES WHEN CLEARED. STONE IS RIGID AND NEVER SLIDES.',
  'PASIR LEWAT GARIS MERAH ATAS = KALAH.': 'SAND OVER THE TOP RED LINE = GAME OVER.',

  // ---------------------------------------------------------------- panel & papan
  'SKOR': 'SCORE',
  'TERBAIK': 'BEST',
  'BATU': 'STONE',
  'MESIU': 'POWDER',
  'TAHAN Q/E MIRING': 'HOLD Q/E TILT',
  'P JEDA  M SUARA': 'P PAUSE  M SOUND',
  'GEMPA': 'QUAKE',
  'ANGIN': 'WIND',
  'PAPAN MIRING': 'BOARD TILT',
  'GEMPA!': 'QUAKE!',
  'DALAM {n}': 'IN {n}',
  'TAHAN {k} MELAWAN': 'HOLD {k} TO RESIST',
  'PIECE TERDORONG': 'PIECE PUSHED',
  'BATU HANCUR!': 'STONE SMASHED!',
  'LEDAKAN!': 'EXPLOSION!',

  // ---------------------------------------------------------------- tutorial
  'MENU: LEWATI': 'MENU: SKIP',
  'ESC: LEWATI': 'ESC: SKIP',
  'BAGUS!': 'NICE!',
  'COBA LAGI! {body}': 'TRY AGAIN! {body}',
  'GERAK': 'MOVE',
  'COBA SEMUA TOMBOL DI BAWAH.': 'TRY EVERY KEY BELOW.',
  'BALIK': 'REVERSE',
  'MUDAH, KAN?': 'EASY, RIGHT?',
  'JATUHKAN': 'DROP',
  'COBA TURUN PELAN DAN JATUH CEPAT. BALOK YANG MENDARAT JADI PASIR.': 'TRY A SOFT DROP AND A HARD DROP. LANDED BLOCKS TURN INTO SAND.',
  'PELAN': 'SOFT',
  'JADI PASIR!': 'SAND!',
  'JEMBATAN': 'BRIDGE',
  'SAMBUNG SATU WARNA DARI DINDING KIRI KE KANAN. ISI CELAH DI BAWAH PANAH!': 'LINK ONE COLOR FROM THE LEFT WALL TO THE RIGHT. FILL THE GAP UNDER THE ARROW!',
  'JEMBATAN HILANG = SKOR!': 'BRIDGE CLEARED = POINTS!',
  'PASIR BELUM SAMPAI DINDING KANAN. TAHAN MIRING KE KANAN!': 'THE SAND DOES NOT REACH THE RIGHT WALL. HOLD TILT RIGHT!',
  'MIRING ADA BATASNYA, PAKAI SEPERLUNYA.': 'TILT IS LIMITED, USE IT WISELY.',
  'PASIR...': 'SAND...',
  'LIHAT: BALOK PASIR DIJATUHKAN DI ATAS LUBANG.': 'WATCH: A SAND BLOCK DROPS OVER THE PIT.',
  'PASIR RONTOK KE LUBANG. JEMBATAN GAGAL!': 'THE SAND SPILLS INTO THE PIT. NO BRIDGE!',
  'SEKARANG BALOK BATU. JATUHKAN DI ATAS LUBANG YANG SAMA!': 'NOW A STONE BLOCK. DROP IT OVER THE SAME PIT!',
  'PASIR RONTOK, BATU TETAP UTUH: BATU KAKU!': 'SAND SPILLS, STONE HOLDS: STONE IS RIGID!',
  'BINTIK API = MESIU. KENA CLEAR, MELEDAK, BATU PUN HANCUR. ISI CELAHNYA, LALU LIHAT KOTAK KIRI!': 'FIERY SPECKS = GUNPOWDER. A CLEAR SETS IT OFF AND EVEN STONE BREAKS. FILL THE GAP, THEN WATCH THE LEFT BOX!',
  'BOOM! LEDAKAN = SKOR TAMBAHAN.': 'BOOM! EXPLOSIONS = BONUS POINTS.',
  'SIAP MAIN!': 'READY!',
  'JANGAN BIARKAN PASIR LEWAT GARIS MERAH ATAS.': 'NEVER LET THE SAND CROSS THE TOP RED LINE.',
  'GANGGUAN (GEMPA, ANGIN, PAPAN MIRING) SELALU DIPERINGATKAN 3 DETIK SEBELUMNYA.': 'HAZARDS (QUAKE, WIND, BOARD TILT) ARE ALWAYS ANNOUNCED 3 SECONDS AHEAD.',
  'MAIN SEKARANG': 'PLAY NOW',

  // ---------------------------------------------------------------- game over & peringkat
  'CHAIN TERBAIK': 'BEST CHAIN',
  'BUTIR DIHAPUS': 'GRAINS CLEARED',
  'DURASI': 'TIME',
  '{n} DTK': '{n} SEC',
  'REKOR PRIBADI BARU!': 'NEW PERSONAL BEST!',
  '{n} PRESTASI BARU': '{n} NEW ACHIEVEMENTS',
  'MAIN LAGI': 'PLAY AGAIN',
  'MINGGU INI': 'THIS WEEK',
  'SEPANJANG MASA': 'ALL TIME',
  'MEMUAT...': 'LOADING...',
  'BELUM ADA SKOR': 'NO SCORES YET',
  'JADILAH YANG PERTAMA!': 'BE THE FIRST!',
  'KAMU': 'YOU',
  'OFFLINE - SKOR LOKAL': 'OFFLINE - LOCAL SCORES',
  'RESET DALAM {t}': 'RESETS IN {t}',
  '{d}H {h}J': '{d}D {h}H',
  '{h}J {m}M': '{h}H {m}M',
  '{m}M': '{m}M',
  'MODE UJI - SKOR TIDAK DISIMPAN': 'TEST MODE - SCORE NOT SAVED',
  'ISI NAMA UNTUK PERINGKAT': 'SET A NAME TO GET RANKED',
  'MENGIRIM SKOR...': 'SENDING SCORE...',
  'REKOR MINGGU INI! #{n}': 'WEEKLY BEST! #{n}',
  'PERINGKAT MINGGU INI #{n}': 'THIS WEEK: #{n}',
  'OFFLINE - DISIMPAN LOKAL': 'OFFLINE - SAVED LOCALLY',
  'NAMA SUDAH DIPAKAI': 'NAME ALREADY TAKEN',
  'TERLALU CEPAT, COBA LAGI': 'TOO FAST, TRY AGAIN',
  'SKOR TIDAK TERCATAT': 'SCORE NOT RECORDED',
  'SKOR TIDAK DIKIRIM': 'SCORE NOT SENT',

  // ---------------------------------------------------------------- prestasi
  'TROFI {a}/{b}': 'TROPHIES {a}/{b}',
  'RAHASIA': 'SECRET',
  'HADIAH: {r}': 'REWARD: {r}',
  'TROFI PERUNGGU!': 'BRONZE TROPHY!',
  'TROFI PERAK!': 'SILVER TROPHY!',
  'TROFI EMAS!': 'GOLD TROPHY!',
  'TROFI LEGENDA!': 'LEGEND TROPHY!',
  'TROFI RAHASIA!': 'SECRET TROPHY!',
  'PRESTASI!': 'ACHIEVEMENT!',
  'HADIAH TERBUKA': 'REWARD UNLOCKED',
  '{r} DI PENGATURAN': '{r} IN SETTINGS',
  'MURID TELADAN': 'MODEL STUDENT',
  'SELESAIKAN TUTORIAL': 'FINISH THE TUTORIAL',
  'JEMBATAN PERTAMA': 'FIRST BRIDGE',
  'CLEAR PERTAMA KALI': 'CLEAR FOR THE FIRST TIME',
  'REAKSI BERANTAI': 'CHAIN REACTION',
  'CAPAI CHAIN X3': 'REACH CHAIN X3',
  'AHLI MIRING': 'TILT MASTER',
  'CLEAR < 1 DETIK SETELAH MIRING': 'CLEAR < 1 SEC AFTER A TILT',
  'NYARIS!': 'CLOSE CALL!',
  'CLEAR SAAT DEKAT GARIS BAHAYA': 'CLEAR NEAR THE DANGER LINE',
  'PAPAN BERSIH': 'CLEAN SWEEP',
  'KOSONGKAN PAPAN SETELAH CLEAR': 'EMPTY THE BOARD WITH A CLEAR',
  'BOOM!': 'BOOM!',
  'LEDAKKAN MESIU PERTAMA KALI': 'SET OFF YOUR FIRST GUNPOWDER',
  'PENGHANCUR BATU': 'STONE BREAKER',
  'HANCURKAN BATU DENGAN LEDAKAN': 'BREAK STONE WITH AN EXPLOSION',
  'TANGAN KOSONG': 'NO HANDS',
  'LEVEL 5 TANPA MIRING': 'LEVEL 5 WITHOUT TILTING',
  'TAHAN BANTING': 'TOUGH AS NAILS',
  'BERTAHAN 5 EVENT SEKALI MAIN': 'SURVIVE 5 HAZARDS IN ONE RUN',
  'MARATON': 'MARATHON',
  'CAPAI LEVEL 15': 'REACH LEVEL 15',
  'BADAI PASIR': 'SANDSTORM',
  'CAPAI CHAIN X5': 'REACH CHAIN X5',
  'GOYANG DUMANG!': 'SHAKE IT TO THE MAX!',
  'MIRING KIRI-KANAN 6X < 2 DETIK': 'TILT LEFT-RIGHT 6X IN < 2 SEC',
  'LAWAN ARUS': 'AGAINST THE FLOW',
  'TAHAN MIRING LAWAN ARAH PAPAN': 'TILT AGAINST A BOARD TILT',
  'TEMA KERTAS': 'PAPER THEME',
  'TEMA NEON': 'NEON THEME',
  'TEMA RETRO': 'RETRO THEME',

  // ---------------------------------------------------------------- toast & lainnya
  'MODE UJI': 'TEST MODE',
  'SKOR DAN PRESTASI TIDAK DISIMPAN': 'SCORES AND TROPHIES NOT SAVED',
  'NAMA DISIMPAN': 'NAME SAVED',
  'SUARA': 'SOUND',
  'MUSIK + EFEK': 'MUSIC + SFX',
  'MATERIAL BARU: MESIU': 'NEW MATERIAL: GUNPOWDER',
  'MELEDAK SAAT KENA CLEAR': 'EXPLODES WHEN CLEARED',
  'MATERIAL BARU: BATU': 'NEW MATERIAL: STONE',
  'BERAT, TIDAK LONGSOR': 'HEAVY, NEVER SLIDES',
  'SKOR TERTUNDA': 'PENDING SCORE',
  'MASUK PERINGKAT': 'NOW ON THE BOARD',
  'WEBSITE (OFFLINE)': 'WEBSITE (OFFLINE)',

  // ---------------------------------------------------------------- kotak nama (HTML)
  'NAMA PEMAIN': 'PLAYER NAME',
  'Nama ini tampil di papan peringkat.': 'This name appears on the leaderboard.',
  '2-16 karakter': '2-16 characters',
  'SIMPAN': 'SAVE',
  'LEWATI': 'SKIP',
  'Nama itu sudah dipakai pemain lain.': 'That name is already taken by another player.',
  'Server peringkat belum siap.': 'The leaderboard server is not ready yet.',
  'Nama tidak valid.': 'Invalid name.',
  'Nama 2-16 karakter: huruf, angka, spasi, _ atau -': 'Name must be 2-16 characters: letters, numbers, space, _ or -',
  'Memeriksa nama...': 'Checking name...',
  'Nama "{name}" sudah dipakai pemain lain. Pilih nama baru supaya skor tertundamu tersimpan.': 'The name "{name}" is already taken. Pick a new name so your pending score is saved.',
  'Isi nama supaya skor tertundamu tersimpan.': 'Enter a name so your pending score is saved.',

  // ---------------------------------------------------------------- tombol sentuh & kredit (HTML)
  'TURUN': 'DOWN',
  'MENU': 'MENU',
  'SandTilt - tetris pasir': 'SandTilt - sand tetris',
  'Kontrol kiri': 'Left controls',
  'Kontrol kanan': 'Right controls',
  'Arah': 'Direction',
  'Miring kiri (tahan)': 'Tilt left (hold)',
  'Miring kanan (tahan)': 'Tilt right (hold)',
  'Jatuh instan': 'Hard drop',
  'Geser kiri': 'Move left',
  'Geser kanan': 'Move right',
  'Turun pelan': 'Soft drop',
  'Putar balik': 'Rotate back',
  'Putar': 'Rotate',
  'Menu (jeda &amp; pengaturan)': 'Menu (pause &amp; settings)',
  'Menu (jeda & pengaturan)': 'Menu (pause & settings)',
  '<b>SANDTILT</b> · tetris pasir yang bisa miring': '<b>SANDTILT</b> · sand tetris that tilts',
  'Final Project Teknik Pengembangan Game (TPG) 2026': 'Final Project, Game Development Techniques course (TPG) 2026',
  'PEMBUAT': 'MADE BY',
  'ASET': 'ASSETS',
  'Foto Alvin Zanua Putra': 'Photo of Alvin Zanua Putra',
  'Foto Muhammad Azhar Aziz': 'Photo of Muhammad Azhar Aziz',
  '<b>Efek suara</b> - Kenney: Impact, Interface, Sci-fi Sounds, Digital Audio, Music Jingles (kenney.nl, CC0)': '<b>Sound effects</b> - Kenney: Impact, Interface, Sci-fi Sounds, Digital Audio, Music Jingles (kenney.nl, CC0)',
  '<b>Font pixel</b> - Kenney Fonts (kenney.nl, CC0)': '<b>Pixel font</b> - Kenney Fonts (kenney.nl, CC0)',
  '<b>Soundtrack chiptune &amp; ikon trofi</b> - dibuat tim SandTilt': '<b>Chiptune soundtrack &amp; trophy icons</b> - made by the SandTilt team',
  '<b>Suara angin &amp; pasir meluncur</b> - dibuat tim dengan ffmpeg': '<b>Wind &amp; sliding sand sounds</b> - made by the team with ffmpeg',
};
