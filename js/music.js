// Compositor: transforma a "partitura" de uma música (songs.js) numa lista de eventos em
// batidas. Puro (sem navegador): o mesmo resultado alimenta o sintetizador e o gerador do mapa.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  penta: [0, 2, 4, 7, 9],
  pentaMinor: [0, 3, 5, 7, 10],
  inSen: [0, 1, 5, 7, 10],
};

export function degreeToMidi(root, scale, deg) {
  const s = SCALES[scale];
  const o = Math.floor(deg / s.length);
  const i = ((deg % s.length) + s.length) % s.length;
  return root + 12 * o + s[i];
}

// Padrão de 16 passos: 'x' forte, 'o' fraco, '.' pausa. Padrões menores se repetem.
function patVel(p, step) {
  const c = p[step % p.length];
  return c === 'x' ? 1 : c === 'o' ? 0.55 : 0;
}

// Nível de um padrão por energia (0..1). O array pode ter 1 a 3 padrões.
function pick(list, energy) {
  if (!Array.isArray(list)) return list;
  return list[Math.min(list.length - 1, Math.floor(energy * list.length * 0.999))];
}

// Melodia curta (2 compassos) que se repete na seção, deslocada pelo acorde de cada compasso.
function makeMotif(r, density, steps) {
  const notes = [];
  let deg = 0;
  for (let s = 0; s < steps * 2; s += 2) {
    const strong = s % 8 === 0;
    if (r() > (strong ? Math.min(1, density + 0.25) : density)) continue;
    if (strong) deg = [0, 2, 4, 7][Math.floor(r() * 4)];
    else deg += [-2, -1, -1, 1, 1, 2, 3][Math.floor(r() * 7)];
    deg = Math.max(-3, Math.min(9, deg));
    notes.push({ s, deg, vel: strong ? 1 : 0.75 });
  }
  for (let i = 0; i < notes.length; i++) {
    const next = i + 1 < notes.length ? notes[i + 1].s : steps * 2;
    notes[i].len = Math.min(next - notes[i].s, r() < 0.3 ? 4 : 2);
  }
  return notes;
}

const TONAL = ['bass', 'gtr', 'gtrMute', 'pad', 'arp', 'lead', 'lead2'];

// Resultado: { events: [{b, part, midi?, dur, vel}], sections, totalBeats, spb, accents }
export function compose(song) {
  const r = rng(song.seed || 1);
  const steps = 16;
  const bpb = 4;
  const sb = bpb / steps; // batidas por passo
  const events = [];
  const sections = [];
  let bar = 0;
  for (const sec of song.sections) {
    const parts = new Set(sec.parts);
    const startBeat = bar * bpb;
    sections.push({ name: sec.name, startBeat, endBeat: startBeat + sec.bars * bpb, energy: sec.energy, spin: sec.spin ?? 0 });
    const motif = parts.has('lead') ? makeMotif(r, sec.density ?? song.leadDensity ?? 0.55, steps) : null;
    const motif2 = parts.has('lead2') ? makeMotif(r, (sec.density ?? 0.5) * 0.7, steps) : null;
    if (song.drums.crash && sec.energy >= 0.6) events.push({ b: startBeat, part: 'crash', dur: 2, vel: 1 });
    for (let i = 0; i < sec.bars; i++, bar++) {
      const b0 = bar * bpb;
      const chord = song.progression[i % song.progression.length];
      const fill = sec.fill !== false && i === sec.bars - 1 && sec.energy >= 0.45;
      // Bateria e percussão: qualquer parte que tenha padrão em song.drums.
      for (const [name, pats] of Object.entries(song.drums)) {
        if (name === 'crash' || !parts.has(name)) continue;
        const p = pick(pats, sec.energy);
        for (let s = 0; s < steps; s++) {
          let v = patVel(p, s);
          if (fill && name === song.fillPart && s >= 8) v = s % 2 === 0 || s >= 12 ? Math.max(v, 0.5 + (s - 8) / 16) : v;
          if (v > 0) events.push({ b: b0 + s * sb, part: name, dur: sb, vel: v });
        }
      }
      // Baixo: 'x' raiz, 'o' oitava, '5' quinta, '-' segura a nota anterior.
      if (parts.has('bass')) {
        const p = pick(song.bass, sec.energy);
        let last = null;
        for (let s = 0; s < steps; s++) {
          const c = p[s % p.length];
          if (c === '-' && last) { last.dur += sb; continue; }
          if (c === '.') { last = null; continue; }
          const off = c === 'o' ? 7 : c === '5' ? 4 : 0;
          last = { b: b0 + s * sb, part: 'bass', midi: degreeToMidi(song.root, song.scale, chord + off), dur: sb * 0.9, vel: c === 'x' ? 1 : 0.8 };
          events.push(last);
        }
      }
      // Guitarra base: acorde de força (raiz, quinta e oitava). 'x' palhetada aberta,
      // 'o' abafada (curta), '-' segura, '.' pausa.
      if (parts.has('gtr') && song.gtr) {
        const p = pick(song.gtr, sec.energy);
        let last = null;
        for (let s = 0; s < steps; s++) {
          const c = p[s % p.length];
          if (c === '-' && last) { for (const n of last) n.dur += sb; continue; }
          if (c === '.' || c === '-') { last = null; continue; }
          const mute = c === 'o';
          last = [0, 4, 7].map(off => ({ b: b0 + s * sb, part: mute ? 'gtrMute' : 'gtr', midi: degreeToMidi(song.root + 12, song.scale, chord + off), dur: sb * (mute ? 0.5 : 0.9), vel: mute ? 0.75 : 1 }));
          events.push(...last);
        }
      }
      if (parts.has('pad')) {
        for (const off of [0, 2, 4]) {
          events.push({ b: b0, part: 'pad', midi: degreeToMidi(song.root + 12, song.scale, chord + off), dur: bpb, vel: 0.7 });
        }
      }
      if (parts.has('arp')) {
        const seq = [0, 2, 4, 7, 4, 2];
        const every = sec.energy > 0.7 ? 1 : 2;
        for (let s = 0, k = 0; s < steps; s += every, k++) {
          events.push({ b: b0 + s * sb, part: 'arp', midi: degreeToMidi(song.root + 24, song.scale, chord + seq[k % seq.length]), dur: sb * every * 0.9, vel: s % 4 === 0 ? 1 : 0.7 });
        }
      }
      for (const [m, part, oct] of [[motif, 'lead', 24], [motif2, 'lead2', 12]]) {
        if (!m) continue;
        const half = (i % 2) * steps;
        for (const n of m) {
          if (n.s < half || n.s >= half + steps) continue;
          events.push({ b: b0 + (n.s - half) * sb, part, midi: degreeToMidi(song.root + oct, song.scale, chord + n.deg), dur: n.len * sb * 0.95, vel: n.vel });
        }
      }
    }
  }
  events.sort((a, b) => a.b - b.b || (a.part < b.part ? -1 : 1));
  const totalBeats = bar * bpb;
  return { song, events, sections, totalBeats, spb: 60 / song.bpm, duration: totalBeats * 60 / song.bpm };
}

export function sectionAt(comp, beat) {
  for (const s of comp.sections) if (beat < s.endBeat) return s;
  return comp.sections[comp.sections.length - 1];
}

export { TONAL };
