/* A girl's own room: Today, My week, Stars, Journal, More. */
import { esc, Store, today, ymd, parseYmd, addDays, DOW, DOWL, MON, ago, byAtDesc, fmtShort, uid, nowIso, Snd, Confetti, toast, openSheet, closeSheet, pickRow, picked, act, queued, write, setDoc, mergeDoc, delDoc, ordinal } from './core.js';
import { S, P, kids, avatar, accentOf, nick, short, buddyOf, buddyImg, BUDDIES, THEMES, ACCENTS, MOODS, HARD_MOODS, FOODS, SLOTS, STARTER_ROUTINE,
  JOURNAL_PROMPTS, STICKERS, WISH_EMOJI, COVERS, PLAN_COLORS, homeFor, homeName, places, placeOf, rhythm, routineOf, dayOf, routineStats, moodToday,
  starsOf, strikesOf, cycleOf, streakSet, rewardsList, jobsFor, doneBy, rules, weekDays, isParent } from './model.js';

export const ROOM_TABS = [['today', '☀️', 'Today'], ['week', '🧭', 'My week'], ['stars', '⭐', 'Stars'], ['journal', '📓', 'Journal'], ['more', '•••', 'More']];

const defaultSlot = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'after' : 'bed'; };

export function viewRoom() {
  const k = S.me.id, p = P(k);
  const t = today(), h = homeFor(t);
  const body = { today: tabToday, week: tabWeek, stars: tabStars, journal: tabJournal, more: tabMore }[S.tab] || tabToday;
  const scrap = S.tab === 'week';
  return `<div class="screen ${scrap ? 'scrap' : 't-' + (p.theme || 'classic')}"><div class="main">
    <div class="row"><button class="home-btn" data-act="toFamily" aria-label="Family home">⌂</button><span class="grow t-s">${esc(DOWL[new Date().getDay()])}${h !== 'unknown' ? ` · ${esc(homeName(h))}` : ''}</span><button class="out" data-act="signOut">Sign out</button></div>
    ${scrap ? '' : `<div class="rhead">${avatar(k)}<span class="grow"><span class="t-b">${esc(p.name)}'s room</span></span><button class="pill" data-act="tab" data-tab="stars" aria-label="${starsOf(k)} stars"><span class="st">★</span>${starsOf(k)}</button></div>`}
    ${principalCard(k)}
    ${body(k)}
  </div>
  <nav class="nav">${ROOM_TABS.map(([id, e, t]) => `<button class="${S.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}" aria-current="${S.tab === id}"><i>${e}</i>${t}</button>`).join('')}</nav></div>`;
}

/* ---------- strike 10 message ---------- */
function principalCard(k) {
  const n = strikesOf(k);
  if (n < rules().principalAt) return '';
  const key = `yumi-principal-${k}-${P(k)?.pub?.cycleStart || ''}-${n}`;
  try { if (localStorage.getItem(key)) return ''; } catch (e) {}
  return `<div class="card" style="border:3px solid var(--bad)"><div class="big-msg"><span class="e">⚠️</span><h2>${n} strikes</h2>
    <p class="note" style="font-size:16px;color:var(--ink)">That's too many. Dad will let your principal know.</p>
    <p class="note">Strikes start again when you fill your jar to ${rules().paydayStars} stars.</p>
    <button class="btn ink" data-act="principalSeen" data-key="${esc(key)}">I understand</button></div></div>`;
}

/* ---------- buddy ---------- */
function buddyLine(k) {
  const p = P(k), b = buddyOf(k), hr = new Date().getHours(), rs = routineStats(k), left = rs.total - rs.done, stars = starsOf(k), toGo = rules().paydayStars - stars;
  const n = p.nick || p.name;
  const lines = [];
  if (hr < 12) lines.push(`Morning ${n}! ${left ? `${left} ${left === 1 ? 'thing' : 'things'} on your list today` : 'Your list is all done!'}`);
  else if (hr < 17) lines.push(`Hey ${n}! How was today?`);
  else lines.push(`Evening ${n}. Bedtime list next?`);
  if (toGo > 0 && toGo <= 10) lines.push(`Only ${toGo} more ★ to your $${rules().paydayDollars}!`);
  if (rs.total && !left) lines.push('Whole routine done. Superstar!');
  const line = lines[(new Date().getMinutes() + (S.ui.bump || 0)) % lines.length];
  if (!b) return `<button class="card" data-act="openMine" style="text-align:left"><h3>🐾 Pick your buddy</h3><p class="note">Koko, Cheri, Luna or Daisy can cheer you on.</p></button>`;
  return `<button class="buddy" data-act="buddyTap" aria-label="${esc(b.name)} says ${esc(line)}">${buddyImg(b)}<span class="bubble">${esc(line)} ${b.e}</span></button>`;
}

/* ---------- Today ---------- */
function tabToday(k) {
  return `${buddyLine(k)}${checkinCard(k)}${routineCard(k)}${streakLine(k)}${myJobs(k)}`;
}

function checkinCard(k) {
  const mood = S.ui.mood, m = MOODS.find(x => x.id === mood), posted = moodToday(k);
  return `<section class="card" aria-label="Check in"><h3>How are you today, ${esc(P(k).nick || P(k).name)}?</h3>
    <div class="moods" role="group" aria-label="Pick a feeling">${MOODS.map(x => `<button class="${mood === x.id ? 'on' : ''}" data-act="mood" data-mood="${x.id}" aria-pressed="${mood === x.id}"><i>${x.e}</i>${x.t}</button>`).join('')}</div>
    ${mood ? `<textarea id="moodText" rows="2" maxlength="280" placeholder="${esc(m?.q || 'Tell the crew how you feel…')}"></textarea>
      ${HARD_MOODS.includes(mood) ? '<label class="hug"><input type="checkbox" id="hugAsk"> I would love a hug from Dad</label>' : ''}
      <button class="btn solid" data-act="moodPost">Tell the crew</button>` : ''}
    ${posted ? `<p class="note">You told the crew you're feeling ${esc(posted.t.toLowerCase())} today ${posted.e}</p>` : ''}
  </section>`;
}

export function routineCard(k, asDad = false) {
  const all = routineOf(k), day = dayOf(k), done = new Set(day.done || []), rs = routineStats(k);
  const title = asDad ? `${esc(P(k).name)}'s routine` : 'My routine';
  if (!all.length) return `<section class="card"><h3>☀️ ${title}</h3><div class="empty">No routine yet.<br><br><button class="btn solid" data-act="useStarter" data-k="${esc(k)}">Use a starter routine</button></div></section>`;
  const slot = S.ui.slot || defaultSlot(), items = all.filter(r => r.slot === slot), editing = S.ui.editRoutine === k;
  return `<section class="card" aria-label="Routine"><h3>☀️ ${title} <em>${rs.done} of ${rs.total}</em></h3>
    <div class="slots">${SLOTS.map(sl => { const it = all.filter(r => r.slot === sl.id), dn = it.filter(r => done.has(r.id)).length;
      return `<button class="${sl.id} ${slot === sl.id ? 'on' : ''}" data-act="slot" data-slot="${sl.id}" aria-pressed="${slot === sl.id}">${it.length && dn === it.length ? '<span class="tick">✓</span>' : ''}<i>${sl.e}</i>${sl.t}<small>${dn}/${it.length}</small></button>`; }).join('')}</div>
    ${editing
      ? items.map(r => `<div class="stepedit"><span>${esc(r.e || '•')}</span><span class="grow">${esc(r.t)}</span><button class="x-btn" data-act="stepDel" data-k="${esc(k)}" data-id="${esc(r.id)}" aria-label="Remove ${esc(r.t)}">🗑️</button></div>`).join('') +
        `<div class="row"><input type="text" id="newStep" maxlength="60" placeholder="Add a step"><button class="btn solid small" data-act="stepAdd" data-k="${esc(k)}" data-slot="${slot}">Add</button></div>`
      : items.map(r => `<button class="step ${done.has(r.id) ? 'done' : ''}" data-act="step" data-k="${esc(k)}" data-id="${esc(r.id)}" aria-pressed="${done.has(r.id)}"><span class="e">${esc(r.e || '•')}</span><span class="t">${esc(r.t)}</span><span class="ck">${done.has(r.id) ? '✓' : ''}</span></button>`).join('') || '<div class="empty">Nothing here yet. Tap Edit to add a step.</div>'}
    <div class="row"><p class="note grow">${rs.done === rs.total ? `Whole routine done today. ★ ${day.starred ? 'Star earned!' : ''}` : `Finish every step today for a star. ${rs.total - rs.done} to go.`}</p><button class="btn small" data-act="editRoutine" data-k="${esc(k)}">${editing ? 'Done' : 'Edit'}</button></div>
  </section>`;
}

function streakLine(k) {
  const set = streakSet(k); let n = 0, d = new Date();
  if (!set.has(ymd(d))) d = addDays(d, -1);
  while (set.has(ymd(d))) { n++; d = addDays(d, -1); }
  const days = weekDays(0), t = today();
  return `<div class="streak"><span class="fire">🔥</span><span>${n ? `${n} day streak` : 'Finish your whole routine to start a streak'}</span>
    <span class="wkdots" aria-label="This week">${days.map((d, i) => `<span>${'MTWTFSS'[i]}<i class="${set.has(d) ? 'on' : ''} ${d === t ? 'today' : ''}">${set.has(d) ? '★' : ''}</i></span>`).join('')}</span></div>`;
}

export function taskRow(tk) {
  const by = doneBy(tk), mine = by.includes(S.me.id), t = today();
  const when = tk.daily ? 'Every day' : tk.date ? (tk.date === t ? 'Today' : tk.date < t ? `Since ${fmtShort(tk.date)}` : fmtShort(tk.date)) : 'Any time';
  const forWho = !tk.who || tk.who === 'all' ? 'Everyone' : short(tk.who);
  const canTick = !tk.who || tk.who === 'all' || tk.who === S.me.id;
  return `<div class="task ${mine ? 'done' : ''}">${canTick ? `<button class="tk" data-act="taskTick" data-id="${esc(tk.id)}" aria-pressed="${mine}" aria-label="${mine ? 'Untick' : 'Tick'} ${esc(tk.t)}">${mine ? '✓' : ''}</button>` : '<span class="tk" style="opacity:.3"></span>'}
    <span class="e">${esc(tk.e || '✅')}</span><span class="tt"><b>${esc(tk.t)}</b><small>${esc(forWho)} · ${when}</small></span>
    ${by.length ? `<span class="whos">${by.map(w => avatar(w)).join('')}</span>` : ''}
    ${tk.stars ? `<span class="st">+${tk.stars}★</span>` : ''}
    ${isParent() || tk.by === S.me.id ? `<button class="x-btn" data-act="taskDel" data-id="${esc(tk.id)}" aria-label="Delete ${esc(tk.t)}">✕</button>` : ''}</div>`;
}

function myJobs(k) {
  const list = jobsFor(k);
  return `<section class="card"><h3>✅ My jobs <em>stars go in my jar</em></h3>${list.length ? list.map(taskRow).join('') : '<div class="empty">No jobs today.</div>'}<button class="btn small" data-act="goJobs">All family jobs</button></section>`;
}

/* ---------- My week (Feel First) ---------- */
function tabWeek(k) {
  const off = S.ui.weekOff || 0, days = weekDays(off), t = today();
  const sel = days.includes(S.ui.weekSel) ? S.ui.weekSel : days.includes(t) ? t : days[0];
  const picks = d => Store.get(`kids/${k}/week/${d}`) || {};
  const started = days.filter(d => { const x = picks(d); return x.place || x.food || x.note; }).length;
  const cur = picks(sel), r = rhythm(), hug = P(k)?.art ? '/art/hug' : null;
  return `<span class="brush">YOUR WEEK, YOUR SAY</span>
    <p class="caps">WHAT WOULD FEEL <mark>GOOD</mark> THIS WEEK?</p>
    <div class="row"><span class="started"><b>${started}</b> ${started === 1 ? 'DAY' : 'DAYS'} STARTED ★</span></div>
    <div class="wknav"><button class="iconbtn" data-act="weekOff" data-n="-1" ${off <= -1 ? 'disabled' : ''} aria-label="Last week">‹</button><b>${off === 0 ? 'This week' : off === 1 ? 'Next week' : 'Last week'}</b><button class="iconbtn" data-act="weekOff" data-n="1" ${off >= 1 ? 'disabled' : ''} aria-label="Next week">›</button></div>
    <div class="days">${days.map(d => { const x = picks(d), pl = placeOf(x.place); return `<button class="${d === sel ? 'on' : ''} ${d === t ? 'today' : ''}" data-act="weekSel" data-d="${d}" aria-pressed="${d === sel}">${DOW[parseYmd(d).getDay()]}<i>${x.place || x.food ? '♥' : '♡'}</i><small>${esc(pl ? pl.t : '?')}</small></button>`; }).join('')}</div>
    <div class="sbox"><h4>WHERE WOULD YOU LIKE TO BE? <span>· ${esc(fmtShort(sel))}</span></h4>
      <div class="places">${places().map(pl => `<button class="${cur.place === pl.id ? 'on' : ''}" data-act="pickPlace" data-d="${sel}" data-v="${esc(pl.id)}">${esc(pl.e || '✿')} ${esc(pl.t)}</button>`).join('')}</div>
      <p class="note">No reason needed. You can change it any time.</p></div>
    <div class="sbox"><h4>WHAT WOULD YOU LIKE TO EAT?</h4>
      <div class="ftiles">${FOODS.map(f => `<button class="${cur.food === f.id ? 'on' : ''}" data-act="pickFood" data-d="${sel}" data-v="${f.id}" aria-label="${esc(f.t)}" aria-pressed="${cur.food === f.id}"><img src="/img/food-${f.id}.webp" alt="${esc(f.t)}"></button>`).join('')}</div></div>
    <div class="sbox"><h4>ANYTHING ELSE FOR ${esc(DOW[parseYmd(sel).getDay()].toUpperCase())}?</h4>
      <textarea id="weekNote" rows="2" maxlength="200" placeholder="Like: can we have a movie night?">${esc(cur.note || '')}</textarea>
      <button class="btn small" data-act="saveWeekNote" data-d="${sel}">Save my note</button></div>
    <div class="tcard"><div><b>TIME THAT IS CLEAR AND KIND</b><span>🌙 <em>${r.quiet} min</em> quiet time, then ✦ <em>${r.our} min</em> just us</span></div>${hug ? `<img src="${hug}" alt="">` : '<span style="font-size:48px;text-align:center">🤗</span>'}</div>
    <p class="note" style="text-align:center">Dad sees your picks next to the plan. They're wishes, so you can talk about them together.</p>`;
}

/* ---------- Stars ---------- */
export function jarCard(k) {
  const n = starsOf(k), R = rules(), pct = Math.min(100, Math.round(n / R.paydayStars * 100));
  return `<div class="jar"><div class="top"><span class="big">★</span><span><span class="n">${n}<small> / ${R.paydayStars}</small></span><br><span class="lbl">stars in ${S.me?.id === k ? 'my' : 'her'} jar</span></span></div>
    <div class="jarbar"><i style="width:${pct}%"></i></div>
    <div class="goal"><span>${R.paydayStars - n} more to go</span><span><b>${R.paydayStars} ★ = $${R.paydayDollars}</b> payday</span></div></div>`;
}

function paydays(k, asDad) {
  const list = Store.col(`kids/${k}/payday`).sort(byAtDesc);
  const pending = list.filter(p => p.status !== 'paid'), paid = list.filter(p => p.status === 'paid');
  return pending.map(p => `<div class="payday"><span class="e">💵</span><span class="grow"><b>${asDad ? `Pay ${esc(P(k).name)} $${p.amount}` : `Dad owes you $${p.amount}! 🎉`}</b><small>${asDad ? 'Her jar hit 100. Tap Paid once she has it.' : 'You filled your jar! Your stars and strikes start fresh.'}</small></span>${asDad ? `<button class="btn good small" data-act="paid" data-k="${esc(k)}" data-id="${esc(p.id)}">Paid</button>` : ''}</div>`).join('')
    + (paid.length ? `<p class="note">💰 ${paid.length} ${paid.length === 1 ? 'payday' : 'paydays'} so far: $${paid.reduce((a, p) => a + (Number(p.amount) || 0), 0)}</p>` : '');
}

export function strikesCard(k) {
  const n = strikesOf(k), R = rules(), taken = Math.floor(n / R.strikesPerStar);
  return `<section class="card"><h3>✕ Strikes <em>${n}${taken ? ` · ${taken} ★ taken` : ''}</em></h3>
    <div class="ladder" aria-label="${n} strikes">${Array.from({ length: R.principalAt }, (_, i) => { const s = i + 1, on = s <= n, mk = s % R.strikesPerStar === 0 && s < R.principalAt, pr = s === R.principalAt;
      return `<i class="${on ? 'on' : ''} ${mk ? 'mk' : ''} ${pr ? 'pr' : ''}">${on ? (pr ? '!' : '✕') : mk ? '−★' : pr ? '!' : ''}</i>`; }).join('')}</div>
    <div class="lkey"><span>3, 6, 9: lose a star</span><span>10: principal is told</span></div>
    <p class="note">Strikes start again when the jar hits ${R.paydayStars} stars.</p></section>`;
}

export function logCard(k, asDad) {
  const logs = Store.col(`kids/${k}/log`).sort(byAtDesc).slice(0, 12);
  if (!logs.length) return '';
  return `<section class="card"><h3>📜 Latest</h3>${logs.map(l => `<div class="logrow"><span class="li ${l.type === 'star' ? 's' : l.type === 'carry' ? 'c' : 'k'}">${l.type === 'strike' ? '✕' : '★'}</span>
    <span class="grow">${l.type === 'strike' ? `Strike${l.count ? ` ${l.count}` : ''}${l.takesStar ? ' (−1 ★)' : ''}` : `+${Number(l.n) || 1} ★`} · ${esc(l.reason || '')}</span><time>${ago(l.at)}</time>
    ${asDad && l.type !== 'carry' ? `<button class="x-btn" data-act="undoLog" data-k="${esc(k)}" data-id="${esc(l.id)}" aria-label="Undo">↺</button>` : ''}</div>`).join('')}</section>`;
}

function tabStars(k) {
  const n = starsOf(k), red = Store.col(`kids/${k}/redeemed`).sort(byAtDesc);
  const pending = red.filter(r => r.status === 'pending'), done = red.filter(r => r.status === 'done').slice(0, 3);
  return `${jarCard(k)}${paydays(k, false)}${strikesCard(k)}
    <section class="card"><h3>🎁 Spend now, or save for $${rules().paydayDollars}?</h3>
      ${pending.map(r => `<div class="ticket"><span class="e">${esc(r.emoji)}</span><span class="grow"><b>${esc(r.title)}</b><small>Waiting for Dad · ${ago(r.at)}</small></span></div>`).join('')}
      ${done.map(r => `<div class="ticket" style="background:var(--good-soft)"><span class="e">${esc(r.emoji)}</span><span class="grow"><b>${esc(r.title)}</b><small style="color:#0F6B44">Done ✓</small></span></div>`).join('')}
      <div class="rewards">${rewardsList().map(r => { const can = n >= r.cost, conf = S.ui.confirm === r.id;
        return `<div class="reward"><span class="re">${esc(r.e)}</span><b>${esc(r.t)}</b><p>${esc(r.d)}</p><div class="rf"><span class="cost">★ ${r.cost}</span>
        ${conf ? `<button class="btn solid small" data-act="redeemYes" data-id="${esc(r.id)}">Spend ${r.cost}</button>` : `<button class="btn small" data-act="redeem" data-id="${esc(r.id)}" ${can ? '' : 'disabled'}>${can ? 'Get it' : `${r.cost - n} more`}</button>`}</div></div>`; }).join('')}</div>
      <p class="note">Stars you spend come out of your jar, so your $${rules().paydayDollars} takes a bit longer.</p></section>
    ${logCard(k, false)}`;
}

/* ---------- Journal ---------- */
function tabJournal(k) {
  const p = P(k), entries = Store.col(`kids/${k}/journal`).sort(byAtDesc);
  const color = p.journalColor || COVERS[0], stk = p.journalStickers?.length ? p.journalStickers : ['⭐', '💖', '🌈'];
  const prompt = JOURNAL_PROMPTS[new Date().getDate() % JOURNAL_PROMPTS.length];
  return `<div class="lockline">🔒 <span>Only you can read your journal. Dad sees a page only if you share it.</span></div>
    <button class="cover" data-act="journalNew" style="background:${esc(color)}"><span class="stk">${stk.map(s => `<span>${esc(s)}</span>`).join('')}</span><span><h3>${esc(p.journalTitle || p.name + "'s Journal")}</h3><span class="handnote">${entries.length} ${entries.length === 1 ? 'page' : 'pages'} · tap to write</span></span></button>
    <div class="row"><div class="prompt grow">✏️ ${esc(prompt)}</div><button class="btn small" data-act="coverEdit">🎨 Cover</button></div>
    ${entries.length ? entries.map(j => { const m = MOODS.find(x => x.id === j.mood);
      return `<article class="jp"><div class="jh">${j.sticker ? `<span style="font-size:22px">${esc(j.sticker)}</span>` : ''}<b>${esc(j.title || 'My page')}</b>${m ? `<span title="${m.t}">${m.e}</span>` : ''}<time>${ago(j.at)}</time><button class="x-btn" data-act="journalDel" data-id="${esc(j.id)}" aria-label="Delete page">🗑️</button></div>
      <p>${esc(j.body)}</p>
      <button class="share" data-act="journalShare" data-id="${esc(j.id)}" aria-pressed="${!!j.shared}"><span class="tog ${j.shared ? 'on' : ''}"></span>${j.shared ? '<span style="color:var(--good)">Shared with Dad ✓</span>' : '<span class="muted">Just me</span>'}</button></article>`; }).join('')
      : '<div class="empty">No pages yet. Tap the cover to write your first one.</div>'}`;
}

/* ---------- More ---------- */
function tabMore(k) {
  if (S.sub === 'mine') return viewMine(k);
  if (S.sub === 'planner') return viewPlanner(k);
  if (S.sub === 'wish') return viewWish(k);
  return `<div class="menu">
    <button data-act="sub" data-sub="mine"><i>🎨</i>Make it mine<small>${esc(buddyOf(k)?.name || 'Buddy')} · ${esc((THEMES.find(t => t[0] === P(k).theme) || THEMES[0])[1])}</small></button>
    <button data-act="sub" data-sub="planner"><i>🗓️</i>My planner<small>${Store.col(`kids/${k}/plans`).filter(x => !x.done).length} to do</small></button>
    <button data-act="sub" data-sub="wish"><i>🎁</i>My wishlist<small>${Store.col(`kids/${k}/wishlist`).length}</small></button>
    <button data-act="toFamily"><i>⌂</i>Family home<small>Messages, calendar</small></button>
    <button data-act="goJobs"><i>✅</i>Family jobs</button>
    <button data-act="sound"><i>${Snd.on ? '🔊' : '🔈'}</i>Sounds<small>${Snd.on ? 'On' : 'Off'}</small></button>
    <button data-act="signOut"><i>👋</i>Sign out<small>Your code brings you back</small></button>
  </div>`;
}
const backBtn = () => `<button class="btn small" data-act="sub" data-sub="" style="width:fit-content">‹ More</button>`;

export function viewMine(k) {
  const p = P(k), b = p.buddy, th = p.theme || 'classic', ac = p.accent || 'pink';
  return `${S.ui.intro ? `<div class="banner good">🎉 <span>You're in! Pick your buddy and how your room looks. You can change it any time.</span></div>` : backBtn()}
    <p class="t-b">Make it mine</p>
    <p class="handnote muted">Pick your buddy.</p>
    <div class="bgrid">${BUDDIES.map(x => `<button class="bcard ${b === x.id ? 'on' : ''}" data-act="setMine" data-f="buddy" data-v="${x.id}" aria-pressed="${b === x.id}">${buddyImg(x, '')}<b>${esc(x.name)}</b><small>${esc(x.what)}</small></button>`).join('')}</div>
    <section class="card"><h3>My room look</h3><div class="thm">${THEMES.map(([id, t]) => `<button class="${id} ${th === id ? 'on' : ''}" data-act="setMine" data-f="theme" data-v="${id}" aria-pressed="${th === id}">${t}</button>`).join('')}</div></section>
    <section class="card"><h3>My colour</h3><div class="swatches">${Object.entries(ACCENTS).map(([id, c]) => `<button style="background:${c}" class="${ac === id ? 'on' : ''}" data-act="setMine" data-f="accent" data-v="${id}" aria-label="${id}">${ac === id ? '✓' : ''}</button>`).join('')}</div></section>
    ${S.ui.intro ? `<div class="card"><h3>📲 Keep Yumi on your Home Screen</h3><p class="note">iPhone: tap Share ↑ then Add to Home Screen. Android: tap ⋮ then Add to Home screen. You'll stay signed in until you tap Sign out.</p></div>
      <button class="btn solid wide" data-act="introDone">All done</button>` : ''}`;
}

function viewPlanner(k) {
  const t = today(), items = Store.col(`kids/${k}/plans`);
  const open = items.filter(x => !x.done), done = items.filter(x => x.done).sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || ''))).slice(0, 6);
  const late = open.filter(x => x.date && x.date < t), tod = open.filter(x => x.date === t), soon = open.filter(x => x.date && x.date > t).sort((a, b) => a.date.localeCompare(b.date)), some = open.filter(x => !x.date).sort(byAtDesc);
  const row = x => `<div class="todo ${x.done ? 'done' : ''}" style="--tc:${esc(x.color || 'var(--accent)')}"><button class="ck2" data-act="planToggle" data-id="${esc(x.id)}" aria-label="Done: ${esc(x.title)}">${x.done ? '✓' : ''}</button><span class="tt"><b>${esc(x.title)}</b>${x.date ? `<small>${x.date === t ? 'Today' : fmtShort(x.date)}</small>` : ''}</span><button class="x-btn" data-act="planDel" data-id="${esc(x.id)}" aria-label="Delete">✕</button></div>`;
  const grp = (title, arr) => arr.length ? `<p class="sec-title">${title}</p>${arr.map(row).join('')}` : '';
  const pc = S.ui.planColor || PLAN_COLORS[0];
  return `${backBtn()}<p class="t-b">My planner</p>
    <section class="card"><input type="text" id="planTitle" maxlength="80" placeholder="What do you want to do?">
      <div class="row"><input type="date" id="planDate" style="flex:1" aria-label="Day (optional)"><div class="colors">${PLAN_COLORS.map(c => `<button style="background:${c}" class="${pc === c ? 'on' : ''}" data-act="planColor" data-c="${c}" aria-label="Colour"></button>`).join('')}</div></div>
      <button class="btn solid" data-act="planAdd">Add to my planner</button></section>
    ${open.length || done.length ? grp('Missed it', late) + grp('Today', tod) + grp('Coming up', soon) + grp('Some day', some) + grp('Done', done) : '<div class="empty">Your planner is empty. Add your first thing above.</div>'}`;
}

function viewWish(k) {
  const list = Store.col(`kids/${k}/wishlist`).sort((a, b) => (a.got ? 1 : 0) - (b.got ? 1 : 0) || (b.hearts || 1) - (a.hearts || 1) || byAtDesc(a, b));
  return `${backBtn()}<div class="row"><p class="t-b grow">My wishlist</p><button class="btn solid small" data-act="wishNew">＋ Add</button></div>
    ${list.length ? list.map(w => `<div class="wish ${w.got ? 'got' : ''}"><span class="e">${esc(w.emoji || '🎁')}</span><span class="tt"><b>${esc(w.title)}</b>${w.note ? `<small>${esc(w.note)}</small><br>` : ''}<span class="hearts">${'♥'.repeat(w.hearts || 1)}</span></span>${w.got ? '<span class="pill" style="background:var(--good)">Got it!</span>' : ''}<button class="x-btn" data-act="wishDel" data-id="${esc(w.id)}" aria-label="Delete">✕</button></div>`).join('')
      : '<div class="empty">What are you dreaming of? Add it to your wishlist.</div>'}`;
}

/* ---------- actions ---------- */
const kidOf = el => el?.dataset?.k || S.me.id;
export const ROOM_ACTIONS = {
  principalSeen(el) { try { localStorage.setItem(el.dataset.key, '1'); } catch (e) {} Snd.tap(); S.render(); },
  buddyTap(el) { S.ui.bump = (S.ui.bump || 0) + 1; Snd.boop(); Confetti.from(el, 14); S.render(); },
  openMine() { S.tab = 'more'; S.sub = 'mine'; Snd.tap(); S.render(); },
  sub(el) { S.sub = el.dataset.sub || null; S.ui.intro = false; Snd.tap(); window.scrollTo({ top: 0 }); S.render(); },
  introDone() { S.ui.intro = false; S.sub = null; S.tab = 'today'; Snd.magic(); window.scrollTo({ top: 0 }); S.render(); },
  mood(el) { const m = el.dataset.mood; S.ui.mood = S.ui.mood === m ? null : m; Snd.pop(); S.render(true); },
  async moodPost(el) {
    const m = MOODS.find(x => x.id === S.ui.mood); if (!m) return;
    const text = (document.getElementById('moodText')?.value || '').trim(), hug = !!document.getElementById('hugAsk')?.checked;
    const body = { kid: S.me.id, mood: m.id, text, at: nowIso() }; if (hug) body.hug = true;
    S.ui.mood = null; Confetti.from(el, 40); Snd.pop();
    await setDoc('feed/' + uid(), body);
    toast(hug ? 'Told the crew. Dad knows you want a hug 🤗' : 'Told the crew');
  },
  slot(el) { S.ui.slot = el.dataset.slot; Snd.tap(); S.render(); },
  editRoutine(el) { const k = kidOf(el); S.ui.editRoutine = S.ui.editRoutine === k ? null : k; Snd.tap(); S.render(); },
  async step(el) {
    const k = kidOf(el), id = el.dataset.id, d = today(), path = `kids/${k}/days/${d}`;
    const day = dayOf(k, d), done = new Set(day.done || []), was = done.has(id);
    was ? done.delete(id) : done.add(id);
    Store.hold(path);
    Store.docs.set(path, { ...day, date: d, done: [...done] }); S.render();
    was ? Snd.uncheck() : Snd.check();
    const r = await queued('tick:' + k, () => act('routineTick', { kid: k, date: d, step: id, done: !was }));
    Store.release(path);
    if (!r.ok) { toast("That tick didn't save. Try again."); Snd.err(); Store.kick(); return; }
    if (r.gained > 0) { setTimeout(() => { Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 140); toast('Whole routine done! +1 ★'); }, 150); }
    else if (!was) { const slot = routineOf(k).find(x => x.id === id)?.slot, ids = routineOf(k).filter(x => x.slot === slot).map(x => x.id); if (ids.every(x => r.done.includes(x))) { Confetti.from(el, 50); toast('That part is done!'); } }
  },
  async stepAdd(el) {
    const k = kidOf(el), slot = el.dataset.slot, inp = document.getElementById('newStep'), t = (inp?.value || '').trim();
    if (!t) { inp?.focus(); return; }
    const max = Math.max(0, ...routineOf(k).filter(r => r.slot === slot).map(r => r.order || 0));
    inp.value = ''; Snd.check();
    await setDoc(`kids/${k}/routine/${uid()}`, { slot, t, e: '⭐', order: max + 1 });
  },
  async stepDel(el) { Snd.tap(); await delDoc(`kids/${kidOf(el)}/routine/${el.dataset.id}`); },
  async useStarter(el) {
    const k = kidOf(el);
    await write(STARTER_ROUTINE.map(([slot, e, t], i) => ({ path: `kids/${k}/routine/r${String(i + 1).padStart(2, '0')}`, set: { slot, e, t, order: i + 1, at: nowIso() } })));
    Snd.magic(); toast('Starter routine added');
  },
  async taskTick(el) {
    const id = el.dataset.id, r = await act('taskTick', { task: id, date: today() });
    if (!r.ok) { toast(r.error === 'not_your_job' ? 'That job is for someone else' : "That tick didn't save"); Snd.err(); return; }
    if (r.done) { Confetti.from(el, 30); if (r.stars) { Snd.star(); toast(`+${r.stars} ★ in your jar`); } else Snd.check(); } else Snd.uncheck();
  },
  async taskDel(el) { Snd.tap(); await delDoc('tasks/' + el.dataset.id); },
  weekOff(el) { S.ui.weekOff = Math.max(-1, Math.min(1, (S.ui.weekOff || 0) + Number(el.dataset.n))); S.ui.weekSel = null; Snd.tap(); S.render(); },
  weekSel(el) { S.ui.weekSel = el.dataset.d; Snd.tap(); S.render(); },
  async pickPlace(el) { await savePick(el.dataset.d, { place: el.dataset.v }, 'place'); },
  async pickFood(el) { await savePick(el.dataset.d, { food: el.dataset.v }, 'food'); },
  async saveWeekNote(el) { const v = (document.getElementById('weekNote')?.value || '').trim().slice(0, 200); await savePick(el.dataset.d, { note: v }, 'note'); toast('Note saved'); },
  async redeem(el) { S.ui.confirm = el.dataset.id; Snd.tap(); S.render(); setTimeout(() => { if (S.ui.confirm === el.dataset.id) { S.ui.confirm = null; S.render(); } }, 5000); },
  async redeemYes(el) {
    S.ui.confirm = null; const r = await act('redeem', { reward: el.dataset.id });
    if (!r.ok) { toast(r.error === 'not_enough' ? 'Not enough stars yet' : "That didn't work. Try again."); Snd.err(); S.render(); return; }
    Snd.magic(); Confetti.from(el, 60); toast('Ticket sent to Dad!');
  },
  journalNew() {
    const prompt = JOURNAL_PROMPTS[new Date().getDate() % JOURNAL_PROMPTS.length];
    openSheet(`<h2 id="sheetTitle">New page</h2><div class="form">
      <label>How do you feel?</label>${pickRow('jm', MOODS.map(m => m.e), '')}
      <label>Title<input type="text" id="jTitle" maxlength="60" placeholder="Today was…"></label>
      <label>Write<textarea id="jBody" class="hand" rows="6" maxlength="4000" placeholder="${esc(prompt)}"></textarea></label>
      <label>Sticker</label>${pickRow('js', STICKERS, '')}
      <label class="hug" style="color:var(--ink)"><input type="checkbox" id="jShare"> Share this page with Dad</label>
      <p class="note">Pages are just yours unless you share them. You can change it later.</p>
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="journalSave">Save page</button></div></div>`);
  },
  async journalSave() {
    const body = document.getElementById('jBody').value.trim(), title = document.getElementById('jTitle').value.trim();
    if (!body && !title) { Snd.err(); document.getElementById('jBody').focus(); return; }
    const me = picked('jm'), mood = (MOODS.find(m => m.e === me) || {}).id || null;
    const shared = document.getElementById('jShare').checked;
    closeSheet(); Snd.magic();
    await setDoc(`kids/${S.me.id}/journal/${uid()}`, { title, body, mood, sticker: picked('js') || null, shared });
    toast(shared ? 'Page saved and shared with Dad' : 'Page saved, just for you');
  },
  async journalShare(el) {
    const path = `kids/${S.me.id}/journal/${el.dataset.id}`, j = Store.get(path); if (!j) return;
    Snd.tap(); await mergeDoc(path, { shared: !j.shared });
    toast(!j.shared ? 'Dad can read this page now' : 'This page is just yours again');
  },
  async journalDel(el) {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = '❓'; toast('Tap the bin again to delete this page'); setTimeout(() => { delete el.dataset.sure; el.textContent = '🗑️'; }, 4000); return; }
    Snd.tap(); await delDoc(`kids/${S.me.id}/journal/${el.dataset.id}`);
  },
  coverEdit() {
    const p = P(S.me.id), color = p.journalColor || COVERS[0], stk = p.journalStickers || ['⭐', '💖', '🌈'];
    openSheet(`<h2 id="sheetTitle">Design your cover</h2><div class="form">
      <label>Name<input type="text" id="cTitle" maxlength="40" value="${esc(p.journalTitle || p.name + "'s Journal")}"></label>
      <label>Colour</label><div class="swatches" data-pick="cc">${COVERS.map(c => `<button type="button" style="background:${c}" class="${c === color ? 'on' : ''}" data-act="pick" data-v="${c}">✓</button>`).join('')}</div>
      <label>Stickers (up to 4)</label><div class="emoji-pick" id="cStk">${STICKERS.map(s => `<button type="button" class="${stk.includes(s) ? 'on' : ''}" data-act="stkToggle" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="coverSave">Save cover</button></div></div>`);
  },
  stkToggle(el) { const on = document.querySelectorAll('#cStk button.on'); if (!el.classList.contains('on') && on.length >= 4) { Snd.err(); toast('Four stickers max'); return; } el.classList.toggle('on'); Snd.tick(); },
  async coverSave() {
    const body = { journalTitle: document.getElementById('cTitle').value.trim().slice(0, 40), journalColor: picked('cc') || COVERS[0], journalStickers: [...document.querySelectorAll('#cStk button.on')].map(b => b.dataset.v) };
    closeSheet(); Snd.magic(); await mergeDoc('people/' + S.me.id, body);
  },
  async setMine(el) {
    const f = el.dataset.f, v = el.dataset.v; Snd.magic();
    if (f === 'buddy') Confetti.from(el, 30);
    await mergeDoc('people/' + S.me.id, { [f]: v });
  },
  planColor(el) { S.ui.planColor = el.dataset.c; Snd.tick(); S.render(); },
  async planAdd() {
    const t = document.getElementById('planTitle').value.trim(); if (!t) { document.getElementById('planTitle').focus(); Snd.err(); return; }
    const date = document.getElementById('planDate').value || null; Snd.pop();
    await setDoc(`kids/${S.me.id}/plans/${uid()}`, { title: t, date, color: S.ui.planColor || PLAN_COLORS[0], done: false });
  },
  async planToggle(el) {
    const path = `kids/${S.me.id}/plans/${el.dataset.id}`, x = Store.get(path); if (!x) return;
    x.done ? Snd.uncheck() : (Snd.check(), Confetti.from(el, 24));
    await mergeDoc(path, { done: !x.done, doneAt: x.done ? null : nowIso() });
  },
  async planDel(el) { Snd.tap(); await delDoc(`kids/${S.me.id}/plans/${el.dataset.id}`); },
  wishNew() {
    openSheet(`<h2 id="sheetTitle">Add a wish</h2><div class="form">
      <label>What is it?<input type="text" id="wTitle" maxlength="60" placeholder="Roller skates" autofocus></label>
      <label>Picture</label>${pickRow('we', WISH_EMOJI, WISH_EMOJI[0])}
      <label>How much do you want it?</label>${pickRow('wh', ['♥', '♥♥', '♥♥♥'], '♥')}
      <label>Note (optional)<input type="text" id="wNote" maxlength="80" placeholder="The pink ones"></label>
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="wishSave">Add wish</button></div></div>`);
  },
  async wishSave() {
    const t = document.getElementById('wTitle').value.trim(); if (!t) { Snd.err(); return; }
    const hearts = (picked('wh') || '♥').length; closeSheet(); Snd.magic();
    await setDoc(`kids/${S.me.id}/wishlist/${uid()}`, { title: t, emoji: picked('we') || '🎁', hearts, note: document.getElementById('wNote')?.value.trim() || '' });
  },
  async wishDel(el) { Snd.tap(); await delDoc(`kids/${S.me.id}/wishlist/${el.dataset.id}`); },
};

async function savePick(d, patch, what) {
  const path = `kids/${S.me.id}/week/${d}`, cur = Store.get(path) || {};
  const next = { ...cur, ...patch };
  if (what !== 'note' && cur[what] === patch[what]) next[what] = null;
  Snd.pop();
  await write([{ path, set: { ...next, at: cur.at || nowIso(), updatedAt: nowIso() } }]);
}
