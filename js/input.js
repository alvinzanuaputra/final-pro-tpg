import { CFG } from './config.js';

// Input → aksi bernama. Gameplay hanya membaca aksi, bukan tombol mentah.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'soft', KeyS: 'soft',
  ArrowUp: 'rotCW', KeyX: 'rotCW', KeyW: 'rotCW',
  KeyZ: 'rotCCW',
  Space: 'hardDrop',
  KeyQ: 'tiltL', KeyE: 'tiltR',
};
const REPEAT = new Set(['left', 'right']);
const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export class Input {
  constructor(onUiKey) {
    this.onUiKey = onUiKey;
    this.held = { left: false, right: false, soft: false, tiltL: false, tiltR: false };
    this.queue = [];
    this.repeat = { left: 0, right: 0 };
    this.enabled = false;   // aksi gameplay hanya dikumpulkan saat bermain

    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (PREVENT.has(e.code)) e.preventDefault();
      this.onUiKey(e);
      const a = KEYMAP[e.code];
      if (!a || e.repeat) return;
      this.press(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.release(a);
    });
    window.addEventListener('blur', () => this.releaseAll());
  }

  press(a) {
    if (a in this.held) this.held[a] = true;
    if (!this.enabled) return;
    if (a === 'soft' || a === 'tiltL' || a === 'tiltR') return; // aksi tahan, dibaca lewat poll()
    this.queue.push(a);
    if (REPEAT.has(a)) this.repeat[a] = -CFG.DAS;
  }

  release(a) { if (a in this.held) this.held[a] = false; }

  releaseAll() { for (const k in this.held) this.held[k] = false; }

  // Tombol sentuh di layar memakai aksi yang sama.
  bindTouch(root) {
    for (const el of root.querySelectorAll('[data-action]')) {
      const a = el.dataset.action;
      const down = (e) => { e.preventDefault(); el.classList.add('on'); this.press(a); };
      const up = (e) => { e.preventDefault(); el.classList.remove('on'); this.release(a); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // Dipanggil sekali per tick: mengembalikan aksi + auto-repeat geser (DAS/ARR).
  poll(dt) {
    const actions = this.queue;
    this.queue = [];
    if (this.enabled) {
      for (const a of REPEAT) {
        if (!this.held[a]) continue;
        this.repeat[a] += dt;
        while (this.repeat[a] >= CFG.ARR) { this.repeat[a] -= CFG.ARR; actions.push(a); }
      }
    }
    const tilt = this.enabled ? (this.held.tiltR ? 1 : 0) - (this.held.tiltL ? 1 : 0) : 0;
    return { actions, soft: this.enabled && this.held.soft, tilt };
  }

  clear() { this.queue = []; }
}
