/* The White Hart — everything you can hear, built out of oscillators and good manners. */
(() => {
  'use strict';
  const WH = window.WH;

  let audioEnabled = (() => {
    try { return localStorage.getItem('white-hart-sound') === 'on'; } catch (_) { return false; }
  })();
  let rig = null;
  let contextBroken = false;

  function base() {
    if (contextBroken) return null;
    if (rig) return rig;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { contextBroken = true; return null; }
    try {
      const context = new Ctx();
      const master = context.createGain();
      master.gain.value = audioEnabled ? 0.2 : 0;
      master.connect(context.destination);

      // A room tone: filtered noise, a little of a crowded evening.
      const sampleCount = Math.floor(context.sampleRate * 2);
      const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < sampleCount; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2 + white * 0.06;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const lowpass = context.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 340;
      const roomGain = context.createGain();
      roomGain.gain.value = 0.16;
      noise.connect(lowpass);
      lowpass.connect(roomGain);
      roomGain.connect(master);
      noise.start();

      const hum = context.createOscillator();
      const humGain = context.createGain();
      hum.type = 'sine';
      hum.frequency.value = 56;
      humGain.gain.value = 0;
      hum.connect(humGain);
      humGain.connect(master);
      hum.start();

      const shimmer = context.createOscillator();
      const shimmerGain = context.createGain();
      shimmer.type = 'triangle';
      shimmer.frequency.value = 172;
      shimmerGain.gain.value = 0;
      shimmer.connect(shimmerGain);
      shimmerGain.connect(master);
      shimmer.start();

      const singerOne = context.createOscillator();
      const singerTwo = context.createOscillator();
      const singerGain = context.createGain();
      singerOne.type = 'triangle';
      singerTwo.type = 'sine';
      singerOne.frequency.value = 294;
      singerTwo.frequency.value = 311;
      singerGain.gain.value = 0;
      singerOne.connect(singerGain);
      singerTwo.connect(singerGain);
      singerGain.connect(master);
      singerOne.start();
      singerTwo.start();

      const rain = context.createBufferSource();
      rain.buffer = buffer;
      rain.loop = true;
      const rainFilter = context.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.value = 1400;
      const rainGain = context.createGain();
      rainGain.gain.value = 0;
      rain.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(master);
      rain.start();

      rig = { context, master, noise, roomGain, hum, humGain, shimmer, shimmerGain, singerOne, singerTwo, singerGain, rain, rainGain, quiet: false };
      context.resume().catch(() => {});
      return rig;
    } catch (error) {
      console.warn('The pub is quieter than expected.', error);
      contextBroken = true;
      return null;
    }
  }

  function tone({ type = 'sine', from = 440, to = null, duration = 0.08, gain = 0.05, delay = 0, curve = 'exp', pan = 0 }) {
    if (!audioEnabled) return;
    const r = base();
    if (!r) return;
    const { context, master } = r;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), start);
    if (to) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
      else osc.frequency.linearRampToValueAtTime(Math.max(20, to), start + duration);
    }
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, duration * 0.3));
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    if (pan && context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      osc.connect(amp); amp.connect(panner); panner.connect(master);
    } else {
      osc.connect(amp); amp.connect(master);
    }
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function noiseBurst({ duration = 0.18, gain = 0.06, freq = 900, q = 1.2, type = 'bandpass', delay = 0, sweepTo = null }) {
    if (!audioEnabled) return;
    const r = base();
    if (!r) return;
    const { context, master } = r;
    const start = context.currentTime + delay;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = context.createBufferSource();
    src.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, start);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), start + duration);
    filter.Q.value = q;
    const amp = context.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter); filter.connect(amp); amp.connect(master);
    src.start(start);
    src.stop(start + duration + 0.02);
  }

  const SOUNDS = {
    click: () => tone({ type: 'sine', from: 520, to: 380, duration: 0.05, gain: 0.035 }),
    select: () => { tone({ type: 'sine', from: 370, duration: 0.05, gain: 0.04 }); tone({ type: 'sine', from: 555, duration: 0.05, gain: 0.02, delay: 0.05 }); },
    pour: () => { noiseBurst({ duration: 0.5, gain: 0.05, freq: 420, sweepTo: 1400, q: 0.7 }); tone({ type: 'sine', from: 220, to: 420, duration: 0.5, gain: 0.02 }); },
    serve: () => { tone({ type: 'sine', from: 740, duration: 0.09, gain: 0.05 }); tone({ type: 'sine', from: 1110, duration: 0.14, gain: 0.03, delay: 0.04 }); },
    zoneOn: () => { tone({ type: 'sine', from: 300, to: 520, duration: 0.22, gain: 0.035 }); noiseBurst({ duration: 0.2, gain: 0.02, freq: 800, sweepTo: 260 }); },
    zoneOff: () => { tone({ type: 'sine', from: 460, to: 240, duration: 0.22, gain: 0.035 }); },
    buy: () => { tone({ type: 'triangle', from: 520, duration: 0.07, gain: 0.04 }); tone({ type: 'triangle', from: 780, duration: 0.12, gain: 0.035, delay: 0.06 }); },
    nope: () => tone({ type: 'square', from: 180, to: 120, duration: 0.16, gain: 0.025 }),
    meow: () => { tone({ type: 'sawtooth', from: 620, to: 900, duration: 0.16, gain: 0.022 }); tone({ type: 'sawtooth', from: 880, to: 520, duration: 0.24, gain: 0.02, delay: 0.14 }); },
    squeak: () => { tone({ type: 'square', from: 1500, to: 2100, duration: 0.06, gain: 0.012 }); tone({ type: 'square', from: 1900, to: 1300, duration: 0.06, gain: 0.012, delay: 0.07 }); },
    clink: () => { tone({ type: 'sine', from: 1800, duration: 0.09, gain: 0.03 }); tone({ type: 'sine', from: 2600, duration: 0.07, gain: 0.02, delay: 0.02 }); },
    ghost: () => { tone({ type: 'sine', from: 320, to: 210, duration: 1.1, gain: 0.022 }); tone({ type: 'sine', from: 214, to: 160, duration: 1.3, gain: 0.014, delay: 0.1 }); },
    ufo: () => { tone({ type: 'sine', from: 220, to: 1400, duration: 1.4, gain: 0.02 }); tone({ type: 'triangle', from: 660, to: 220, duration: 1.4, gain: 0.012, delay: 0.2 }); },
    thunder: () => { noiseBurst({ duration: 1.6, gain: 0.09, freq: 220, sweepTo: 60, q: 0.6, type: 'lowpass' }); noiseBurst({ duration: 0.5, gain: 0.05, freq: 3000, sweepTo: 400, delay: 0.05 }); },
    sneeze: () => { noiseBurst({ duration: 0.12, gain: 0.05, freq: 1800, sweepTo: 700 }); tone({ type: 'sawtooth', from: 300, to: 180, duration: 0.18, gain: 0.02, delay: 0.08 }); },
    smash: () => { noiseBurst({ duration: 0.5, gain: 0.07, freq: 3200, sweepTo: 900, q: 0.8 }); tone({ type: 'triangle', from: 1600, to: 400, duration: 0.3, gain: 0.02 }); },
    laugh: () => { for (let i = 0; i < 5; i++) tone({ type: 'triangle', from: 340 - i * 12, to: 300 - i * 12, duration: 0.09, gain: 0.02, delay: i * 0.11 }); },
    tick: () => tone({ type: 'square', from: 760, duration: 0.05, gain: 0.02 }),
    tock: () => tone({ type: 'square', from: 990, duration: 0.05, gain: 0.028 }),
    coin: () => { tone({ type: 'square', from: 980, duration: 0.05, gain: 0.03 }); tone({ type: 'square', from: 1320, duration: 0.1, gain: 0.03, delay: 0.05 }); },
    fanfare: () => {
      [523, 659, 784, 1047].forEach((freq, i) => {
        tone({ type: 'triangle', from: freq, duration: 0.28, gain: 0.035, delay: i * 0.13 });
        tone({ type: 'sine', from: freq / 2, duration: 0.3, gain: 0.02, delay: i * 0.13 });
      });
    },
    sadTrombone: () => {
      [392, 370, 349, 330].forEach((freq, i) => tone({ type: 'sawtooth', from: freq, to: freq * 0.97, duration: 0.32, gain: 0.03, delay: i * 0.22 }));
    },
    door: () => { noiseBurst({ duration: 0.3, gain: 0.045, freq: 300, sweepTo: 120, type: 'lowpass' }); tone({ type: 'sine', from: 180, to: 90, duration: 0.3, gain: 0.02 }); },
    bubble: () => tone({ type: 'sine', from: 300, to: 620, duration: 0.12, gain: 0.02 }),
    zap: () => { tone({ type: 'sawtooth', from: 1200, to: 120, duration: 0.2, gain: 0.03 }); noiseBurst({ duration: 0.2, gain: 0.03, freq: 2400, sweepTo: 300 }); }
  };

  function play(name) {
    if (!audioEnabled) return;
    const fn = SOUNDS[name];
    if (fn) { try { fn(); } catch (_) { /* the pub stays polite */ } }
  }

  function boom() {
    if (!audioEnabled) return;
    const r = base();
    if (!r) return;
    const { context, master } = r;
    r.quiet = false;
    const resume = context.state === 'suspended' ? context.resume() : Promise.resolve();
    resume.catch(() => {}).then(() => {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.min(0.34, master.gain.value + 0.2), now);
      const sub = context.createOscillator();
      const subGain = context.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(84, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.45);
      subGain.gain.setValueAtTime(0.34, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      sub.connect(subGain); subGain.connect(master);
      sub.start(now); sub.stop(now + 0.75);
      noiseBurst({ duration: 0.6, gain: 0.14, freq: 2400, sweepTo: 120, q: 0.6 });
      const ring = context.createOscillator();
      const ringGain = context.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(930, now + 0.05);
      ringGain.gain.setValueAtTime(0.0001, now);
      ringGain.gain.exponentialRampToValueAtTime(0.06, now + 0.08);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.1);
      ring.connect(ringGain); ringGain.connect(master);
      ring.start(now + 0.04); ring.stop(now + 2.2);
      setTimeout(() => {
        if (rig && audioEnabled) rig.master.gain.setTargetAtTime(0.2, rig.context.currentTime, 0.9);
      }, 700);
    });
  }

  function hush() {
    const r = base();
    if (!r) return;
    r.quiet = true;
    r.master.gain.cancelScheduledValues(r.context.currentTime);
    r.master.gain.setTargetAtTime(0, r.context.currentTime, 0.012);
    r.context.suspend().catch(() => {});
  }

  /* Ambience follows the state of the pub: zones on, energy high, weather, opera. */
  function update({ energyRatio = 0, zones = 0, paused = false, pending = false, opera = false, weather = 'clear' } = {}) {
    const r = base();
    if (!r) return;
    const { context, humGain, shimmerGain, singerGain, singerOne, singerTwo, rainGain, roomGain, master } = r;
    const now = context.currentTime;
    const live = zones > 0 && !paused && !pending;
    humGain.gain.setTargetAtTime(live ? 0.004 + energyRatio * 0.03 : 0, now, 0.35);
    shimmerGain.gain.setTargetAtTime(live && energyRatio > 0.5 ? (energyRatio - 0.5) * 0.05 : 0, now, 0.5);
    const singing = opera && !paused && !pending && !r.quiet && audioEnabled;
    singerGain.gain.setTargetAtTime(singing ? 0.022 : 0, now, 0.3);
    singerOne.frequency.setTargetAtTime(294 + Math.sin(now * 3.1) * 17, now, 0.18);
    singerTwo.frequency.setTargetAtTime(311 + Math.sin(now * 2.3 + 1) * 23, now, 0.18);
    const wet = weather === 'rain' ? 0.05 : weather === 'drizzle' ? 0.028 : weather === 'storm' ? 0.075 : weather === 'snow' ? 0.012 : 0;
    rainGain.gain.setTargetAtTime(audioEnabled && !r.quiet ? wet : 0, now, 0.8);
    roomGain.gain.setTargetAtTime(audioEnabled && !r.quiet ? (paused ? 0.06 : 0.16) : 0, now, 0.5);
    if (audioEnabled && !r.quiet && !pending) master.gain.setTargetAtTime(0.2, now, 0.3);
    if (audioEnabled && context.state === 'suspended' && !pending) context.resume().catch(() => {});
  }

  function setEnabled(value) {
    audioEnabled = Boolean(value);
    try { localStorage.setItem('white-hart-sound', audioEnabled ? 'on' : 'off'); } catch (_) {}
    const r = base();
    if (r) {
      r.quiet = !audioEnabled;
      r.master.gain.cancelScheduledValues(r.context.currentTime);
      r.master.gain.setTargetAtTime(audioEnabled ? 0.2 : 0, r.context.currentTime, 0.2);
      if (audioEnabled) r.context.resume().catch(() => {});
    }
    return audioEnabled;
  }

  WH.audio = {
    play, boom, hush, update, setEnabled,
    get enabled() { return audioEnabled; },
    toggle() { return setEnabled(!audioEnabled); },
    warmUp() { if (audioEnabled) base(); }
  };
})();
