// All sound is synthesized with WebAudio: short oscillator blips and filtered noise bursts,
// plus a quiet two-oscillator pad that hums under play. No audio files, no network. The
// context is created lazily on the first user gesture, so loading the page stays silent.

export function createAudio() {
  let context = null;
  let master = null;
  let padNodes = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return context;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    return context;
  }

  function blip({ type = 'square', from = 880, to = 220, seconds = 0.12, gain = 0.16, when = 0 }) {
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(amp);
    amp.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noise({ seconds = 0.25, gain = 0.22, cutoff = 900 }) {
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(start);
  }

  function startPad() {
    const ctx = ensure();
    if (!ctx || padNodes) return;
    const amp = ctx.createGain();
    amp.gain.value = 0.035;
    amp.connect(master);
    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 55;
    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 82.4;
    const oscC = ctx.createOscillator();
    oscC.type = 'triangle';
    oscC.frequency.value = 110.3;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmp = ctx.createGain();
    lfoAmp.gain.value = 0.012;
    lfo.connect(lfoAmp);
    lfoAmp.connect(amp.gain);
    oscA.connect(amp);
    oscB.connect(amp);
    oscC.connect(amp);
    oscA.start();
    oscB.start();
    oscC.start();
    lfo.start();
    padNodes = { amp, oscA, oscB, oscC, lfo };
  }

  return {
    /** Call from a user gesture (start, click) so the context is allowed to sound. */
    unlock() {
      ensure();
      startPad();
    },
    laser() {
      blip({ type: 'square', from: 920, to: 240, seconds: 0.09, gain: 0.08 });
    },
    explosion(big) {
      noise({ seconds: big ? 0.4 : 0.22, gain: big ? 0.3 : 0.18, cutoff: big ? 600 : 1100 });
      blip({ type: 'sawtooth', from: 160, to: 40, seconds: 0.25, gain: 0.12 });
    },
    pickup() {
      blip({ type: 'sine', from: 660, to: 990, seconds: 0.1, gain: 0.12 });
      blip({ type: 'sine', from: 990, to: 1320, seconds: 0.12, gain: 0.1, when: 0.07 });
    },
    powerup() {
      blip({ type: 'sine', from: 523, to: 523, seconds: 0.1, gain: 0.12 });
      blip({ type: 'sine', from: 659, to: 659, seconds: 0.1, gain: 0.12, when: 0.09 });
      blip({ type: 'sine', from: 784, to: 1046, seconds: 0.16, gain: 0.12, when: 0.18 });
    },
    coreHit() {
      blip({ type: 'sawtooth', from: 220, to: 55, seconds: 0.35, gain: 0.22 });
      noise({ seconds: 0.3, gain: 0.2, cutoff: 500 });
    },
    waveHorn() {
      blip({ type: 'triangle', from: 392, to: 392, seconds: 0.16, gain: 0.14 });
      blip({ type: 'triangle', from: 523, to: 523, seconds: 0.22, gain: 0.14, when: 0.14 });
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        blip({ type: 'triangle', from: freq, to: freq, seconds: 0.22, gain: 0.14, when: i * 0.13 });
      });
    },
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => {
        blip({ type: 'triangle', from: freq, to: freq * 0.94, seconds: 0.26, gain: 0.13, when: i * 0.16 });
      });
    },
    /** M toggles sound on and off; returns the new muted state. */
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
