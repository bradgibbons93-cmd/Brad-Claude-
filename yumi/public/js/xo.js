/* Noughts & crosses, the rules and Yumi's moves, with nothing else in here so the tests can load it.
   rnd can be swapped by a test to make Yumi's choices predictable. */
let rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
export const setRandom = f => { rnd = f; };
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function winner(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line: [a, c, d] };
  return b.every(Boolean) ? { who: 'draw', line: [] } : null;
}
export function minimax(b, me, turn) {
  const w = winner(b);
  if (w) return { score: w.who === 'draw' ? 0 : w.who === me ? 10 : -10 };
  let best = null;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn; const r = minimax(b, me, turn === 'X' ? 'O' : 'X'); b[i] = '';
    const s = r.score * 0.9;
    if (!best || (turn === me ? s > best.score : s < best.score)) best = { score: s, i };
  }
  return best;
}
/* Yumi's move. Easy wins when it can and blocks about half the time; Tricky plays properly, with the odd slip. */
export function yumiMove(b, level = 'easy') {
  const free = b.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  if (!free.length) return -1;
  const finds = who => free.find(i => { const t = b.slice(); t[i] = who; return winner(t)?.who === who; });
  const win = finds('O'); if (win !== undefined) return win;
  if (level === 'tricky' && rnd(100) >= 12) return minimax(b.slice(), 'O', 'O').i;
  const block = finds('X'); if (block !== undefined && rnd(100) < (level === 'tricky' ? 100 : 50)) return block;
  if (!b[4] && rnd(100) < 40) return 4;
  return free[rnd(free.length)];
}
