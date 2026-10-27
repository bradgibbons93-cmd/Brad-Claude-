/* Two more games beside the word search: Memory match (flip two, find the pairs) and Noughts &
   crosses (against Yumi, or two players on one phone). Scores live at play/<person>/<game>, the same
   as the word search, so they follow her to any phone and the crew card shows how everyone's going. */
import { esc, nowIso, Snd, Confetti, toast, write, Store } from './core.js';
import { S, people, avatar, short } from './model.js';
import { winner, yumiMove } from './xo.js';

const progPath = (id, who = S.me.id) => `play/${who}/${id}`;
const progOf = (id, who = S.me.id) => Store.get(progPath(id, who)) || {};
const save = (id, doc) => write([{ path: progPath(id), set: { ...doc, at: doc.at || nowIso(), updatedAt: nowIso() } }]);
const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const shuffle = list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmtMs = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ---------- Memory match ---------- */
/* KATSEYE photos from the user-supplied quiz reference are cropped into local card assets. */
const PHOTO_IDS = ['member1', 'member2', 'member3', 'member4', 'member5', 'member6', 'group1', 'group2'];
const PHOTO_LABELS = ['KATSEYE photo 1', 'KATSEYE photo 2', 'KATSEYE photo 3', 'KATSEYE photo 4', 'KATSEYE photo 5', 'KATSEYE photo 6', 'KATSEYE group photo 1', 'KATSEYE group photo 2'];
const PHOTO_COLORS = ['#FF5FA2', '#A35BFF', '#3FA9F5', '#22C08A', '#FFB020', '#FF7A45', '#E040FB', '#00B8D4'];
export const MEMBERS = Object.fromEntries(PHOTO_IDS.map((id, i) => [id, [PHOTO_LABELS[i], PHOTO_COLORS[i]]]));
const face = v => MEMBERS[v] ? `<span class="mp" style="--c:${MEMBERS[v][1]}"><b>${PHOTO_IDS.indexOf(v) + 1}</b><img src="/img/katseye/${v}.webp" alt="" loading="lazy"><small>KATSEYE</small></span>` : esc(v);
const label = v => MEMBERS[v]?.[0] || v;
document.addEventListener('error', e => { if (e.target?.matches?.('.mp img')) e.target.remove(); }, true);
const SETS = { members: { t: 'KATSEYE photos', e: PHOTO_IDS }, katseye: { t: 'KATSEYE', e: ['💜', '⭐', '🎤', '🎧', '💃', '🦋', '💿', '🌈'] }, animals: { t: 'Animals', e: ['🐶', '🐱', '🐰', '🦊', '🐼', '🐨', '🦄', '🐸'] } };
function newMemory(size = 12, set = 'members') {
  const n = size / 2;
  const pick = set === 'members' ? shuffle(PHOTO_IDS).slice(0, n) : shuffle(SETS[set].e).slice(0, n);
  return { deck: shuffle([...pick, ...pick]), open: [], matched: [], moves: 0, started: null, size, set, lock: false };
}
const mem = () => (S.ui.mem ||= newMemory());

export function memoryPage() {
  const m = mem(), p = progOf('memory'), best = p['best' + m.size], done = m.matched.length === m.deck.length;
  return `<section class="card mg"><div class="ch"><span class="badge b-lilac">🃏</span><h3>Memory match</h3><em>${m.moves} moves</em></div>
    <div class="chips sm">${[[12, 'Easy · 12'], [16, 'Hard · 16']].map(([n, t]) => `<button class="${m.size === n ? 'on' : ''}" data-act="memSize" data-n="${n}">${t}</button>`).join('')}${Object.entries(SETS).map(([k, x]) => `<button class="${m.set === k ? 'on' : ''}" data-act="memSet" data-s="${k}">${k === 'members' ? '📸' : x.e[0]} ${x.t}</button>`).join('')}</div>
    ${done ? `<div class="ws-done"><span>🎉</span><b>All pairs in ${m.moves} moves${m.ms ? ` · ${fmtMs(m.ms)}` : ''}!</b>${best ? `<small>Your best: ${best} moves</small>` : ''}<button class="btn solid" data-act="memNew">Play again</button></div>` : ''}
    <div class="mem n${m.size}" role="group" aria-label="Memory cards. Tap two to find a pair.">${m.deck.map((e, i) => { const up = m.open.includes(i) || m.matched.includes(i);
      return `<button class="mc ${up ? 'up' : ''} ${m.matched.includes(i) ? 'got' : ''}" data-act="memFlip" data-i="${i}" aria-label="${up ? label(e) : 'Card ' + (i + 1)}" ${m.matched.includes(i) ? 'disabled' : ''}><span class="back">★</span><span class="face">${face(e)}</span></button>`; }).join('')}</div>
    <p class="ws-help">${done ? 'Nice memory! 🧠' : 'Tap two cards. Find all the pairs in as few moves as you can.'}${best && !done ? ` Best: ${best} moves.` : ''}</p>
    <div class="ws-acts"><button class="btn" data-act="memNew">🔀 New game</button></div></section>
    ${crew('memory', pr => pr.best12 || pr.best16 ? [pr.best12 ? `Easy best ${pr.best12} moves` : '', pr.best16 ? `Hard best ${pr.best16}` : ''].filter(Boolean).join(' · ') : '')}`;
}

async function memFlip(i) {
  const m = mem();
  if (m.lock || m.open.includes(i) || m.matched.includes(i) || m.open.length >= 2) return;
  if (!m.started) m.started = Date.now();
  m.open.push(i); Snd.tick();
  if (m.open.length < 2) { S.render(); return; }
  m.moves++;
  const [a, b] = m.open;
  if (m.deck[a] === m.deck[b]) {
    m.matched.push(a, b); m.open = []; Snd.check();
    Confetti.from(document.querySelector(`.mem .mc[data-i="${i}"]`), 18);
    if (m.matched.length === m.deck.length) {
      m.ms = Date.now() - m.started; Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 160);
      const p = progOf('memory'), k = 'best' + m.size, kms = 'bestMs' + m.size;
      await save('memory', { ...p, [k]: p[k] ? Math.min(p[k], m.moves) : m.moves, [kms]: p[kms] ? Math.min(p[kms], m.ms) : m.ms, rounds: (Number(p.rounds) || 0) + 1 });
      toast(p[k] && m.moves < p[k] ? `New best: ${m.moves} moves! 🏆` : `All pairs in ${m.moves} moves! 🎉`);
    }
    S.render(); return;
  }
  m.lock = true; S.render();
  setTimeout(() => { m.open = []; m.lock = false; Snd.uncheck(); S.render(); }, 850);
}

/* ---------- Noughts & crosses ---------- */
const xo = () => (S.ui.xo ||= { b: Array(9).fill(''), turn: 'X', mode: 'yumi', level: 'easy', over: null, think: false });

export function xoPage() {
  const g = xo(), p = progOf('xo'), w = g.over;
  const status = w ? (w.who === 'draw' ? "It's a draw 🤝" : g.mode === 'yumi' ? (w.who === 'X' ? 'You win! 🎉' : 'Yumi wins this one 🤖') : `${w.who === 'X' ? '❌' : '⭕'} wins! 🎉`)
    : g.think ? 'Yumi is thinking…' : g.mode === 'yumi' ? 'Your turn: you are ❌' : `${g.turn === 'X' ? '❌' : '⭕'}'s turn`;
  return `<section class="card mg"><div class="ch"><span class="badge b-pink">⭕</span><h3>Noughts &amp; crosses</h3>${g.mode === 'yumi' ? `<em>${Number(p.wins) || 0}W · ${Number(p.draws) || 0}D · ${Number(p.losses) || 0}L</em>` : ''}</div>
    <div class="chips sm">${[['yumi', '🤖 vs Yumi'], ['two', '👭 2 players']].map(([m, t]) => `<button class="${g.mode === m ? 'on' : ''}" data-act="xoMode" data-m="${m}">${t}</button>`).join('')}${g.mode === 'yumi' ? [['easy', 'Easy'], ['tricky', 'Tricky']].map(([l, t]) => `<button class="${g.level === l ? 'on' : ''}" data-act="xoLevel" data-l="${l}">${t}</button>`).join('') : ''}</div>
    <p class="xo-status ${w ? 'over' : ''}" role="status">${status}</p>
    <div class="xo" role="group" aria-label="Noughts and crosses board">${g.b.map((v, i) => `<button class="xc ${w?.line.includes(i) ? 'win' : ''} ${v ? 'v' + v : ''}" data-act="xoTap" data-i="${i}" ${v || w || g.think ? 'disabled' : ''} aria-label="${v ? (v === 'X' ? 'cross' : 'nought') : 'empty'}, square ${i + 1}">${v === 'X' ? '❌' : v === 'O' ? '⭕' : ''}</button>`).join('')}</div>
    <div class="ws-acts"><button class="btn ${w ? 'solid' : ''}" data-act="xoNew">${w ? 'Play again' : '↺ New game'}</button></div></section>
    ${crew('xo', pr => pr.wins || pr.draws || pr.losses ? `${Number(pr.wins) || 0} wins · ${Number(pr.draws) || 0} draws · ${Number(pr.losses) || 0} losses vs Yumi` : '')}`;
}

async function xoEnd(g) {
  const w = winner(g.b); if (!w) return false;
  g.over = w;
  if (w.who === 'X' || (g.mode === 'two' && w.who === 'O')) { Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 140); } else if (w.who === 'draw') Snd.tap(); else Snd.uncheck();
  if (g.mode === 'yumi') { const p = progOf('xo'), k = w.who === 'X' ? 'wins' : w.who === 'O' ? 'losses' : 'draws'; await save('xo', { ...p, [k]: (Number(p[k]) || 0) + 1 }); }
  return true;
}
async function xoTap(i) {
  const g = xo(); if (g.b[i] || g.over || g.think) return;
  g.b[i] = g.turn; Snd.tick();
  if (await xoEnd(g)) { S.render(); return; }
  if (g.mode === 'two') { g.turn = g.turn === 'X' ? 'O' : 'X'; S.render(); return; }
  g.think = true; S.render();
  setTimeout(async () => { const j = yumiMove(g.b, g.level); if (j >= 0) g.b[j] = 'O'; g.think = false; await xoEnd(g); S.render(); }, 450);
}

/* ---------- shared ---------- */
function crew(id, line) {
  const rows = people().map(x => ({ x, t: line(progOf(id, x.id)) })).filter(r => r.t);
  if (!rows.length) return '';
  return `<section class="card"><div class="ch"><span class="badge b-gold">🏆</span><h3>The crew</h3></div>${rows.map(({ x, t }) => `<div class="devrow">${avatar(x.id)}<span class="tt"><b>${esc(short(x.id))}${x.id === S.me.id ? ' (you)' : ''}</b><small>${esc(t)}</small></span></div>`).join('')}</section>`;
}

export const MINI_ACTIONS = {
  memFlip(el) { memFlip(Number(el.dataset.i)); },
  memNew() { const m = mem(); S.ui.mem = newMemory(m.size, m.set); Snd.magic(); S.render(); },
  memSize(el) { S.ui.mem = newMemory(Number(el.dataset.n), mem().set); Snd.tap(); S.render(); },
  memSet(el) { S.ui.mem = newMemory(mem().size, el.dataset.s); Snd.tap(); S.render(); },
  xoTap(el) { xoTap(Number(el.dataset.i)); },
  xoNew() { const g = xo(); S.ui.xo = { ...g, b: Array(9).fill(''), turn: 'X', over: null, think: false }; Snd.magic(); S.render(); },
  xoMode(el) { const g = xo(); S.ui.xo = { ...g, mode: el.dataset.m, b: Array(9).fill(''), turn: 'X', over: null, think: false }; Snd.tap(); S.render(); },
  xoLevel(el) { const g = xo(); S.ui.xo = { ...g, level: el.dataset.l, b: Array(9).fill(''), turn: 'X', over: null, think: false }; Snd.tap(); S.render(); },
};
