// Teks trailer per bahasa. Huruf kapital, font 5x7 game (tanpa '&' dan huruf beraksen).
// Istilah versi Indonesia mengikuti game: MESIU, GEMPA, ANGIN, PAPAN MIRING, REAKSI BERANTAI, PRESTASI, PERINGKAT.
// '\n' = pindah baris; baris kedua memakai warna aksen.
export type Lang = 'en' | 'id';

export const COPY: Record<Lang, { shots: Record<string, string>; card: [string, string, string]; play: string }> = {
  en: {
    shots: {
      crumble: 'TETRIS THAT\nCRUMBLES',
      tilt: 'TILT\nTHE BOARD',
      bridge: 'CONNECT\nWALL TO WALL',
      chain: 'CHAIN\nREACTIONS',
      gunpowder: 'GUNPOWDER\nGOES BOOM',
      quake: 'THE GROUND\nSHAKES',
      wind: 'THE WIND\nPUSHES',
      force: 'THE BOARD\nTIPS OVER',
      save: 'ONE PIECE\nFROM DEFEAT',
    },
    card: ['UNLOCK ACHIEVEMENTS', 'GLOBAL LEADERBOARD', 'KEYBOARD OR TOUCH'],
    play: 'PLAY FREE IN YOUR BROWSER',
  },
  id: {
    shots: {
      crumble: 'TETRIS\nJADI PASIR',
      tilt: 'MIRINGKAN\nPAPANNYA',
      bridge: 'SAMBUNGKAN\nKIRI KE KANAN',
      chain: 'REAKSI\nBERANTAI',
      gunpowder: 'MESIU\nMELEDAK',
      quake: 'GEMPA\nMENGGUNCANG',
      wind: 'ANGIN\nMENDORONG',
      force: 'PAPAN\nMIRING PAKSA',
      save: 'JANGAN LEWATI\nGARIS MERAH',
    },
    card: ['KUMPULKAN PRESTASI', 'PERINGKAT ONLINE', 'KEYBOARD ATAU LAYAR SENTUH'],
    play: 'MAIN GRATIS DI BROWSER',
  },
};
