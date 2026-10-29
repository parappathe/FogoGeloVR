// Liga tudo: renderização, controles do Quest, mouse, menus, música e o laço do jogo.
import * as THREE from '../vendor/three/three.module.js';
import { compose, sectionAt } from './music.js';
import { makeChart, DIFFS, DIR_VEC, START_ELEM, needFor } from './chart.js';
import { judgeCut, ScoreKeeper, MISS_AFTER, robotBlade, vaporTouch, vaporExpired, VAPOR_WINDOW } from './judge.js';
import * as MODE from './mode.js';
import { SONGS } from './songs.js';
import { Synth } from './synth.js';
import { Panel, Label, C, PANEL_W, PANEL_H } from './ui.js';
import { buildScene, makeNoteMesh, styleNote, animateNote, makeHalf, elemColor, makeSaber, setSaberElem, animateSaber, BLADE, Trail, Sparks } from './scene.js';
import * as S from './save.js';

const GAME_NAME = 'FOGO E GELO';
const save = S.loadState();
const synth = new Synth();
synth.setMusicVolume(save.musicVol);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ELEM_NAME = ['FOGO', 'GELO'];

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const world = buildScene();
const scene = world.scene;
const rig = new THREE.Group();
scene.add(rig);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.02, 150);
rig.add(camera);

const pcYaw = 0; // a câmera do PC olha sempre para a frente da ponte
function deskCamera() {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  camera.position.set(-Math.sin(pcYaw) * 0.6, 1.55, Math.cos(pcYaw) * 0.6);
  camera.lookAt(Math.sin(pcYaw) * 2, 1.15, -Math.cos(pcYaw) * 2);
}
deskCamera();

const panel = new Panel(1.2);
scene.add(panel.mesh);
function placePanel(yaw = 0) {
  panel.mesh.position.set(Math.sin(yaw) * 1.3, 1.4, -Math.cos(yaw) * 1.3);
  panel.mesh.rotation.set(0, -yaw, 0);
}
placePanel();

const fpsLabel = new Label(0.14);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);

// Placar no chão, à frente de onde vêm as notas.
class Hud {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 768; this.canvas.height = 256;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.group = new THREE.Group();
    this.mesh.position.set(0, 0.12, -2.8);
    this.mesh.rotation.x = -0.75;
    this.group.add(this.mesh);
    this.last = '';
  }
  draw(sk, progress) {
    const key = `${sk.score}|${sk.combo}|${Math.round(sk.health * 50)}|${Math.round(progress * 100)}`;
    if (key === this.last) return;
    this.last = key;
    const g = this.g, w = 768, h = 256;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(10,4,24,0.55)'; g.fillRect(0, 0, w, h);
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.font = 'bold 72px sans-serif'; g.textAlign = 'left';
    g.fillText(String(sk.score).padStart(6, '0'), 24, 70);
    g.textAlign = 'right'; g.fillStyle = C.edge; g.font = 'bold 64px sans-serif';
    g.fillText(`x${sk.mult}`, w - 24, 70);
    g.fillStyle = '#ffffff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center';
    g.fillText(sk.combo > 1 ? `${sk.combo} em sequência` : '', w / 2, 150);
    // Vida e progresso.
    g.fillStyle = '#2a2140'; g.fillRect(24, 196, w - 48, 22);
    g.fillStyle = sk.health > 0.3 ? '#5dffa0' : '#ff4d4d'; g.fillRect(24, 196, (w - 48) * sk.health, 22);
    g.fillStyle = '#2a2140'; g.fillRect(24, 232, w - 48, 8);
    g.fillStyle = C.btnOn; g.fillRect(24, 232, (w - 48) * clamp(progress, 0, 1), 8);
    this.tex.needsUpdate = true;
  }
}
const hud = new Hud();
scene.add(hud.group);
hud.group.visible = false;

const sparks = new Sparks(500);
scene.add(sparks.points);
const trailBits = new Sparks(600, 0.028); // chamas e cristais soltos pelo rastro da lâmina
scene.add(trailBits.points);

// ---------- Lâminas ----------
// Cada lâmina tem um elemento (0 fogo, 1 gelo); o gatilho troca. Começa esquerda fogo, direita gelo.
const sabers = [0, 1].map(hand => {
  const elem = START_ELEM[hand];
  const pivot = new THREE.Group();
  const model = makeSaber(elem);
  pivot.add(model);
  scene.add(pivot);
  const trail = new Trail(elemColor(elem));
  scene.add(trail.mesh);
  return {
    hand, elem, pivot, model, trail, entry: null,
    base: new THREE.Vector3(), tip: new THREE.Vector3(), pbase: new THREE.Vector3(), ptip: new THREE.Vector3(),
    valid: false, cooldown: 0,
  };
});

// ---------- VR: controles ----------
const hands = { left: null, right: null };
const ctrls = [];
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  const grip = renderer.xr.getControllerGrip(i);
  rig.add(ctrl); rig.add(grip);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: C.edge }));
  laser.scale.z = 2; laser.visible = false;
  ctrl.add(laser);
  const entry = { ctrl, grip, laser, source: null, hand: null, prev: [], hoverIndex: -1 };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => {
    entry.source = e.data; entry.hand = e.data.handedness;
    if (entry.hand === 'left' || entry.hand === 'right') hands[entry.hand] = entry;
    attachSabers();
  });
  ctrl.addEventListener('disconnected', () => {
    if (entry.hand && hands[entry.hand] === entry) hands[entry.hand] = null;
    entry.source = null; entry.hand = null;
    attachSabers();
  });
  ctrl.addEventListener('selectstart', () => onTrigger(entry));
}

const inVR = () => renderer.xr.isPresenting;

function attachSabers() {
  for (const s of sabers) {
    const e = hands[s.hand === 0 ? 'left' : 'right'];
    s.entry = e;
    if (inVR() && e) {
      e.grip.add(s.pivot);
      s.pivot.position.set(0, 0, 0);
      s.pivot.rotation.set(THREE.MathUtils.degToRad(save.angle), 0, 0);
    } else {
      scene.add(s.pivot);
      s.pivot.rotation.set(0, 0, 0);
    }
    s.valid = false;
    s.trail.clear();
  }
}

function setElem(s, elem, effects = true) {
  s.elem = elem;
  setSaberElem(s.model, elem, effects);
  s.trail.setColor(elemColor(elem));
  if (effects) {
    synth.swap(elem, s.hand === 0 ? -0.5 : 0.5);
    sparks.burst(s.tip, elemColor(elem), 18, 1.6, elem === 0 ? 2 : -3);
    pulse(s, 0.35, 25);
  }
  updateHint();
}
// Gatilho (ou botão direito / Espaço no PC): troca fogo <-> gelo.
function toggleElem(s) { setElem(s, 1 - s.elem); }

function pulse(saber, v, ms) {
  try { saber.entry?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(v, ms); } catch { /* sem vibração */ }
}

// Põe o jogador no centro da plataforma, virado para a frente (-Z).
function recenter() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, -head.z);
}
let recenterIn = 0;
renderer.xr.addEventListener('sessionstart', () => { recenterIn = 5; attachSabers(); updateHint(); placePanel(0); });
renderer.xr.addEventListener('sessionend', () => { deskCamera(); attachSabers(); updateHint(); if (app === 'playing') pauseGame(); });

function headYaw() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  return Math.atan2(d.x, -d.z);
}

// ---------- Mouse (PC) ----------
const mouse = { ndc: new THREE.Vector2(0.15, -0.1), moved: false };
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

renderer.domElement.addEventListener('pointermove', (e) => {
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.moved = true;
  if (panel.visible && !inVR()) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    panel.setHover(panel.pick(hit?.uv));
  }
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', (e) => {
  synth.unlock();
  if (e.button === 2) { if (app === 'playing' && !inVR()) toggleElem(sabers[1]); return; }
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  if (panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    doAction(panel.actionAt(panel.pick(hit?.uv)));
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'f' || e.key === 'F') { save.fps = !save.fps; S.saveState(save); }
  if (e.key === ' ') { e.preventDefault(); if (app === 'playing' && !inVR() && !e.repeat) toggleElem(sabers[1]); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lâmina do mouse: a ponta segue o mouse no plano do anel de corte.
function placeSaber(s, gripPos, tipPos) {
  s.pivot.position.copy(gripPos);
  tmpV2.copy(gripPos).multiplyScalar(2).sub(tipPos); // olhar para o lado oposto: -Z aponta para a ponta
  s.pivot.lookAt(tmpV2);
}
function yawFrame(yaw, lx, ly, lz, out) {
  // ponto no referencial virado para `yaw` (x direita, z para trás)
  out.set(Math.cos(yaw) * lx - Math.sin(yaw) * lz, ly, Math.sin(yaw) * lx + Math.cos(yaw) * lz);
  return out;
}
const gripP = new THREE.Vector3(), tipP = new THREE.Vector3();
function updateMouseSaber() {
  const s = sabers[1];
  raycaster.setFromCamera(mouse.ndc, camera);
  const dir = new THREE.Vector3(Math.sin(pcYaw), 0, -Math.cos(pcYaw));
  const plane = new THREE.Plane(dir, -MODE.HIT_DIST);
  if (!raycaster.ray.intersectPlane(plane, tipP)) return;
  // Converte para o referencial da câmera para posicionar o cabo.
  const lx = Math.cos(pcYaw) * tipP.x + Math.sin(pcYaw) * tipP.z;
  yawFrame(pcYaw, 0.22 + lx * 0.3, 1.0 + (tipP.y - 1.15) * 0.35, 0.05, gripP);
  placeSaber(s, gripP, tipP);
}

// ---------- Estado do jogo ----------
let app = 'menu';          // 'menu' | 'playing' | 'paused' | 'result'
let screen = 'main';
let songIdx = save.lastSong, diffIdx = save.lastDiff;
let comp = null, chart = null, sk = null;
let nextIdx = 0;
const active = [];         // { n, mesh, done, fade, vapor, vaporSaber }
const notePool = [];
const halves = [];         // { m, v, spin, life }
let lastBeat = -1, lastSection = null, songT = 0;
let result = null;
const dev = { autoplay: false };

function getNoteMesh() {
  const m = notePool.pop() || makeNoteMesh();
  scene.add(m);
  m.visible = true;
  m.scale.setScalar(1);
  return m;
}
function freeNoteMesh(m) { m.visible = false; scene.remove(m); notePool.push(m); }

function startSong(si = songIdx, di = diffIdx) {
  songIdx = si; diffIdx = di;
  save.lastSong = si; save.lastDiff = di; S.saveState(save);
  clearNotes();
  comp = compose(SONGS[si]);
  chart = MODE.decorate(makeChart(comp, di, { spawnDist: MODE.SPAWN_DIST }), comp, di);
  sk = new ScoreKeeper(chart.notes.length, { noFail: save.noFail });
  nextIdx = 0;
  lastBeat = -1; lastSection = null;
  for (const s of sabers) setElem(s, START_ELEM[s.hand], false);
  synth.stop();
  synth.start(comp, chart.lead + 0.5);
  app = 'playing';
  panel.hide();
  hud.group.visible = true;
  hud.last = '';
  if (!inVR()) deskCamera();
  updateHint();
}

function clearNotes() {
  for (const a of active) freeNoteMesh(a.mesh);
  active.length = 0;
  for (const h of halves) h.life = 0;
}

function pauseGame() {
  if (app !== 'playing') return;
  app = 'paused';
  synth.pause();
  screen = 'pause';
  placePanel(inVR() ? headYaw() : pcYaw);
  showScreen();
}
function resumeGame() {
  if (app !== 'paused') return;
  panel.hide();
  app = 'playing';
  synth.unlock();
  synth.resume();
}
function togglePause() { if (app === 'playing') pauseGame(); else if (app === 'paused') resumeGame(); }

function quitToMenu() {
  synth.stop();
  clearNotes();
  for (const s of sabers) setElem(s, START_ELEM[s.hand], false);
  app = 'menu';
  hud.group.visible = false;
  screen = 'songs';
  updateHint();
  if (!inVR()) deskCamera();
  placePanel(0);
  showScreen();
}

function finish(failed) {
  synth.stop();
  synth.fanfare(!failed);
  const song = SONGS[songIdx], diff = DIFFS[diffIdx];
  const res = { score: sk.score, rank: failed ? '—' : sk.rank, acc: Math.round(sk.accuracy * 100), combo: sk.maxCombo };
  const isRecord = !failed && S.record(save, song.id, diff.id, res);
  result = { ...res, failed, isRecord, hits: sk.hits, total: chart.notes.length, misses: sk.misses + sk.bad };
  clearNotes();
  for (const s of sabers) setElem(s, START_ELEM[s.hand], false);
  app = 'result';
  hud.group.visible = false;
  screen = 'result';
  updateHint();
  placePanel(inVR() ? headYaw() : 0);
  showScreen();
}

// ---------- Menus ----------
function showScreen() {
  panel.show((p) => {
    const W = PANEL_W;
    if (screen === 'main') {
      p.title(GAME_NAME, 90);
      p.text('Gelo apaga o fogo, fogo derrete o gelo. O gatilho troca.', W / 2, 160, { size: 30, color: C.dim });
      p.button('Jogar', 'go:songs', 312, 230, 400, 100, { size: 44 });
      p.button('Opções', 'go:options', 312, 350, 400, 84);
      p.button('Como jogar', 'go:help', 312, 454, 400, 84);
      p.text(inVR() ? 'Aponte com o controle e aperte o gatilho' : 'PC: o mouse corta, botão direito ou Espaço troca. Esc pausa.', W / 2, 610, { size: 26, color: C.dim });
    } else if (screen === 'songs') {
      p.title('Escolha a música', 64);
      SONGS.forEach((song, i) => {
        const y = 120 + i * 170;
        p.text(song.name, 50, y + 30, { size: 38, bold: true, align: 'left' });
        p.text(song.desc, 50, y + 72, { size: 24, align: 'left', color: C.dim });
        DIFFS.forEach((d, k) => {
          const best = S.bestOf(save, song.id, d.id);
          p.button(d.name, `play:${i}:${k}`, 430 + k * 190, y + 6, 175, 100,
            { size: 30, on: i === songIdx && k === diffIdx, sub: best ? `${best.rank} · ${best.score}` : 'sem recorde' });
        });
      });
      p.button('Voltar', 'go:main', 362, 630, 300, 66, { size: 30 });
    } else if (screen === 'options') {
      p.title('Opções', 64);
      const line = (y, label, vals, cur, key) => {
        p.text(label, 50, y + 32, { size: 30, align: 'left' });
        vals.forEach(([v, txt], k) => p.button(txt, `opt:${key}:${v}`, 420 + k * 118, y, 108, 64, { size: 26, on: v === cur }));
      };
      line(120, 'Sem derrota', [[false, 'Não'], [true, 'Sim']], save.noFail, 'noFail');
      line(210, 'Ângulo da lâmina', [[-30, '-30°'], [-15, '-15°'], [0, '0°'], [15, '+15°'], [30, '+30°']], save.angle, 'angle');
      line(300, 'Altura das notas', [[-0.15, 'Baixa'], [0, 'Média'], [0.15, 'Alta']], save.height, 'height');
      line(390, 'Volume da música', [[0, '0'], [0.4, '40%'], [0.8, '80%'], [1, '100%']], save.musicVol, 'musicVol');
      line(480, 'Mostrar FPS', [[false, 'Não'], [true, 'Sim']], save.fps, 'fps');
      p.button('Voltar', 'go:main', 362, 600, 300, 70, { size: 30 });
    } else if (screen === 'help') {
      p.title('Como jogar', 64);
      const lines = [
        ['Cada lâmina é de FOGO (laranja) ou de GELO (azul).', C.text],
        ['O GATILHO troca o elemento daquela lâmina: fogo ⇄ gelo.', C.edge],
        ['Esfera de fogo: só quebra com lâmina de GELO.', C.fire],
        ['Esfera de gelo: só quebra com lâmina de FOGO.', C.ice],
        ['Qualquer mão serve: o que vale é o elemento da lâmina.', C.text],
        ['Vapor (as duas grudadas): corte com as duas lâminas juntas,', C.text],
        ['   uma de fogo e uma de gelo. Siga a seta (Fácil: livre).', C.text],
        ['Errar gasta a barra verde. Pausa: B ou Y (Esc no PC).', C.dim],
        [inVR() ? 'Começa: esquerda de fogo, direita de gelo.' : 'PC: botão direito ou Espaço troca; vapor quebra com um corte.', C.dim],
      ];
      lines.forEach(([l, col], i) => p.text(l, 50, 125 + i * 52, { size: 28, align: 'left', color: col }));
      p.button('Voltar', 'go:main', 362, 610, 300, 70, { size: 30 });
    } else if (screen === 'pause') {
      p.title('Pausa', 80);
      p.button('Continuar', 'resume', 312, 170, 400, 90, { size: 40 });
      p.button('Recomeçar', 'restart', 312, 280, 400, 80);
      p.button('Recentralizar', 'recenter', 312, 380, 400, 80, { locked: !inVR() });
      p.button('Sair da música', 'quit', 312, 480, 400, 80);
    } else if (screen === 'result') {
      const r = result;
      p.title(r.failed ? 'A ponte desabou' : 'Música completa!', 70);
      p.text(`${SONGS[songIdx].name} · ${DIFFS[diffIdx].name}`, PANEL_W / 2, 130, { size: 30, color: C.dim });
      p.text(r.rank, 230, 300, { size: 180, bold: true, color: r.failed ? C.dim : C.btnOn });
      p.text(`Pontos: ${r.score}`, 440, 220, { size: 36, align: 'left', bold: true });
      p.text(`Precisão: ${r.acc}%`, 440, 275, { size: 30, align: 'left' });
      p.text(`Notas cortadas: ${r.hits} de ${r.total}`, 440, 325, { size: 30, align: 'left' });
      p.text(`Maior sequência: ${r.combo}`, 440, 375, { size: 30, align: 'left' });
      if (r.isRecord) p.text('NOVO RECORDE!', 440, 430, { size: 34, bold: true, align: 'left', color: C.edge });
      p.button('Jogar de novo', 'restart', 160, 520, 340, 90, { size: 34 });
      p.button('Músicas', 'go:songs', 524, 520, 340, 90, { size: 34 });
    }
  });
}

function doAction(a) {
  if (!a) return;
  synth.unlock();
  synth.click();
  const [cmd, x, y] = a.split(':');
  if (cmd === 'go') { screen = x; showScreen(); }
  else if (cmd === 'play') startSong(Number(x), Number(y));
  else if (cmd === 'opt') {
    const v = y === 'true' ? true : y === 'false' ? false : Number(y);
    save[x] = v;
    if (x === 'angle') attachSabers();
    if (x === 'musicVol') synth.setMusicVolume(v);
    S.saveState(save);
    showScreen();
  } else if (cmd === 'resume') resumeGame();
  else if (cmd === 'restart') startSong();
  else if (cmd === 'recenter') { recenter(); placePanel(0); }
  else if (cmd === 'quit') quitToMenu();
}

function onTrigger(entry) {
  synth.unlock();
  if (panel.visible) { if (entry.hoverIndex >= 0) doAction(panel.actionAt(entry.hoverIndex)); return; }
  if (app === 'playing') {
    const s = sabers.find(x => x.entry === entry);
    if (s) toggleElem(s);
  }
}

// Laser dos controles apontando para o menu.
const rayM = new THREE.Matrix4();
function updateLasers() {
  for (const e of ctrls) {
    const show = inVR() && panel.visible && e.source;
    e.laser.visible = !!show;
    e.hoverIndex = -1;
    if (!show) continue;
    rayM.identity().extractRotation(e.ctrl.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(e.ctrl.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rayM);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    e.laser.scale.z = hit ? hit.distance : 2;
    if (hit) e.hoverIndex = panel.pick(hit.uv);
  }
  const h = ctrls.find(e => e.hoverIndex >= 0);
  if (inVR() && panel.visible) panel.setHover(h ? h.hoverIndex : -1);
}

// Botões B/Y pausam.
function pollButtons() {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp) continue;
    const b = gp.buttons.map(x => x.pressed);
    if ((b[5] && !e.prev[5]) || (b[4] && !e.prev[4] && app === 'paused')) togglePause();
    e.prev = b;
  }
}

// ---------- Jogo ----------
const pos = {}, frame = {};
const tmpSaber = { base0: null, tip0: null, base1: null, tip1: null, dt: 0, elem: 0 };
const cutPoint = new THREE.Vector3();

function readSabers(dt) {
  for (const s of sabers) {
    s.pbase.copy(s.base); s.ptip.copy(s.tip);
    s.model.updateWorldMatrix(true, false);
    s.base.set(0, 0, BLADE.base).applyMatrix4(s.model.matrixWorld);
    s.tip.set(0, 0, BLADE.tip).applyMatrix4(s.model.matrixWorld);
    const ok = s.pivot.visible && (inVR() ? !!s.entry : (s.hand === 1 || dev.autoplay));
    if (ok) s.trail.push(tmpV.copy(s.base).lerp(s.tip, 0.35), s.tip);
    s.trail.mesh.visible = ok && app === 'playing';
    const was = s.valid;
    s.valid = ok;
    s.fresh = ok && was; // precisa de dois quadros seguidos para medir a passada
    s.dt = dt;
    // Rastro: chamas que sobem (fogo) ou cristais que caem devagar (gelo) quando a lâmina corre.
    if (s.fresh && app === 'playing' && dt > 0) {
      const v = s.tip.distanceTo(s.ptip) / dt;
      if (v > 1.4) {
        const n = Math.min(3, Math.floor(v / 2) + 1);
        for (let i = 0; i < n; i++) {
          tmpV.copy(s.ptip).lerp(s.tip, Math.random()).lerp(s.base, Math.random() * 0.4);
          if (s.elem === 0) trailBits.emit(tmpV, Math.random() < 0.5 ? 0xffb030 : 0xff5010, (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 2.5, 0.35);
          else trailBits.emit(tmpV, Math.random() < 0.5 ? 0xe8fbff : 0x8fe6ff, (Math.random() - 0.5) * 0.3, -0.1, (Math.random() - 0.5) * 0.3, -1.2, 0.6);
        }
      }
    }
    s.cooldown = Math.max(0, s.cooldown - dt);
  }
}

// Robô do PC (dev.autoplay): cada lâmina cuida das notas do seu lado (e as duas do vapor) e
// troca o elemento (como se apertasse o gatilho) assim que a nota anterior daquela mão saiu.
function autoplaySabers(st) {
  for (const s of sabers) {
    const n = chart.notes.find(x => (x.hand === s.hand || x.kind === 'vapor') && !x.handled && x.t > st - 0.06);
    if (n && s.elem !== needFor(n, s.hand)) toggleElem(s);
    const rest = yawFrame(pcYaw, s.hand === 0 ? -0.35 : 0.35, 1.0, -0.2, new THREE.Vector3());
    if (!n || n.t - st > 0.35) {
      placeSaber(s, rest, yawFrame(pcYaw, s.hand === 0 ? -0.5 : 0.5, 1.3, -1.1, new THREE.Vector3()));
      continue;
    }
    const at = MODE.notePos(n, n.t, chart.diff.speed, {});
    at.y += save.height;
    if (n.kind === 'vapor') at.x += s.hand === 0 ? -0.1 : 0.1;
    MODE.noteFrame(n, frame);
    const u = clamp((st - (n.t - 0.05)) / 0.1 * 2 - 1, -1, 1);
    const b = robotBlade(at, frame, n.dir, u);
    const tip = new THREE.Vector3(b.tip.x, b.tip.y, b.tip.z), base = new THREE.Vector3(b.base.x, b.base.y, b.base.z);
    const dir = tip.clone().sub(base).normalize();
    const grip = base.clone().addScaledVector(dir, BLADE.base); // BLADE.base é negativo: recua 0,1 m
    placeSaber(s, grip, grip.clone().addScaledVector(dir, 1));
  }
}

function spawnNotes(st) {
  const lead = chart.lead;
  while (nextIdx < chart.notes.length && chart.notes[nextIdx].t - lead <= st) {
    const n = chart.notes[nextIdx++];
    const mesh = getNoteMesh();
    styleNote(mesh, n, DIR_VEC);
    active.push({ n, mesh, done: false, fade: 0, vapor: {}, vaporSaber: null });
  }
}

function cutNote(a, s, res) {
  a.done = true; a.n.handled = true;
  sk.hit(res.points);
  const p = a.mesh.position;
  // Fogo apagado solta brasas que sobem; gelo quebrado vira cacos; vapor solta nuvem branca.
  const sphere = a.n.elem;
  const col = elemColor(sphere);
  sparks.burst(p, col, 22, 2 + res.speed * 0.3, sphere === 0 ? 1 : -6);
  if (sphere === 2) { sparks.burst(p, 0xffffff, 30, 1.2, 1.5); sparks.burst(p, 0xff8a30, 10, 2); sparks.burst(p, 0x8fe6ff, 10, 2); }
  else sparks.burst(p, elemColor(s.elem), 10, 1.5, s.elem === 0 ? 2 : -3);
  const ang = Math.atan2(res.cutDir[1], res.cutDir[0]);
  MODE.noteFrame(a.n, frame);
  for (const side of [1, -1]) {
    let h = halves.find(x => x.life <= 0);
    if (!h) { h = { m: makeHalf(), v: new THREE.Vector3(), spin: 0, life: 0 }; halves.push(h); }
    scene.add(h.m);
    h.m.visible = true;
    const hc = sphere === 2 ? elemColor(side > 0 ? 1 : 0) : col;
    h.m.material.color.setHex(hc);
    h.m.material.emissive.setHex(hc);
    h.m.material.opacity = 1;
    h.m.position.copy(p);
    h.m.rotation.set(0, a.mesh.rotation.y, ang + (side > 0 ? 0 : Math.PI));
    // Separa perpendicular ao corte, no plano da nota.
    const nx = -res.cutDir[1] * side, ny = res.cutDir[0] * side;
    h.v.set(frame.right.x * nx * 1.6 + frame.back.x * -0.8, ny * 1.6 + 0.6, frame.right.z * nx * 1.6 + frame.back.z * -0.8);
    h.spin = (Math.random() - 0.5) * 12;
    h.life = 0.6;
  }
  freeNoteMesh(a.mesh);
  synth.cut(Math.min(1, res.points / 100), clamp(p.x, -1, 1), sphere);
  pulse(s, 0.6, 30);
}

function badNote(a, s, kind) {
  a.done = true; a.n.handled = true; a.fade = 0.25;
  if (kind === 'miss') { sk.miss(); synth.miss(); }
  else { sk.wrong(); synth.bad(); if (s) pulse(s, 1, 80); }
}

function updatePlaying(dt) {
  synth.tick(dt);
  synth.pump();
  const st = synth.time();
  const speed = chart.diff.speed;

  songT += dt;
  if (!inVR()) {
    if (dev.autoplay) autoplaySabers(st);
    else updateMouseSaber();
  }

  readSabers(dt);
  spawnNotes(st);

  for (const a of active) {
    const n = a.n;
    MODE.notePos(n, st, speed, pos);
    pos.y += save.height;
    if (a.done) {
      a.fade -= dt;
      a.mesh.position.set(pos.x, pos.y, pos.z);
      a.mesh.scale.setScalar(Math.max(0.01, a.fade * 4));
      continue;
    }
    a.mesh.position.set(pos.x, pos.y, pos.z);
    animateNote(a.mesh, songT);
    if (n.t - st < 0.35) {
      MODE.noteFrame(n, frame);
      const vapor = n.kind === 'vapor';
      for (const s of sabers) {
        if (!s.fresh || s.cooldown > 0) continue;
        // Robô: cada lâmina só cuida das notas do seu lado (não esbarra nas da outra).
        if (dev.autoplay && n.hand >= 0 && n.hand !== s.hand) continue;
        if (vapor && a.vaporSaber === s) continue; // a mesma lâmina passando de novo não conta
        tmpSaber.base0 = s.pbase; tmpSaber.tip0 = s.ptip; tmpSaber.base1 = s.base; tmpSaber.tip1 = s.tip;
        tmpSaber.dt = s.dt;
        tmpSaber.elem = s.elem;
        const res = judgeCut(n, pos, frame, tmpSaber);
        if (!res) continue;
        if (!res.ok) { badNote(a, s, 'wrong'); s.cooldown = 0.05; break; }
        if (vapor && (inVR() || dev.autoplay)) {
          const r = vaporTouch(a.vapor, s.elem, st, res.points);
          if (r === 'espera') { a.vaporSaber = s; sparks.burst(pos, elemColor(s.elem), 8, 1); pulse(s, 0.3, 20); continue; }
          if (r === 'quebrou') cutNote(a, s, { ...res, points: a.vapor.points });
          else badNote(a, s, 'wrong');
          break;
        }
        cutNote(a, s, res); // no PC (uma lâmina só) o vapor quebra com um corte
        break;
      }
    }
    // Vapor tocado por uma lâmina só: a outra tem até VAPOR_WINDOW para chegar.
    if (!a.done && n.kind === 'vapor' && vaporExpired(a.vapor, st)) badNote(a, null, 'wrong');
    const grace = a.vapor.first ? Math.max(MISS_AFTER, a.vapor.first.time + VAPOR_WINDOW - n.t) : MISS_AFTER;
    if (!a.done && st > n.t + grace) badNote(a, null, 'miss');
  }
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i];
    if (a.done && (a.fade <= 0 || !a.mesh.visible)) { if (a.mesh.visible) freeNoteMesh(a.mesh); active.splice(i, 1); }
  }

  // Batida e seção: o cenário pulsa com a música.
  const beat = Math.floor(st / comp.spb);
  const sec = sectionAt(comp, Math.max(0, st / comp.spb));
  if (beat !== lastBeat && st >= 0) { lastBeat = beat; if (sec.energy > 0.4) world.beat(0.4 + sec.energy * 0.6); }
  if (sec !== lastSection && st >= 0) { if (lastSection && sec.energy >= 0.85) world.flash(1); lastSection = sec; }
  world.update(dt, { energy: st >= 0 ? sec.energy : 0.2 });

  hud.draw(sk, st / comp.duration);
  if (sk.failed) finish(true);
  else if (st > comp.duration + 1) finish(false);
}

function updateHalves(dt) {
  for (const h of halves) {
    if (h.life <= 0) { if (h.m.visible) { h.m.visible = false; scene.remove(h.m); } continue; }
    h.life -= dt;
    h.v.y -= 7 * dt;
    h.m.position.addScaledVector(h.v, dt);
    h.m.rotation.x += h.spin * dt;
    h.m.material.opacity = Math.max(0, h.life / 0.6);
  }
}

// ---------- Laço principal ----------
let fpsAcc = 0, fpsN = 0, fpsShown = 0, clockT = 0;
const clock = new THREE.Clock();
const fpsDiv = document.getElementById('fps');

function step(dt) {
  if (recenterIn > 0 && inVR()) { recenterIn--; if (recenterIn === 0) recenter(); }
  pollButtons();
  if (app === 'playing') updatePlaying(dt);
  else {
    readSabers(dt);
    world.update(dt, { energy: 0.15 });
    if (!inVR()) {
      if (app === 'menu' || app === 'result') deskCamera();
      // No menu do PC a lâmina fica parada ao lado.
      placeSaber(sabers[1], yawFrame(pcYaw, 0.35, 1.0, -0.1, gripP), yawFrame(pcYaw, 0.55, 1.4, -1.0, tipP));
    }
  }
  updateHalves(dt);
  sparks.update(dt);
  trailBits.update(dt);
  clockT += dt;
  for (const s of sabers) animateSaber(s.model, dt, clockT);
  updateLasers();
  // No PC só a lâmina direita aparece (a não ser com o robô).
  sabers[0].pivot.visible = inVR() ? !!sabers[0].entry : (dev.autoplay && app === 'playing');
  sabers[1].pivot.visible = inVR() ? !!sabers[1].entry : true;
}

function frameLoop() {
  const dt = Math.min(0.05, clock.getDelta());
  if (!dev.freeze) step(dt); // freeze: congela a cena para fotos de teste
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  fpsLabel.mesh.visible = save.fps && inVR();
  if (fpsLabel.mesh.visible) fpsLabel.set(`${fpsShown} FPS`);
  fpsDiv.style.display = save.fps && !inVR() ? 'block' : 'none';
  if (save.fps) fpsDiv.textContent = `${fpsShown} FPS`;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frameLoop);

// ---------- Botão VR e dica ----------
const vrBtn = document.getElementById('vr');
const hintDiv = document.getElementById('hint');
function updateHint() {
  if (inVR()) { hintDiv.textContent = ''; return; }
  if (app === 'playing') {
    const e = sabers[1].elem;
    hintDiv.innerHTML = `Lâmina: <b style="color:${e === 0 ? C.fire : C.ice}">${ELEM_NAME[e]}</b> · corta esferas de ${e === 0 ? 'gelo' : 'fogo'} · botão direito ou Espaço troca · Esc pausa`;
  } else hintDiv.textContent = 'Clique no menu · no Quest, aperte "Entrar em VR"';
}
async function setupVR() {
  const ok = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) {
    vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS';
    vrBtn.disabled = true;
    return;
  }
  vrBtn.disabled = false;
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.addEventListener('click', async () => {
    synth.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
      if (app === 'menu') { screen = 'main'; showScreen(); }
    } catch (err) {
      vrBtn.textContent = 'Não deu para entrar em VR';
      console.error(err);
    }
  });
}
setupVR();
attachSabers();
showScreen();
updateHint();

// Para testes no console: window.jogo (o painel escondido não anima: use dev.advance).
dev.advance = (sec, fps = 60) => {
  for (let i = 0; i < sec * fps; i++) step(1 / fps);
  renderer.render(scene, camera);
  return { app, score: sk?.score, hits: sk?.hits, misses: sk?.misses, bad: sk?.bad, total: chart?.notes.length, st: synth.time() };
};
window.jogo = { startSong, doAction, dev, save, get sk() { return sk; }, get chart() { return chart; }, get app() { return app; } };
