// audio.js — every sound is synthesized with WebAudio: no audio files.
// Short envelope-shaped oscillators and filtered noise for effects, and a
// small lookahead step sequencer for the bass-and-arpeggio music loop.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.step = 0;
    this.nextNoteAt = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);
    this.noiseBuf = this.makeNoise();
    this.nextNoteAt = this.ctx.currentTime + 0.1;
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  tone({ type = 'square', from = 440, to = null, dur = 0.12, vol = 0.2, dest = null, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t0);
    if (to !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.25, from = 3000, to = 300, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shoot': this.tone({ type: 'square', from: 880, to: 320, dur: 0.07, vol: 0.06 }); break;
      case 'enemyHit': this.noise({ dur: 0.06, vol: 0.10, from: 4000, to: 1200 }); break;
      case 'explode':
        this.noise({ dur: 0.32, vol: 0.30, from: 2600, to: 120 });
        this.tone({ type: 'sine', from: 220, to: 40, dur: 0.32, vol: 0.28 });
        break;
      case 'bigExplode':
        this.noise({ dur: 0.7, vol: 0.42, from: 3200, to: 60 });
        this.tone({ type: 'sine', from: 160, to: 30, dur: 0.7, vol: 0.4 });
        this.tone({ type: 'sawtooth', from: 90, to: 24, dur: 0.7, vol: 0.2 });
        break;
      case 'hurt':
        this.tone({ type: 'sawtooth', from: 300, to: 60, dur: 0.28, vol: 0.3 });
        this.noise({ dur: 0.2, vol: 0.2, from: 2000, to: 200 });
        break;
      case 'dash': this.noise({ dur: 0.16, vol: 0.14, from: 500, to: 4200 }); break;
      case 'pickup':
        this.tone({ type: 'sine', from: 660, dur: 0.07, vol: 0.14 });
        this.tone({ type: 'sine', from: 990, dur: 0.1, vol: 0.14, delay: 0.06 });
        break;
      case 'heart':
        this.tone({ type: 'sine', from: 520, dur: 0.09, vol: 0.16 });
        this.tone({ type: 'sine', from: 780, dur: 0.14, vol: 0.16, delay: 0.08 });
        break;
      case 'upgrade':
        [440, 554, 659, 880].forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.14, vol: 0.16, delay: i * 0.07 }));
        break;
      case 'waveclear':
        [523, 659, 784].forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.16, vol: 0.15, delay: i * 0.09 }));
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'sawtooth', from: f, dur: 0.3, vol: 0.14, delay: i * 0.22 }));
        break;
      case 'boss':
        this.tone({ type: 'sawtooth', from: 110, dur: 0.4, vol: 0.22 });
        this.tone({ type: 'sawtooth', from: 116, dur: 0.4, vol: 0.22, delay: 0.05 });
        break;
      case 'click': this.tone({ type: 'sine', from: 700, to: 900, dur: 0.05, vol: 0.1 }); break;
    }
  }

  // A-minor driving loop: bass on every step, a sparse arp on top.
  updateMusic(playing) {
    if (!this.ctx || this.muted) return;
    const SPB = 60 / 132 / 2; // 132 BPM, eighth notes
    const bass = [55, 0, 55, 55, 0, 55, 0, 65.4, 49, 0, 49, 49, 0, 82.4, 0, 73.4];
    const arpNotes = [220, 261.6, 329.6, 440, 329.6, 261.6];
    while (this.nextNoteAt < this.ctx.currentTime + 0.15) {
      const delay = Math.max(0, this.nextNoteAt - this.ctx.currentTime);
      const s = this.step % 16;
      if (playing) {
        const b = bass[s];
        if (b) this.tone({ type: 'triangle', from: b, dur: 0.16, vol: 0.30, dest: this.musicGain, delay });
        if (s % 2 === 0) {
          const a = arpNotes[(this.step >> 1) % arpNotes.length];
          this.tone({ type: 'square', from: a, dur: 0.09, vol: 0.045, dest: this.musicGain, delay });
        }
        if (s % 4 === 2) this.noise({ dur: 0.03, vol: 0.03, from: 8000, to: 6000, delay });
      }
      this.nextNoteAt += SPB;
      this.step++;
    }
  }
}
