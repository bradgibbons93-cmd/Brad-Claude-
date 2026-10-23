/* Games. The KATSEYE word search to start: the printable sheet letter for letter, plus a fresh
   shuffle of the same words whenever she wants another go. Progress lives at play/<person>/<game>,
   so it follows her to any phone and the crew can see how far everyone got. */
import { esc, Store, nowIso, Snd, Confetti, toast, write } from './core.js';
import { S, people, avatar, short, isParent } from './model.js';
import { N, KATSEYE_SHEET, KATSEYE_WORDS, makeGrid, locate, lineCells, snap } from './wordsearch.js';

export const GAMES = [
  { id: 'katseye', e: '💜', t: 'KATSEYE Word Search', d: 'Find the 12 hidden words', words: KATSEYE_WORDS, sheet: KATSEYE_SHEET },
];
const COLORS = ['#FF5FA2', '#A35BFF', '#3FA9F5', '#22C08A', '#FFB020', '#FF7A45', '#E040FB', '#00B8D4', '#7C4DFF', '#F06292', '#26A69A', '#FFCA28'];
const gameById = id => GAMES.find(g => g.id === id) || GAMES[0];
const progPath = (id, who = S.me.id) => `play/${who}/${id}`;
export const progOf = (id, who = S.me.id) => Store.get(progPath(id, who)) || {};
const foundOf = p => (p.found && typeof p.found === 'object' ? p.found : {});
const grids = new Map();
export function gridOf(game, seed) {
  if (!seed) return game.sheet;
  const k = game.id + ':' + seed;
  if (!grids.has(k)) grids.set(k, makeGrid(game.words, seed) || game.sheet);
  return grids.get(k);
}

/* ---------- screens ---------- */
const fmtMs = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const cx = i => (i % N) + 0.5, cy = i => Math.floor(i / N) + 0.5;
const seg = (a, b, color, cls = '') => `<line class="${cls}" x1="${cx(a)}" y1="${cy(a)}" x2="${cx(b)}" y2="${cy(b)}" stroke="${color}"/>`;

/* The small card on Home: how far you are, and one tap to play. */
export function gamesTeaser() {
  const g = GAMES[0], n = Object.keys(foundOf(progOf(g.id))).length, all = g.words.length;
  return `<button class="card gamecard" data-act="goGames" style="text-align:left"><div class="ch"><span class="badge b-lilac">🎮</span><h3>Games</h3><em>${n === all ? 'All found! ✓' : n ? `${n}/${all} found` : 'New'}</em></div>
    <span class="gc-row"><span class="gc-ic">${g.e}</span><span class="grow"><b>${esc(g.t)}</b><small>${n && n < all ? 'Keep going, you got this!' : esc(g.d)}</small></span><span class="gc-go">Play ›</span></span></button>`;
}

export function gamesPage() {
  const g = gameById(S.ui.game), p = progOf(g.id), found = foundOf(p), grid = gridOf(g, p.seed || 0);
  const nFound = g.words.filter(w => found[w]).length, done = nFound === g.words.length;
  const lines = g.words.map((w, i) => found[w] && Array.isArray(found[w]) ? seg(found[w][0], found[w][1], COLORS[i % COLORS.length]) : '').join('');
  const tap = S.ui.wsTap;
  const cells = [...grid].map((ch, i) => ch === '*'
    ? `<span class="wc star" aria-hidden="true">★</span>`
    : `<button class="wc ${tap === i ? 'tap' : ''} ${S.ui.wsHint === i ? 'hint' : ''}" data-i="${i}" aria-label="${ch}, row ${Math.floor(i / N) + 1}, column ${i % N + 1}">${ch}</button>`).join('');
  const crew = people().map(x => ({ x, pr: progOf(g.id, x.id) })).filter(({ pr }) => Object.keys(foundOf(pr)).length || pr.best);
  return `<div class="backrow"><button class="btn small" data-act="sub" data-sub="">‹ Back</button></div>
    <h1 class="page-title" style="padding-top:0"><span>🎮</span>Games</h1>
    <div class="chips">${GAMES.map(x => `<button class="${x.id === g.id ? 'on' : ''}" data-act="gamePick" data-g="${x.id}">${x.e} ${esc(x.t)}</button>`).join('')}<button disabled style="opacity:.55">✨ More soon</button></div>
    <section class="ws-card">
      <div class="ws-head"><span class="ws-star" aria-hidden="true">★</span><div><h2>KATSEYE</h2><p>Word search</p></div><span class="ws-star r" aria-hidden="true">★</span></div>
      <div class="ws-meta"><span><b>${nFound}</b> of ${g.words.length} found</span><span>${p.seed ? '🔀 Shuffled puzzle' : '🖨️ The printable'}</span>${p.started && !done ? `<span>⏱️ <b id="wsClock" data-from="${esc(p.started)}">${fmtMs(Date.now() - new Date(p.started))}</b></span>` : ''}</div>
      ${done ? `<div class="ws-done"><span>🎉</span><b>All ${g.words.length} found${p.ms ? ` in ${fmtMs(p.ms)}` : ''}!</b>${p.best ? `<small>Your best: ${fmtMs(p.best)}</small>` : ''}<button class="btn solid" data-act="wsNew" data-sure="1">Play a new puzzle</button></div>` : ''}
      <div class="ws" id="ws" data-g="${g.id}" role="group" aria-label="Word search. Drag across a word, or tap its first and last letter.">
        <svg class="ws-lines" viewBox="0 0 ${N} ${N}" preserveAspectRatio="none" aria-hidden="true">${lines}<line id="wsSel" x1="0" y1="0" x2="0" y2="0" stroke="#7B2FD0" visibility="hidden"/></svg>${cells}</div>
      <p class="ws-help">${tap != null ? 'Now tap the last letter ✨' : 'Drag across a word, or tap its first and last letter'}</p>
      <ol class="ws-words">${g.words.map((w, i) => `<li class="${found[w] ? 'got' : ''}" style="--wc:${COLORS[i % COLORS.length]}"><span class="n">${i + 1}.</span><span class="w">${w}</span>${found[w] ? '<span class="ok">✓</span>' : ''}</li>`).join('')}</ol>
      <div class="ws-acts"><button class="btn" data-act="wsHint" ${done ? 'disabled' : ''}>💡 Hint</button><button class="btn" data-act="wsNew">🔀 New puzzle</button>${p.seed ? '<button class="btn" data-act="wsSheet">🖨️ The printable</button>' : ''}<button class="btn" data-act="wsReset" ${nFound ? '' : 'disabled'}>↺ Start again</button></div>
    </section>
    ${crew.length ? `<section class="card"><div class="ch"><span class="badge b-gold">🏆</span><h3>The crew</h3></div>${crew.map(({ x, pr }) => { const n = g.words.filter(w => foundOf(pr)[w]).length;
      const r = Number(pr.rounds) || 0;
      return `<div class="devrow">${avatar(x.id)}<span class="tt"><b>${esc(short(x.id))}${x.id === S.me.id ? ' (you)' : ''}</b><small>${n === g.words.length ? `All ${n} found ✓` : `${n} of ${g.words.length} found`}${r ? ` · finished ${r === 1 ? 'once' : r + ' times'}` : ''}${pr.best ? ` · best ${fmtMs(pr.best)}` : ''}</small></span>${r ? '<span class="st" style="font-size:22px">🏆</span>' : ''}</div>`; }).join('')}</section>` : ''}
    ${isParent() ? '' : '<p class="note" style="text-align:center">Just for fun. Stars still come from your routine and jobs ⭐</p>'}`;
}

/* ---------- playing ---------- */
const cur = () => { const g = gameById(document.getElementById('ws')?.dataset.g || S.ui.game), p = progOf(g.id); return { g, p, grid: gridOf(g, p.seed || 0) }; };
function showSel(a, b) {
  const l = document.getElementById('wsSel'); if (!l) return;
  if (a == null) { l.setAttribute('visibility', 'hidden'); return; }
  l.setAttribute('x1', cx(a)); l.setAttribute('y1', cy(a)); l.setAttribute('x2', cx(b)); l.setAttribute('y2', cy(b)); l.setAttribute('visibility', 'visible');
}
async function save(g, doc) { await write([{ path: progPath(g.id), set: { ...doc, at: doc.at || nowIso(), updatedAt: nowIso() } }]); }

/* The letters from a to b: a new word, one already found, or nothing. */
async function check(a, b) {
  const cells = lineCells(a, b);
  if (!cells || cells.length < 2) return false;
  const { g, p, grid } = cur(), found = { ...foundOf(p) };
  const letters = cells.map(i => grid[i]).join(''), back = [...letters].reverse().join('');
  const w = g.words.find(x => x === letters || x === back);
  if (!w) { Snd.uncheck(); return false; }
  if (found[w]) { Snd.tap(); toast(`Already found ${w} 💜`); return true; }
  found[w] = [a, b];
  const started = p.started || S.ui.wsFirst || nowIso(), all = g.words.every(x => found[x]);
  const doc = { ...p, found, started };
  if (all) { const ms = Date.now() - new Date(started); doc.done = nowIso(); doc.ms = ms; doc.best = p.best ? Math.min(p.best, ms) : ms; doc.rounds = (Number(p.rounds) || 0) + 1; }
  S.ui.wsTap = null; S.ui.wsHint = null;
  const el = document.querySelector(`#ws .wc[data-i="${b}"]`);
  if (all) { Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 180); toast(`You found all ${g.words.length}! 💜✨`); }
  else { Snd.check(); Confetti.from(el, 26); toast(`Found ${w}! ${g.words.length - Object.keys(found).length} to go`); }
  await save(g, doc);
  return true;
}

let drag = null;
function tapCell(i) {
  const a = S.ui.wsTap;
  if (a == null || a === i) { S.ui.wsTap = a === i ? null : i; Snd.tick(); S.render(); return; }
  if (!lineCells(a, i)) { S.ui.wsTap = i; Snd.tick(); toast('Pick letters in a straight line'); S.render(); return; }
  check(a, i).then(hit => { if (!hit) { S.ui.wsTap = null; S.render(); } });
}
document.addEventListener('pointerdown', e => {
  const c = e.target.closest?.('#ws button.wc');
  if (!c || e.button > 0) return;
  e.preventDefault();
  const i = Number(c.dataset.i);
  drag = { start: i, end: i, moved: false };
  S.ui.wsDragging = true;
  if (!S.ui.wsFirst && !progOf(cur().g.id).started) S.ui.wsFirst = nowIso();
  try { document.getElementById('ws').setPointerCapture(e.pointerId); } catch (err) {}
  showSel(i, i);
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const c = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#ws .wc');
  if (!c || c.dataset.i == null) return;
  const end = snap(drag.start, Number(c.dataset.i));
  if (end === drag.end) return;
  drag.end = end; drag.moved = true; showSel(drag.start, end); Snd.tick();
});
function finish(cancel) {
  if (!drag) return;
  const d = drag; drag = null; S.ui.wsDragging = false;
  if (cancel) { showSel(null); S.render(); return; }
  if (!d.moved || d.end === d.start) { showSel(null); tapCell(d.start); return; }
  S.ui.wsTap = null;
  check(d.start, d.end).then(() => { showSel(null); S.render(); });
}
document.addEventListener('pointerup', () => finish(false));
document.addEventListener('pointercancel', () => finish(true));
/* A keyboard press on a letter works like a tap. */
document.addEventListener('click', e => { const c = e.target.closest?.('#ws button.wc'); if (c && e.detail === 0) tapCell(Number(c.dataset.i)); });
setInterval(() => { const el = document.getElementById('wsClock'); if (el) el.textContent = fmtMs(Date.now() - new Date(el.dataset.from)); }, 1000);

export const GAME_ACTIONS = {
  goGames() { S.tab = 'me'; S.sub = 'games'; Snd.pop(); window.scrollTo({ top: 0 }); S.render(true); },
  gamePick(el) { S.ui.game = el.dataset.g; S.ui.wsTap = null; Snd.tap(); S.render(); },
  wsHint() {
    const { g, p, grid } = cur(), left = g.words.filter(w => !foundOf(p)[w]);
    if (!left.length) return;
    const w = left[Math.floor(Math.random() * left.length)], at = locate(grid, w);
    if (!at) return;
    S.ui.wsHint = at[0]; Snd.magic(); toast(`${w} starts at the sparkly letter ✨`); S.render();
    setTimeout(() => { if (S.ui.wsHint === at[0]) { S.ui.wsHint = null; S.render(); } }, 3500);
  },
  async wsNew(el) {
    const { g, p } = cur(), n = Object.keys(foundOf(p)).length;
    if (n && !p.done && !el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'Sure? Tap again'; setTimeout(() => { if (el.isConnected) { delete el.dataset.sure; el.textContent = '🔀 New puzzle'; } }, 4000); return; }
    S.ui.wsTap = null; S.ui.wsHint = null; S.ui.wsFirst = null; Snd.magic();
    await save(g, { seed: 1 + Math.floor(Math.random() * 2 ** 30), found: {}, best: p.best || null, rounds: p.rounds || 0, at: nowIso() });
    toast('New puzzle! Same 12 words, new spots 🔀');
  },
  async wsSheet() {
    const { g, p } = cur(); S.ui.wsTap = null; S.ui.wsFirst = null; Snd.tap();
    await save(g, { seed: 0, found: {}, best: p.best || null, rounds: p.rounds || 0, at: nowIso() });
  },
  async wsReset(el) {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'Sure? Tap again'; setTimeout(() => { if (el.isConnected) { delete el.dataset.sure; el.textContent = '↺ Start again'; } }, 4000); return; }
    const { g, p } = cur(); S.ui.wsTap = null; S.ui.wsFirst = null; Snd.uncheck();
    await save(g, { seed: p.seed || 0, found: {}, best: p.best || null, rounds: p.rounds || 0, at: nowIso() });
  },
};
