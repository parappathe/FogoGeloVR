// Cenário do Fogo e Gelo (tudo gerado por código): uma ponte de pedra sobre um abismo, com um
// vulcão à esquerda (lava, brasas subindo) e uma geleira à direita (cristais, neve caindo).
// As esferas vêm pelo corredor da ponte, de frente.
import * as THREE from '../vendor/three/three.module.js';
import { HIT_DIST } from './mode.js';

export const COLORS = { fire: 0xff6a1a, ice: 0x8fe6ff, vapor: 0xf4f1ff, accent: 0xffd23f };
export const elemColor = (e) => e === 0 ? COLORS.fire : e === 1 ? COLORS.ice : COLORS.vapor;

const rand = (a, b) => a + Math.random() * (b - a);

export function buildScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1b1018, 0.018);

  // Céu: degradê que vai do vermelho do vulcão (esquerda) ao azul da geleira (direita).
  const skyGeo = new THREE.SphereGeometry(90, 40, 20);
  const cols = [];
  const pos = skyGeo.attributes.position;
  const fireC = new THREE.Color(0x5a1408), iceC = new THREE.Color(0x0e2a4a), top = new THREE.Color(0x07060c), low = new THREE.Color(0x120608);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / 90, h = pos.getY(i) / 90;
    const side = fireC.clone().lerp(iceC, THREE.MathUtils.smoothstep(x, -0.5, 0.5));
    const c = h > 0 ? side.clone().lerp(top, Math.min(1, h * 1.6)) : side.clone().lerp(low, Math.min(1, -h * 2));
    cols.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  scene.add(new THREE.HemisphereLight(0x9ab8d8, 0x3a1408, 0.9));
  const sun = new THREE.DirectionalLight(0xffe6d0, 0.8);
  sun.position.set(-3, 8, 4);
  scene.add(sun);
  const lavaLight = new THREE.PointLight(0xff5a1a, 30, 30, 1.6);
  lavaLight.position.set(-5, -1, -6);
  scene.add(lavaLight);
  const iceLight = new THREE.PointLight(0x5ac8ff, 18, 28, 1.6);
  iceLight.position.set(5, 2, -6);
  scene.add(iceLight);

  // Ponte: blocos de pedra (InstancedMesh) de z = +2 até o fundo.
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a7b70, roughness: 0.95, metalness: 0.05, flatShading: true });
  const blockGeo = new THREE.BoxGeometry(0.58, 0.3, 0.78);
  const rowsZ = 56, perRow = 4;
  const deck = new THREE.InstancedMesh(blockGeo, stoneMat, rowsZ * perRow);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();
  const tint = new THREE.Color();
  let k = 0;
  for (let r = 0; r < rowsZ; r++) {
    for (let c = 0; c < perRow; c++) {
      p3.set(-0.9 + c * 0.6 + (r % 2 ? 0.05 : -0.05), -0.15 - Math.random() * 0.03, 2 - r * 0.8);
      q.setFromEuler(new THREE.Euler(rand(-0.02, 0.02), rand(-0.03, 0.03), rand(-0.02, 0.02)));
      m4.compose(p3, q, sc);
      deck.setMatrixAt(k, m4);
      // Lado esquerdo levemente avermelhado (calor), direito azulado (gelo).
      tint.setHSL(c < 2 ? 0.05 : 0.58, 0.12, rand(0.32, 0.45));
      deck.setColorAt(k, tint);
      k++;
    }
  }
  scene.add(deck);
  // Vigas por baixo e parapeito baixo com pilaretes.
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x3c332e, roughness: 1, flatShading: true });
  for (const x of [-1.15, 1.15]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 46), beamMat);
    beam.position.set(x, -0.6, -20);
    scene.add(beam);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 46), stoneMat);
    rail.position.set(x * 1.06, 0.42, -20);
    scene.add(rail);
  }
  const postGeo = new THREE.BoxGeometry(0.22, 0.5, 0.22);
  const posts = new THREE.InstancedMesh(postGeo, stoneMat, 46);
  for (let i = 0; i < 23; i++) {
    for (const [j, x] of [[0, -1.22], [1, 1.22]]) {
      m4.compose(p3.set(x, 0.2, 1.5 - i * 2), q.identity(), sc);
      posts.setMatrixAt(i * 2 + j, m4);
    }
  }
  scene.add(posts);
  // Pedrinhas de brasa no parapeito esquerdo e gelo no direito.
  const emberCapMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
  const iceCapMat = new THREE.MeshStandardMaterial({ color: 0xcff6ff, emissive: 0x3aa8ff, emissiveIntensity: 0.6, roughness: 0.15, flatShading: true });
  const caps = [];
  for (let i = 0; i < 23; i++) {
    const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), emberCapMat);
    e.position.set(-1.22, 0.5, 1.5 - i * 2);
    const ic = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), iceCapMat);
    ic.scale.set(0.7, 1.6, 0.7);
    ic.position.set(1.22, 0.56, 1.5 - i * 2);
    scene.add(e, ic);
    caps.push(e);
  }

  // Linha do ponto de corte no chão (metade laranja, metade azul).
  for (const [x, col] of [[-0.55, COLORS.fire], [0.55, COLORS.ice]]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.03), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.005, -HIT_DIST);
    scene.add(line);
  }

  // Fundo do abismo: rio de lava à esquerda, água gelada à direita (cores no vértice).
  const abyssGeo = new THREE.PlaneGeometry(140, 140, 40, 40);
  abyssGeo.rotateX(-Math.PI / 2);
  const ac = [];
  const ap = abyssGeo.attributes.position;
  const lavaA = new THREE.Color(0xff4a0a), lavaB = new THREE.Color(0x3a0800), iceA = new THREE.Color(0x10304a);
  for (let i = 0; i < ap.count; i++) {
    const x = ap.getX(i), z = ap.getZ(i);
    const veins = 0.5 + 0.5 * Math.sin(x * 0.35 + Math.sin(z * 0.2) * 2.5) * Math.sin(z * 0.27 + x * 0.1);
    const lava = lavaB.clone().lerp(lavaA, veins);
    const c = lava.lerp(iceA, THREE.MathUtils.smoothstep(x, -6, 6));
    ac.push(c.r, c.g, c.b);
  }
  abyssGeo.setAttribute('color', new THREE.Float32BufferAttribute(ac, 3));
  const abyssMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const abyss = new THREE.Mesh(abyssGeo, abyssMat);
  abyss.position.set(0, -22, -30);
  scene.add(abyss);

  // Vulcão: cone escuro com cratera brilhando e rios de lava descendo.
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 1, flatShading: true });
  const volcano = new THREE.Mesh(new THREE.ConeGeometry(26, 44, 14, 4, true), rockMat);
  volcano.position.set(-34, 0, -52);
  scene.add(volcano);
  const craterMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, fog: false });
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 1.2, 14), craterMat);
  crater.position.set(-34, 21.6, -52);
  scene.add(crater);
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a0a, fog: false });
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 0.35;
    const pts = [];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10, rr = 3.4 + t * 22, y = 21.5 - t * 44;
      pts.push(new THREE.Vector3(-34 + Math.sin(a + t * 0.25) * rr, y, -52 + Math.cos(a + t * 0.25) * rr));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.35 + Math.random() * 0.3, 5), lavaMat);
    scene.add(tube);
  }
  // Colunas de basalto perto da ponte, à esquerda, com o topo em brasa.
  const basaltGeo = new THREE.CylinderGeometry(0.6, 0.7, 1, 6);
  const glowTopMat = new THREE.MeshBasicMaterial({ color: 0xff5010 });
  for (let i = 0; i < 14; i++) {
    const h = rand(4, 16);
    const col = new THREE.Mesh(basaltGeo, rockMat);
    col.scale.set(rand(0.8, 1.6), h, rand(0.8, 1.6));
    const x = rand(-12, -4), z = rand(-36, 2);
    col.position.set(x, -22 + h / 2 + rand(8, 18), z);
    scene.add(col);
    const topG = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 6), glowTopMat);
    topG.scale.set(col.scale.x, 1, col.scale.z);
    topG.position.set(x, col.position.y + h / 2 + 0.02, z);
    scene.add(topG);
  }

  // Geleira: montanhas de gelo à direita e cristais grandes perto da ponte.
  const glacierMat = new THREE.MeshStandardMaterial({ color: 0xbfe2f2, roughness: 0.4, metalness: 0.05, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(rand(8, 14), rand(22, 40), 6, 1), glacierMat);
    m.position.set(rand(24, 50), -10 + rand(0, 6), rand(-70, -20));
    m.rotation.y = rand(0, 3);
    scene.add(m);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 50), glacierMat);
  shelf.position.set(11, -6, -18);
  scene.add(shelf);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x2a8cff, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85, flatShading: true });
  const crystalGeo = new THREE.OctahedronGeometry(1, 0);
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(crystalGeo, crystalMat);
    const s = rand(0.4, 1.4);
    c.scale.set(s * 0.5, s * rand(2, 4), s * 0.5);
    c.position.set(rand(4.5, 15), -4.5 + c.scale.y * 0.6, rand(-40, 3));
    c.rotation.set(rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4));
    scene.add(c);
  }

  // Brasas subindo (esquerda) e neve caindo (direita).
  const makeParticles = (n, color, size) => {
    const arr = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return { arr, geo, mat, n, vel: new Float32Array(n) };
  };
  const embers = makeParticles(700, 0xff7a2a, 0.09);
  for (let i = 0; i < embers.n; i++) {
    embers.arr.set([rand(-30, -1.6), rand(-20, 18), rand(-45, 4)], i * 3);
    embers.vel[i] = rand(0.6, 2);
  }
  const snow = makeParticles(900, 0xe8f6ff, 0.07);
  for (let i = 0; i < snow.n; i++) {
    snow.arr.set([rand(1.6, 30), rand(-15, 18), rand(-45, 4)], i * 3);
    snow.vel[i] = rand(0.4, 1.1);
  }

  let flashV = 0, pulse = 0, t = 0;
  const skyBase = new THREE.Color(1, 1, 1);
  const abyssBase = new THREE.Color(1, 1, 1);
  return {
    scene,
    flash(v = 1) { flashV = Math.max(flashV, v); },
    beat(v = 1) { pulse = Math.max(pulse, v); },
    update(dt, info = {}) {
      t += dt;
      const en = info.energy || 0;
      const ea = embers.arr, sa = snow.arr;
      for (let i = 0; i < embers.n; i++) {
        ea[i * 3 + 1] += embers.vel[i] * (1 + en * 1.5) * dt;
        ea[i * 3] += Math.sin(t * 1.3 + i) * 0.3 * dt;
        if (ea[i * 3 + 1] > 18) ea[i * 3 + 1] = -20;
      }
      for (let i = 0; i < snow.n; i++) {
        sa[i * 3 + 1] -= snow.vel[i] * dt;
        sa[i * 3] += Math.sin(t * 0.7 + i * 1.7) * 0.25 * dt;
        if (sa[i * 3 + 1] < -15) sa[i * 3 + 1] = 18;
      }
      embers.geo.attributes.position.needsUpdate = true;
      snow.geo.attributes.position.needsUpdate = true;
      pulse = Math.max(0, pulse - dt * 4);
      flashV = Math.max(0, flashV - dt * 2.5);
      // Na batida: a lava brilha mais e "sobe", os cristais piscam.
      const glow = 0.85 + en * 0.25 + pulse * 0.45;
      abyssMat.color.copy(abyssBase).multiplyScalar(glow);
      abyss.position.y = -22 + pulse * 0.8 + en * 1.5;
      craterMat.color.setRGB(1, 0.42 + pulse * 0.3, 0.1 + pulse * 0.15);
      lavaMat.color.setRGB(1, 0.3 + pulse * 0.25, 0.04);
      lavaLight.intensity = 22 + pulse * 30 + Math.sin(t * 7) * 3;
      crystalMat.emissiveIntensity = 0.35 + pulse * 1.1;
      iceCapMat.emissiveIntensity = 0.4 + pulse * 1.0;
      iceLight.intensity = 14 + pulse * 18;
      emberCapMat.color.setRGB(1, 0.35 + pulse * 0.4 + Math.sin(t * 9) * 0.05, 0.1);
      embers.mat.size = 0.08 + pulse * 0.06;
      snow.mat.size = 0.06 + pulse * 0.04;
      skyMat.color.copy(skyBase).multiplyScalar(1 + flashV * 1.8);
    },
  };
}

// ---------- Esferas (notas) ----------
// Fogo: bola de lava facetada com labaredas. Gelo: cristal facetado com pontas.
// Vapor: uma de cada, grudadas, com um anel de vapor girando. Seta branca na frente, ou um
// anel pequeno quando qualquer sentido vale.
const R = 0.16;
const fireGeo = new THREE.IcosahedronGeometry(R, 1);
const iceGeo = new THREE.IcosahedronGeometry(R * 1.05, 0);
const flameGeo = new THREE.ConeGeometry(0.06, 0.22, 6);
flameGeo.translate(0, 0.11, 0);
const spikeGeo = new THREE.OctahedronGeometry(0.06, 0);
const haloGeo = new THREE.CircleGeometry(0.28, 24);
const chevShape = new THREE.Shape();
chevShape.moveTo(-0.1, -0.02); chevShape.lineTo(0, 0.07); chevShape.lineTo(0.1, -0.02);
chevShape.lineTo(0.1, -0.06); chevShape.lineTo(0, 0.03); chevShape.lineTo(-0.1, -0.06); chevShape.closePath();
const chevGeo = new THREE.ShapeGeometry(chevShape);
const dotGeo = new THREE.RingGeometry(0.035, 0.055, 20);
const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: true });
const fireMat = new THREE.MeshStandardMaterial({ color: 0xff5a10, emissive: 0xff3000, emissiveIntensity: 0.9, roughness: 0.6, flatShading: true });
const crustMat = new THREE.MeshStandardMaterial({ color: 0x2a0d06, roughness: 1, flatShading: true });
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
const iceMat = new THREE.MeshStandardMaterial({ color: 0xc8f4ff, emissive: 0x2a90ff, emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.92, flatShading: true });
const haloMats = [COLORS.fire, COLORS.ice, COLORS.vapor].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
const steamGeo = new THREE.TorusGeometry(0.27, 0.035, 8, 32);

function fireBall() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(fireGeo, fireMat);
  // Placas de crosta escura por cima da lava.
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), crustMat);
    const a = i * 1.26, b = (i % 2 ? 0.5 : -0.4);
    c.position.set(Math.cos(a) * R * 0.85, b * R, Math.sin(a) * R * 0.85);
    c.scale.set(1, 0.5, 1);
    g.add(c);
  }
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(flameGeo, flameMat);
    const a = i / 5 * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.08, 0.06, Math.sin(a) * 0.08);
    f.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(f);
    flames.push(f);
  }
  g.add(core);
  g.userData.flames = flames;
  return g;
}
function iceBall() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(iceGeo, iceMat));
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0.6, 0.6, -0.5], [-0.6, -0.6, -0.5]];
  for (const d of dirs) {
    const s = new THREE.Mesh(spikeGeo, iceMat);
    const v = new THREE.Vector3(...d).normalize();
    s.position.copy(v).multiplyScalar(R * 1.05);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    s.scale.set(0.7, 1.8, 0.7);
    g.add(s);
  }
  return g;
}

export function makeNoteMesh() {
  const g = new THREE.Group();
  const fire = fireBall(), ice = iceBall();
  const halo = new THREE.Mesh(haloGeo, haloMats[0]); halo.position.z = -0.05;
  const steam = new THREE.Mesh(steamGeo, steamMat);
  const chev = new THREE.Mesh(chevGeo, markMat); chev.position.z = R + 0.03;
  const dot = new THREE.Mesh(dotGeo, markMat); dot.position.z = R + 0.03;
  g.add(fire, ice, halo, steam, chev, dot);
  g.userData = { fire, ice, halo, steam, chev, dot, seed: Math.random() * 10 };
  return g;
}

export function styleNote(mesh, note, dirVec) {
  const u = mesh.userData;
  const vapor = note.elem === 2;
  u.fire.visible = note.elem === 0 || vapor;
  u.ice.visible = note.elem === 1 || vapor;
  u.fire.position.set(vapor ? -0.13 : 0, 0, 0);
  u.ice.position.set(vapor ? 0.13 : 0, 0, 0);
  u.steam.visible = vapor;
  u.halo.material = haloMats[note.elem];
  u.halo.scale.setScalar(vapor ? 1.35 : 1);
  u.chev.visible = note.dir >= 0;
  u.dot.visible = note.dir < 0 && !vapor;
  if (note.dir >= 0) {
    const [dx, dy] = dirVec[note.dir];
    u.chev.rotation.z = Math.atan2(-dx, dy);
  }
}

// Animação da esfera enquanto voa (labaredas tremendo, cristal girando, vapor rodando).
export function animateNote(mesh, t) {
  const u = mesh.userData;
  const s = t * 14 + u.seed;
  u.fire.userData.flames.forEach((f, i) => { f.scale.set(1, 0.7 + 0.45 * Math.abs(Math.sin(s + i * 1.7)), 1); });
  u.fire.rotation.y = t * 1.5 + u.seed;
  u.ice.rotation.y = -t * 0.8 + u.seed;
  u.steam.rotation.z = t * 3;
  u.steam.scale.setScalar(1 + 0.08 * Math.sin(t * 9));
}

// Pedaço de esfera quebrada (voa e some).
const halfGeo = new THREE.SphereGeometry(R, 10, 6, 0, Math.PI);
export function makeHalf() {
  const m = new THREE.Mesh(halfGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, flatShading: true, transparent: true }));
  return m;
}

// ---------- Lâmina ----------
// Cabo na mão (origem), lâmina de 1 m para -Z. A cor e o enfeite mudam com o elemento.
export const BLADE = { base: -0.1, tip: -1.08 };
export function makeSaber(elem = 0) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x2c2420, metalness: 0.7, roughness: 0.4 }));
  handle.rotation.x = Math.PI / 2;
  const guardMat = new THREE.MeshBasicMaterial({ color: elemColor(elem) });
  const guard = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), guardMat);
  guard.scale.set(1.6, 0.6, 0.6);
  guard.position.z = -0.1;
  const len = BLADE.base - BLADE.tip;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, len, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  core.rotation.x = Math.PI / 2; core.position.z = (BLADE.base + BLADE.tip) / 2;
  const glowMat = new THREE.MeshBasicMaterial({ color: elemColor(elem), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, len, 10), glowMat);
  glow.rotation.x = Math.PI / 2; glow.position.z = core.position.z;
  // Enfeites: pontas de cristal (gelo) ou labaredas (fogo) ao longo da lâmina.
  const deco = new THREE.Group();
  const iceDecoMat = new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.85 });
  const fireDecoMat = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const iceDeco = [], fireDeco = [];
  for (let i = 0; i < 6; i++) {
    const z = BLADE.base - 0.12 - i * 0.15;
    const c = new THREE.Mesh(spikeGeo, iceDecoMat);
    c.position.set(i % 2 ? 0.025 : -0.025, 0, z); c.scale.set(0.35, 0.9, 0.35); c.rotation.z = i % 2 ? -0.9 : 0.9;
    const f = new THREE.Mesh(flameGeo, fireDecoMat);
    f.position.set(0, 0.015, z); f.scale.set(0.35, 0.45, 0.35);
    deco.add(c, f);
    iceDeco.push(c); fireDeco.push(f);
  }
  g.add(handle, guard, core, glow, deco);
  g.userData = { guardMat, glowMat, glow, iceDeco, fireDeco, elem, flashT: 0 };
  setSaberElem(g, elem, false);
  return g;
}

export function setSaberElem(model, elem, flash = true) {
  const u = model.userData;
  u.elem = elem;
  u.guardMat.color.setHex(elemColor(elem));
  u.glowMat.color.setHex(elemColor(elem));
  u.iceDeco.forEach(m => { m.visible = elem === 1; });
  u.fireDeco.forEach(m => { m.visible = elem === 0; });
  if (flash) u.flashT = 0.25;
}

// Brilho da lâmina (pisca ao trocar de elemento, labareda treme).
export function animateSaber(model, dt, t) {
  const u = model.userData;
  u.flashT = Math.max(0, u.flashT - dt);
  const f = u.flashT / 0.25;
  u.glow.scale.set(1 + f * 2.2, 1, 1 + f * 2.2);
  u.glowMat.opacity = 0.6 + f * 0.4;
  if (u.elem === 0) u.fireDeco.forEach((m, i) => { m.scale.y = 0.35 + 0.25 * Math.abs(Math.sin(t * 13 + i * 2.1)); });
}

// Rastro da lâmina: fita entre as últimas posições do meio e da ponta.
export class Trail {
  constructor(color, n = 14) {
    this.n = n;
    this.pts = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.alpha = new Float32Array(n * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.alpha, 3));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.color = new THREE.Color(color);
  }
  setColor(c) { this.color.setHex(c); }
  push(mid, tip) {
    this.pts.unshift([mid.x, mid.y, mid.z, tip.x, tip.y, tip.z]);
    if (this.pts.length > this.n) this.pts.pop();
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[Math.min(i, this.pts.length - 1)];
      this.pos.set(p, i * 6);
      const k = (1 - i / (this.n - 1)) * 0.8;
      this.alpha.set([this.color.r * k * 0.3, this.color.g * k * 0.3, this.color.b * k * 0.3, this.color.r * k, this.color.g * k, this.color.b * k], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
  clear() { this.pts = []; }
}

// Partículas (um único Points reaproveitado): faíscas dos cortes, chamas e cristais do rastro.
// Cada partícula tem a própria gravidade (chama sobe, cristal cai devagar, faísca cai).
export class Sparks {
  constructor(max = 400, size = 0.04) {
    this.max = max;
    this.p = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.g = new Float32Array(max);
    this.life = new Float32Array(max);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.points.frustumCulled = false;
    for (let i = 0; i < max; i++) this.p[i * 3 + 1] = -100;
    this._c = new THREE.Color();
  }
  emit(at, color, vx, vy, vz, gravity = -6, life = 0.6) {
    const c = this._c.set(color);
    const i = this.next; this.next = (this.next + 1) % this.max;
    this.p.set([at.x, at.y, at.z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    this.c.set([c.r, c.g, c.b], i * 3);
    this.g[i] = gravity;
    this.life[i] = life;
  }
  burst(at, color, n = 24, speed = 2.5, gravity = -6) {
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      const r = Math.sqrt(1 - u * u);
      this.emit(at, color, Math.cos(a) * r * s, u * s + 1, Math.sin(a) * r * s, gravity, 0.5 + Math.random() * 0.3);
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.p[i * 3 + 1] = -100; continue; }
      this.v[i * 3 + 1] += this.g[i] * dt;
      for (let k = 0; k < 3; k++) this.p[i * 3 + k] += this.v[i * 3 + k] * dt;
      const f = Math.min(1, this.life[i] * 2);
      for (let k = 0; k < 3; k++) this.c[i * 3 + k] *= 0.97 + 0.03 * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
