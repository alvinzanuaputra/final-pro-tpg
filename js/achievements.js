import { store } from './util.js';

// Deskripsi maksimal 30 karakter supaya muat SATU baris di semua ukuran layar
// (kartu prestasi maksimal 3 baris: nama + deskripsi + hadiah).
// tier: bronze | silver | gold | legend | secret → ikon trofi (assets/image/trophy-*.svg).
// legend = trofi ungu yang TERLIHAT (ikon & suara sama dengan secret), untuk prestasi tersulit.
export const ACHIEVEMENTS = [
  { id: 'tutorial', tier: 'bronze', name: 'MURID TELADAN', desc: 'SELESAIKAN TUTORIAL' },
  { id: 'first_bridge', tier: 'bronze', name: 'JEMBATAN PERTAMA', desc: 'CLEAR PERTAMA KALI' },
  { id: 'chain3', tier: 'silver', name: 'REAKSI BERANTAI', desc: 'CAPAI CHAIN X3' },
  { id: 'tilt_master', tier: 'silver', name: 'AHLI MIRING', desc: 'CLEAR < 1 DETIK SETELAH MIRING' },
  { id: 'close_call', tier: 'silver', name: 'NYARIS!', desc: 'CLEAR SAAT DEKAT GARIS BAHAYA' },
  { id: 'clean_board', tier: 'gold', name: 'PAPAN BERSIH', desc: 'KOSONGKAN PAPAN SETELAH CLEAR' },
  { id: 'boom', tier: 'bronze', name: 'BOOM!', desc: 'LEDAKKAN MESIU PERTAMA KALI' },
  { id: 'stone_breaker', tier: 'silver', name: 'PENGHANCUR BATU', desc: 'HANCURKAN BATU DENGAN LEDAKAN' },
  { id: 'no_tilt', tier: 'gold', name: 'TANGAN KOSONG', desc: 'LEVEL 5 TANPA MIRING' },
  { id: 'survivor', tier: 'gold', name: 'TAHAN BANTING', desc: 'BERTAHAN DARI 5 EVENT' },
  { id: 'marathon', tier: 'gold', name: 'MARATON', desc: 'CAPAI LEVEL 15' },
  { id: 'chain5', tier: 'legend', name: 'BADAI PASIR', desc: 'CAPAI CHAIN X5', reward: 'TEMA KERTAS' },
  { id: 'quake', tier: 'secret', name: 'GOYANG DUMANG!', desc: 'MIRING KIRI-KANAN 6X < 2 DETIK', hidden: true, reward: 'TEMA NEON' },
  { id: 'counter', tier: 'secret', name: 'LAWAN ARUS', desc: 'TAHAN MIRING LAWAN ARAH PAPAN', hidden: true, reward: 'TEMA RETRO' },
];

export class Achievements {
  constructor(events, onUnlock) {
    this.unlocked = new Set(store.get('ach', []));
    this.onUnlock = onUnlock;
    this.sessionNew = 0;
    this.tiltLog = [];
    this.bind(events);
  }

  unlock(id) {
    if (this.disabled || this.unlocked.has(id)) return false;   // disabled: mode uji (lihat main.js)
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return false;
    this.unlocked.add(id);
    this.sessionNew++;
    store.set('ach', [...this.unlocked]);
    this.onUnlock(def);
    return true;
  }

  list() { return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: this.unlocked.has(a.id) })); }

  bind(ev) {
    ev.on('clear', (d) => {
      this.unlock('first_bridge');
      if (d.chain >= 3) this.unlock('chain3');
      if (d.chain >= 5) this.unlock('chain5');
      if (d.sinceTilt <= 1) this.unlock('tilt_master');
      if (d.inDanger) this.unlock('close_call');
    });
    ev.on('boardClear', () => this.unlock('clean_board'));
    // Rahasia: tahan miring berlawanan arah saat event Papan Miring (bisa di HP maupun desktop).
    ev.on('counterForce', () => this.unlock('counter'));
    ev.on('explode', (d) => {
      this.unlock('boom');
      if (d.stones > 0) this.unlock('stone_breaker');
    });
    ev.on('levelUp', (d) => {
      if (d.level >= 5 && d.tiltsUsed === 0) this.unlock('no_tilt');
      if (d.level >= 15) this.unlock('marathon');
    });
    // Event (gempa, angin, papan miring) yang selesai tanpa kalah, dihitung per game.
    ev.on('eventEnd', (e) => { if (e.survived >= 5) this.unlock('survivor'); });
    // Gempa: 6 percobaan miring bergantian arah dalam 2 detik (charge tidak harus ada).
    ev.on('tiltAttempt', (dir) => {
      const now = performance.now();
      this.tiltLog.push({ dir, now });
      this.tiltLog = this.tiltLog.filter((t) => now - t.now <= 2000);
      const log = this.tiltLog;
      if (log.length >= 6) {
        let alt = true;
        for (let k = log.length - 5; k < log.length; k++) if (log[k].dir === log[k - 1].dir) alt = false;
        if (alt) { this.tiltLog = []; ev.emit('quake'); this.unlock('quake'); }
      }
    });
  }
}
