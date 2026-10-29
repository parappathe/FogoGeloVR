// Sintetizador e tocador das músicas (Web Audio, sem arquivos) + efeitos sonoros.
// O relógio da música é o relógio do áudio, para as notas baterem com o som.
// Sem áudio liberado (testes, painel escondido) o relógio é manual: main.js avança com tick().

const KIT = {
  kick: { tone: { f0: 150, f1: 42, dur: 0.32, vol: 0.9 } },
  snare: { tone: { f0: 220, f1: 160, dur: 0.1, vol: 0.25 }, noise: { type: 'bandpass', f: 1900, q: 0.8, dur: 0.17, vol: 0.45 } },
  clap: { noise: { type: 'bandpass', f: 1300, q: 1.2, dur: 0.14, vol: 0.4, bursts: 3 } },
  hat: { noise: { type: 'highpass', f: 7500, q: 0.7, dur: 0.045, vol: 0.18 } },
  openhat: { noise: { type: 'highpass', f: 7000, q: 0.7, dur: 0.25, vol: 0.14 } },
  crash: { noise: { type: 'highpass', f: 5000, q: 0.5, dur: 1.4, vol: 0.2 } },
  tom: { tone: { f0: 180, f1: 90, dur: 0.25, vol: 0.5 } },
};

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Synth {
  constructor() {
    this.ctx = null;
    this.comp = null;
    this.manual = 0;        // relógio manual (s) quando não há áudio
    this.playing = false;
    this.paused = false;
    this.musicVol = 0.8;
  }

  get hasAudio() { return !!this.ctx; }

  // Precisa ser chamado num clique/gesto (regra dos navegadores). Os testes não chamam.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC({ latencyHint: 'interactive' });
      this.out = c.createDynamicsCompressor();
      this.out.threshold.value = -14; this.out.ratio.value = 4;
      this.out.connect(c.destination);
      this.music = c.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.out);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.out);
      // Eco (delay com retorno) para leads e arpejos.
      this.echoIn = c.createGain(); this.echoIn.gain.value = 1;
      const dl = c.createDelay(1); dl.delayTime.value = 0.3;
      const fb = c.createGain(); fb.gain.value = 0.35;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
      this.echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.music);
      this.echoDelay = dl;
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // Áudio liberado com a música já andando (relógio manual): continua do mesmo ponto.
      if (this.playing && this.comp) {
        this.latency = Math.min(0.15, (c.outputLatency || 0) + (c.baseLatency || 0));
        this.t0 = c.currentTime - this.manual - this.latency;
        const b = this.manual / this.comp.spb;
        this.idx = this.comp.events.findIndex(e => e.b >= b);
        if (this.idx < 0) this.idx = this.comp.events.length;
        this.echoDelay.delayTime.value = this.comp.spb * 0.75;
      }
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
  }

  setMusicVolume(v) { this.musicVol = v; if (this.music) this.music.gain.value = v; }

  // Começa a música. lead = segundos de silêncio antes do tempo 0 (as primeiras notas já vêm voando).
  start(comp, lead = 2) {
    this.comp = comp;
    this.idx = 0;
    this.playing = true;
    this.paused = false;
    this.manual = -lead;
    this.kit = { ...KIT, ...(comp.song.kit || {}) };
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const lat = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
      this.latency = Math.min(0.15, lat);
      this.t0 = this.ctx.currentTime + lead + 0.05;
      this.echoDelay.delayTime.setValueAtTime(comp.spb * 0.75, this.ctx.currentTime);
    }
  }

  stop() {
    this.playing = false;
    this.comp = null;
    if (this.ctx && this.busNow) { try { this.busNow.disconnect(); } catch { /* já desligado */ } }
    this.busNow = null;
  }

  pause() { this.paused = true; if (this.ctx) this.ctx.suspend(); }
  resume() { this.paused = false; if (this.ctx) this.ctx.resume(); }

  // Tempo da música em segundos (0 = primeira batida). Negativo durante a contagem.
  time() {
    if (!this.ctx) return this.manual;
    return this.ctx.currentTime - this.t0 - this.latency;
  }

  // Sem áudio: avança o relógio manual.
  tick(dt) { if (!this.ctx && this.playing && !this.paused) this.manual += dt; }

  // Agenda os eventos que tocam nos próximos instantes. Chamar todo quadro.
  pump() {
    if (!this.playing || !this.comp || !this.ctx || this.paused) return;
    if (!this.busNow) { this.busNow = this.ctx.createGain(); this.busNow.connect(this.music); }
    const spb = this.comp.spb;
    const until = this.ctx.currentTime + 0.25;
    const ev = this.comp.events;
    while (this.idx < ev.length && this.t0 + ev[this.idx].b * spb < until) {
      const e = ev[this.idx++];
      const when = Math.max(this.ctx.currentTime, this.t0 + e.b * spb);
      this.play(e, when, spb);
    }
  }

  play(e, when, spb) {
    const drum = this.kit[e.part];
    if (drum) return this.drum(drum, when, e.vel, this.busNow);
    const p = this.comp.song.sound?.[e.part];
    if (p) this.voice(p, midiHz(e.midi), when, e.dur * spb, e.vel, this.busNow);
  }

  drum(k, t, vel, bus) {
    const c = this.ctx;
    if (k.tone) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = k.tone.wave || 'sine';
      o.frequency.setValueAtTime(k.tone.f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, k.tone.f1 ?? k.tone.f0), t + k.tone.dur * 0.6);
      g.gain.setValueAtTime(k.tone.vol * vel, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + k.tone.dur);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + k.tone.dur + 0.02);
    }
    if (k.noise) {
      const n = k.noise;
      const bursts = n.bursts || 1;
      for (let i = 0; i < bursts; i++) {
        const tb = t + i * 0.012;
        const s = c.createBufferSource(); s.buffer = this.noise;
        const f = c.createBiquadFilter(); f.type = n.type; f.frequency.value = n.f; f.Q.value = n.q ?? 1;
        const g = c.createGain();
        const dur = i < bursts - 1 ? 0.012 : n.dur;
        g.gain.setValueAtTime(n.vol * vel, tb);
        g.gain.exponentialRampToValueAtTime(0.0001, tb + dur);
        s.connect(f); f.connect(g); g.connect(bus);
        s.start(tb, Math.random() * 1.5); s.stop(tb + dur + 0.02);
      }
    }
  }

  // Voz tonal genérica: osciladores (com desafinação) → filtro passa-baixa com envelope → ganho.
  voice(p, hz, t, dur, vel, bus) {
    const c = this.ctx;
    const a = p.attack ?? 0.005, d = p.decay ?? 0.2, s = p.sustain ?? 0.6, r = p.release ?? 0.12;
    const vol = (p.vol ?? 0.1) * vel;
    const g = c.createGain();
    const f = c.createBiquadFilter(); f.type = p.ftype || 'lowpass'; f.Q.value = p.q ?? 1;
    const cut = p.cutoff ?? 4000;
    f.frequency.setValueAtTime(cut, t);
    if (p.env) {
      f.frequency.setValueAtTime(cut + p.env, t);
      f.frequency.exponentialRampToValueAtTime(cut, t + a + d);
    }
    const end = t + Math.max(dur, a + 0.01);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setTargetAtTime(vol * s + 0.0001, t + a, d / 3 + 0.001);
    g.gain.setTargetAtTime(0.0001, end, r / 3 + 0.001);
    const voices = p.voices || 1;
    for (let i = 0; i < voices; i++) {
      const o = c.createOscillator();
      o.type = p.wave || 'sawtooth';
      o.frequency.setValueAtTime(hz, t);
      if (voices > 1) o.detune.value = (i / (voices - 1) - 0.5) * 2 * (p.detune ?? 10);
      if (p.vibrato) {
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = p.vibrato; lg.gain.value = hz * 0.006;
        lfo.connect(lg); lg.connect(o.frequency);
        lfo.start(t); lfo.stop(end + r + 0.05);
      }
      if (p.slide) { o.frequency.setValueAtTime(hz * p.slide, t); o.frequency.exponentialRampToValueAtTime(hz, t + 0.06); }
      o.connect(f);
      o.start(t); o.stop(end + r + 0.05);
    }
    f.connect(g); g.connect(p.dist ? this._dist(p.dist, bus) : bus);
    if (p.echo) { const eg = c.createGain(); eg.gain.value = p.echo; g.connect(eg); eg.connect(this.echoIn); }
  }

  // Distorção de guitarra (WaveShaper) compartilhada por intensidade, com um filtro de
  // "caixa de som" depois. Fica pendurada no bus da música (some quando a música para).
  _dist(amount, bus) {
    bus._dist = bus._dist || {};
    if (bus._dist[amount]) return bus._dist[amount];
    const c = this.ctx;
    const pre = c.createGain(); pre.gain.value = 2.5;
    const sh = c.createWaveShaper();
    const n = 1024, curve = new Float32Array(n), k = amount;
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    sh.curve = curve; sh.oversample = '2x';
    const cab = c.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 4200; cab.Q.value = 0.8;
    const post = c.createGain(); post.gain.value = 0.35;
    pre.connect(sh); sh.connect(cab); cab.connect(post); post.connect(bus);
    bus._dist[amount] = pre;
    return pre;
  }

  // ---------- Efeitos sonoros ----------
  _sfxBus(pan = 0) {
    const c = this.ctx;
    if (!c.createStereoPanner) return this.sfx;
    const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.sfx);
    return p;
  }
  // Corte: esfera de fogo apagada pelo gelo faz "tsss"; esfera de gelo quebrada pelo fogo estala.
  // sphere: 0 fogo, 1 gelo, 2 vapor.
  cut(strength = 0.6, pan = 0, sphere = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, bus = this._sfxBus(pan);
    if (sphere === 0) {
      this.drum({ noise: { type: 'highpass', f: 3500, q: 0.7, dur: 0.35, vol: 0.3 + strength * 0.2 } }, t, 1, bus);
      this.drum({ tone: { f0: 220, f1: 60, dur: 0.15, vol: 0.25 } }, t, 1, bus);
    } else if (sphere === 1) {
      this.drum({ noise: { type: 'bandpass', f: 5200, q: 2, dur: 0.06, vol: 0.4 + strength * 0.2, bursts: 4 } }, t, 1, bus);
      [2093, 2637, 3136].forEach((hz, i) => this.voice({ wave: 'triangle', decay: 0.12, sustain: 0, vol: 0.06, release: 0.1 }, hz, t + i * 0.025, 0.05, 1, bus));
    } else {
      this.drum({ noise: { type: 'highpass', f: 2500, q: 0.5, dur: 0.6, vol: 0.4 } }, t, 1, bus);
      this.voice({ wave: 'triangle', decay: 0.2, sustain: 0, vol: 0.1 }, 1568, t, 0.1, 1, bus);
    }
  }
  // Troca de elemento da lâmina: fogo acende (sopro grave subindo), gelo congela (sininhos).
  swap(elem, pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, bus = this._sfxBus(pan);
    if (elem === 0) {
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.22);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      s.connect(f); f.connect(g); g.connect(bus);
      s.start(t, Math.random()); s.stop(t + 0.32);
      this.voice({ wave: 'sawtooth', cutoff: 600, decay: 0.15, sustain: 0, vol: 0.08 }, 98, t, 0.15, 1, bus);
    } else {
      [2637, 3520, 4186].forEach((hz, i) => this.voice({ wave: 'sine', decay: 0.2, sustain: 0, vol: 0.09, release: 0.15 }, hz, t + i * 0.035, 0.06, 1, bus));
      this.drum({ noise: { type: 'highpass', f: 8000, q: 0.7, dur: 0.12, vol: 0.12 } }, t, 1, bus);
    }
  }
  bad(pan = 0) {
    if (!this.ctx) return;
    this.voice({ wave: 'square', cutoff: 900, decay: 0.15, sustain: 0, vol: 0.1 }, 140, this.ctx.currentTime, 0.12, 1, this._sfxBus(pan));
  }
  miss() {
    if (!this.ctx) return;
    this.drum({ noise: { type: 'lowpass', f: 500, q: 0.7, dur: 0.2, vol: 0.15 } }, this.ctx.currentTime, 1, this.sfx);
  }
  click() {
    if (!this.ctx) return;
    this.voice({ wave: 'square', cutoff: 3000, decay: 0.04, sustain: 0, vol: 0.08 }, 880, this.ctx.currentTime, 0.04, 1, this.sfx);
  }
  // Aviso de onde vem a próxima nota: um "vush" que vem do lado certo (pan = -1 esquerda .. 1 direita).
  whoosh(pan, behind = false) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(behind ? 400 : 900, t);
    f.frequency.exponentialRampToValueAtTime(behind ? 1200 : 2600, t + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    s.connect(f); f.connect(g); g.connect(this._sfxBus(pan));
    s.start(t, Math.random()); s.stop(t + 0.5);
  }
  fanfare(win = true) {
    if (!this.ctx) return;
    const notes = win ? [72, 76, 79, 84] : [67, 65, 63, 60];
    const t = this.ctx.currentTime;
    notes.forEach((m, i) => this.voice({ wave: 'triangle', decay: 0.3, sustain: 0.3, vol: 0.12 }, midiHz(m), t + i * 0.15, 0.3, 1, this.sfx));
  }
}
