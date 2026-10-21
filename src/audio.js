// Mali FM sintisajzer u duhu YM2612 čipa: dva operatora (modulator -> nosilac).
// Muzika je u 7/8 ritmu (2+2+3) na hidžaz lestvici — malo čočeka na aerodromu.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

const SONGS = {
  title: {
    step: 0.15,
    lead: [74, _, 72, 70, 69, _, 70, 69, 67, 66, _, 67, 69, _, 70, 69, 67, 66, 63, _, 66, 62, _, 63, 66, 62, _, _],
    bass: [38, 45, 43, 38],
    leadPatch: { ratio: 2, index: 2.2, gain: 0.11, decay: 0.22 },
  },
  game: {
    step: 0.125,
    lead: [62, 66, 67, 69, _, 70, 69, 67, _, 66, 63, 62, _, _, 69, 70, 72, 74, _, 72, 70, 69, 67, 66, 67, 62, _, _],
    bass: [38, 38, 43, 45],
    leadPatch: { ratio: 1, index: 3, gain: 0.09, decay: 0.16 },
  },
  boss: {
    step: 0.105,
    lead: [62, _, 62, 63, 66, _, 63, 62, _, 62, 63, 66, 67, 66, 69, _, 69, 70, 69, _, 66, 67, 66, 63, 62, 63, 62, _],
    bass: [38, 39, 38, 45],
    leadPatch: { ratio: 3, index: 4, gain: 0.085, decay: 0.12 },
  },
};

// akcenti 7/8: 2+2+3
const ACCENTS = [1, 0, 1, 0, 1, 0, 0];

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.song = null;
    this.stepIdx = 0;
    this.nextTime = 0;
    try { this.muted = localStorage.getItem('djura-mute') === '1'; } catch { /* nema storage-a */ }
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
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);

    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    setInterval(() => this.schedule(), 25);
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('djura-mute', this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  fm(t, freq, dur, { ratio = 1, index = 2, gain = 0.1, attack = 0.005, decay = dur, type = 'sine', dest, slide = 0 } = {}) {
    const c = this.ctx;
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const modGain = c.createGain();
    const amp = c.createGain();
    car.type = type;
    car.frequency.setValueAtTime(freq, t);
    mod.frequency.setValueAtTime(freq * ratio, t);
    if (slide) {
      car.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
      mod.frequency.exponentialRampToValueAtTime(Math.max(20, freq * ratio * slide), t + dur);
    }
    modGain.gain.setValueAtTime(freq * index, t);
    modGain.gain.exponentialRampToValueAtTime(freq * index * 0.2 + 0.01, t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, decay));
    mod.connect(modGain).connect(car.frequency);
    car.connect(amp).connect(dest || this.sfxBus);
    mod.start(t); car.start(t);
    mod.stop(t + dur + 0.05); car.stop(t + dur + 0.05);
  }

  noise(t, dur, { gain = 0.1, freq = 3000, q = 1, type = 'bandpass', dest, sweep } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const amp = c.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(amp).connect(dest || this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  playMusic(name) {
    if (this.song === name) return;
    this.song = name;
    this.stepIdx = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.05;
  }

  stopMusic() { this.song = null; }

  schedule() {
    if (!this.ctx || !this.song) return;
    const s = SONGS[this.song];
    if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.02;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const i = this.stepIdx % s.lead.length;
      const inBar = i % 7;
      const bar = Math.floor(i / 7) % s.bass.length;
      const t = this.nextTime;
      const dest = this.musicBus;

      const note = s.lead[i];
      if (note) this.fm(t, mtof(note), s.step * 1.6, { ...s.leadPatch, dest });

      if (ACCENTS[inBar]) {
        const root = s.bass[bar];
        const n = inBar === 4 ? root + 7 : root;
        this.fm(t, mtof(n), s.step * 1.8, { ratio: 0.5, index: 1.5, gain: 0.16, decay: s.step * 1.5, dest });
      }
      // bubanj: tapan na 1, "klak" na ostalim akcentima, činela svuda
      if (inBar === 0) this.fm(t, 110, 0.18, { ratio: 0.5, index: 1, gain: 0.35, slide: 0.35, dest });
      else if (ACCENTS[inBar]) this.noise(t, 0.09, { gain: 0.12, freq: 1800, q: 0.8, dest });
      this.noise(t, 0.03, { gain: 0.04, freq: 8000, q: 2, type: 'highpass', dest });

      this.nextTime += s.step;
      this.stepIdx++;
    }
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'blip':
        this.fm(t, 880, 0.06, { ratio: 2, index: 1, gain: 0.12 });
        break;
      case 'arrest':
        [0, 4, 7, 12].forEach((n, k) => this.fm(t + k * 0.05, mtof(72 + n), 0.12, { ratio: 1, index: 2, gain: 0.14 }));
        this.noise(t, 0.05, { gain: 0.2, freq: 4000 });
        break;
      case 'cuffs':
        this.noise(t, 0.04, { gain: 0.25, freq: 6000, q: 4 });
        this.noise(t + 0.07, 0.04, { gain: 0.25, freq: 7000, q: 4 });
        break;
      case 'wrong':
        this.fm(t, 180, 0.35, { ratio: 1.01, index: 6, gain: 0.15, type: 'square', slide: 0.6 });
        break;
      case 'miss':
        this.fm(t, 300, 0.1, { ratio: 2, index: 1, gain: 0.08, slide: 0.5 });
        break;
      case 'escape':
        this.noise(t, 1.4, { gain: 0.2, freq: 400, sweep: 4000, q: 1.5 });
        this.fm(t, 440, 1.0, { ratio: 1.5, index: 3, gain: 0.1, slide: 0.25 });
        break;
      case 'whistle':
        for (let k = 0; k < 2; k++) this.fm(t + k * 0.22, 2600, 0.18, { ratio: 0.03, index: 4, gain: 0.12 });
        break;
      case 'pickup':
        [0, 7, 12, 19].forEach((n, k) => this.fm(t + k * 0.04, mtof(76 + n), 0.09, { ratio: 3, index: 1, gain: 0.1 }));
        break;
      case 'gate':
        this.fm(t, 70, 0.3, { ratio: 0.5, index: 2, gain: 0.3, slide: 0.5 });
        this.noise(t + 0.15, 0.12, { gain: 0.2, freq: 900 });
        break;
      case 'gateOpen':
        this.fm(t, 200, 0.4, { ratio: 1.5, index: 2, gain: 0.12, slide: 2 });
        break;
      case 'bossHit':
        this.fm(t, 140, 0.25, { ratio: 2.3, index: 8, gain: 0.25, slide: 0.4 });
        this.noise(t, 0.15, { gain: 0.25, freq: 1200 });
        break;
      case 'bounce':
        this.fm(t, 220, 0.2, { ratio: 1.4, index: 5, gain: 0.18, slide: 0.5 });
        break;
      case 'throw':
        this.noise(t, 0.2, { gain: 0.08, freq: 2000, sweep: 600 });
        break;
      case 'stun':
        [0, 3, 6, 9].forEach((n, k) => this.fm(t + k * 0.07, mtof(84 - n), 0.08, { ratio: 2, index: 1, gain: 0.07 }));
        break;
      case 'win':
        [0, 4, 7, 12, 7, 12, 16].forEach((n, k) => this.fm(t + k * 0.11, mtof(67 + n), 0.22, { ratio: 1, index: 2.5, gain: 0.13 }));
        break;
      case 'lose':
        [7, 6, 5, 0].forEach((n, k) => this.fm(t + k * 0.25, mtof(60 + n), 0.3, { ratio: 1, index: 3, gain: 0.13, slide: k === 3 ? 0.5 : 1 }));
        break;
      case 'alarm':
        for (let k = 0; k < 3; k++) {
          this.fm(t + k * 0.3, 880, 0.15, { ratio: 1, index: 1, gain: 0.1, type: 'square' });
          this.fm(t + k * 0.3 + 0.15, 660, 0.15, { ratio: 1, index: 1, gain: 0.1, type: 'square' });
        }
        break;
    }
  }
}
