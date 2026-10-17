/* Every screen once you're signed in: Home, Routines, Rewards, Family and Me (Settings for a parent).
   Bright and warm, big icons, and a gold star next to everything you can earn. */
import { esc, Store, today, ymd, parseYmd, addDays, startOfWeek, DOW, DOWL, MON, MONL, ago, byAtDesc, fmtShort, fmtTime, Snd } from './core.js';
import { S, P, people, kids, avatar, short, nick, famName, BUDDIES, THEMES, ACCENTS, MOODS, HARD_MOODS, FOODS, SLOTS, JOURNAL_PROMPTS, COVERS, PLAN_COLORS,
  IDEA_FILTERS, homeFor, homeName, nextSwitch, roster, places, placeOf, rhythm, routineOf, dayOf, routineStats, moodToday, starsOf, strikesOf,
  streakSet, rewardsList, TRAIL_REWARDS, ideasList, jobsFor, doneBy, rules, weekDays, isParent, isKid, buddyOf, buddyImg } from './model.js';
import { isIOS } from './push.js';

const hasArt = k => (S.boot?.art || []).includes(k);
const slotNow = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'after' : 'bed'; };
const tint = id => { const p = P(id); if (!p) return 'c-pink'; if (p.role === 'parent') return 'c-blue'; return { pink: 'c-pink', lilac: 'c-lilac', mint: 'c-mint', sun: 'c-sun', ocean: 'c-ocean' }[p.accent] || 'c-pink'; };
const stars5 = frac => { const on = Math.max(0, Math.min(5, Math.round((frac || 0) * 5))); return `<span class="stars5" aria-label="${on} of 5">${[0, 1, 2, 3, 4].map(i => `<i class="${i < on ? 'on' : ''}">★</i>`).join('')}</span>`; };
const selKid = () => (S.ui.kid && P(S.ui.kid)?.role === 'kid') ? S.ui.kid : kids()[0]?.id;
const notesOn = d => Store.col('notes').filter(n => n.date === d && (!n.priv || n.by === S.me.id)).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
const eventsOn = d => Store.col('events').filter(e => e.date === d).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

export const TABS_KID = [['home', '🏠', 'Home'], ['routines', '📋', 'Routines'], ['rewards', '🏆', 'Rewards'], ['family', '👨‍👧‍👧', 'Family'], ['me', '😊', 'Me']];
export const TABS_PARENT = [['home', '🏠', 'Home'], ['routines', '📋', 'Routines'], ['rewards', '🏆', 'Rewards'], ['family', '👨‍👧‍👧', 'Family'], ['me', '⚙️', 'Settings']];

export function viewApp() {
  const body = { home: tabHome, routines: tabRoutines, rewards: tabRewards, family: tabFamily, me: tabMe }[S.tab] || tabHome;
  const tabs = isParent() ? TABS_PARENT : TABS_KID;
  return `<div class="screen"><div class="main">${body()}</div>
    <nav class="nav">${tabs.map(([id, e, t]) => `<button class="${S.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}" aria-current="${S.tab === id}"><i>${e}</i>${t}</button>`).join('')}</nav>
    ${timerPill()}</div>`;
}

/* ---------- shared pieces ---------- */
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; }

function hero() {
  const d = new Date(), me = P(S.me.id), w = isParent() ? waitingItems().length : 0;
  const sparks = [[8, 22, 0], [86, 16, .6], [70, 40, 1.2], [20, 52, 1.8], [52, 12, .9]].map(([x, y, dl]) => `<span class="spark" style="left:${x}%;top:${y}%;animation-delay:${dl}s">★</span>`).join('');
  return `<header class="hero">${hasArt('family') ? '<img class="bg" src="/art/family" alt="">' : ''}${sparks}
    <div class="hero-top"><span class="brand"><i>★</i> yumi · ${esc(famName())}</span><span class="datepill">📅 ${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}</span>${isParent() ? `<button class="bell" data-act="openInbox" aria-label="${w} waiting for you">🔔${w ? `<b>${w}</b>` : ''}</button>` : ''}</div>
    <div class="hero-txt"><h1><span class="sun">${d.getHours() < 17 ? '☀️' : '🌙'}</span><span>${greeting()},<br>${esc(me.role === 'parent' ? me.name : me.nick || me.name)}!</span></h1><p>A happy family makes a bright day 💗</p></div></header>`;
}

function personProgress(id) {
  const p = P(id);
  if (p.role === 'kid') { const r = routineStats(id); return r.total ? r.done / r.total : 0; }
  const items = Store.col('dad/routine'), day = Store.get('dad/days/' + today()) || { done: [] };
  if (items.length) return items.filter(r => (day.done || []).includes(r.id)).length / items.length;
  return 0;
}

function peopleCards() {
  const ps = people(), goal = Store.get('pub/family')?.goal;
  const cards = ps.map(p => {
    const frac = personProgress(p.id), on = Math.round(frac * 5);
    const label = p.role === 'parent' ? (p.nick || p.name) : p.name;
    const sub = p.role === 'kid' ? `⭐ ${starsOf(p.id)}` : `🔥 ${Number(p.pub?.streak) || 0} days`;
    return `<button class="pc ${tint(p.id)} ${p.id === S.me.id ? 'me' : ''}" data-act="personTap" data-k="${esc(p.id)}" aria-label="${esc(label)}: ${on} of 5 today">${avatar(p.id)}<b>${esc(label)}</b>${stars5(frac)}<small>${sub}</small></button>`;
  });
  if (goal) cards.push(`<button class="pc c-mint" data-act="tab" data-tab="rewards"><span class="home">🏡</span><b>Goal</b>${stars5(goal.progress / goal.target)}<small>${Math.min(goal.progress, goal.target)}/${goal.target}</small></button>`);
  return `<div class="people" style="--n:${Math.min(cards.length, 4)}">${cards.join('')}</div>`;
}

function itemRow(k, r, done, dad = false) {
  return `<button class="ritem ${done ? 'done' : ''}" data-act="${dad ? 'dadStep' : 'step'}" ${dad ? '' : `data-k="${esc(k)}"`} data-id="${esc(r.id)}" aria-pressed="${done}">
    <span class="cb">${done ? '✓' : ''}</span><span class="e">${esc(r.e || '•')}</span><span class="t">${esc(r.t)}</span><span class="st">★</span></button>`;
}

function slotChips(items, done, slot) {
  return `<div class="slots">${SLOTS.map(sl => { const it = items.filter(r => r.slot === sl.id), dn = it.filter(r => done.has(r.id)).length;
    return `<button class="${slot === sl.id ? 'on' : ''}" data-act="slot" data-slot="${sl.id}" aria-pressed="${slot === sl.id}">${it.length && dn === it.length ? '<span class="tick">✓</span>' : ''}<i>${sl.e}</i>${sl.id === 'after' ? 'After' : sl.t} ${dn}/${it.length}</button>`; }).join('')}</div>`;
}

function routineCard(k, { big = false, title = "Today's Routine" } = {}) {
  const all = routineOf(k), done = new Set(dayOf(k).done || []), rs = routineStats(k), editing = S.ui.editRoutine === k;
  if (!all.length) return `<section class="card"><div class="ch"><span class="badge b-orange">✅</span><h3>${title}</h3></div><div class="empty">No routine yet.<br><br><button class="btn solid" data-act="useStarter" data-k="${esc(k)}">Use a starter routine</button></div></section>`;
  const slot = S.ui.slot || slotNow(), items = all.filter(r => r.slot === slot);
  return `<section class="card ${big ? 'big' : ''}"><div class="ch"><span class="badge b-orange">✅</span><h3>${title}</h3><button class="edit" data-act="editRoutine" data-k="${esc(k)}">${editing ? 'Done' : 'Edit'}</button></div>
    ${slotChips(all, done, slot)}
    ${editing ? items.map(r => `<div class="stepedit"><span style="font-size:22px">${esc(r.e || '•')}</span><span class="grow">${esc(r.t)}</span><button class="x-btn" data-act="stepDel" data-k="${esc(k)}" data-id="${esc(r.id)}" aria-label="Remove ${esc(r.t)}">🗑️</button></div>`).join('') +
      `<div class="row"><input type="text" id="newStep" maxlength="60" placeholder="Add a step"><button class="btn solid small" data-act="stepAdd" data-k="${esc(k)}" data-slot="${slot}">Add</button></div>`
      : items.map(r => itemRow(k, r, done.has(r.id))).join('') || '<div class="empty">Nothing here. Tap Edit to add a step.</div>'}
    <p class="goalline">${rs.done === rs.total ? '🎉 All done today! +1 ★ in the jar' : `Finish all ${rs.total} for <b>+1 ★</b> · ${rs.total - rs.done} to go`}</p></section>`;
}

function dadRoutineCard(big = false) {
  const items = Store.col('dad/routine').sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const day = Store.get('dad/days/' + today()) || { done: [] }, done = new Set(day.done || []), editing = S.ui.editDad;
  if (!items.length) return `<section class="card"><div class="ch"><span class="badge b-orange">✅</span><h3>My Routine</h3></div><p class="note">A few steps for your own day. Your streak shows on the girls' screens.</p><button class="btn blue" data-act="dadStarter">Use a starter routine</button></section>`;
  const slot = S.ui.slot || slotNow(), list = items.filter(r => r.slot === slot);
  return `<section class="card ${big ? 'big' : ''}"><div class="ch"><span class="badge b-orange">✅</span><h3>My Routine</h3><button class="edit" data-act="dadEdit">${editing ? 'Done' : 'Edit'}</button></div>
    ${slotChips(items, done, slot)}
    ${editing ? list.map(r => `<div class="stepedit"><span style="font-size:22px">${esc(r.e || '•')}</span><span class="grow">${esc(r.t)}</span><button class="x-btn" data-act="dadStepDel" data-id="${esc(r.id)}" aria-label="Remove">🗑️</button></div>`).join('') +
      `<div class="row"><input type="text" id="dadStepIn" maxlength="60" placeholder="Add a step"><input type="hidden" id="dadSlot" value="${slot}"><button class="btn blue small" data-act="dadStepAdd">Add</button></div>`
      : list.map(r => itemRow('', r, done.has(r.id), true)).join('') || '<div class="empty">Nothing in this part of the day.</div>'}
  </section>`;
}

function weekStars(k) {
  const ws = startOfWeek(new Date()).getTime();
  return Store.col(`kids/${k}/log`).filter(l => (l.type === 'star') && new Date(l.at).getTime() >= ws).reduce((a, l) => a + (Number(l.n) || 1), 0);
}
function streakOf(k) { const set = streakSet(k); let n = 0, d = new Date(); if (!set.has(ymd(d))) d = addDays(d, -1); while (set.has(ymd(d))) { n++; d = addDays(d, -1); } return n; }
const QUOTES = ['Small steps, big dreams! 💗', 'You are a superstar ⭐', 'Every tick counts! ✨', 'Kind hearts shine bright 🌈', 'Keep going, you got this! 💪', 'Proud of you! 💖'];

function starsCard(k) {
  const n = starsOf(k), R = rules(), pct = Math.min(100, Math.round(n / R.paydayStars * 100));
  return `<section class="card sun"><div class="ch"><span class="badge b-gold">🏆</span><h3>Stars &amp; Streaks</h3></div>
    <div class="ss"><button class="box" data-act="tab" data-tab="rewards"><b><i>⭐</i>${n}</b><small>stars in my jar</small></button><div class="box"><b><i>🔥</i>${streakOf(k)}</b><small>day streak!</small></div></div>
    <div class="bar"><i style="width:${pct}%"></i></div><div class="barlbl"><span>${weekStars(k)} this week</span><span>${n}/${R.paydayStars} = $${R.paydayDollars}</span></div>
    <p class="quote">"${QUOTES[new Date().getDate() % QUOTES.length]}"</p></section>`;
}

function girlsStarsCard() {
  const R = rules();
  return `<section class="card sun"><div class="ch"><span class="badge b-gold">🏆</span><h3>Girls' Stars</h3></div>
    ${kids().map(k => { const n = starsOf(k.id); return `<button class="row" data-act="personTap" data-k="${esc(k.id)}" style="text-align:left">${avatar(k.id)}<span class="grow"><b style="font:700 16px/1.1 var(--f)">${esc(k.nick || k.name)} · ⭐ ${n}</b><span class="bar" style="display:block;margin-top:6px;height:10px"><i style="width:${Math.min(100, n)}%"></i></span><small class="t-s">🔥 ${streakOf(k.id)} days · ${strikesOf(k.id)} strikes</small></span></button>`; }).join('')}
    <p class="quote">"${R.paydayStars} stars = $${R.paydayDollars} payday"</p></section>`;
}

function quickButtons() {
  return isParent()
    ? `<div class="quick"><button class="q-gold" data-act="quickStar"><i>⭐</i>Give a Star</button><button class="q-red" data-act="quickStrike"><i>✖️</i>Give a Strike</button><button class="q-blue" data-act="timerOpen"><i>⏱️</i>Start a Timer</button><button class="q-pink" data-act="taskNew"><i>✅</i>Quick Add Job</button></div>`
    : `<div class="quick one"><button class="q-blue" data-act="timerOpen"><i>⏱️</i>Start a Timer</button><button class="q-pink" data-act="taskNew"><i>✅</i>Add a Task</button></div>`;
}

function notesCard(compact = false) {
  const f = Store.col('feed').filter(x => x.text).sort(byAtDesc)[0];
  if (compact) return `<button class="card rose notes" data-act="goNotes" style="text-align:left"><div class="ch"><span class="badge b-pink">💗</span><h3>Notes</h3></div><p>${f ? esc(f.text.slice(0, 60)) : 'Be kind 💗'}</p></button>`;
  return `<section class="card rose notes"><div class="ch"><span class="badge b-pink">💗</span><h3>Family Notes</h3><button class="edit" data-act="noteNew" aria-label="Write a note">＋</button></div>
    ${f ? `<button data-act="goNotes" style="text-align:left;display:grid;gap:6px"><p>${esc(f.text.slice(0, 120))}</p><small>${esc(nick(f.kid))} · ${ago(f.at)}</small></button>` : '<p>Be kind<br>Work hard<br>Have fun! 💗</p>'}</section>`;
}

function buddyCard(k) {
  const b = buddyOf(k), p = P(k), rs = routineStats(k), left = rs.total - rs.done, toGo = rules().paydayStars - starsOf(k);
  const lines = [left ? `${left} more ${left === 1 ? 'tick' : 'ticks'} for today's star!` : 'Whole routine done. Superstar!', `${toGo} stars to your $${rules().paydayDollars}!`, `You've got this, ${p.nick || p.name}!`];
  const line = lines[(new Date().getMinutes() + (S.ui.bump || 0)) % lines.length];
  if (!b) return `<button class="buddy" data-act="openMine"><span style="font-size:40px">🐾</span><span class="bubble">Pick a buddy to cheer you on!</span></button>`;
  return `<button class="buddy" data-act="buddyTap">${buddyImg(b)}<span class="grow"><span class="bubble">${esc(line)}</span><br><small class="t-s">${esc(b.name)} says</small></span></button>`;
}

function moodCard(k) {
  const mood = S.ui.mood, m = MOODS.find(x => x.id === mood), posted = moodToday(k);
  return `<section class="card"><div class="ch"><span class="badge b-lilac">😊</span><h3>How are you feeling?</h3></div>
    <div class="moods">${MOODS.map(x => `<button class="${mood === x.id ? 'on' : ''}" data-act="mood" data-mood="${x.id}" aria-pressed="${mood === x.id}"><i>${x.e}</i>${x.t}</button>`).join('')}</div>
    ${mood ? `<textarea id="moodText" rows="2" maxlength="280" placeholder="${esc(m?.q || 'Tell the crew…')}"></textarea>
      ${HARD_MOODS.includes(mood) ? '<label class="hug"><input type="checkbox" id="hugAsk"> I would love a hug from Dad 🤗</label>' : ''}
      <button class="btn solid" data-act="moodPost">Tell the crew</button>` : ''}
    ${posted ? `<p class="note">Today you're feeling ${esc(posted.t.toLowerCase())} ${posted.e}</p>` : ''}</section>`;
}

function todayCard() {
  const t = today(), evs = eventsOn(t), ns = notesOn(t), h = homeFor(t), nx = nextSwitch();
  return `${h !== 'unknown' ? `<button class="tonight h-${h}" data-act="goCal"><span class="big">${h === 'swap' ? '🔁' : '🏠'}</span><span class="grow"><b>Tonight: ${esc(homeName(h))}</b><small>${nx ? `${nx.home === 'dad' ? "Dad's" : nx.home === 'mum' ? "Mum's" : 'Swap'} in ${nx.sleeps} ${nx.sleeps === 1 ? 'sleep' : 'sleeps'}` : 'Same all fortnight'}</small></span><span style="font-size:22px">›</span></button>` : ''}
    <section class="card"><div class="ch"><span class="badge b-blue">📅</span><h3>Today</h3><button class="edit" data-act="addEvent">＋ Add</button></div>
    ${evs.map(e => `<div class="tl"><span class="e">${esc(e.emoji || '📌')}</span><span>${esc(e.title)}</span><time>${e.time ? fmtTime(e.time) : 'All day'}</time></div>`).join('')}
    ${ns.map(n => `<div class="tl"><span class="e">📝</span><span>${esc(n.text)}</span><time>${n.time ? fmtTime(n.time) : ''}</time></div>`).join('')}
    ${evs.length || ns.length ? '' : '<p class="note">Nothing on the calendar today.</p>'}</section>`;
}

function principalCard(k) {
  const n = strikesOf(k);
  if (n < rules().principalAt) return '';
  const key = `yumi-principal-${k}-${P(k)?.pub?.cycleStart || ''}-${n}`;
  try { if (localStorage.getItem(key)) return ''; } catch (e) {}
  return `<section class="card warn"><div class="big-msg"><span class="e">⚠️</span><h2>${n} strikes</h2>
    <p class="note" style="font-size:17px;color:var(--ink)">That's too many. Dad will let your principal know.</p>
    <p class="note">Strikes start again when you fill your jar to ${rules().paydayStars} stars.</p>
    <button class="btn ink" data-act="principalSeen" data-key="${esc(key)}">I understand</button></div></section>`;
}

/* ---------- Home ---------- */
function tabHome() {
  const me = S.me.id;
  if (isParent()) {
    const w = waitingItems();
    return `${hero()}${peopleCards()}${pushCard()}
      ${w.length ? `<section class="card" id="waiting"><div class="ch"><span class="badge b-pink">🔔</span><h3>Waiting for you</h3><em>${w.length}</em></div>${w.map(x => x.html).join('')}</section>` : ''}
      ${quickButtons()}${girlsStarsCard()}${dadRoutineCard()}${notesCard()}${todayCard()}`;
  }
  return `${hero()}${peopleCards()}${principalCard(me)}${pushCard()}${buddyCard(me)}
    ${routineCard(me)}
    <div class="duo"><div class="col">${starsCard(me)}</div><div class="col">${quickButtons()}${notesCard(true)}</div></div>
    ${moodCard(me)}${todayCard()}`;
}

/* Asks once (until dismissed) to turn on lock-screen notifications. */
function pushCard() {
  const st = S.ui.pushState;
  let hidden = false; try { hidden = localStorage.getItem('yumi-push-hide') === '1'; } catch (e) {}
  if (hidden || !['off', 'install'].includes(st)) return '';
  const why = isParent() ? 'Know the moment the girls finish their routine, check in, pick a reward or want a hug.' : 'Get a ping when you earn a star, plus little reminders for your routine.';
  return `<section class="card pushcard"><div class="ch"><span class="badge b-gold">🔔</span><h3>${isParent() ? 'Alerts on your lock screen' : 'Stars on your lock screen'}</h3><button class="x-btn" data-act="pushHide" aria-label="Not now">✕</button></div>
    <p class="note">${why}</p>
    <button class="btn solid" data-act="${st === 'off' ? 'pushOn' : 'pushOpen'}">${st === 'off' ? 'Turn on notifications' : 'Show me how'}</button></section>`;
}
const PUSH_LABEL = { on: 'On ✓', off: 'Off', blocked: 'Blocked', install: 'Needs Home Screen', unsupported: 'Not on this phone' };
export const pushTile = cls => `<button class="${cls}" data-act="pushOpen"><i>🔔</i><b>Notifications</b><small>${PUSH_LABEL[S.ui.pushState] || '…'}</small></button>`;
const picEdit = k => `<label class="avedit" aria-label="Change picture">${avatar(k)}<span class="cam">📷</span><input type="file" accept="image/*" data-pic="${esc(k)}" class="vh"></label>`;

/* ---------- Routines ---------- */
function streakLine(k) {
  const set = streakSet(k), days = weekDays(0), t = today(), n = streakOf(k);
  return `<div class="streakcard"><span class="fire">🔥</span><span>${n ? `<b style="font-size:20px">${n} day streak!</b>` : 'Finish a whole routine to start a streak'}</span>
    <span class="wkdots">${days.map((d, i) => `<span>${'MTWTFSS'[i]}<i class="${set.has(d) ? 'on' : ''} ${d === t ? 'today' : ''}">${set.has(d) ? '★' : ''}</i></span>`).join('')}</span></div>`;
}

export function taskRow(tk) {
  const by = doneBy(tk), mine = by.includes(S.me.id), t = today();
  const when = tk.daily ? 'Every day' : tk.date ? (tk.date === t ? 'Today' : tk.date < t ? `Since ${fmtShort(tk.date)}` : fmtShort(tk.date)) : 'Any time';
  const forWho = !tk.who || tk.who === 'all' ? 'Everyone' : short(tk.who);
  const canTick = !tk.who || tk.who === 'all' || tk.who === S.me.id;
  return `<div class="task ${mine ? 'done' : ''}">${canTick ? `<button class="tk" data-act="taskTick" data-id="${esc(tk.id)}" aria-pressed="${mine}" aria-label="${mine ? 'Untick' : 'Tick'} ${esc(tk.t)}">${mine ? '✓' : ''}</button>` : '<span class="tk" style="opacity:.3"></span>'}
    <span class="e">${esc(tk.e || '✅')}</span><span class="tt"><b>${esc(tk.t)}</b><small>${esc(forWho)} · ${when}</small></span>
    ${by.length ? `<span class="whos">${by.map(w => avatar(w)).join('')}</span>` : ''}
    ${tk.stars ? `<span class="st">+${tk.stars} ★</span>` : ''}
    ${isParent() || tk.by === S.me.id ? `<button class="x-btn" data-act="taskDel" data-id="${esc(tk.id)}" aria-label="Delete ${esc(tk.t)}">✕</button>` : ''}</div>`;
}

function jobsCard() {
  const t = today(), f = S.ui.jobWho || (isKid() ? S.me.id : 'all');
  const all = Store.col('tasks').filter(tk => f === 'all' || !tk.who || tk.who === f || tk.who === 'all');
  const now = all.filter(tk => tk.daily || !tk.date || tk.date <= t).sort((a, b) => (a.daily === b.daily ? 0 : a.daily ? -1 : 1) || String(a.at || '').localeCompare(String(b.at || '')));
  const later = all.filter(tk => !tk.daily && tk.date && tk.date > t).sort((a, b) => a.date.localeCompare(b.date));
  return `<section class="card"><div class="ch"><span class="badge b-mint">🧹</span><h3>${isKid() ? 'Jobs for stars' : 'Family jobs'}</h3><button class="edit" data-act="taskNew">＋ Add</button></div>
    <div class="chips">${[['all', 'Everyone'], ...people().map(p => [p.id, short(p.id)])].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="jobWho" data-w="${esc(k)}">${esc(l)}</button>`).join('')}</div>
    ${now.length ? now.map(taskRow).join('') : `<div class="empty">No jobs yet.${isParent() ? '<br><br><button class="btn solid" data-act="starterJobs">Add starter jobs</button>' : ''}</div>`}
    ${later.length ? `<p class="sec-title">Coming up</p>${later.map(taskRow).join('')}` : ''}
    <p class="note">${isKid() ? 'Tick a job when it\'s done. The stars go straight in your jar.' : 'Daily jobs reset every morning. You set the stars.'}</p></section>`;
}

function kidChips(withMe = false) {
  const k = S.ui.rk || selKid();
  const list = [...kids().map(x => [x.id, x.nick || x.name]), ...(withMe ? [['me', 'Me']] : [])];
  return `<div class="chips">${list.map(([id, l]) => `<button class="${k === id ? 'on' : ''}" data-act="pickKid" data-k="${esc(id)}">${id === 'me' ? avatar(S.me.id) : avatar(id)}${esc(l)}</button>`).join('')}</div>`;
}

function tabRoutines() {
  if (isParent()) {
    const k = S.ui.rk || selKid();
    return `<h1 class="page-title"><span>📋</span>Routines</h1>${kidChips(true)}
      ${k === 'me' ? dadRoutineCard(true) : `${routineCard(k, { big: true, title: `${esc(P(k)?.nick || P(k)?.name || '')}'s Routine` })}${streakLine(k)}`}
      ${jobsCard()}`;
  }
  const me = S.me.id;
  return `<h1 class="page-title"><span>📋</span>My Routines</h1>${routineCard(me, { big: true })}${streakLine(me)}${jobsCard()}`;
}

/* ---------- Rewards ---------- */
function jarCard(k) {
  const n = starsOf(k), R = rules(), pct = Math.min(100, Math.round(n / R.paydayStars * 100));
  return `<div class="jar"><div class="top"><span class="big">🫙</span><span><span class="n">${n}<small> / ${R.paydayStars} ★</small></span><br><span class="lbl">${S.me.id === k ? 'stars in my jar' : `in ${esc(P(k).nick || P(k).name)}'s jar`}</span></span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="goal"><span>${R.paydayStars - n} more to go</span><span>💵 ${R.paydayStars} ★ = $${R.paydayDollars}</span></div></div>`;
}
/* Each treat on the trail can be tapped and bought. The last stop is the $100 payday. */
function trailCard(k) {
  const n = starsOf(k), R = rules(), marks = [...TRAIL_REWARDS.map(r => [r.cost, r.e, r.id]), [R.paydayStars, '💵', 'payday']];
  const next = marks.find(([v]) => n < v), mine = S.me.id === k;
  return `<section class="card"><div class="ch"><span class="badge b-gold">🗺️</span><h3>Star trail</h3><em>${next ? `${next[0] - n} to ${next[1]}` : 'Payday!'}</em></div>
    <div class="trail">${marks.map(([v, e, id]) => `<button class="${n >= v ? 'hit' : ''}" data-act="rewardOpen" data-id="${id}" ${mine ? '' : 'disabled'} aria-label="${v} stars">${n >= v && id !== 'payday' && mine ? '<em>Get it!</em>' : ''}<i>${e}</i>${v}</button>`).join('')}</div>
    ${mine ? '<p class="note" style="text-align:center">Tap a treat to get it</p>' : ''}</section>`;
}
function paydayCards(k, asDad) {
  const list = Store.col(`kids/${k}/payday`).sort(byAtDesc);
  const pending = list.filter(p => p.status !== 'paid'), paid = list.filter(p => p.status === 'paid');
  return pending.map(p => `<div class="payday"><span class="e">💵</span><span class="grow"><b>${asDad ? `Pay ${esc(P(k).name)} $${p.amount}` : `Dad owes you $${p.amount}! 🎉`}</b><small>${asDad ? 'Her jar hit 100. Tap Paid once she has it.' : 'You filled your jar! Your stars and strikes start fresh.'}</small></span>${asDad ? `<button class="btn good small" data-act="paid" data-k="${esc(k)}" data-id="${esc(p.id)}">Paid</button>` : ''}</div>`).join('')
    + (paid.length ? `<p class="note" style="text-align:center">💰 ${paid.length} ${paid.length === 1 ? 'payday' : 'paydays'} so far: $${paid.reduce((a, p) => a + (Number(p.amount) || 0), 0)}</p>` : '');
}
function strikesCard(k) {
  const n = strikesOf(k), R = rules(), taken = Math.floor(n / R.strikesPerStar);
  return `<section class="card"><div class="ch"><span class="badge" style="background:var(--bad)">✖️</span><h3>Strikes</h3><em>${n}${taken ? ` · ${taken} ★ taken` : ''}</em></div>
    <div class="ladder" aria-label="${n} strikes">${Array.from({ length: R.principalAt }, (_, i) => { const s = i + 1, on = s <= n, mk = s % R.strikesPerStar === 0 && s < R.principalAt, pr = s === R.principalAt;
      return `<i class="${on ? 'on' : ''} ${mk ? 'mk' : ''} ${pr ? 'pr' : ''}">${on ? (pr ? '!' : '✕') : mk ? '−★' : pr ? '!' : ''}</i>`; }).join('')}</div>
    <div class="lkey"><span>3, 6, 9: lose a star</span><span>10: principal is told</span></div>
    <p class="note">Strikes start again when the jar hits ${R.paydayStars} stars.</p></section>`;
}
function logCard(k, asDad) {
  const logs = Store.col(`kids/${k}/log`).sort(byAtDesc).slice(0, 12);
  if (!logs.length) return '';
  return `<section class="card"><div class="ch"><span class="badge b-lilac">📜</span><h3>Latest</h3></div>${logs.map(l => `<div class="logrow"><span class="li ${l.type === 'star' ? 's' : l.type === 'carry' ? 'c' : 'k'}">${l.type === 'strike' ? '✕' : '★'}</span>
    <span class="grow">${l.type === 'strike' ? `Strike${l.count ? ` ${l.count}` : ''}${l.takesStar ? ' (−1 ★)' : ''}` : `+${Number(l.n) || 1} ★`} · ${esc(l.reason || '')}</span><time>${ago(l.at)}</time>
    ${asDad && l.type !== 'carry' ? `<button class="x-btn" data-act="undoLog" data-k="${esc(k)}" data-id="${esc(l.id)}" aria-label="Undo">↺</button>` : ''}</div>`).join('')}</section>`;
}
function shopCard(k) {
  const n = starsOf(k), red = Store.col(`kids/${k}/redeemed`).sort(byAtDesc);
  const pending = red.filter(r => r.status === 'pending'), done = red.filter(r => r.status === 'done').slice(0, 3);
  return `<section class="card"><div class="ch"><span class="badge b-pink">🎁</span><h3>Spend or save?</h3></div>
    ${pending.map(r => `<div class="ticket"><span class="e">${esc(r.emoji)}</span><span class="grow"><b>${esc(r.title)}</b><small>Waiting for Dad · ${ago(r.at)}</small></span></div>`).join('')}
    ${done.map(r => `<div class="ticket" style="background:var(--good-soft)"><span class="e">${esc(r.emoji)}</span><span class="grow"><b>${esc(r.title)}</b><small style="color:#0F6B44">Done ✓</small></span></div>`).join('')}
    <div class="rewards">${rewardsList().map(r => { const can = n >= r.cost;
      return `<button class="reward ${can ? 'can' : ''}" data-act="rewardOpen" data-id="${esc(r.id)}"><span class="re">${esc(r.e)}</span><b>${esc(r.t)}</b><p>${esc(r.d)}</p><span class="rf"><span class="cost">★ ${r.cost}</span>
      <span class="get">${can ? 'Get it' : `${r.cost - n} more`}</span></span></button>`; }).join('')}</div>
    <p class="note">Stars you spend come out of your jar, so your $${rules().paydayDollars} takes a bit longer.</p></section>`;
}

function tabRewards() {
  if (isParent()) {
    const k = S.ui.rk && S.ui.rk !== 'me' ? S.ui.rk : selKid(), p = P(k);
    if (!p) return '<h1 class="page-title">Rewards</h1>';
    const sister = kids().find(x => x.id !== k), R = rules(), next = strikesOf(k) + 1;
    const reasons = ['Helped out', `Kind to ${sister ? sister.nick || sister.name : 'family'}`, 'Tidied up', 'Brave', 'Listened first time', 'Great effort', 'Homework done'];
    const pending = Store.col(`kids/${k}/redeemed`).filter(r => r.status === 'pending');
    return `<h1 class="page-title"><span>🏆</span>Rewards</h1>${kidChips(false)}${jarCard(k)}${paydayCards(k, true)}
      <section class="card"><div class="ch"><span class="badge b-gold">⭐</span><h3>Give ${esc(p.nick || p.name)} a star</h3></div>
        <div class="reasons">${reasons.map(r => `<button data-act="giveStar" data-k="${esc(k)}" data-r="${esc(r)}" data-n="1">★ ${esc(r)}</button>`).join('')}<button data-act="giveStar" data-k="${esc(k)}" data-r="Big win" data-n="3">★ Big win +3</button></div></section>
      <section class="card"><div class="ch"><span class="badge" style="background:var(--bad)">✖️</span><h3>Give a strike</h3><em>${next >= R.principalAt ? `#${next}: principal` : next % R.strikesPerStar === 0 ? `#${next} takes a ★` : `would be #${next}`}</em></div>
        <div class="reasons bad">${['Not listening', 'Unkind words', "Didn't tidy up", 'Screen time over'].map(r => `<button data-act="giveStrike" data-k="${esc(k)}" data-r="${esc(r)}">✕ ${esc(r)}</button>`).join('')}</div></section>
      ${pending.length ? `<section class="card"><div class="ch"><span class="badge b-pink">🎟️</span><h3>Her tickets</h3></div>${pending.map(r => `<div class="wait"><span class="e">${esc(r.emoji)}</span><span class="tt"><b>${esc(r.title)}</b><small>★${r.cost} · ${ago(r.at)}</small></span><span class="acts"><button class="btn blue small" data-act="redSet" data-k="${esc(k)}" data-id="${esc(r.id)}" data-s="done">Done</button><button class="btn small" data-act="redSet" data-k="${esc(k)}" data-id="${esc(r.id)}" data-s="declined">Not now</button></span></div>`).join('')}</section>` : ''}
      ${strikesCard(k)}${logCard(k, true)}`;
  }
  const me = S.me.id;
  return `<h1 class="page-title"><span>🏆</span>My Rewards</h1>${principalCard(me)}${jarCard(me)}${paydayCards(me, false)}${trailCard(me)}${shopCard(me)}${strikesCard(me)}${logCard(me, false)}`;
}

/* ---------- Family ---------- */
function famChips() {
  const sub = S.sub || 'cal';
  const list = [['cal', '📅', 'Calendar'], ['week', '🧭', isParent() ? "Girls' week" : 'My week'], ['notes', '💬', 'Notes'], ['ideas', '💡', 'Ideas']];
  return `<div class="chips">${list.map(([id, e, t]) => `<button class="${sub === id ? 'on' : ''}" data-act="sub" data-sub="${id}">${e} ${t}</button>`).join('')}</div>`;
}
function tabFamily() {
  const sub = S.sub || 'cal';
  const body = sub === 'week' ? (isParent() ? girlsWeek() : myWeek(S.me.id)) : sub === 'notes' ? notesPage() : sub === 'ideas' ? ideasPage() : calPage();
  return `<h1 class="page-title"><span>👨‍👧‍👧</span>Family</h1>${famChips()}${body}`;
}

function calPage() {
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i)));
  const sel = S.ui.calSel || today();
  const m = S.ui.calMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const y = m.getFullYear(), mo = m.getMonth(), first = new Date(y, mo, 1), offset = (first.getDay() + 6) % 7, n = new Date(y, mo + 1, 0).getDate(), t = today();
  let cells = ''; for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let dd = 1; dd <= n; dd++) {
    const s = ymd(new Date(y, mo, dd)), h = homeFor(s), ev = eventsOn(s).length + notesOn(s).length, ov = Store.get('stays/' + s);
    cells += `<button class="cday h-${h} ${s === t ? 'is-today' : ''} ${s === sel ? 'is-sel' : ''} ${s < t ? 'past' : ''}" data-act="calDay" data-d="${s}" aria-label="${fmtShort(s)}, ${homeName(h)}">${dd}${ev ? '<i class="evdot"></i>' : ''}${ov && isParent() ? '<i class="ov"></i>' : ''}</button>`;
  }
  const sh = homeFor(sel), sev = eventsOn(sel), sn = notesOn(sel), r = roster();
  return `<div class="strip">${days.map((d, i) => { const dt = parseYmd(d), h = homeFor(d); return `<button class="${sel === d ? 'on' : ''}" data-act="calSel" data-d="${d}">${i === 0 ? 'Today' : DOW[dt.getDay()]}<b>${dt.getDate()}</b><span class="hd ${h}"></span></button>`; }).join('')}</div>
    <section class="card"><div class="ch"><span class="badge b-blue">📅</span><h3>${esc(fmtShort(sel))}</h3><em>${esc(homeName(sh))}</em></div>
      ${sev.map(e => `<div class="evrow"><span class="e">${esc(e.emoji || '📌')}</span><span class="grow"><b>${esc(e.title)}</b><small>${e.time ? fmtTime(e.time) : 'All day'} · ${!e.who || e.who === 'all' ? 'Whole crew' : esc(short(e.who))}</small></span>${isParent() || e.by === S.me.id ? `<button class="x-btn" data-act="delEvent" data-id="${esc(e.id)}" aria-label="Delete">✕</button>` : ''}</div>`).join('')}
      ${sn.map(nn => `<div class="evrow"><span class="e">📝</span><span class="grow"><b>${esc(nn.text)}</b><small>${nn.time ? fmtTime(nn.time) : ''}${nn.priv ? ' · just you' : ''}</small></span></div>`).join('')}
      ${sev.length || sn.length ? '' : '<p class="note">Nothing on yet.</p>'}
      <div class="row" style="flex-wrap:wrap"><button class="btn solid small" data-act="addEvent">＋ Add to this day</button>${isParent() ? `<button class="btn small" data-act="flipHome" data-d="${sel}">Make it ${sh === 'dad' ? "Mum's" : "Dad's"}</button>${Store.get('stays/' + sel) ? `<button class="btn small" data-act="clearHome" data-d="${sel}">Back to usual</button>` : ''}` : ''}</div></section>
    <section class="card"><div class="calhead"><button class="iconbtn" data-act="calMove" data-n="-1" aria-label="Previous month">‹</button><h3>${MONL[mo]} ${y}</h3><button class="iconbtn" data-act="calMove" data-n="1" aria-label="Next month">›</button></div>
      <div class="legend"><span class="h-dad">🏠 Dad's</span><span class="h-mum">🏠 Mum's</span></div>
      <div class="calgrid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="dow">${x}</span>`).join('')}${cells}</div>
      ${!r?.pattern ? `<p class="note">${isParent() ? 'Set the weekly house pattern in Settings.' : "Dad hasn't set the house plan yet."}</p>` : ''}</section>`;
}

function myWeek(k) {
  const off = S.ui.weekOff || 0, days = weekDays(off), t = today();
  const sel = days.includes(S.ui.weekSel) ? S.ui.weekSel : days.includes(t) ? t : days[0];
  const picks = d => Store.get(`kids/${k}/week/${d}`) || {};
  const started = days.filter(d => { const x = picks(d); return x.place || x.food || x.note; }).length;
  const cur = picks(sel), r = rhythm();
  return `<span class="brush">YOUR WEEK, YOUR SAY</span>
    <p class="caps">WHAT WOULD FEEL <mark>GOOD</mark> THIS WEEK?</p>
    <span class="started"><b>${started}</b> ${started === 1 ? 'DAY' : 'DAYS'} STARTED ★</span>
    <div class="wknav"><button class="iconbtn" data-act="weekOff" data-n="-1" ${off <= -1 ? 'disabled' : ''} aria-label="Last week">‹</button><b>${off === 0 ? 'This week' : off === 1 ? 'Next week' : 'Last week'}</b><button class="iconbtn" data-act="weekOff" data-n="1" ${off >= 1 ? 'disabled' : ''} aria-label="Next week">›</button></div>
    <div class="days">${days.map(d => { const x = picks(d), pl = placeOf(x.place); return `<button class="${d === sel ? 'on' : ''} ${d === t ? 'today' : ''}" data-act="weekSel" data-d="${d}">${DOW[parseYmd(d).getDay()]}<i>${x.place || x.food ? '♥' : '♡'}</i><small>${esc(pl ? pl.t : '?')}</small></button>`; }).join('')}</div>
    <div class="sbox"><h4>WHERE WOULD YOU LIKE TO BE? <span>· ${esc(fmtShort(sel))}</span></h4>
      <div class="places">${places().map(pl => `<button class="${cur.place === pl.id ? 'on' : ''}" data-act="pickPlace" data-d="${sel}" data-v="${esc(pl.id)}">${esc(pl.e || '✿')} ${esc(pl.t)}</button>`).join('')}</div>
      <p class="note">No reason needed. You can change it any time.</p></div>
    <div class="sbox"><h4>WHAT WOULD YOU LIKE TO EAT?</h4>
      <div class="ftiles">${FOODS.map(f => `<button class="${cur.food === f.id ? 'on' : ''}" data-act="pickFood" data-d="${sel}" data-v="${f.id}" aria-label="${esc(f.t)}"><img src="/img/food-${f.id}.webp" alt="${esc(f.t)}"></button>`).join('')}</div></div>
    <div class="sbox"><h4>ANYTHING ELSE FOR ${esc(DOW[parseYmd(sel).getDay()].toUpperCase())}?</h4>
      <textarea id="weekNote" rows="2" maxlength="200" placeholder="Like: can we have a movie night?">${esc(cur.note || '')}</textarea>
      <button class="btn small" data-act="saveWeekNote" data-d="${sel}">Save my note</button></div>
    <div class="tcard"><div><b>TIME THAT IS CLEAR AND KIND</b><span>🌙 <em>${r.quiet} min</em> quiet time, then ✦ <em>${r.our} min</em> just us</span></div>${hasArt('hug') ? '<img src="/art/hug" alt="">' : '<span style="font-size:52px;text-align:center">🤗</span>'}</div>`;
}

function girlsWeek() {
  const ks = kids(), k = S.ui.weekKid && P(S.ui.weekKid) ? S.ui.weekKid : ks[0]?.id;
  if (!k) return '';
  const off = S.ui.dadWeekOff || 0, days = weekDays(off), r = rhythm();
  const planPlace = d => { const h = homeFor(d); return h === 'dad' || h === 'mum' ? h : null; };
  const rows = days.map(d => {
    const x = Store.get(`kids/${k}/week/${d}`) || {}, want = placeOf(x.place), plan = planPlace(d), food = FOODS.find(f => f.id === x.food);
    const diff = x.place && plan && x.place !== plan;
    return `<div class="r"><b>${DOW[parseYmd(d).getDay()]}</b><span class="c ${diff ? 'diff' : ''}">${want ? `${esc(want.e || '')} ${esc(want.t)}` : '<span class="muted">Not picked</span>'}${food ? ` · ${esc(food.t)}` : ''}${x.note ? `<small>"${esc(x.note)}"</small>` : ''}</span><span class="c">${plan ? esc(placeOf(plan)?.t || homeName(plan)) : homeName(homeFor(d))}</span></div>`;
  }).join('');
  return `<div class="chips">${ks.map(x => `<button class="${x.id === k ? 'on' : ''}" data-act="weekKid" data-k="${esc(x.id)}">${avatar(x.id)}${esc(x.nick || x.name)}</button>`).join('')}</div>
    <div class="wknav"><button class="iconbtn" data-act="dadWeekOff" data-n="-1" ${off <= -1 ? 'disabled' : ''} aria-label="Last week">‹</button><b>${off === 0 ? 'This week' : off === 1 ? 'Next week' : 'Last week'}</b><button class="iconbtn" data-act="dadWeekOff" data-n="1" ${off >= 1 ? 'disabled' : ''} aria-label="Next week">›</button></div>
    <section class="card"><div class="vs"><div class="r hd"><span></span><span>${esc(P(k).nick || P(k).name)} would like</span><span>The plan</span></div>${rows}</div></section>
    <section class="card"><div class="ch"><span class="badge b-lilac">🌙</span><h3>Quiet time, then our time</h3></div><div class="row"><label class="grow t-s">Quiet (min)<input type="number" id="rhQuiet" min="0" max="240" value="${r.quiet}"></label><label class="grow t-s">Just us (min)<input type="number" id="rhOur" min="0" max="240" value="${r.our}"></label></div><button class="btn blue" data-act="saveRhythm">Save the promise</button></section>
    <p class="handnote" style="text-align:center;color:var(--ink2)">Wishes, not changes. Talk about it together.</p>`;
}

function postHtml(f) {
  const who = P(f.kid) ? f.kid : null, m = MOODS.find(x => x.id === f.mood);
  const hearts = Object.keys(f.hearts || {}).filter(k => f.hearts[k]), mine = hearts.includes(S.me.id);
  const cm = Store.col('comments').filter(c => c.post === f.id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return `<article class="post">${avatar(who || 'x')}<div class="bd">
    <div class="meta">${esc(who ? nick(who) : 'Someone')}${f.to && P(f.to) ? ` <span class="chip">to ${esc(P(f.to).name)}</span>` : ''}${f.type === 'idea' ? ' <span class="chip">wants to do this</span>' : m ? ` <span class="chip">${m.e} ${m.t}</span>` : ''}<time>${ago(f.at)}</time></div>
    ${f.text ? `<p class="txt">${esc(f.text)}</p>` : ''}${f.hug ? '<span class="chip" style="width:fit-content">🤗 Would love a hug</span>' : ''}
    ${cm.slice(-2).map(c => `<p class="cmt"><b>${esc(nick(c.who))}</b> ${esc(c.text)}</p>`).join('')}
    <div class="acts"><button class="${mine ? 'on' : ''}" data-act="heart" data-id="${esc(f.id)}" aria-pressed="${mine}">${mine ? '💗' : '🤍'} ${hearts.length ? hearts.map(h => esc(short(h))).join(', ') : 'Love'}</button>
      <button data-act="comment" data-id="${esc(f.id)}">💬 ${cm.length || 'Reply'}</button>
      ${isParent() || f.kid === S.me.id ? `<button data-act="postDel" data-id="${esc(f.id)}" aria-label="Remove message" style="margin-left:auto">✕</button>` : ''}</div></div></article>`;
}
function notesPage() {
  const posts = Store.col('feed').sort(byAtDesc), limit = S.ui.wallAll ? 40 : 10;
  return `<section class="card rose"><div class="ch"><span class="badge b-pink">💗</span><h3>Write to the family</h3></div>
      <div class="compose"><textarea id="msgText" rows="1" maxlength="280" placeholder="Proud of you because…" aria-label="Write to the family"></textarea><button class="btn solid small" data-act="msgSend">Post</button></div></section>
    ${posts.length ? `<section class="card">${posts.slice(0, limit).map(postHtml).join('')}${posts.length > limit ? '<button class="btn small" data-act="wallMore">Show more</button>' : ''}</section>` : '<div class="empty">No notes yet. Say hi!</div>'}`;
}
function ideasPage() {
  const all = ideasList(), f = S.ui.ideaFilter || 'all';
  const list = f === 'all' ? all : all.filter(i => (i.tags || []).includes(f));
  if (!S.ui.idea || !list.some(x => x.t === S.ui.idea)) S.ui.idea = list[new Date().getDate() % Math.max(1, list.length)]?.t;
  const it = list.find(x => x.t === S.ui.idea);
  return `<div class="chips">${IDEA_FILTERS.map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-act="ideaFilter" data-f="${k}">${t}</button>`).join('')}</div>
    ${it ? `<div class="ideacard ${S.ui.spun ? 'spin' : ''}"><span class="ie">${it.e}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div>
    <div class="row" style="flex-wrap:wrap;justify-content:center"><button class="btn solid" data-act="spin">✨ Spin again</button>${isKid() ? '<button class="btn" data-act="ideaPlan">＋ My planner</button><button class="btn" data-act="ideaAsk">💗 Ask Dad</button>' : '<button class="btn" data-act="ideaShare">📣 Suggest it</button>'}</div>` : '<div class="empty">No ideas here.</div>'}
    <div class="minis">${list.filter(x => x !== it).slice(0, 8).map(x => `<button data-act="ideaPick" data-t="${esc(x.t)}"><span>${x.e}</span>${esc(x.t)}</button>`).join('')}</div>`;
}

/* ---------- Me / Settings ---------- */
const backBtn = () => `<div class="backrow"><button class="btn small" data-act="sub" data-sub="">‹ Back</button></div>`;
function tabMe() {
  if (isParent()) return S.sub === 'phones' ? phonesPage() : S.sub === 'settings' ? settingsPage() : parentMenu();
  const k = S.me.id;
  if (S.sub === 'journal') return journalPage(k);
  if (S.sub === 'mine') return minePage(k);
  if (S.sub === 'planner') return plannerPage(k);
  if (S.sub === 'wish') return wishPage(k);
  const p = P(k), b = buddyOf(k);
  return `<div class="profile">${picEdit(k)}<div><h1>${esc(p.name)}</h1><p>${esc(p.title || '')}</p><p>⭐ ${starsOf(k)} · 🔥 ${streakOf(k)} days${b ? ` · ${esc(b.name)}` : ''}</p></div></div>
    <div class="tiles">
      <button class="c-lilac" data-act="sub" data-sub="journal"><i>📓</i><b>My Journal</b><small>Private unless you share</small></button>
      <button class="c-pink" data-act="sub" data-sub="mine"><i>🎨</i><b>Make it mine</b><small>Picture, buddy, look</small></button>
      <button class="c-mint" data-act="sub" data-sub="planner"><i>🗓️</i><b>My Planner</b><small>${Store.col(`kids/${k}/plans`).filter(x => !x.done).length} to do</small></button>
      <button class="c-sun" data-act="sub" data-sub="wish"><i>🎁</i><b>Wishlist</b><small>${Store.col(`kids/${k}/wishlist`).length} wishes</small></button>
      ${pushTile('c-blue')}
      <button class="c-mint" data-act="sound"><i>${Snd.on ? '🔊' : '🔈'}</i><b>Sounds</b><small>${Snd.on ? 'On' : 'Off'}</small></button>
      <button class="c-ocean" data-act="signOut"><i>👋</i><b>Sign out</b><small>Your code brings you back</small></button>
    </div>`;
}

function journalPage(k) {
  const p = P(k), entries = Store.col(`kids/${k}/journal`).sort(byAtDesc);
  const color = p.journalColor || COVERS[0], stk = p.journalStickers?.length ? p.journalStickers : ['⭐', '💖', '🌈'];
  const prompt = JOURNAL_PROMPTS[new Date().getDate() % JOURNAL_PROMPTS.length];
  return `${backBtn()}<div class="lockline">🔒 <span>Only you can read your journal. Dad sees a page only if you share it.</span></div>
    <button class="cover" data-act="journalNew" style="background:${esc(color)}"><span class="stk">${stk.map(s => `<span>${esc(s)}</span>`).join('')}</span><span><h3>${esc(p.journalTitle || p.name + "'s Journal")}</h3><span class="handnote">${entries.length} ${entries.length === 1 ? 'page' : 'pages'} · tap to write</span></span></button>
    <div class="row"><div class="prompt grow">✏️ ${esc(prompt)}</div><button class="btn small" data-act="coverEdit">🎨 Cover</button></div>
    ${entries.length ? entries.map(j => { const m = MOODS.find(x => x.id === j.mood);
      return `<article class="jp"><div class="jh">${j.sticker ? `<span style="font-size:22px">${esc(j.sticker)}</span>` : ''}<b>${esc(j.title || 'My page')}</b>${m ? `<span>${m.e}</span>` : ''}<time>${ago(j.at)}</time><button class="x-btn" data-act="journalDel" data-id="${esc(j.id)}" aria-label="Delete page">🗑️</button></div>
      <p>${esc(j.body)}</p><button class="share" data-act="journalShare" data-id="${esc(j.id)}" aria-pressed="${!!j.shared}"><span class="tog ${j.shared ? 'on' : ''}"></span>${j.shared ? '<span style="color:var(--good)">Shared with Dad ✓</span>' : '<span class="muted">Just me</span>'}</button></article>`; }).join('')
      : '<div class="empty">No pages yet. Tap the cover to write your first one.</div>'}`;
}

function minePage(k) {
  const p = P(k), b = p.buddy, th = p.theme || 'classic', ac = p.accent || 'pink';
  return `${S.ui.intro ? `<div class="backrow"></div><div class="banner good">🎉 <span>You're in! Pick your buddy and how Yumi looks. You can change it any time.</span></div>` : backBtn()}
    <h1 class="t-b">Make it mine</h1>
    <section class="card"><div class="ch"><span class="badge b-pink">📷</span><h3>My picture</h3></div>
      <div class="picrow">${picEdit(k)}<div class="col">
        <label class="btn solid">📷 New picture<input type="file" accept="image/*" data-pic="${esc(k)}" class="vh"></label>
        ${p.pic ? `<button class="btn" data-act="picClear" data-k="${esc(k)}">Use my old one</button>` : '<small class="note">Take a selfie or pick one from your photos.</small>'}
      </div></div></section>
    <div class="bgrid">${BUDDIES.map(x => `<button class="bcard ${b === x.id ? 'on' : ''}" data-act="setMine" data-f="buddy" data-v="${x.id}" aria-pressed="${b === x.id}">${buddyImg(x, '')}<b>${esc(x.name)}</b><small>${esc(x.what)}</small></button>`).join('')}</div>
    <section class="card"><div class="ch"><span class="badge b-pink">🎀</span><h3>My look</h3></div><div class="thm">${THEMES.map(([id, t]) => `<button class="${id} ${th === id ? 'on' : ''}" data-act="setMine" data-f="theme" data-v="${id}">${t}</button>`).join('')}</div></section>
    <section class="card"><div class="ch"><span class="badge b-lilac">🎨</span><h3>My colour</h3></div><div class="swatches">${Object.entries(ACCENTS).map(([id, c]) => `<button style="background:${c}" class="${ac === id ? 'on' : ''}" data-act="setMine" data-f="accent" data-v="${id}" aria-label="${id}">${ac === id ? '✓' : ''}</button>`).join('')}</div></section>
    ${S.ui.intro ? `<section class="card"><div class="ch"><span class="badge b-blue">📲</span><h3>Keep Yumi on your Home Screen</h3></div><p class="note">iPhone: tap Share ↑ then Add to Home Screen. Android: tap ⋮ then Add to Home screen. You'll stay signed in until you tap Sign out.</p></section>
      <button class="btn solid wide" data-act="introDone">All done!</button>` : ''}`;
}

function plannerPage(k) {
  const t = today(), items = Store.col(`kids/${k}/plans`);
  const open = items.filter(x => !x.done), done = items.filter(x => x.done).sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || ''))).slice(0, 6);
  const late = open.filter(x => x.date && x.date < t), tod = open.filter(x => x.date === t), soon = open.filter(x => x.date && x.date > t).sort((a, b) => a.date.localeCompare(b.date)), some = open.filter(x => !x.date).sort(byAtDesc);
  const row = x => `<div class="todo ${x.done ? 'done' : ''}" style="--tc:${esc(x.color || 'var(--accent)')}"><button class="ck2" data-act="planToggle" data-id="${esc(x.id)}" aria-label="Done: ${esc(x.title)}">${x.done ? '✓' : ''}</button><span class="tt"><b>${esc(x.title)}</b>${x.date ? `<small>${x.date === t ? 'Today' : fmtShort(x.date)}</small>` : ''}</span><button class="x-btn" data-act="planDel" data-id="${esc(x.id)}" aria-label="Delete">✕</button></div>`;
  const grp = (title, arr) => arr.length ? `<p class="sec-title">${title}</p>${arr.map(row).join('')}` : '';
  const pc = S.ui.planColor || PLAN_COLORS[0];
  return `${backBtn()}<h1 class="t-b">🗓️ My planner</h1>
    <section class="card"><input type="text" id="planTitle" maxlength="80" placeholder="What do you want to do?">
      <div class="row"><input type="date" id="planDate" style="flex:1" aria-label="Day (optional)"><div class="colors">${PLAN_COLORS.map(c => `<button style="background:${c}" class="${pc === c ? 'on' : ''}" data-act="planColor" data-c="${c}" aria-label="Colour"></button>`).join('')}</div></div>
      <button class="btn solid" data-act="planAdd">Add to my planner</button></section>
    ${open.length || done.length ? grp('Missed it', late) + grp('Today', tod) + grp('Coming up', soon) + grp('Some day', some) + grp('Done', done) : '<div class="empty">Your planner is empty. Add your first thing above.</div>'}`;
}

function wishPage(k) {
  const list = Store.col(`kids/${k}/wishlist`).sort((a, b) => (a.got ? 1 : 0) - (b.got ? 1 : 0) || (b.hearts || 1) - (a.hearts || 1) || byAtDesc(a, b));
  return `${backBtn()}<div class="row"><h1 class="t-b grow">🎁 My wishlist</h1><button class="btn solid small" data-act="wishNew">＋ Add</button></div>
    ${list.length ? list.map(w => `<div class="wish ${w.got ? 'got' : ''}"><span class="e">${esc(w.emoji || '🎁')}</span><span class="tt"><b>${esc(w.title)}</b>${w.note ? `<small>${esc(w.note)}</small><br>` : ''}<span class="hearts">${'♥'.repeat(w.hearts || 1)}</span></span>${w.got ? '<span class="btn good small">Got it!</span>' : ''}<button class="x-btn" data-act="wishDel" data-id="${esc(w.id)}" aria-label="Delete">✕</button></div>`).join('')
      : '<div class="empty">What are you dreaming of? Add it to your wishlist.</div>'}`;
}

function parentMenu() {
  const p = P(S.me.id);
  return `<div class="profile">${picEdit(S.me.id)}<div><h1>${esc(p.name)}</h1><p>${esc(p.title || 'Parent')}</p><p>🔥 ${Number(p.pub?.streak) || 0} day streak</p></div></div>
    <div class="tiles">
      <button class="c-lilac" data-act="sub" data-sub="phones"><i>📱</i><b>Phones</b><small>Add a phone, codes</small></button>
      <button class="c-blue" data-act="sub" data-sub="settings"><i>🏠</i><b>Houses &amp; goal</b><small>Pattern, places, family goal</small></button>
      <button class="c-mint" data-act="goGirlsWeek"><i>🧭</i><b>Girls' week</b><small>What they'd like</small></button>
      <a class="c-sun" href="/api/export" download><i>💾</i><b>Backup</b><small>Download everything</small></a>
      ${pushTile('c-pink')}
      <button class="c-mint" data-act="sound"><i>${Snd.on ? '🔊' : '🔈'}</i><b>Sounds</b><small>${Snd.on ? 'On' : 'Off'}</small></button>
      <button class="c-ocean" data-act="signOut"><i>👋</i><b>Sign out</b><small>Your code brings you back</small></button>
    </div>`;
}

function phonesPage() {
  const pc = S.ui.pair, devs = S.ui.devices;
  if (!devs && !S.ui.devLoading) S.loadDevices?.();
  const left = pc ? Math.max(0, Math.round((pc.until - Date.now()) / 1000)) : 0;
  const ln = S.ui.link;
  return `${backBtn()}<h1 class="t-b">📱 Phones</h1>
    <section class="card"><div class="ch"><span class="badge b-pink">💌</span><h3>Send the girls their link</h3></div>
      ${ln ? `<p class="note">${esc(short(ln.who))}'s link is ready. Send it by Messages and she taps it on her phone.</p>
        <div class="linkbox">${esc(ln.url)}</div>
        <div class="row" style="flex-wrap:wrap"><button class="btn solid" data-act="linkShare">Send it ↑</button><button class="btn" data-act="linkCopy">Copy</button><button class="btn small" data-act="linkDone">Done</button></div>
        <p class="note">Works once, until this time tomorrow. If she's asked for a code, it's <b>${esc(ln.code.slice(0, 3))} ${esc(ln.code.slice(3))}</b>.</p>`
      : `<p class="note">Makes a link that adds her phone. It works once, for a day. On an iPhone it shows her how to put Yumi on her Home Screen, so she gets notifications too.</p>
        <div class="row" style="flex-wrap:wrap">${kids().map(k => `<button class="btn" data-act="linkMake" data-k="${esc(k.id)}">${avatar(k.id)}${esc(k.nick || k.name)}'s link</button>`).join('')}</div>`}</section>
    <section class="card"><div class="ch"><span class="badge b-lilac">📲</span><h3>Add a phone</h3></div>
      ${pc && left > 0 ? `<p class="note">On ${esc(nick(pc.who))}'s phone, open the Yumi link and type:</p>
        <div class="code6">${esc(pc.code.slice(0, 3))}&nbsp;${esc(pc.code.slice(3))}</div>
        <p class="note" style="text-align:center">Works for ${Math.ceil(left / 60)} more ${Math.ceil(left / 60) === 1 ? 'minute' : 'minutes'} · one phone only</p>
        <ol class="steps-howto"><li>Code accepted: "This phone is for ${esc(P(pc.who)?.name || '')} ♡"</li>${P(pc.who)?.role === 'kid' && !pc.hasCode ? '<li>She picks her 4-number code and her buddy</li>' : ''}<li>Share ↑ › Add to Home Screen</li><li>Done. It stays signed in until someone taps Sign out</li></ol>
        <button class="btn small" data-act="pairDone">Close</button>`
      : `<p class="note">Phone right here? You'll get a code to type in that works once, for 10 minutes.</p><div class="row" style="flex-wrap:wrap">${people().map(p => `<button class="btn" data-act="pairMake" data-k="${esc(p.id)}">${avatar(p.id)}${esc(p.role === 'kid' ? p.nick || p.name : p.name)}</button>`).join('')}</div>`}</section>
    <section class="card"><div class="ch"><span class="badge b-pink">🔢</span><h3>The girls' codes</h3></div>${kids().map(k => `<div class="devrow">${avatar(k.id)}<span class="tt"><b>${esc(k.name)}</b><small>${k.hasCode ? 'Has a 4-number code' : 'No code yet. She picks one when her phone is added.'}</small></span><button class="btn small" data-act="kidCode" data-k="${esc(k.id)}">${k.hasCode ? 'Change' : 'Set'}</button></div>`).join('')}
      <p class="note">Forgot her code? Set a new one here and tell her.</p></section>
    <section class="card"><div class="ch"><span class="badge b-blue">📱</span><h3>Signed-in phones</h3></div>
      ${!devs ? '<p class="note">Loading…</p>' : devs.devices?.length ? devs.devices.map(d => `<div class="devrow"><span class="tt"><b>${esc(d.label || 'Device')}${d.id === devs.mine ? ' (this one)' : ''}</b><small>${d.person ? `Last used by ${esc(short(d.person))} · ` : ''}${ago(d.lastSeen)}${d.signedIn ? '' : ' · signed out'}</small></span>${d.id === devs.mine ? '' : `<button class="btn small" data-act="forget" data-id="${esc(d.id)}">Remove</button>`}</div>`).join('') : '<p class="note">No phones yet.</p>'}
      <p class="note">Remove a lost phone and it's signed out straight away.</p></section>`;
}

function settingsPage() {
  const r = roster() || { pattern: {} }, pat = S.ui.pattern || r.pattern || {};
  const lab = v => v === 'mum' ? 'Mum' : v === 'dad' ? 'Dad' : v === 'alt' ? 'Swap' : '—';
  const nextTue = (() => { let d = new Date(); while (d.getDay() !== 2) d = addDays(d, 1); return d; })();
  const g = Store.get('settings/goal') || {};
  return `${backBtn()}<h1 class="t-b">🏠 Houses &amp; goal</h1>
    <section class="card"><div class="ch"><span class="badge b-blue">🏠</span><h3>Weekly house pattern</h3></div>
      <div class="pattern">${[1, 2, 3, 4, 5, 6, 0].map(dw => { const v = pat[dw] || ''; return `<button class="h-${v === 'alt' ? 'swap' : v || 'unknown'}" data-act="patDay" data-dow="${dw}"><b>${DOW[dw]}</b>${lab(v)}</button>`; }).join('')}</div>
      <p class="note">Tap a day to switch Dad › Mum › Swap. Swap days go back and forth each week.</p>
      ${Object.values(pat).includes('alt') ? `<p class="note">Which swap day is Mum's? ${[nextTue, addDays(nextTue, 7)].map(d => `<button class="btn small ${r.altMumTuesday === ymd(d) ? 'blue' : ''}" data-act="setAlt" data-d="${ymd(d)}">${fmtShort(ymd(d))}</button>`).join(' ')}</p>` : ''}
      <button class="btn blue" data-act="savePattern">Save pattern</button></section>
    <section class="card"><div class="ch"><span class="badge b-mint">🧭</span><h3>Places the girls can pick</h3></div>
      ${places().map(p => `<div class="devrow"><span class="tt"><b>${esc(p.e || '✿')} ${esc(p.t)}</b></span>${['dad', 'mum'].includes(p.id) ? '' : `<button class="btn small" data-act="placeDel" data-id="${esc(p.id)}">Remove</button>`}</div>`).join('')}
      <div class="row"><input type="text" id="placeIn" maxlength="24" placeholder="Like: Nan's"><button class="btn blue small" data-act="placeAdd">Add</button></div></section>
    <section class="card"><div class="ch"><span class="badge b-gold">🎯</span><h3>Family goal</h3></div>
      <input type="text" id="gTitle" maxlength="40" placeholder="Beach day" value="${esc(g.title || '')}">
      <div class="row"><input type="text" id="gEmoji" maxlength="4" style="width:76px" value="${esc(g.emoji || '🎯')}" aria-label="Emoji"><input type="number" id="gTarget" min="10" max="1000" value="${Number(g.target) || 100}" aria-label="Stars needed"></div>
      <p class="note">Every star the girls earn from now on fills it.</p><button class="btn blue" data-act="goalSave">Start this goal</button></section>
    <section class="card"><div class="ch"><span class="badge b-lilac">🔐</span><h3>My code</h3></div>
      <input type="tel" inputmode="numeric" id="oldCode" maxlength="6" placeholder="Current 6-number code" autocomplete="off">
      <input type="tel" inputmode="numeric" id="newCode" maxlength="6" placeholder="New 6-number code" autocomplete="off">
      <button class="btn blue" data-act="changeCode">Change my code</button></section>
    <p class="note" style="text-align:center">Yumi · ${esc(famName())} · ${esc(S.boot?.version || '')}</p>`;
}

/* ---------- Dad's "Waiting for you" ---------- */
export function waitingItems() {
  const items = [];
  for (const k of kids()) {
    for (const p of Store.col(`kids/${k.id}/payday`).filter(x => x.status !== 'paid')) items.push({ at: p.at, html: `<div class="wait goodbg"><span class="e">💵</span><span class="tt"><b>${esc(k.name)} filled her jar! Pay her $${p.amount}</b><small>100 stars · ${ago(p.at)}</small></span><button class="btn good small" data-act="paid" data-k="${esc(k.id)}" data-id="${esc(p.id)}">Paid</button></div>` });
    for (const r of Store.col(`kids/${k.id}/redeemed`).filter(x => x.status === 'pending')) items.push({ at: r.at, html: `<div class="wait"><span class="e">${esc(r.emoji)}</span><span class="tt"><b>${esc(k.name)} bought "${esc(r.title)}"</b><small>★${r.cost} · ${ago(r.at)}</small></span><span class="acts"><button class="btn blue small" data-act="redSet" data-k="${esc(k.id)}" data-id="${esc(r.id)}" data-s="done">Done</button><button class="btn small" data-act="redSet" data-k="${esc(k.id)}" data-id="${esc(r.id)}" data-s="declined">Not now</button></span></div>` });
  }
  for (const i of Store.col('inbox').filter(x => !x.seen && x.kind !== 'payday')) {
    const e = { strike: '⚠️', principal: '🏫', hug: '🤗', journal: '📓' }[i.kind] || '🔔';
    const btn = i.kind === 'journal' ? `<button class="btn blue small" data-act="readPage" data-id="${esc(i.id)}">Read</button>` : i.kind === 'hug' ? `<button class="btn good small" data-act="seen" data-id="${esc(i.id)}">Hugged ✓</button>` : `<button class="btn ink small" data-act="seen" data-id="${esc(i.id)}">Seen</button>`;
    items.push({ at: i.at, html: `<div class="wait ${i.kind === 'strike' || i.kind === 'principal' ? 'warn' : ''}"><span class="e">${e}</span><span class="tt"><b>${esc(i.title)}</b><small>${esc(i.sub || '')} · ${ago(i.at)}</small></span>${btn}</div>` });
  }
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/* ---------- timer ---------- */
function timerPill() {
  const t = S.ui.timer;
  if (!t?.end) return '';
  const left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
  return `<button class="timerpill" id="timerPill" data-act="timerOpen">⏱️ <span id="timerLeft">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span> ${esc(t.label || '')}</button>`;
}
