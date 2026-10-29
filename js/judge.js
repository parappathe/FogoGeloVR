// Juiz do corte e placar. Puro (sem navegador): vetores são objetos {x, y, z}.
import { DIR_VEC } from './chart.js';

export const NOTE_R = 0.21;      // raio de acerto da nota (m), um pouco maior que o desenho
export const MIN_SPEED = 1.1;    // velocidade mínima da ponta da lâmina para valer (m/s)
export const DIR_COS = 0.42;     // tolerância da direção (~65°)
export const MISS_AFTER = 0.14;  // segundos depois do tempo da nota em que ela conta como perdida
export const VAPOR_R = 0.27;     // raio de acerto da esfera de vapor (é maior: as duas lâminas passam)
export const VAPOR_WINDOW = 0.15; // as duas lâminas têm que cortar o vapor com até 0,15 s de diferença

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const lerpV = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

export function distPointSeg(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const L = dot(ab, ab);
  const t = L > 0 ? Math.max(0, Math.min(1, dot(ap, ab) / L)) : 0;
  const q = lerpV(a, b, t);
  const d = sub(p, q);
  return Math.sqrt(dot(d, d));
}

// Menor distância entre o centro c e a área varrida pela lâmina entre dois quadros.
export function sweepDist(c, base0, tip0, base1, tip1) {
  const dtip = sub(tip1, tip0);
  const n = Math.min(24, 2 + Math.ceil(Math.sqrt(dot(dtip, dtip)) / 0.04));
  let best = Infinity;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const d = distPointSeg(c, lerpV(base0, base1, t), lerpV(tip0, tip1, t));
    if (d < best) best = d;
  }
  return best;
}

// Testa um corte. frame = { right: {x,y,z}, up: {x,y,z} } da nota (plano de frente para o
// jogador). saber = { base0, tip0, base1, tip1, dt, elem } (elem 0 fogo, 1 gelo).
// Não existe mão certa: vale qualquer lâmina com o elemento oposto ao da esfera.
// Retorna null (não encostou ou foi fraco) ou { ok, reason, points, cutDir:[x,y] }.
// Vapor: retorna ok para qualquer elemento; quem decide se o vapor quebrou é vaporTouch.
export function judgeCut(note, center, frame, saber, opts = {}) {
  const vapor = note.kind === 'vapor';
  const radius = opts.radius ?? (vapor ? VAPOR_R : NOTE_R);
  const d = sweepDist(center, saber.base0, saber.tip0, saber.base1, saber.tip1);
  if (d > radius) return null;
  // Velocidade no ponto da lâmina mais perto da nota (média entre a ponta e o meio).
  const v0 = lerpV(saber.base0, saber.tip0, 0.75), v1 = lerpV(saber.base1, saber.tip1, 0.75);
  const v = sub(v1, v0);
  const dt = Math.max(1e-4, saber.dt);
  const vx = dot(v, frame.right) / dt, vy = dot(v, frame.up) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed < (opts.minSpeed ?? MIN_SPEED)) return null;
  const cut = [vx / speed, vy / speed];
  if (!vapor && saber.elem === note.elem) return { ok: false, reason: 'elemento', points: 0, cutDir: cut };
  let align = 1;
  if (note.dir >= 0) {
    const want = DIR_VEC[note.dir];
    align = cut[0] * want[0] + cut[1] * want[1];
    if (align < DIR_COS) return { ok: false, reason: 'direcao', points: 0, cutDir: cut };
  }
  const sQ = Math.min(1, (speed - MIN_SPEED) / 2.2);
  const aQ = note.dir >= 0 ? (align - DIR_COS) / (1 - DIR_COS) : 1;
  const cQ = 1 - Math.min(1, d / radius);
  const points = Math.round(45 + 25 * sQ + 15 * aQ + 15 * cQ);
  return { ok: true, reason: 'ok', points, cutDir: cut, speed };
}

// Esfera de vapor: guarda o primeiro toque; quebra quando a outra lâmina, do outro elemento,
// passa até VAPOR_WINDOW segundos depois. state começa {} e é mexido aqui.
// Retorna 'espera' (primeiro toque ou toque repetido do mesmo elemento), 'quebrou' ou
// 'tarde' (o segundo toque veio depois da janela: o vapor conta como erro).
export function vaporTouch(state, elem, time, points = 100) {
  if (!state.first) { state.first = { elem, time, points }; return 'espera'; }
  if (time - state.first.time > VAPOR_WINDOW + 1e-9) return 'tarde';
  if (elem === state.first.elem) return 'espera';
  state.points = Math.round((state.first.points + points) / 2);
  return 'quebrou';
}
// O primeiro toque já passou da janela sem o segundo?
export const vaporExpired = (state, time) => !!state.first && time - state.first.time > VAPOR_WINDOW + 1e-9;

export const MULT_STEPS = [0, 8, 16, 32]; // combo para chegar a x2, x3, x4

export class ScoreKeeper {
  constructor(total, { noFail = false } = {}) {
    this.total = total;
    this.noFail = noFail;
    this.score = 0; this.hits = 0; this.misses = 0; this.bad = 0; this.bombs = 0;
    this.combo = 0; this.maxCombo = 0; this.points = 0;
    this.health = 0.6;
    this.failed = false;
  }
  get mult() { let m = 1; for (let i = 1; i < MULT_STEPS.length; i++) if (this.combo >= MULT_STEPS[i]) m = i + 1; return m; }
  get judged() { return this.hits + this.misses + this.bad; }
  get accuracy() { return this.judged ? this.points / (100 * this.judged) : 1; }
  // Pontuação máxima possível: todas as notas com 100 pontos e o multiplicador subindo.
  get maxScore() {
    let s = 0;
    for (let i = 0; i < this.total; i++) { let m = 1; for (let k = 1; k < MULT_STEPS.length; k++) if (i >= MULT_STEPS[k]) m = k + 1; s += 100 * m; }
    return s;
  }
  hit(points) {
    this.score += points * this.mult;
    this.points += points;
    this.hits++; this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.health = Math.min(1, this.health + 0.02);
  }
  _lose(amount) {
    this.combo = 0;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && !this.noFail) this.failed = true;
  }
  miss() { this.misses++; this._lose(0.12); }
  wrong() { this.bad++; this._lose(0.1); }
  bomb() { this.bombs++; this._lose(0.15); }
  get rank() {
    const r = this.score / Math.max(1, this.maxScore);
    return r >= 0.9 ? 'S' : r >= 0.8 ? 'A' : r >= 0.65 ? 'B' : r >= 0.5 ? 'C' : 'D';
  }
}

// Robô: gera a passada da lâmina que corta a nota no centro, na direção pedida.
// Usado nos testes e no "autoplay" do navegador. Retorna {base, tip} para a fase u (-1..1).
export function robotBlade(center, frame, dir, u, reach = 0.32) {
  const dv = dir >= 0 ? DIR_VEC[dir] : [0, -1];
  const ox = frame.right, oy = frame.up;
  const s = u * reach;
  const tip = {
    x: center.x + (ox.x * dv[0] + oy.x * dv[1]) * s,
    y: center.y + (ox.y * dv[0] + oy.y * dv[1]) * s,
    z: center.z + (ox.z * dv[0] + oy.z * dv[1]) * s,
  };
  // A lâmina atravessa a nota de frente para trás: ponta 0,35 m além, cabo 0,65 m antes.
  const f = frame.back; // do centro da nota para o jogador
  const blade = { x: tip.x - f.x * 0.35, y: tip.y - f.y * 0.35, z: tip.z - f.z * 0.35 };
  const base = { x: tip.x + f.x * 0.65, y: tip.y + f.y * 0.65 - 0.25, z: tip.z + f.z * 0.65 };
  return { base, tip: blade };
}
