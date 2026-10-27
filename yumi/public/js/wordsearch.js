/* The word search itself, with nothing about screens: the printable KATSEYE sheet, fresh shuffles
   of its words, and finding a word or a straight line in a grid. Kept apart so the tests can run it. */
export const N = 10;
/* The printable, row by row. The * square is the star in the picture, not a letter. */
export const KATSEYE_SHEET = [
  'GABRIELLAK',
  'IMEGANPATO',
  'DSYMANONHG',
  'AOOLPXRGNA',
  'NPOAMIANGM',
  'IHNRDPCATE',
  'EICAEOEROB',
  'LAHJBJWLUO',
  'A*ANUUVYCY',
  'OBEETCCCHZ',
].join('');
export const KATSEYE_WORDS = ['GAMEBOY', 'GABRIELLA', 'YOONCHAE', 'SOPHIA', 'DANIELA', 'GNARLY', 'MEGAN', 'TOUCH', 'DEBUT', 'MANON', 'LARA', 'MIA'];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* Across, down and diagonal, like the printable. Kids read forwards, so no backwards words. */
const PLACE_DIRS = [[0, 1], [1, 0], [1, 1]];
export function makeGrid(words, seed) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng(seed + attempt * 7919), g = Array(N * N).fill('');
    const ok = [...words].sort((a, b) => b.length - a.length).every(w => {
      for (let tries = 0; tries < 300; tries++) {
        const [dr, dc] = PLACE_DIRS[Math.floor(r() * PLACE_DIRS.length)];
        const r0 = Math.floor(r() * N), c0 = Math.floor(r() * N);
        if (r0 + dr * (w.length - 1) >= N || c0 + dc * (w.length - 1) >= N) continue;
        let fits = true;
        for (let k = 0; k < w.length && fits; k++) { const ch = g[(r0 + dr * k) * N + c0 + dc * k]; fits = !ch || ch === w[k]; }
        if (!fits) continue;
        for (let k = 0; k < w.length; k++) g[(r0 + dr * k) * N + c0 + dc * k] = w[k];
        return true;
      }
      return false;
    });
    if (ok) return g.map(ch => ch || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(r() * 26)]).join('');
  }
  return null;
}
const ALL_DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
/* Where a word sits in a grid: [first cell, last cell], or null. */
export function locate(grid, w) {
  for (let i = 0; i < N * N; i++) for (const [dr, dc] of ALL_DIRS) {
    const r0 = Math.floor(i / N), c0 = i % N, r1 = r0 + dr * (w.length - 1), c1 = c0 + dc * (w.length - 1);
    if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
    let ok = true;
    for (let k = 0; k < w.length && ok; k++) ok = grid[(r0 + dr * k) * N + c0 + dc * k] === w[k];
    if (ok) return [i, r1 * N + c1];
  }
  return null;
}
/* The cells from a to b, if they're in a straight line (across, down or diagonal). */
export function lineCells(a, b) {
  const r0 = Math.floor(a / N), c0 = a % N, r1 = Math.floor(b / N), c1 = b % N;
  if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return null;
  const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0), n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
  return Array.from({ length: n + 1 }, (_, k) => (r0 + dr * k) * N + c0 + dc * k);
}
/* A wobbly finger still draws a straight line: snap to the nearest of the eight directions. */
export function snap(a, b) {
  const r0 = Math.floor(a / N), c0 = a % N, dy = Math.floor(b / N) - r0, dx = b % N - c0;
  if (!dx && !dy) return a;
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const dr = Math.round(Math.sin(ang)), dc = Math.round(Math.cos(ang));
  let n = Math.max(Math.abs(dx), Math.abs(dy));
  while (n > 0 && !(r0 + dr * n >= 0 && r0 + dr * n < N && c0 + dc * n >= 0 && c0 + dc * n < N)) n--;
  return (r0 + dr * n) * N + c0 + dc * n;
}
