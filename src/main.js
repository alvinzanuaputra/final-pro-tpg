import { createAudio } from './audio.js';
import { RULES } from './config.js';
import { createGame, startGame, tickGame } from './game.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';

const root = document.querySelector('#game');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const overlayButton = document.querySelector('#overlay-button');
const pauseButton = document.querySelector('#pause');
const soundButton = document.querySelector('#sound');
const motionInput = document.querySelector('#reduced-motion');
const options = new URLSearchParams(location.search);
const seedParam = options.get('seed');
const seedValue = seedParam === null || !Number.isInteger(Number(seedParam)) ? null : Number(seedParam) >>> 0;
const seed = () => seedValue ?? crypto.getRandomValues(new Uint32Array(1))[0];
const audio = createAudio();
const renderer = createRenderer(root);
const storageKey = 'arus-butir-best';
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
motionInput.checked = motionPreference.matches;
motionPreference.addEventListener('change', event => { motionInput.checked = event.matches; });

let best = 0;
try { best = Math.max(0, Number(localStorage.getItem(storageKey)) || 0); } catch {}
if (!Number.isSafeInteger(best)) best = 0;
let game = createGame(seed());
let paused = false;
let muted = false;
let previous;
let accumulator = 0;
let reportFrame;
let lastScreen = 'ready';

const isRunning = () => !paused && (game.phase === 'falling' || game.phase === 'settling');
const input = createInput(root, { unlock: audio.unlock, pause: togglePause, isRunning });

function syncScreen() {
  const screen = paused ? 'paused' : isRunning() ? 'playing' : game.phase;
  if (screen === lastScreen) return;
  lastScreen = screen;
  const focusWasInOverlay = overlay.contains(document.activeElement);
  overlay.hidden = screen === 'playing';
  pauseButton.disabled = screen === 'ready' || screen === 'over';
  pauseButton.textContent = paused ? 'Lanjut' : 'Jeda';
  if (screen === 'paused') {
    overlayTitle.textContent = 'Dijeda';
    overlayCopy.textContent = 'Ronde siap dilanjutkan.';
    overlayButton.textContent = 'Lanjut main';
    overlayButton.focus({ preventScroll: true });
  } else if (screen === 'over') {
    overlayTitle.textContent = 'Arena penuh';
    overlayCopy.textContent = 'Skor akhir ' + game.score.toLocaleString('id-ID') + '.';
    overlayButton.textContent = 'Main lagi';
    input.reset();
    overlayButton.focus({ preventScroll: true });
  } else if (screen === 'playing' && (focusWasInOverlay || document.activeElement === pauseButton)) {
    root.focus({ preventScroll: true });
  }
}

function newRound() {
  game = createGame(seed());
  paused = false;
  previous = undefined;
  accumulator = 0;
  input.reset();
  renderer.resetEffects();
  startGame(game);
  syncScreen();
  root.focus({ preventScroll: true });
}

function togglePause() {
  if (game.phase === 'ready' || game.phase === 'over') return;
  paused = !paused;
  previous = undefined;
  accumulator = 0;
  input.reset();
  syncScreen();
}

overlayButton.addEventListener('click', () => {
  audio.unlock();
  if (paused) togglePause();
  else newRound();
});

pauseButton.addEventListener('click', () => {
  audio.unlock();
  togglePause();
});

soundButton.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  audio.unlock();
  soundButton.textContent = muted ? 'Suara bisu' : 'Suara aktif';
  soundButton.setAttribute('aria-pressed', String(muted));
  soundButton.setAttribute('aria-label', muted ? 'Aktifkan audio' : 'Bisukan audio');
  if (isRunning()) root.focus({ preventScroll: true });
});

document.addEventListener('visibilitychange', () => {
  previous = undefined;
  accumulator = 0;
  if (document.hidden && isRunning()) togglePause();
});

if (options.get('debug') === '1') {
  import('./debug.js').then(({ attachDebug, loadFixture }) => {
    reportFrame = attachDebug(root, {
      fixture() {
        audio.unlock();
        if (game.phase === 'ready' || game.phase === 'over') newRound();
        if (paused) togglePause();
        input.reset();
        loadFixture(game);
        root.focus({ preventScroll: true });
      },
      force(material) {
        if (game.next && !game.next.special) game.next = { ...game.next, material };
        root.focus({ preventScroll: true });
      },
    });
  }).catch(error => console.warn('Debug tidak tersedia.', error.message));
}

function frame(now) {
  const start = performance.now();
  if (isRunning() && !document.hidden) {
    const limit = RULES.tickMs * RULES.maxCatchUp;
    accumulator = Math.min(limit, accumulator + Math.min(limit, now - (previous ?? now)));
    let ticks = 0;
    while (accumulator + 0.001 >= RULES.tickMs && ticks < RULES.maxCatchUp) {
      tickGame(game, input.sample());
      accumulator = Math.max(0, accumulator - RULES.tickMs);
      ticks++;
    }
    for (const event of game.events) {
      renderer.addEvent(event, now);
      audio.play(event);
    }
    game.events.length = 0;

    if (game.score > best) {
      best = game.score;
      try { localStorage.setItem(storageKey, String(best)); } catch {}
    }
  }
  previous = now;
  syncScreen();
  renderer.render(game, best, paused, now);
  reportFrame?.(now, performance.now() - start);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
