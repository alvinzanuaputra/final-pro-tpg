import { RULES } from './config.js';

const KEY_ACTION = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate',
  KeyA: 'left', KeyD: 'right', KeyS: 'down', KeyW: 'rotate', Space: 'drop',
};
const IMPULSES = ['rotate', 'drop'];

export function createInput(root, { unlock, pause, isRunning }) {
  const held = new Map();
  const impulses = new Set();
  const activePointers = new Map();
  let direction = 0;
  let ticks = 0;
  let pendingMove = 0;
  let pendingSoft = false;

  const currentDirection = () => {
    let result = 0;
    for (const action of held.values()) {
      if (action === 'left') result = -1;
      if (action === 'right') result = 1;
    }
    return result;
  };

  function press(source, action) {
    if (!isRunning() || held.has(source)) return;
    if (IMPULSES.includes(action)) impulses.add(action);
    held.set(source, action);
    if (action === 'left' || action === 'right') pendingMove = currentDirection();
    if (action === 'down') pendingSoft = true;
  }

  function reset() {
    held.clear();
    impulses.clear();
    direction = 0;
    ticks = 0;
    pendingMove = 0;
    pendingSoft = false;
    for (const button of activePointers.values()) button.classList.remove('is-held');
    activePointers.clear();
  }

  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (!event.repeat) {
        unlock();
        pause();
      }
      return;
    }
    if (event.target.closest?.('button, select, input, textarea, a, summary')) return;
    const action = KEY_ACTION[event.code];
    if (!action || !isRunning()) return;
    event.preventDefault();
    if (!event.repeat) press(event.code, action);
  });
  window.addEventListener('keyup', event => held.delete(event.code));
  window.addEventListener('blur', reset);

  for (const button of root.querySelectorAll('[data-action]')) {
    const action = button.dataset.action;
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !isRunning()) return;
      event.preventDefault();
      unlock();
      button.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, button);
      button.classList.add('is-held');
      press(event.pointerId, action);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(name, event => {
        held.delete(event.pointerId);
        activePointers.delete(event.pointerId);
        if (![...activePointers.values()].includes(button)) button.classList.remove('is-held');
      });
    }
    button.addEventListener('click', event => {
      if (event.detail !== 0 || !isRunning()) return;
      unlock();
      const key = Symbol();
      press(key, action);
      held.delete(key);
    });
  }

  return {
    reset,
    sample() {
      const nextDirection = currentDirection();
      let move = pendingMove;
      if (nextDirection !== direction) {
        direction = nextDirection;
        ticks = 0;
        move ||= direction;
      } else if (direction && ++ticks >= RULES.moveDelayTicks) {
        if ((ticks - RULES.moveDelayTicks) % RULES.moveRepeatTicks === 0) move ||= direction;
      }
      const actions = {
        move, rotate: impulses.has('rotate'), hardDrop: impulses.has('drop'),
        softPressed: pendingSoft, softDrop: [...held.values()].includes('down'),
      };
      impulses.clear();
      pendingMove = 0;
      pendingSoft = false;
      return actions;
    },
  };
}
