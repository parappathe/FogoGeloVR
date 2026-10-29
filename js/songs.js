// As músicas do Fogo e Gelo, compostas pelo próprio jogo (rock épico sintetizado).
// Cada seção: compassos, energia (0..1, define densidade das notas e da bateria) e partes que
// tocam. Partes: kick, snare, hat, ride, tom (viradas), bass, gtr (guitarra base, acordes de
// força), pad (coral), lead (guitarra solo), lead2 (melodia de apoio), arp.
// Os instrumentos (sound) são presets do sintetizador (js/synth.js); kit = tambores próprios.

const DRUMS_ROCK = {
  kick: ['x.......x.......', 'x.....x.x.......', 'x..x..x.x..x..x.'],
  snare: ['........x.......', '....x.......x...', '....x.......x..o'],
  hat: ['x.o.x.o.x.o.x.o.', 'x.x.x.x.x.x.x.x.', 'xoxoxoxoxoxoxoxo'],
  ride: ['x...x...x...x...', 'x.o.x.o.x.o.x.o.'],
  tom: ['................'], // só toca nas viradas (fillPart)
  crash: 'x',
};

// Tambores de rock: bumbo mais seco, caixa com estalo, tons graves.
const KIT_ROCK = {
  kick: { tone: { f0: 130, f1: 45, dur: 0.28, vol: 1 }, noise: { type: 'lowpass', f: 1800, q: 0.7, dur: 0.02, vol: 0.25 } },
  snare: { tone: { f0: 240, f1: 170, dur: 0.12, vol: 0.32 }, noise: { type: 'bandpass', f: 2300, q: 0.7, dur: 0.2, vol: 0.55 } },
  ride: { noise: { type: 'highpass', f: 6000, q: 2, dur: 0.3, vol: 0.09 }, tone: { f0: 2600, f1: 2500, dur: 0.25, vol: 0.02, wave: 'square' } },
  tom: { tone: { f0: 160, f1: 75, dur: 0.32, vol: 0.7 }, noise: { type: 'lowpass', f: 900, q: 0.7, dur: 0.05, vol: 0.15 } },
};

export const SONGS = [
  {
    id: 'brasa', name: 'Brasa', desc: 'Para aquecer · 100 BPM · mi menor', bpm: 100, seed: 41,
    root: 40, scale: 'minor', progression: [0, 5, 3, 6], leadDensity: 0.5, fillPart: 'tom',
    drums: DRUMS_ROCK, kit: KIT_ROCK,
    bass: ['x-------x-------', 'x.x.x.x.x.x.x.x.', 'xxo.xxo.xxo.x5o.'],
    gtr: ['x-------x-------', 'x--.x--.x--.x-o.', 'xooxooxoxooxooxo'],
    sound: {
      bass: { wave: 'sawtooth', cutoff: 380, env: 600, decay: 0.2, sustain: 0.5, vol: 0.3 },
      gtr: { wave: 'sawtooth', voices: 2, detune: 9, cutoff: 3200, decay: 0.3, sustain: 0.7, vol: 0.05, dist: 18 },
      gtrMute: { wave: 'sawtooth', cutoff: 1100, decay: 0.05, sustain: 0.1, vol: 0.06, dist: 18 },
      pad: { wave: 'triangle', voices: 3, detune: 12, attack: 0.6, release: 1, ftype: 'bandpass', cutoff: 900, q: 1.5, vol: 0.12, vibrato: 5 },
      lead: { wave: 'sawtooth', cutoff: 2600, env: 1400, decay: 0.3, sustain: 0.7, vol: 0.05, vibrato: 5.5, echo: 0.3, dist: 30 },
    },
    sections: [
      { name: 'intro', bars: 4, energy: 0.3, parts: ['pad', 'ride', 'kick'] },
      { name: 'parte A', bars: 8, energy: 0.5, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'tom'] },
      { name: 'subida', bars: 4, energy: 0.65, parts: ['kick', 'snare', 'ride', 'bass', 'gtr', 'pad', 'tom'] },
      { name: 'refrão', bars: 8, energy: 0.85, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'lead', 'pad', 'tom'] },
      { name: 'calmaria', bars: 4, energy: 0.35, parts: ['pad', 'bass', 'ride'] },
      { name: 'parte B', bars: 8, energy: 0.7, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'lead', 'tom'] },
      { name: 'refrão final', bars: 4, energy: 0.95, parts: ['kick', 'snare', 'ride', 'bass', 'gtr', 'lead', 'pad', 'tom'] },
      { name: 'fim', bars: 4, energy: 0.4, parts: ['pad', 'kick', 'gtr'] },
    ],
  },
  {
    id: 'degelo', name: 'Degelo', desc: 'Rock frígio · 125 BPM · ré frígio', bpm: 125, seed: 57,
    root: 38, scale: 'phrygian', progression: [0, 1, 0, 6], leadDensity: 0.6, fillPart: 'tom',
    drums: DRUMS_ROCK, kit: KIT_ROCK,
    bass: ['x.......x.......', 'x.xox.xox.xox.xo', 'xxoxxxoxxxoxxo5o'],
    gtr: ['x---x---x---x---', 'xoo.xoo.xoxoxoo.', 'xoxoxoxoxoxoxoxo'],
    sound: {
      bass: { wave: 'square', cutoff: 420, env: 700, decay: 0.12, sustain: 0.5, vol: 0.26 },
      gtr: { wave: 'sawtooth', voices: 2, detune: 11, cutoff: 3400, decay: 0.25, sustain: 0.65, vol: 0.05, dist: 22 },
      gtrMute: { wave: 'sawtooth', cutoff: 1200, decay: 0.05, sustain: 0.1, vol: 0.06, dist: 22 },
      pad: { wave: 'sawtooth', voices: 3, detune: 15, attack: 0.5, release: 1.2, ftype: 'bandpass', cutoff: 750, q: 2, vol: 0.13, vibrato: 4.5, echo: 0.2 },
      lead: { wave: 'sawtooth', voices: 2, detune: 6, cutoff: 3000, env: 1600, decay: 0.25, sustain: 0.7, vol: 0.045, vibrato: 6, echo: 0.35, dist: 35 },
      arp: { wave: 'triangle', decay: 0.1, sustain: 0, vol: 0.07, echo: 0.4 },
    },
    sections: [
      { name: 'intro', bars: 4, energy: 0.35, parts: ['pad', 'arp', 'ride'] },
      { name: 'parte A', bars: 8, energy: 0.55, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'tom'] },
      { name: 'refrão', bars: 8, energy: 0.85, parts: ['kick', 'snare', 'ride', 'bass', 'gtr', 'lead', 'pad', 'tom'] },
      { name: 'ponte', bars: 4, energy: 0.5, parts: ['kick', 'bass', 'pad', 'arp'] },
      { name: 'parte B', bars: 8, energy: 0.7, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'arp', 'lead', 'tom'] },
      { name: 'solo', bars: 8, energy: 0.9, parts: ['kick', 'snare', 'ride', 'bass', 'gtr', 'lead', 'tom'] },
      { name: 'refrão final', bars: 8, energy: 1, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'lead', 'pad', 'arp', 'tom'] },
      { name: 'fim', bars: 4, energy: 0.35, parts: ['pad', 'arp'] },
    ],
  },
  {
    id: 'erupcao', name: 'Erupção', desc: 'Metal épico · 150 BPM · mi menor harmônica', bpm: 150, seed: 73,
    root: 40, scale: 'harmonicMinor', progression: [0, 5, 4, 4], leadDensity: 0.65, fillPart: 'tom', chartStart: 12,
    drums: {
      ...DRUMS_ROCK,
      kick: ['x...x...x...x...', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'],
      hat: ['x.x.x.x.x.x.x.x.', 'xoxoxoxoxoxoxoxo', 'xxxxxxxxxxxxxxxx'],
    },
    kit: KIT_ROCK,
    bass: ['x.o.x.o.x.o.x.o.', 'xoxoxoxoxoxoxoxo', 'xxxxxxxxxxxxx5xo'],
    gtr: ['x---x---x---x---', 'xooxooxoxooxooxo', 'xoooxoooxoxoxooo'],
    sound: {
      bass: { wave: 'sawtooth', voices: 2, detune: 8, cutoff: 500, env: 1100, decay: 0.1, sustain: 0.35, vol: 0.25 },
      gtr: { wave: 'sawtooth', voices: 2, detune: 12, cutoff: 3600, decay: 0.2, sustain: 0.6, vol: 0.05, dist: 28 },
      gtrMute: { wave: 'sawtooth', cutoff: 1300, decay: 0.04, sustain: 0.1, vol: 0.065, dist: 28 },
      pad: { wave: 'sawtooth', voices: 3, detune: 18, attack: 0.3, release: 0.9, ftype: 'bandpass', cutoff: 820, q: 1.8, vol: 0.12, vibrato: 5 },
      lead: { wave: 'sawtooth', voices: 2, detune: 7, cutoff: 3400, env: 2000, decay: 0.15, sustain: 0.65, vol: 0.045, vibrato: 6.5, echo: 0.3, dist: 40 },
      lead2: { wave: 'triangle', decay: 0.3, sustain: 0.5, vol: 0.08, vibrato: 5 },
    },
    sections: [
      { name: 'intro', bars: 4, energy: 0.4, parts: ['kick', 'ride', 'pad'] },
      { name: 'parte A', bars: 8, energy: 0.65, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'tom'] },
      { name: 'subida', bars: 4, energy: 0.75, parts: ['kick', 'snare', 'ride', 'bass', 'gtr', 'lead2', 'tom'] },
      { name: 'erupção', bars: 8, energy: 1, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'lead', 'pad', 'tom'] },
      { name: 'cinzas', bars: 4, energy: 0.3, parts: ['pad', 'lead2'] },
      { name: 'parte B', bars: 8, energy: 0.8, parts: ['kick', 'snare', 'ride', 'bass', 'gtr', 'lead2', 'tom'] },
      { name: 'erupção 2', bars: 8, energy: 1, parts: ['kick', 'snare', 'hat', 'bass', 'gtr', 'lead', 'lead2', 'tom'] },
      { name: 'lava', bars: 8, energy: 0.9, parts: ['kick', 'snare', 'ride', 'bass', 'gtr', 'pad', 'lead', 'tom'] },
      { name: 'fim', bars: 4, energy: 0.4, parts: ['pad', 'kick', 'gtr'] },
    ],
  },
];
