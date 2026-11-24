export function createAudio() {
  let context;
  let output;
  let muted = false;

  return {
    unlock() {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        output = context.createGain();
        output.gain.value = muted ? 0 : 0.3;
        output.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (output) output.gain.setTargetAtTime(muted ? 0 : 0.3, context.currentTime, 0.015);
    },
    play(event) {
      if (!context || muted || context.state !== 'running') return;

      function tone(from, to, duration, delay = 0, wave = 'sine', volume = 0.24) {
        const start = context.currentTime + delay;
        const end = start + duration;
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(from, start);
        oscillator.frequency.exponentialRampToValueAtTime(to, end);
        envelope.gain.setValueAtTime(0.001, start);
        envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.001, end);
        oscillator.connect(envelope);
        envelope.connect(output);
        oscillator.start(start);
        oscillator.stop(end);
      }

      switch (event.type) {
        case 'land':
          tone(155 + event.material * 30, 55 + event.material * 10, 0.09, 0, 'triangle');
          break;
        case 'clear': {
          const pitch = 1 + Math.min(event.chain - 1, 4) * 0.12;
          tone(440 * pitch, 520 * pitch, 0.12, 0, 'triangle');
          tone(659 * pitch, 880 * pitch, 0.2, 0.06);
          break;
        }
        case 'combo':
          tone(880, 1109, 0.16, 0.13, 'triangle', 0.14);
          break;
        case 'charge-full':
          tone(523, 784, 0.12, 0.13);
          tone(784, 1047, 0.2, 0.23);
          break;
        case 'explode':
          tone(124, 32, 0.23, 0, 'sawtooth', 0.22);
          break;
        case 'dye':
          tone(270, 740, 0.22);
          break;
        case 'game-over':
          tone(392, 196, 0.32, 0, 'triangle');
          break;
      }
    },
  };
}
