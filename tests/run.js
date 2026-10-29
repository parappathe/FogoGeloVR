// Testes automáticos (Node, sem navegador e sem som): node tests/run.js
import { compose } from '../js/music.js';
import { makeChart, DIFFS, OPPOSITE, START_ELEM, needFor } from '../js/chart.js';
import { judgeCut, robotBlade, ScoreKeeper, MISS_AFTER, vaporTouch, vaporExpired, VAPOR_WINDOW } from '../js/judge.js';
import { decorate, notePos, noteFrame, SPAWN_DIST, HIT_DIST } from '../js/mode.js';
import { SONGS } from '../js/songs.js';

let fails = 0, count = 0;
function check(cond, msg) { count++; if (!cond) { fails++; console.log('  FALHOU:', msg); } }

const FPS = 90;

// Passa a lâmina do robô pela nota (de u=-1 a u=1 em `dur` segundos, centrado no tempo da nota).
// Retorna o resultado do juiz com o instante do toque (time) ou null.
function swing(n, chart, { dir = n.dir, elem = 1 - n.elem, dur = 0.1, reach = 0.32, offset = 0, xoff = 0 } = {}) {
  const frame = noteFrame(n);
  const t0 = n.t - dur / 2 + offset;
  const at = notePos(n, n.t, chart.diff.speed); // a passada é fixa no lugar onde a nota chega
  at.x += xoff;
  let prev = null;
  for (let k = 0; k <= Math.ceil(dur * FPS); k++) {
    const time = t0 + k / FPS;
    const c = notePos(n, time, chart.diff.speed);
    const u = Math.max(-1, Math.min(1, (time - t0) / dur * 2 - 1));
    const cur = robotBlade(at, frame, dir, u, reach);
    if (prev) {
      const res = judgeCut(n, c, frame, { base0: prev.base, tip0: prev.tip, base1: cur.base, tip1: cur.tip, dt: 1 / FPS, elem });
      if (res) return { ...res, time };
    }
    prev = cur;
  }
  return null;
}

// Vapor: as duas lâminas passam (uma de cada lado do centro); retorna o resultado do vaporTouch.
// delay1 atrasa o toque da segunda lâmina (simula a outra lâmina chegando tarde).
function swingVapor(n, chart, elems, { delay1 = 0 } = {}) {
  const a = swing(n, chart, { elem: elems[0], xoff: -0.1 });
  const b = swing(n, chart, { elem: elems[1], xoff: 0.1 });
  if (!a?.ok || !b?.ok) return null;
  b.time += delay1;
  const st = {};
  const [p, q] = a.time <= b.time ? [[elems[0], a], [elems[1], b]] : [[elems[1], b], [elems[0], a]];
  vaporTouch(st, p[0], p[1].time, p[1].points);
  return vaporTouch(st, q[0], q[1].time, q[1].points);
}

const totals = [];
for (const song of SONGS) {
  console.log(`Música: ${song.name}`);
  const comp = compose(song);
  const comp2 = compose(song);
  check(JSON.stringify(comp.events) === JSON.stringify(comp2.events), 'composição sempre igual');
  check(comp.events.length > 300, `poucos eventos (${comp.events.length})`);
  check(comp.duration > 55 && comp.duration < 130, `duração ${comp.duration.toFixed(0)} s fora de 55..130`);
  check(comp.events.every(e => e.b >= 0 && e.b <= comp.totalBeats && e.dur > 0), 'eventos dentro da música');
  check(comp.events.some(e => e.part === 'gtr') && comp.events.some(e => e.part === 'tom'), 'tem guitarra e viradas de tom');
  console.log(`  ${comp.duration.toFixed(0)} s, ${song.bpm} BPM`);

  for (let d = 0; d < DIFFS.length; d++) {
    const chart = decorate(makeChart(comp, d, { spawnDist: SPAWN_DIST }), comp, d);
    const notes = chart.notes;
    const diff = DIFFS[d];
    const nps = notes.length / comp.duration;
    const vapors = notes.filter(n => n.kind === 'vapor');
    check(JSON.stringify(notes) === JSON.stringify(decorate(makeChart(comp, d, { spawnDist: SPAWN_DIST }), comp, d).notes), `${diff.name}: mapa sempre igual`);
    check(notes.length >= 40, `${diff.name}: poucas notas`);
    check(nps < [1.6, 2.8, 4.2][d], `${diff.name}: notas demais (${nps.toFixed(2)}/s)`);
    if (d > 0) {
      const prevCount = makeChart(comp, d - 1).notes.length;
      check(notes.length > prevCount, `${diff.name} tem que ter mais notas que ${DIFFS[d - 1].name}`);
    }
    const lastHand = [-99, -99];
    let ordered = true, gapOk = true, posOk = true, elemOk = true;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (i > 0 && n.t < notes[i - 1].t) ordered = false;
      for (const h of n.kind === 'vapor' ? [0, 1] : [n.hand]) {
        if (n.b - lastHand[h] < chart.gapHand - 1e-6) gapOk = false;
        lastHand[h] = n.b;
      }
      if (!(n.y >= 0.8 && n.y <= 1.5 && Math.abs(n.x) <= 0.5)) posOk = false;
      if (n.t - chart.lead < 0.5) posOk = false; // tem que dar tempo de aparecer
      if (n.kind === 'vapor') { if (n.elem !== 2 || n.vaporElems[0] === n.vaporElems[1] || n.dir !== -1) elemOk = false; }
      else if (!(n.elem === 0 || n.elem === 1) || n.need !== 1 - n.elem || !(n.hand === 0 || n.hand === 1)) elemOk = false;
    }
    check(ordered, `${diff.name}: notas fora de ordem`);
    check(gapOk, `${diff.name}: mesma mão rápido demais`);
    check(posOk, `${diff.name}: posição inválida`);
    check(elemOk, `${diff.name}: elemento inválido`);
    check(notes.some(n => n.elem === 0) && notes.some(n => n.elem === 1), `${diff.name}: falta esfera de fogo ou de gelo`);
    if (d === 0) {
      check(notes.every(n => n.dir === -1), 'Fácil: sentido tem que ser livre');
      check(vapors.length === 0, 'Fácil: não tem vapor');
    } else {
      check(notes.filter(n => n.dir >= 0).length > notes.length * 0.6, `${diff.name}: poucas notas com seta`);
      check(vapors.length >= 1, `${diff.name}: nenhuma esfera de vapor`);
      // Vapor vem sozinho (nenhuma outra nota no mesmo tempo).
      check(vapors.every(v => notes.filter(n => n.b === v.b).length === 1), `${diff.name}: vapor junto com outra nota`);
    }
    // Nota nasce longe e chega no ponto de corte.
    const n0 = notes[0];
    const pSpawn = notePos(n0, n0.t - chart.lead, diff.speed), pHit = notePos(n0, n0.t, diff.speed);
    check(-pSpawn.z > SPAWN_DIST * 0.9, `${diff.name}: nota nasce perto demais`);
    check(Math.abs(pHit.z + HIT_DIST) < 1e-6 && Math.abs(pHit.x - n0.x) < 1e-6 && Math.abs(pHit.y - n0.y) < 1e-6, `${diff.name}: nota não chega no ponto de corte`);

    // Robô: cada mão acompanha o elemento da lâmina; troca (gatilho) quando a próxima nota
    // pede o outro elemento, e só depois do último corte daquela mão.
    const blade = [...START_ELEM];
    const lastCut = [-99, -99];
    let swaps = 0, swapTooFast = 0, swapBeforeEach = true;
    const sk = new ScoreKeeper(notes.length);
    let robotFail = 0;
    for (const n of notes) {
      const hs = n.kind === 'vapor' ? [0, 1] : [n.hand];
      for (const h of hs) {
        const need = needFor(n, h);
        if (blade[h] !== need) {
          if (n.t - lastCut[h] < diff.minSwap - 1e-6) swapTooFast++;
          blade[h] = need; swaps++;
        }
        if (blade[h] !== need) swapBeforeEach = false;
        lastCut[h] = n.t;
      }
      if (n.kind === 'vapor') {
        if (swingVapor(n, chart, [blade[0], blade[1]]) === 'quebrou') sk.hit(90); else { sk.miss(); robotFail++; }
      } else {
        const res = swing(n, chart, { elem: blade[n.hand] });
        if (res?.ok) sk.hit(res.points); else { sk.miss(); robotFail++; }
      }
    }
    console.log(`  ${diff.name}: ${notes.length} notas (${nps.toFixed(2)}/s), ${vapors.length} vapor, ${swaps} trocas de elemento`);
    totals.push([song.name, diff.name, notes.length, vapors.length, swaps]);
    check(robotFail === 0, `${diff.name}: robô errou ${robotFail} notas`);
    check(sk.rank === 'S' || sk.rank === 'A', `${diff.name}: robô tirou ${sk.rank}`);
    check(!sk.failed, `${diff.name}: robô perdeu`);
    check(swapBeforeEach, `${diff.name}: robô chegou numa nota com o elemento errado`);
    check(swapTooFast === 0, `${diff.name}: ${swapTooFast} trocas sem tempo de apertar o gatilho (mínimo ${diff.minSwap} s)`);
    check(swaps === chart.swaps, `${diff.name}: trocas do robô (${swaps}) diferentes das do mapa (${chart.swaps})`);
    check(swaps >= notes.length * 0.12, `${diff.name}: o mapa quase não obriga a trocar (${swaps} trocas)`);
    // Sequência com elementos alternados na mesma mão (o "obriga a trocar").
    let alt = 0;
    for (const h of [0, 1]) {
      const seq = notes.filter(n => n.hand === h).map(n => n.elem);
      for (let i = 2; i < seq.length; i++) if (seq[i] !== seq[i - 1] && seq[i - 1] !== seq[i - 2]) alt++;
    }
    check(alt >= 2, `${diff.name}: nenhuma sequência alternando fogo/gelo na mesma mão`);

    // Cortes inválidos.
    const orbs = notes.filter(n => n.kind === 'orb');
    const withDir = orbs.filter(n => n.dir >= 0).slice(0, 20);
    if (d > 0) check(withDir.length > 0 && withDir.every(n => swing(n, chart, { dir: OPPOSITE[n.dir] })?.reason === 'direcao'), `${diff.name}: corte na direção oposta foi aceito`);
    check(orbs.slice(0, 20).every(n => swing(n, chart, { elem: n.elem })?.reason === 'elemento'), `${diff.name}: lâmina do mesmo elemento da esfera foi aceita`);
    check(orbs.slice(0, 20).every(n => !swing(n, chart, { dur: 1.2, reach: 0.25 })?.ok), `${diff.name}: lâmina devagar cortou`);
    check(orbs.slice(0, 20).every(n => !swing(n, chart, { offset: MISS_AFTER + 0.25 })?.ok), `${diff.name}: corte muito atrasado valeu`);
    // Qualquer mão serve: o juiz não olha a mão, só o elemento (a lâmina "da outra mão" corta).
    check(orbs.slice(0, 20).every(n => swing(n, chart, { elem: 1 - n.elem, xoff: n.hand === 0 ? 0.05 : -0.05 })?.ok), `${diff.name}: lâmina certa da outra mão foi recusada`);
    for (const v of vapors.slice(0, 5)) {
      check(swingVapor(v, chart, [0, 0]) !== 'quebrou' && swingVapor(v, chart, [1, 1]) !== 'quebrou', `${diff.name}: vapor quebrou com duas lâminas do mesmo elemento`);
      check(swingVapor(v, chart, [0, 1], { delay1: 0.3 }) === 'tarde', `${diff.name}: vapor quebrou com cortes muito separados`);
      check(swingVapor(v, chart, [1, 0]) === 'quebrou', `${diff.name}: vapor com elementos invertidos nas mãos não quebrou`);
    }
  }
}

// Regras do vapor isoladas.
{
  const st = {};
  check(vaporTouch(st, 0, 10) === 'espera', 'vapor: primeiro toque espera');
  check(vaporTouch(st, 0, 10.05) === 'espera', 'vapor: toque repetido do mesmo elemento espera');
  check(!vaporExpired(st, 10 + VAPOR_WINDOW - 0.01) && vaporExpired(st, 10 + VAPOR_WINDOW + 0.01), 'vapor: janela de 0,15 s');
  check(vaporTouch(st, 1, 10.1) === 'quebrou', 'vapor: outro elemento dentro da janela quebra');
  const st2 = {};
  vaporTouch(st2, 1, 5);
  check(vaporTouch(st2, 0, 5.2) === 'tarde', 'vapor: outro elemento fora da janela é erro');
}

// Placar.
{
  const sk = new ScoreKeeper(10);
  for (let i = 0; i < 10; i++) sk.hit(100);
  check(sk.score === sk.maxScore && sk.rank === 'S', 'placar perfeito = S');
  const sk2 = new ScoreKeeper(30);
  for (let i = 0; i < 6; i++) sk2.miss();
  check(sk2.failed, 'errar várias seguidas perde');
  const sk3 = new ScoreKeeper(30, { noFail: true });
  for (let i = 0; i < 20; i++) sk3.miss();
  check(!sk3.failed, 'modo sem derrota não perde');
}

console.log('\nResumo (música · dificuldade · notas · vapor · trocas):');
for (const t of totals) console.log(`  ${t[0]} · ${t[1]} · ${t[2]} · ${t[3]} · ${t[4]}`);
console.log(fails ? `\n${fails} de ${count} verificações FALHARAM` : `\nTudo certo (${count} verificações)`);
process.exit(fails ? 1 : 0);
