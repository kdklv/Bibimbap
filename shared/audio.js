// Shared Web Audio for the plankton toys. Recipes: sound.md
// Pond mix is the house sound: dark warmth, chorus, quiet bed, bubbles not clicks.
const Audio = {
  scales: {
    pentatonic: [0, 2, 4, 7, 9],
    gamelan:    [0, 1, 5, 7, 8],
    wholeTone:  [0, 2, 4, 6, 8, 10],
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
  },

  ctx: null,
  bus: null,
  master: null,
  reverb: null,
  reverbWet: null,
  delay: null,
  delayFb: null,
  delayWet: null,
  warmth: null,
  chorus: null,
  chorusWet: null,
  _voices: 0,
  _bed: null,

  noteFromY(y, canvasHeight, scaleName = 'pentatonic', octaves = 2, rootMidi = 60) {
    const scale = this.scales[scaleName];
    const totalNotes = scale.length * octaves;
    const index = Math.floor((1 - y / canvasHeight) * totalNotes);
    const clamped = Math.max(0, Math.min(totalNotes - 1, index));
    const octave = Math.floor(clamped / scale.length);
    const degree = scale[clamped % scale.length];
    return rootMidi + octave * 12 + degree;
  },

  midiToNote(midi) {
    const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return notes[midi % 12] + Math.floor(midi / 12 - 1);
  },

  freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  },

  ready() {
    return !!this.ctx;
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // Call once inside the first user gesture.
  //   toy voice → bus → dry + reverb + delay + chorus → warmth LP → dest
  //   bed → warmth + reverb  (never delay)
  //   outDry → master + reverb  (drones skip delay)
  init(opts = {}) {
    if (this.ctx) {
      this.resume();
      return this;
    }

    const c = new (window.AudioContext || window.webkitAudioContext)();
    c.resume();
    this.ctx = c;

    this.warmth = c.createBiquadFilter();
    this.warmth.type = 'lowpass';
    this.warmth.frequency.value = Math.max(900, (opts.warmth ?? 3800) * 0.52);
    this.warmth.Q.value = opts.warmthQ ?? 0.5;
    this.warmth.connect(c.destination);

    this.master = c.createGain();
    this.master.gain.value = opts.master ?? 0.5;
    this.master.connect(this.warmth);

    this.bus = c.createGain();
    this.bus.connect(this.master);

    const ir = this._impulse(opts.reverbSecs ?? 2.2, opts.reverbDecay ?? 2.1);
    this.reverb = c.createConvolver();
    this.reverb.buffer = ir;
    this.reverbWet = c.createGain();
    this.reverbWet.gain.value = Math.min(0.72, (opts.reverb ?? 0.38) * 1.32);
    this.bus.connect(this.reverb);
    this.reverb.connect(this.reverbWet);
    this.reverbWet.connect(this.master);

    this.delay = c.createDelay(1.0);
    this.delay.delayTime.value = opts.delayTime ?? 0.22;
    this.delayFb = c.createGain();
    this.delayFb.gain.value = opts.delayFeedback ?? 0.34;
    this.delayWet = c.createGain();
    this.delayWet.gain.value = (opts.delay ?? 0) * 0.72;
    this.bus.connect(this.delay);
    this.delay.connect(this.delayFb);
    this.delayFb.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.master);

    this.chorus = c.createDelay(0.4);
    this.chorus.delayTime.value = 0.024;
    this.chorusWet = c.createGain();
    this.chorusWet.gain.value = opts.chorus ?? 0.26;
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.13;
    lfoG.gain.value = 0.004;
    lfo.connect(lfoG);
    lfoG.connect(this.chorus.delayTime);
    lfo.start();
    this.bus.connect(this.chorus);
    this.chorus.connect(this.chorusWet);
    this.chorusWet.connect(this.master);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.resume();
    });
    window.addEventListener('pageshow', () => this.resume());

    const bedAmp = opts.bed === undefined ? 0.024 : opts.bed;
    if (bedAmp > 0) {
      this._ensureBed();
      this._bed.g.gain.value = bedAmp;
    }
    return this;
  },

  out(node) {
    if (this.bus) node.connect(this.bus);
  },

  // Held drones: skip delay/chorus so they don't flutter.
  outDry(node) {
    if (!this.master) return;
    node.connect(this.master);
    if (this.reverb) node.connect(this.reverb);
  },

  setDelay(v, tau = 0.06) {
    if (!this.delayWet) return;
    this.delayWet.gain.setTargetAtTime(Math.max(0, v * 0.72), this.now(), tau);
  },

  setReverb(v, tau = 0.06) {
    if (!this.reverbWet) return;
    this.reverbWet.gain.setTargetAtTime(Math.min(0.72, Math.max(0, v * 1.32)), this.now(), tau);
  },

  // Tiny pitch-slide bubble. Contact without a click.
  tick({ vol = 0.16, at = 0 } = {}) {
    if (!this._gate()) return;
    this._bubble({ vol: vol * 0.4, at });
  },

  ping({ freq = 1400, q = 22, vol = 3.2, decay = 0.26, at = 0 } = {}) {
    if (!this._gate()) return;
    const c = this.ctx;
    const t = this.now() + at;
    const n = Math.max(32, Math.floor(c.sampleRate * 0.006));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq * 0.72, t);
    f.Q.setValueAtTime(q * 0.55, t);
    const g = c.createGain();
    g.gain.setValueAtTime(vol * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay * 1.25);
    src.connect(f); f.connect(g); this.out(g);
    src.start(t);
  },

  tone({
    midi,
    freq,
    vol = 0.12,
    attack = 0.02,
    decay = 0.5,
    type = 'sine',
    harm = 0,
    partial = 0,
    partialGain = 0.12,
    oct = 0,
    filtOpen = 2100,
    filtClose = 230,
    filtQ = 0.9,
    filtTime,
    slideFrom = 1,
    slideTime = 0,
    lfoHz = 0,
    lfoDepth = 0,
    at = 0,
  } = {}) {
    if (!this._gate()) return;
    if (this._voices >= 10) return;
    const c = this.ctx;
    const t = this.now() + at;
    const f0 = freq ?? this.freq(midi);
    if (!Number.isFinite(f0) || f0 <= 0) return;
    const life = attack + decay + 0.08;
    const fTime = filtTime ?? Math.max(0.1, decay * 0.55);

    this._voices++;
    setTimeout(() => { this._voices = Math.max(0, this._voices - 1); }, life * 1000);

    const osc = c.createOscillator();
    const filt = c.createBiquadFilter();
    const env = c.createGain();
    osc.type = type;
    if (slideFrom !== 1 && slideTime > 0) {
      osc.frequency.setValueAtTime(f0 * slideFrom, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f0), t + slideTime);
    } else {
      osc.frequency.value = f0;
    }
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(Math.max(80, filtOpen), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(80, filtClose), t + fTime);
    filt.Q.value = filtQ;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(filt); filt.connect(env); this.out(env);
    osc.start(t); osc.stop(t + life);

    if (harm > 0) {
      const h = c.createOscillator();
      const hg = c.createGain();
      h.type = 'sine';
      h.frequency.value = f0 * 3;
      hg.gain.value = harm;
      h.connect(hg); hg.connect(filt);
      h.start(t); h.stop(t + life);
    }
    if (partial > 1) {
      const p = c.createOscillator();
      const pg = c.createGain();
      p.type = 'sine';
      p.frequency.value = f0 * partial;
      pg.gain.value = partialGain;
      p.connect(pg); pg.connect(filt);
      p.start(t); p.stop(t + life);
    }
    if (oct > 0) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = 'triangle';
      o.frequency.value = f0 * 2;
      og.gain.value = oct;
      o.connect(og); og.connect(filt);
      o.start(t); o.stop(t + life);
    }
    if (lfoHz > 0 && lfoDepth > 0) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = lfoHz;
      lg.gain.value = f0 * lfoDepth;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t); lfo.stop(t + life);
    }
  },

  _bubble({ vol = 0.08, at = 0 } = {}) {
    const freq = 130 + Math.random() * 240;
    this.tone({
      freq,
      vol: Math.min(0.09, vol * 0.7),
      attack: 0.004,
      decay: 0.11 + Math.random() * 0.07,
      slideFrom: 2.3,
      slideTime: 0.06,
      filtOpen: 1400,
      filtClose: 240,
      at,
    });
  },

  _ensureBed() {
    if (this._bed || !this.ctx) return;
    const c = this.ctx;
    const sr = c.sampleRate;
    const n = Math.floor(sr * 2.4);
    const buf = c.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc = acc * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = acc;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 280;
    bp.Q.value = 0.55;
    const a = c.createOscillator();
    const b = c.createOscillator();
    const ag = c.createGain();
    const bg = c.createGain();
    a.type = 'sine'; a.frequency.value = 58;
    b.type = 'sine'; b.frequency.value = 61.5;
    ag.gain.value = 0.45;
    bg.gain.value = 0.38;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(bp); bp.connect(g);
    a.connect(ag); ag.connect(g);
    b.connect(bg); bg.connect(g);
    g.connect(this.warmth);
    g.connect(this.reverb);
    src.start();
    a.start();
    b.start();
    this._bed = { g };
  },

  _gate() {
    if (!this.ctx) return false;
    this.resume();
    return true;
  },

  _impulse(secs, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * secs);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  },
};
