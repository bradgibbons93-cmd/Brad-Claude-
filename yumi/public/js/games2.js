/* Seven more games, drawn from the poster themes: My Room, My Happy Place, Follow Your Energy,
   Sleepover Packing List, Daily Routine, the KATSEYE quiz and Would You Rather. Each keeps its state
   at play/<person>/<game> like the word search, so it follows her to any phone. No stars, just fun. */
import { esc, nowIso, Snd, Confetti, toast, write, Store } from './core.js';
import { S } from './model.js';

const path = (id, who = S.me.id) => `play/${who}/${id}`;
export const prog = (id, who = S.me.id) => Store.get(path(id, who)) || {};
const save = (id, doc) => write([{ path: path(id), set: { ...doc, at: doc.at || nowIso(), updatedAt: nowIso() } }]);
const patch = (id, ch) => save(id, { ...prog(id), ...ch });
const arr = v => (Array.isArray(v) ? v : []);
const card = (badge, cls, title, em, body) => `<section class="card mg g2"><div class="ch"><span class="badge ${cls}">${badge}</span><h3>${title}</h3>${em ? `<em>${esc(em)}</em>` : ''}</div>${body}</section>`;
const opts = (act, key, list, cur, fmt = x => x) => `<div class="g2-opts">${list.map(([v, e, t]) => `<button class="${cur === v ? 'on' : ''}" data-act="${act}" data-k="${key}" data-v="${esc(v)}"><i>${e}</i>${esc(t)}${fmt('')}</button>`).join('')}</div>`;

/* ---------- 1. My Room ---------- */
const WALLS = [['#FFD1E3', '🌸', 'Pink'], ['#E3D4FF', '💜', 'Lilac'], ['#CDEBFF', '☁️', 'Sky'], ['#D3F5E4', '🍃', 'Mint'], ['#FFE9B8', '🌼', 'Sunny']];
const FLOORS = [['#E8C9A0', '🪵', 'Wood'], ['#F5E6F0', '🧸', 'Fluffy rug'], ['#C9B8E8', '🟣', 'Purple']];
const ROOM_ITEMS = [['🛏️', 'Bed'], ['🪴', 'Plant'], ['💡', 'Lamp'], ['🎧', 'Headphones'], ['📚', 'Books'], ['🧸', 'Teddy'], ['🖼️', 'Poster'], ['🎤', 'Mic'], ['🌈', 'Rainbow'], ['⭐', 'Stars'], ['🪞', 'Mirror'], ['🐱', 'Cat']];
export function roomPage() {
  const p = prog('room'), wall = p.wall || WALLS[0][0], floor = p.floor || FLOORS[0][0], items = arr(p.items);
  return card('🛏️', 'b-pink', 'My Room', `${items.length} things`, `
    <div class="room" style="--wall:${wall};--floor:${floor}" role="img" aria-label="Your room with ${items.length} things in it">
      ${items.map((e, i) => `<span class="ri" style="--x:${8 + (i * 29) % 78}%;--y:${6 + ((i * 17) % 4) * 17}%;animation-delay:${(i % 5) * .3}s">${e}</span>`).join('')}
      ${items.length ? '' : '<p class="room-empty">Tap things below to fill your room</p>'}</div>
    <p class="g2-lab">Walls</p>${opts('g2Set', 'room:wall', WALLS, wall)}
    <p class="g2-lab">Floor</p>${opts('g2Set', 'room:floor', FLOORS, floor)}
    <p class="g2-lab">Add things</p><div class="g2-opts">${ROOM_ITEMS.map(([e, t]) => `<button class="${items.includes(e) ? 'on' : ''}" data-act="g2Toggle" data-k="room:items" data-v="${e}" aria-pressed="${items.includes(e)}"><i>${e}</i>${t}</button>`).join('')}</div>
    <div class="ws-acts"><button class="btn" data-act="g2Clear" data-k="room">↺ Empty room</button></div>`);
}

/* ---------- 2. My Happy Place ---------- */
const PLACES = [['beach', '🏖️', 'Beach', 'linear-gradient(#9fe3ff,#ffe9b8)'], ['forest', '🌳', 'Forest', 'linear-gradient(#d3f5e4,#7fd8a6)'], ['space', '🪐', 'Space', 'linear-gradient(#3b2a78,#8b5be6)'], ['cafe', '🧁', 'Cosy café', 'linear-gradient(#ffe1ec,#ffd1a8)'], ['snow', '⛄', 'Snow day', 'linear-gradient(#e3f2ff,#ffffff)'], ['stage', '🎤', 'The stage', 'linear-gradient(#ff5fa2,#a35bff)']];
const WITH = [['🐶', 'A pet'], ['🎵', 'Music'], ['👭', 'My crew'], ['🍓', 'Snacks'], ['📖', 'A book'], ['🧸', 'Cuddles'], ['🌙', 'Quiet'], ['💃', 'Dancing']];
const FEEL = [['calm', '😌', 'Calm'], ['happy', '😄', 'Happy'], ['brave', '🦁', 'Brave'], ['cosy', '🧣', 'Cosy']];
export function happyPage() {
  const p = prog('happy'), place = PLACES.find(x => x[0] === p.place), picks = arr(p.with), feel = FEEL.find(x => x[0] === p.feel);
  return card('🌈', 'b-lilac', 'My Happy Place', '', `
    <p class="g2-lab">Where is it?</p>${opts('g2Set', 'happy:place', PLACES.map(x => x.slice(0, 3)), p.place)}
    <p class="g2-lab">What's with you? (pick up to 3)</p><div class="g2-opts">${WITH.map(([e, t]) => `<button class="${picks.includes(e) ? 'on' : ''}" data-act="g2Toggle" data-k="happy:with" data-v="${e}" data-max="3"><i>${e}</i>${t}</button>`).join('')}</div>
    <p class="g2-lab">How does it feel?</p>${opts('g2Set', 'happy:feel', FEEL, p.feel)}
    ${place ? `<div class="hp" style="background:${place[3]}"><span class="hp-big">${place[1]}</span><span class="hp-with">${picks.join(' ') || '✨'}</span><b>${esc(place[2])}</b><small>${feel ? `${feel[1]} ${feel[2]}` : ''}</small></div>
      <p class="ws-help">Close your eyes, take 3 slow breaths, and go there for a moment 💜</p>` : '<p class="ws-help">Pick a place to see your happy place appear ✨</p>'}`);
}

/* ---------- 3. Follow Your Energy ---------- */
const ENERGY = [[1, '😴', 'Sleepy', ['Cuddle with a blanket', 'Listen to a calm song', 'Draw something slow', 'Have a glass of water']],
  [2, '🙂', 'Chill', ['Read a few pages', 'Play with a pet', 'Make a snack', 'Write in your journal']],
  [3, '😊', 'Good', ['Learn a dance move', 'Tidy your room to music', 'Call a friend', 'Play a board game']],
  [4, '🤩', 'Buzzing', ['Dance party', 'Go for a walk or bike ride', 'Build something', 'Do 10 jumping jacks']],
  [5, '⚡', 'Zoomy', ['Run around outside', 'Make up a routine', 'Obstacle course at home', 'Race a sister']]];
export function energyPage() {
  const p = prog('energy'), lvl = Number(p.level) || 0, e = ENERGY.find(x => x[0] === lvl), done = arr(p.done);
  return card('⚡', 'b-gold', 'Follow Your Energy', done.length ? `${done.length} done` : '', `
    <p class="g2-lab">How much energy do you have right now?</p>
    <div class="battery" role="group" aria-label="Energy level">${ENERGY.map(([n, em, t]) => `<button class="${lvl >= n ? 'on' : ''} ${lvl === n ? 'cur' : ''}" data-act="g2Set" data-k="energy:level" data-v="${n}" aria-label="${t}"><i>${em}</i><span>${t}</span></button>`).join('')}</div>
    ${e ? `<p class="g2-lab">Try one of these</p><div class="g2-list">${e[3].map(t => { const on = done.includes(t); return `<button class="${on ? 'on' : ''}" data-act="g2Toggle" data-k="energy:done" data-v="${esc(t)}"><span>${on ? '✅' : '⬜'}</span>${esc(t)}</button>`; }).join('')}</div>
      <div class="ws-acts"><button class="btn" data-act="g2Spin" data-k="energy">🎲 Surprise me</button></div>
      ${p.spin && e[3].includes(p.spin) ? `<p class="g2-pick">✨ ${esc(p.spin)}</p>` : ''}` : '<p class="ws-help">Tap the battery that feels right 🔋</p>'}`);
}

/* ---------- 4. Sleepover Packing List ---------- */
const PACK = [['🧸', 'Favourite teddy'], ['🛌', 'Sleeping bag'], ['🪥', 'Toothbrush'], ['👚', 'Pyjamas'], ['🔦', 'Torch'], ['🧦', 'Fluffy socks'], ['🍿', 'Snacks to share'], ['🎧', 'Headphones'], ['📖', 'A book'], ['🧴', 'Face wash'], ['🎮', 'A game to share'], ['🩴', 'Slippers']];
export function packPage() {
  const p = prog('pack'), got = arr(p.got), extra = arr(p.extra), all = [...PACK.map(x => x[1]), ...extra], n = all.filter(t => got.includes(t)).length;
  const row = ([e, t]) => `<button class="pk ${got.includes(t) ? 'on' : ''}" data-act="g2Toggle" data-k="pack:got" data-v="${esc(t)}" aria-pressed="${got.includes(t)}"><span class="pk-e">${e}</span><span class="grow">${esc(t)}</span><span class="pk-c">${got.includes(t) ? '🎒' : ''}</span></button>`;
  return card('🎒', 'b-mint', 'Sleepover Packing List', `${n}/${all.length} packed`, `
    <div class="bar" style="height:12px;margin-bottom:10px"><i style="width:${all.length ? n / all.length * 100 : 0}%"></i></div>
    <div class="pklist">${PACK.map(row).join('')}${extra.map(t => row(['✨', t])).join('')}</div>
    <div class="g2-add"><input id="pkNew" type="text" maxlength="30" placeholder="Add your own thing…" aria-label="Add something to pack"><button class="btn solid" data-act="g2PackAdd">＋</button></div>
    ${n === all.length ? '<p class="g2-pick">🎉 All packed. Have the best sleepover!</p>' : ''}
    <div class="ws-acts"><button class="btn" data-act="g2Clear" data-k="pack">↺ Unpack</button></div>`);
}

/* ---------- 5. Daily Routine ---------- */
const DAY = [['🪥', 'Brush teeth'], ['🥣', 'Breakfast'], ['📚', 'School or learning'], ['🏃', 'Play outside'], ['🍎', 'Snack time'], ['🎨', 'Creative time'], ['🧹', 'Tidy up'], ['🍝', 'Dinner'], ['🛁', 'Bath or shower'], ['📖', 'Bedtime story']];
const SLOTS = [['am', '☀️', 'Morning'], ['pm', '🌤️', 'Afternoon'], ['eve', '🌙', 'Evening']];
export function dayPage() {
  const p = prog('day'), put = p.slots && typeof p.slots === 'object' ? p.slots : {}, left = DAY.filter(x => !put[x[1]]);
  return card('🗓️', 'b-blue', 'My Daily Routine', `${DAY.length - left.length}/${DAY.length} placed`, `
    <p class="ws-help" style="text-align:left">Tap an activity, then tap when it happens.</p>
    <div class="g2-opts">${left.map(([e, t]) => `<button class="${p.sel === t ? 'on' : ''}" data-act="g2Set" data-k="day:sel" data-v="${esc(t)}"><i>${e}</i>${esc(t)}</button>`).join('') || '<span class="note">All placed! 🎉</span>'}</div>
    <div class="dayslots">${SLOTS.map(([id, e, t]) => `<div class="dslot"><button class="dhead ${p.sel ? 'hot' : ''}" data-act="g2Place" data-v="${id}" ${p.sel ? '' : 'disabled'}><i>${e}</i>${t}${p.sel ? ' ‹ put here' : ''}</button>
      ${DAY.filter(x => put[x[1]] === id).map(([em, tt]) => `<button class="dact" data-act="g2Unplace" data-v="${esc(tt)}" aria-label="Take ${esc(tt)} out"><i>${em}</i>${esc(tt)}<b>✕</b></button>`).join('')}</div>`).join('')}</div>
    <div class="ws-acts"><button class="btn" data-act="g2Clear" data-k="day">↺ Start again</button></div>`);
}

/* ---------- 6. KATSEYE quiz ---------- */
export const QUIZ = [
  { q: 'How many members are in KATSEYE?', a: ['4', '5', '6', '8'], c: 2 },
  { q: 'What do KATSEYE fans call themselves?', a: ['Eyeconic', 'Army', 'Blinks', 'Swifties'], c: 0 },
  { q: 'Which of these is a KATSEYE member?', a: ['Sophia', 'Taylor', 'Olivia', 'Zoe'], c: 0 },
  { q: 'Which of these is a KATSEYE song?', a: ['Gnarly', 'Sparkles', 'Rainbow Road', 'Sunny Day'], c: 0 },
  { q: 'Which of these is a KATSEYE song?', a: ['Cartwheel', 'Touch', 'Pancakes', 'Tiptoe'], c: 1 },
  { q: 'Which of these is a KATSEYE member?', a: ['Maya', 'Chloe', 'Yoonchae', 'Ruby'], c: 2 },
  { q: 'Which of these is a KATSEYE member?', a: ['Lara', 'Emma', 'Grace', 'Ivy'], c: 0 },
  { q: 'Which of these is a KATSEYE song?', a: ['Cloud Nine', 'Gabriela', 'Moonwalk', 'Bubblegum'], c: 1 },
];
export function quizPage() {
  const z = (S.ui.quiz ||= { i: 0, score: 0, pick: null, done: false }), p = prog('quiz'), q = QUIZ[z.i];
  if (z.done) return card('💜', 'b-pink', 'KATSEYE Quiz', '', `<div class="ws-done"><span>${z.score >= 7 ? '🏆' : z.score >= 4 ? '🎉' : '💜'}</span><b>You got ${z.score} of ${QUIZ.length}!</b>${p.best ? `<small>Your best: ${p.best}</small>` : ''}<button class="btn solid" data-act="quizNew">Play again</button></div>`);
  return card('💜', 'b-pink', 'KATSEYE Quiz', `${z.i + 1} of ${QUIZ.length}`, `
    <div class="bar" style="height:10px;margin-bottom:12px"><i style="width:${z.i / QUIZ.length * 100}%"></i></div>
    <h2 class="qq">${esc(q.q)}</h2>
    <div class="qa">${q.a.map((t, i) => `<button class="${z.pick == null ? '' : i === q.c ? 'right' : i === z.pick ? 'wrong' : 'dim'}" data-act="quizPick" data-i="${i}" ${z.pick != null ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>
    ${z.pick != null ? `<p class="ws-help">${z.pick === q.c ? 'Yes! 🎉' : 'Nearly! Now you know 💜'}</p><div class="ws-acts"><button class="btn solid" data-act="quizNext">${z.i + 1 === QUIZ.length ? 'See my score' : 'Next ›'}</button></div>` : ''}`);
}

/* ---------- 7. Would You Rather / Pick One ---------- */
export const RATHER = [['🍕', 'Pizza for dinner', '🍦', 'Ice cream for dinner'], ['🦸', 'Be able to fly', '🧜', 'Breathe underwater'], ['🎤', 'Sing on a huge stage', '💃', 'Dance on a huge stage'], ['🏖️', 'A beach holiday', '🏔️', 'A snow holiday'], ['🐶', 'Have a talking dog', '🐱', 'Have a talking cat'], ['🌙', 'Stay up late', '☀️', 'Wake up early for an adventure'], ['🎨', 'Draw anything and it comes alive', '🎵', 'Any song you hum plays for real'], ['🏰', 'Live in a castle', '🏡', 'Live in a treehouse'], ['🧁', 'Only sweet snacks', '🥨', 'Only salty snacks'], ['🦄', 'Ride a unicorn', '🐉', 'Befriend a dragon']];
export function ratherPage() {
  const p = prog('rather'), picks = p.picks && typeof p.picks === 'object' ? p.picks : {}, n = Object.keys(picks).length, i = RATHER.findIndex((_, k) => !picks[k]), r = RATHER[i];
  return card('🤔', 'b-orange', 'Would You Rather', `${n}/${RATHER.length}`, i < 0 ? `<div class="ws-done"><span>🎉</span><b>You picked all ${RATHER.length}!</b><button class="btn solid" data-act="g2Clear" data-k="rather">Play again</button></div>
      <div class="g2-list">${RATHER.map((x, k) => `<div class="rec">${x[picks[k] === 'a' ? 0 : 2]} ${esc(x[picks[k] === 'a' ? 1 : 3])}</div>`).join('')}</div>`
    : `<h2 class="qq">Would you rather…</h2>
    <div class="rather"><button class="ra" data-act="g2Rather" data-i="${i}" data-v="a"><i>${r[0]}</i>${esc(r[1])}</button><span class="or">or</span><button class="rb" data-act="g2Rather" data-i="${i}" data-v="b"><i>${r[2]}</i>${esc(r[3])}</button></div>
    <p class="ws-help">Pick one, there's no wrong answer. Ask your sister what she'd pick!</p>`);
}

/* ---------- actions ---------- */
const split = k => k.split(':');
export const G2_ACTIONS = {
  async g2Set(el) { const [g, f] = split(el.dataset.k), v = /^\d+$/.test(el.dataset.v) ? Number(el.dataset.v) : el.dataset.v; Snd.tap(); await patch(g, { [f]: v }); },
  async g2Toggle(el) {
    const [g, f] = split(el.dataset.k), v = el.dataset.v, cur = arr(prog(g)[f]), max = Number(el.dataset.max) || 99;
    const on = cur.includes(v), next = on ? cur.filter(x => x !== v) : [...cur, v];
    if (!on && next.length > max) { toast(`Pick up to ${max}`); Snd.err(); return; }
    on ? Snd.uncheck() : Snd.check(); if (!on && f === 'got') Confetti.from(el, 10);
    await patch(g, { [f]: next });
  },
  async g2Clear(el) { Snd.uncheck(); await save(el.dataset.k, {}); },
  async g2Spin() { const e = ENERGY.find(x => x[0] === Number(prog('energy').level)); if (!e) return; Snd.magic(); await patch('energy', { spin: e[3][Math.floor(Math.random() * e[3].length)] }); },
  async g2PackAdd() {
    const box = document.getElementById('pkNew'), t = (box?.value || '').trim().slice(0, 30); if (!t) { box?.focus(); Snd.err(); return; }
    const p = prog('pack'); box.value = ''; Snd.pop(); await patch('pack', { extra: [...arr(p.extra), t] });
  },
  async g2Place(el) { const p = prog('day'); if (!p.sel) return; const t = DAY.find(x => x[1] === p.sel); Snd.check(); await patch('day', { slots: { ...(p.slots || {}), [t[1]]: el.dataset.v }, sel: null }); },
  async g2Unplace(el) { const p = prog('day'), s = { ...(p.slots || {}) }; delete s[el.dataset.v]; Snd.uncheck(); await patch('day', { slots: s }); },
  async g2Rather(el) { const p = prog('rather'); Snd.pop(); await patch('rather', { picks: { ...(p.picks || {}), [el.dataset.i]: el.dataset.v } }); },
  quizPick(el) {
    const z = S.ui.quiz; if (!z || z.pick != null) return;
    z.pick = Number(el.dataset.i);
    if (z.pick === QUIZ[z.i].c) { z.score++; Snd.check(); Confetti.from(el, 24); } else Snd.uncheck();
    S.render();
  },
  async quizNext() {
    const z = S.ui.quiz; if (!z) return;
    if (z.i + 1 < QUIZ.length) { z.i++; z.pick = null; Snd.tap(); S.render(); return; }
    z.done = true; Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 120);
    const p = prog('quiz'); await patch('quiz', { best: Math.max(Number(p.best) || 0, z.score), last: z.score, rounds: (Number(p.rounds) || 0) + 1 });
  },
  quizNew() { S.ui.quiz = { i: 0, score: 0, pick: null, done: false }; Snd.magic(); S.render(); },
};
