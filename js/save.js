// Recordes e opções, salvos no navegador (cada navegador tem os seus).
const KEY = 'fogogelovr.v1';
const DEFAULTS = {
  best: {},          // 'musica:dificuldade' -> { score, rank, acc, combo }
  noFail: false,     // modo sem derrota
  fps: false,
  angle: 0,          // ângulo da lâmina na mão (graus)
  height: 0,         // ajuste de altura das notas (m)
  musicVol: 0.8,
  lastSong: 0,
  lastDiff: 0,
};

export function loadState() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

export function saveState(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* navegador sem armazenamento */ }
}

// Guarda o resultado; retorna true se for recorde.
export function record(s, songId, diffId, res) {
  const k = `${songId}:${diffId}`;
  const old = s.best[k];
  if (old && old.score >= res.score) return false;
  s.best[k] = res;
  saveState(s);
  return true;
}

export const bestOf = (s, songId, diffId) => s.best[`${songId}:${diffId}`] || null;
