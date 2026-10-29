// Gerador do mapa de notas a partir dos eventos da música. Puro (sem navegador).
// O mapa sai sempre igual para a mesma música e dificuldade (semente fixa).
// Elementos: 0 = fogo, 1 = gelo. Cada nota é uma esfera (elem 0 fogo, 1 gelo, 2 vapor) e só
// quebra com a lâmina do elemento oposto. O gerador acompanha o elemento que cada lâmina
// "deveria" ter (começa esquerda fogo, direita gelo) e decide quando o jogador tem que trocar.
import { rng, sectionAt } from './music.js';

// Direções de corte: 0 cima, 1 baixo, 2 esquerda, 3 direita, 4 cima-esq, 5 cima-dir,
// 6 baixo-esq, 7 baixo-dir. -1 = qualquer direção.
const S = Math.SQRT1_2;
export const DIR_VEC = [[0, 1], [0, -1], [-1, 0], [1, 0], [-S, S], [S, S], [-S, -S], [S, -S]];
export const OPPOSITE = [1, 0, 3, 2, 7, 6, 5, 4];
const MIRROR = [0, 1, 3, 2, 5, 4, 7, 6];
const NEIGHBORS = { 0: [4, 5], 1: [6, 7], 2: [4, 6], 3: [5, 7], 4: [0, 2], 5: [0, 3], 6: [1, 2], 7: [1, 3] };

export const LANES = [-0.48, -0.16, 0.16, 0.48];
export const ROWS = [0.85, 1.15, 1.45];

// grid: menor divisão (batidas); gapAny: intervalo mínimo entre notas; gapHand: mínimo para
// a mesma mão; keep: chance de usar um tempo candidato; speed: velocidade das notas (m/s);
// swap: chance de a nota pedir a troca de elemento da mão; minSwap: tempo mínimo (s) entre duas
// notas da mesma mão que pedem elementos diferentes (tempo de apertar o gatilho); vapor: chance
// de esfera de vapor (precisa das duas lâminas, uma de cada elemento). Fácil: sentido livre.
export const DIFFS = [
  { id: 'facil', name: 'Fácil', grid: 1, gapAny: 1, gapHand: 2, minAny: 0.62, minHand: 1.1, keep: 0.8, doubles: 0, dot: 1, diag: 0, speed: 8, swap: 0.3, minSwap: 0.5, vapor: 0 },
  { id: 'normal', name: 'Normal', grid: 0.5, gapAny: 0.5, gapHand: 1, minAny: 0.3, minHand: 0.55, keep: 0.62, doubles: 0.12, dot: 0.12, diag: 0.25, speed: 10, swap: 0.38, minSwap: 0.4, vapor: 0.07 },
  { id: 'dificil', name: 'Difícil', grid: 0.5, gapAny: 0.5, gapHand: 0.5, minAny: 0.2, minHand: 0.3, keep: 0.85, doubles: 0.22, dot: 0.05, diag: 0.4, speed: 12, swap: 0.45, minSwap: 0.3, vapor: 0.09 },
];

export const START_ELEM = [0, 1]; // lâmina esquerda começa de fogo, direita de gelo

const WEIGHT = { kick: 2, snare: 3, clap: 3, lead: 2, tom: 2 };

export function makeChart(comp, diffIndex, opts = {}) {
  const diff = DIFFS[diffIndex];
  const song = comp.song;
  const r = rng((song.seed || 1) * 31 + diffIndex * 7 + 3);
  const weights = { ...WEIGHT, ...(song.chartWeights || {}) };
  const startBeat = song.chartStart ?? 8;
  const endBeat = comp.totalBeats - (song.chartEndGap ?? 4);

  // Tempos candidatos: onde a bateria ou a melodia batem, no grid da dificuldade.
  const cand = new Map();
  for (const e of comp.events) {
    const w = weights[e.part];
    if (!w || e.b < startBeat || e.b > endBeat) continue;
    const q = Math.round(e.b / diff.grid) * diff.grid;
    if (Math.abs(q - e.b) > 1e-6) continue;
    cand.set(q, (cand.get(q) || 0) + w * e.vel + (q % 1 === 0 ? 1 : 0));
  }
  const beats = [...cand.keys()].sort((a, b) => a - b);

  // Intervalos mínimos em batidas, respeitando também um mínimo em segundos (música rápida).
  const gapAny = Math.max(diff.gapAny, diff.minAny / comp.spb);
  const gapHand = Math.max(diff.gapHand, diff.minHand / comp.spb);
  const swapGap = diff.minSwap / comp.spb; // em batidas
  const notes = [];
  const lastHand = [-99, -99];
  const prevDir = [0, 0]; // a primeira nota de cada mão é para baixo (oposto de "cima")
  const blade = [...START_ELEM];
  let swaps = 0;
  let lastVapor = startBeat; // muito tempo sem vapor aumenta a chance
  let last = -99;
  let nextHand = 1;
  const canSwap = (h, b) => b - lastHand[h] >= swapGap - 1e-6;
  for (const b of beats) {
    const sec = sectionAt(comp, b);
    const e = sec.energy;
    if (e <= 0.05) continue;
    const w = cand.get(b);
    if (b - last < gapAny - 1e-6) continue;
    const forced = b - last >= 4 && e >= 0.4;
    const p = diff.keep * (0.3 + 0.7 * e) * (w >= 4 ? 1.25 : w >= 3 ? 1 : 0.7);
    if (!forced && r() > p) continue;

    const okHand = (h) => b - lastHand[h] >= gapHand - 1e-6;

    // Esfera de vapor: sozinha, no meio, precisa das duas lâminas com elementos diferentes.
    if (diff.vapor > 0 && w >= 4 && okHand(0) && okHand(1) && b - last >= 2 * gapAny - 1e-6 && r() < diff.vapor * (0.5 + e) + (b - lastVapor > 40 && e >= 0.6 ? 0.3 : 0)) {
      let ok = blade[0] !== blade[1];
      if (!ok) {
        const order = r() < 0.5 ? [0, 1] : [1, 0];
        const h = order.find(x => canSwap(x, b));
        if (h !== undefined) { blade[h] = 1 - blade[h]; swaps++; ok = true; }
      }
      if (ok) {
        notes.push({ id: notes.length, b, t: b * comp.spb, hand: -1, kind: 'vapor', elem: 2, vaporElems: [...blade], dir: -1, lane: -1, row: 1, x: 0, y: ROWS[1], energy: e });
        lastHand[0] = lastHand[1] = b;
        lastVapor = b;
        last = b;
        nextHand = r() < 0.5 ? 0 : 1;
        continue;
      }
    }

    let hands;
    if (diff.doubles > 0 && w >= 4 && okHand(0) && okHand(1) && r() < diff.doubles * (0.5 + e)) hands = [0, 1];
    else {
      let h = nextHand;
      if (r() < 0.18) h = 1 - h; // às vezes repete a mão
      if (!okHand(h)) h = 1 - h;
      if (!okHand(h)) continue;
      hands = [h];
    }

    const double = hands.length === 2;
    let dirR = null;
    for (const h of hands) {
      let dir;
      if (double) {
        if (dirR === null) dirR = OPPOSITE[prevDir[1]] === 0 || OPPOSITE[prevDir[1]] === 1 ? OPPOSITE[prevDir[1]] : 1;
        dir = h === 1 ? dirR : MIRROR[dirR];
      } else {
        dir = OPPOSITE[prevDir[h]];
        if (diffIndex === 0 && dir > 3) dir = dir < 6 ? 0 : 1;
        if (r() < diff.diag) dir = NEIGHBORS[dir][Math.floor(r() * 2)];
        if (diffIndex === 0 && dir > 1 && r() < 0.7) dir = prevDir[h] === 1 ? 0 : 1;
      }
      prevDir[h] = dir;
      const dot = !double && r() < diff.dot;
      // Altura combina com a direção: corte para cima começa embaixo, para baixo em cima.
      const up = dir === 0 || dir === 4 || dir === 5;
      const down = dir === 1 || dir === 6 || dir === 7;
      const row = up ? (r() < 0.6 ? 0 : 1) : down ? (r() < 0.6 ? 2 : 1) : 1;
      let lane = h === 0 ? (r() < 0.5 ? 0 : 1) : (r() < 0.5 ? 3 : 2);
      if (dir === 2 && h === 1) lane = 3; // corte para a esquerda: começa na direita
      if (dir === 3 && h === 0) lane = 0;
      // Troca de elemento: mais frequente nas partes fortes, só se der tempo de apertar o gatilho.
      if (canSwap(h, b) && r() < diff.swap * (0.6 + 0.6 * e)) { blade[h] = 1 - blade[h]; swaps++; }
      const need = blade[h];
      notes.push({
        id: notes.length, b, t: b * comp.spb, hand: h, kind: 'orb', elem: 1 - need, need,
        dir: dot || diffIndex === 0 ? -1 : dir, lane, row, x: LANES[lane], y: ROWS[row], energy: e,
      });
      lastHand[h] = b;
    }
    last = b;
    nextHand = 1 - hands[hands.length - 1];
  }
  return { diff, notes, gapHand, swaps, lead: (opts.spawnDist ?? 16) / diff.speed };
}

// Elemento que a lâmina da mão `hand` precisa ter para a nota (vapor: o que o mapa planejou).
export function needFor(note, hand) {
  if (note.kind === 'vapor') return note.vaporElems[hand];
  return 1 - note.elem;
}
