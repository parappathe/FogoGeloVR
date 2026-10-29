// Regra própria do Fogo e Gelo: as esferas vêm de frente, pelo corredor da ponte. As de fogo
// saem do lado do vulcão (esquerda) e as de gelo do lado da geleira (direita), fazendo uma
// curva até a faixa delas; o vapor vem de cima, pelo meio. Puro (sem navegador).

export const HIT_DIST = 0.9;     // distância à frente do jogador onde a nota chega no tempo certo
export const SPAWN_DIST = 22;    // distância de onde ela aparece (fundo da ponte)
const SIDE = 2.6;                // quanto a esfera começa deslocada para o lado do elemento dela
const RISE = 1.6;                // de que altura ela desce

// Compatibilidade com o núcleo: aqui não há giro, todas vêm de frente (az = 0).
export function decorate(chart) {
  for (const n of chart.notes) n.az = 0;
  return chart;
}

// Plano do corte: right/up = plano de frente para o jogador, back = da nota para o jogador.
export function noteFrame(note, out = {}) {
  out.right = { x: 1, y: 0, z: 0 };
  out.up = { x: 0, y: 1, z: 0 };
  out.back = { x: 0, y: 0, z: 1 };
  return out;
}

// Posição da nota no tempo da música (s).
export function notePos(note, songTime, speed, out = {}) {
  const ahead = (note.t - songTime) * speed;            // metros que ainda faltam
  const far = Math.min(1, Math.max(0, ahead) / SPAWN_DIST); // 1 no começo, 0 no corte
  const k = far * far;
  const side = note.elem === 0 ? -SIDE : note.elem === 1 ? SIDE : 0;
  out.x = note.x + side * k;
  out.y = note.y + (note.elem === 2 ? RISE * 1.6 : RISE) * k;
  out.z = -(HIT_DIST + ahead);
  out.a = 0;
  return out;
}
