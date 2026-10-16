/* Dad mode: the "Waiting for you" inbox, quick stars and strikes, each girl's things,
   the girls' week, phones and settings. */
import { esc, Store, api, today, ymd, parseYmd, addDays, DOW, DOWL, ago, byAtDesc, fmtShort, uid, nowIso, ordinal, Snd, Confetti, toast, openSheet, closeSheet, pickRow, picked, act, queued, write, setDoc, mergeDoc, delDoc } from './core.js';
import { S, P, people, kids, parents, avatar, accentOf, short, nick, famName, MOODS, SLOTS, STAR_REASONS, STRIKE_REASONS, FOODS, homeFor, homeName, places, placeOf, rhythm, roster,
  routineStats, moodToday, starsOf, strikesOf, rules, weekDays } from './model.js';
import { routineCard, jarCard, strikesCard, logCard } from './room.js';
import { familyNav } from './family.js';

export function viewDad() {
  const page = S.sub?.startsWith('girl:') ? girlPage(S.sub.slice(5)) : S.sub === 'week' ? weekPage() : S.sub === 'phones' ? phonesPage() : S.sub === 'settings' ? settingsPage() : homePage();
  return `<div class="screen dark"><div class="main">${page}</div>${familyNav()}</div>`;
}

const back = () => `<button class="btn small" data-act="dadSub" data-sub="" style="width:fit-content">‹ Dad mode</button>`;
const girlCard = k => { const p = P(k), rs = routineStats(k), m = moodToday(k);
  return `<button class="gc" data-act="dadSub" data-sub="girl:${esc(k)}" style="--pc:${accentOf(k)}">${avatar(k)}<span class="grow"><b>${esc(p.nick || p.name)} ★${starsOf(k)}</b><small>Routine ${rs.done}/${rs.total}${m ? ` · ${m.e}` : ''}</small><small>${strikesOf(k)} ${strikesOf(k) === 1 ? 'strike' : 'strikes'}</small></span></button>`; };

function waiting() {
  const items = [];
  for (const k of kids()) {
    for (const p of Store.col(`kids/${k.id}/payday`).filter(x => x.status !== 'paid')) items.push({ at: p.at, html: `<div class="wait" style="background:var(--good-soft)"><span class="e">💵</span><span class="tt"><b>${esc(k.name)} filled her jar! Pay her $${p.amount}</b><small>100 stars · ${ago(p.at)}. Tap Paid once she has it.</small></span><button class="btn good small" data-act="paid" data-k="${esc(k.id)}" data-id="${esc(p.id)}">Paid</button></div>` });
    for (const r of Store.col(`kids/${k.id}/redeemed`).filter(x => x.status === 'pending')) items.push({ at: r.at, html: `<div class="wait"><span class="e">${esc(r.emoji)}</span><span class="tt"><b>${esc(k.name)} bought "${esc(r.title)}"</b><small>★${r.cost} · ${ago(r.at)}</small></span><span class="acts"><button class="btn dad small" data-act="redSet" data-k="${esc(k.id)}" data-id="${esc(r.id)}" data-s="done">Done</button><button class="btn small" data-act="redSet" data-k="${esc(k.id)}" data-id="${esc(r.id)}" data-s="declined" aria-label="Say no and give the stars back">Not now</button></span></div>` });
  }
  for (const i of Store.col('inbox').filter(x => !x.seen && x.kind !== 'payday')) {
    const e = { strike: '⚠️', principal: '🏫', hug: '🤗', journal: '📓' }[i.kind] || '🔔';
    const btn = i.kind === 'journal' ? `<button class="btn dad small" data-act="readPage" data-id="${esc(i.id)}">Read</button>` : i.kind === 'hug' ? `<button class="btn good small" data-act="seen" data-id="${esc(i.id)}">Hugged ✓</button>` : `<button class="btn small" style="background:var(--ink);color:#fff" data-act="seen" data-id="${esc(i.id)}">Seen</button>`;
    items.push({ at: i.at, html: `<div class="wait ${i.kind === 'strike' || i.kind === 'principal' ? 'warn' : ''}"><span class="e">${e}</span><span class="tt"><b>${esc(i.title)}</b><small>${esc(i.sub || '')} · ${ago(i.at)}</small></span>${btn}</div>` });
  }
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function homePage() {
  const me = P(S.me.id), w = waiting();
  return `<div class="dhead">${avatar(S.me.id)}<span class="grow"><span class="eyebrow">Dad mode</span><br><span class="t-b">${esc(me.name)}</span></span><button class="iconbtn" data-act="dadSub" data-sub="settings" aria-label="Settings">⚙︎</button><button class="out" data-act="signOut" style="background:rgba(255,255,255,.14)">Sign out</button></div>
    <div class="girls">${kids().map(k => girlCard(k.id)).join('')}</div>
    <p class="sec-title">Waiting for you · ${w.length}</p>
    ${w.length ? w.map(x => x.html).join('') : '<div class="empty">Nothing waiting. Nice.</div>'}
    <div class="qa">
      <button data-act="quickStar"><i>⭐</i>Star</button><button data-act="quickStrike"><i>✕</i>Strike</button><button data-act="taskNew"><i>✅</i>Job</button>
      <button data-act="addEvent"><i>📅</i>Event</button><button data-act="dadSub" data-sub="week"><i>🧭</i>Girls' week</button><button data-act="dadSub" data-sub="phones"><i>📱</i>Phones</button>
    </div>
    ${checkinToGirls()}
    ${dadRoutine()}`;
}

function checkinToGirls() {
  return `<section class="card"><h3>💌 Send the girls a note</h3>
    <div class="chips">${[['all', 'Both'], ...kids().map(k => [k.id, k.nick || k.name])].map(([id, l]) => `<button class="${(S.ui.noteTo || 'all') === id ? 'on' : ''}" data-act="noteTo" data-k="${esc(id)}">${esc(l)}</button>`).join('')}</div>
    <textarea id="dadNote" rows="2" maxlength="280" placeholder="Proud of you because…" style="background:#fff"></textarea>
    <button class="btn dad" data-act="dadNoteSend">Send</button></section>`;
}

function dadRoutine() {
  const items = Store.col('dad/routine').sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const day = Store.get('dad/days/' + today()) || { done: [] }, done = new Set(day.done || []);
  const editing = S.ui.editDad;
  if (!items.length) return `<section class="card"><h3>☀️ My routine</h3><p class="note">A few steps for your own day. Your streak shows on the family home.</p><button class="btn dad" data-act="dadStarter">Use a starter routine</button></section>`;
  return `<section class="card"><h3>☀️ My routine <em>${items.filter(r => done.has(r.id)).length}/${items.length} · 🔥 ${Number(P(S.me.id)?.pub?.streak) || 0}</em></h3>
    ${SLOTS.map(sl => { const it = items.filter(r => r.slot === sl.id); return it.length || editing ? `<p class="sec-title">${sl.e} ${sl.t}</p>${it.map(r => editing
      ? `<div class="stepedit" style="background:rgba(255,255,255,.08)"><span>${esc(r.e || '•')}</span><span class="grow">${esc(r.t)}</span><button class="x-btn" style="color:#fff" data-act="dadStepDel" data-id="${esc(r.id)}" aria-label="Remove">🗑️</button></div>`
      : `<button class="step ${done.has(r.id) ? 'done' : ''}" style="${done.has(r.id) ? '' : 'background:rgba(255,255,255,.08);color:#fff'}" data-act="dadStep" data-id="${esc(r.id)}"><span class="e">${esc(r.e || '•')}</span><span class="t">${esc(r.t)}</span><span class="ck">${done.has(r.id) ? '✓' : ''}</span></button>`).join('')}` : ''; }).join('')}
    ${editing ? `<div class="row"><select id="dadSlot" style="width:auto">${SLOTS.map(s => `<option value="${s.id}">${s.t}</option>`).join('')}</select><input type="text" id="dadStepIn" maxlength="60" placeholder="Add a step"><button class="btn dad small" data-act="dadStepAdd">Add</button></div>` : ''}
    <button class="btn small" data-act="dadEdit">${editing ? 'Done' : 'Edit'}</button></section>`;
}

/* ---------- one girl ---------- */
function girlPage(k) {
  const p = P(k); if (!p) return back();
  const sister = kids().find(x => x.id !== k);
  const reasons = STAR_REASONS.map(r => r === 'Kind to sister' && sister ? `Kind to ${sister.nick || sister.name}` : r);
  const pending = Store.col(`kids/${k}/redeemed`).filter(r => r.status === 'pending');
  const shared = Store.col(`kids/${k}/journal`).sort(byAtDesc);
  const plans = Store.col(`kids/${k}/plans`).filter(x => !x.done);
  const wishes = Store.col(`kids/${k}/wishlist`);
  const n = strikesOf(k) + 1, R = rules();
  const next = n >= R.principalAt ? `Strike ${n} brings the principal message.` : n % R.strikesPerStar === 0 ? `Strike ${n} takes a star.` : `This would be strike ${n}.`;
  return `${back()}
    <div class="dhead">${avatar(k)}<span class="grow"><span class="eyebrow">${esc(p.name)}</span><br><span class="t-b">${esc(p.title || '')}</span></span></div>
    ${jarCard(k)}
    ${Store.col(`kids/${k}/payday`).filter(x => x.status !== 'paid').map(x => `<div class="payday"><span class="e">💵</span><span class="grow"><b>Pay ${esc(p.name)} $${x.amount}</b><small>Her jar hit 100. Tap Paid once she has it.</small></span><button class="btn good small" data-act="paid" data-k="${esc(k)}" data-id="${esc(x.id)}">Paid</button></div>`).join('')}
    <section class="card white"><h3>⭐ Give a star</h3><div class="reasons">${reasons.map(r => `<button data-act="giveStar" data-k="${esc(k)}" data-r="${esc(r)}" data-n="1">★ ${esc(r)}</button>`).join('')}<button data-act="giveStar" data-k="${esc(k)}" data-r="Big win" data-n="3">★ Big win +3</button></div>
      <h3 style="margin-top:6px">✕ Give a strike <em>${esc(next)}</em></h3><div class="reasons bad">${STRIKE_REASONS.map(r => `<button data-act="giveStrike" data-k="${esc(k)}" data-r="${esc(r)}">✕ ${esc(r)}</button>`).join('')}</div></section>
    <div class="light">${strikesCard(k)}</div>
    ${pending.length ? `<section class="card white"><h3>🎟️ Her tickets</h3>${pending.map(r => `<div class="wait" style="background:var(--paper)"><span class="e">${esc(r.emoji)}</span><span class="tt"><b>${esc(r.title)}</b><small>★${r.cost} · ${ago(r.at)}</small></span><span class="acts"><button class="btn dad small" data-act="redSet" data-k="${esc(k)}" data-id="${esc(r.id)}" data-s="done">Done</button><button class="btn small" data-act="redSet" data-k="${esc(k)}" data-id="${esc(r.id)}" data-s="declined">Not now</button></span></div>`).join('')}</section>` : ''}
    <div class="light">${routineCard(k, true)}</div>
    <div class="light">${logCard(k, true)}</div>
    <section class="card white"><h3>📓 Pages she shared</h3>${shared.length ? shared.map(j => `<article class="jp"><div class="jh"><b>${esc(j.title || 'A page')}</b><time>${ago(j.at)}</time></div><p>${esc(j.body)}</p></article>`).join('') : '<p class="note">Her journal is private. Pages show here only when she shares them.</p>'}</section>
    <section class="card white"><h3>🗓️ Her planner <em>${plans.length} to do</em></h3>${plans.length ? plans.slice(0, 8).map(x => `<div class="tl"><i style="background:${esc(x.color || 'var(--pink)')}"></i><span>${esc(x.title)}</span><time>${x.date ? fmtShort(x.date) : ''}</time></div>`).join('') : '<p class="note">Nothing planned.</p>'}</section>
    <section class="card white"><h3>🎁 Her wishlist</h3>${wishes.length ? wishes.map(w => `<div class="tl"><span>${esc(w.emoji || '🎁')} ${esc(w.title)} <span style="color:var(--pink)">${'♥'.repeat(w.hearts || 1)}</span></span><time><button class="btn small" data-act="wishGot" data-k="${esc(k)}" data-id="${esc(w.id)}">${w.got ? 'Got ✓' : 'Mark got'}</button></time></div>`).join('') : '<p class="note">Empty for now.</p>'}</section>`;
}

/* ---------- the girls' week (Feel First parent view) ---------- */
function weekPage() {
  const ks = kids(), k = S.ui.weekKid && P(S.ui.weekKid) ? S.ui.weekKid : ks[0]?.id;
  if (!k) return back();
  const off = S.ui.dadWeekOff || 0, days = weekDays(off), r = rhythm();
  const planPlace = d => { const h = homeFor(d); return h === 'dad' || h === 'mum' ? h : null; };
  const rows = days.map(d => {
    const x = Store.get(`kids/${k}/week/${d}`) || {}, want = placeOf(x.place), plan = planPlace(d), food = FOODS.find(f => f.id === x.food);
    const diff = x.place && plan && x.place !== plan;
    return `<div class="r"><b>${DOW[parseYmd(d).getDay()]}</b><span class="c ${diff ? 'diff' : ''}">${want ? `${esc(want.e || '')} ${esc(want.t)}` : '<span class="muted">Not picked</span>'}${food ? ` · ${esc(food.t)}` : ''}${x.note ? `<small>"${esc(x.note)}"</small>` : ''}</span><span class="c">${plan ? esc(placeOf(plan)?.t || homeName(plan)) : homeName(homeFor(d))}</span></div>`;
  }).join('');
  return `${back()}
    <div class="dhead">${avatar(S.me.id)}<span class="grow"><span class="eyebrow">The girls' week</span><br><span class="t-b">What they'd like</span></span></div>
    <div class="chips">${ks.map(x => `<button class="${x.id === k ? 'on' : ''}" data-act="weekKid" data-k="${esc(x.id)}">${esc(x.nick || x.name)}</button>`).join('')}</div>
    <div class="wknav"><button class="iconbtn" data-act="dadWeekOff" data-n="-1" ${off <= -1 ? 'disabled' : ''} aria-label="Last week">‹</button><b>${off === 0 ? 'This week' : off === 1 ? 'Next week' : 'Last week'}</b><button class="iconbtn" data-act="dadWeekOff" data-n="1" ${off >= 1 ? 'disabled' : ''} aria-label="Next week">›</button></div>
    <div class="vs"><div class="r hd"><span></span><span>${esc(P(k).nick || P(k).name)} would like</span><span>The plan</span></div>${rows}</div>
    <section class="card"><h3>🌙 Quiet time, then our time</h3><div class="row"><label class="grow t-s">Quiet (min)<input type="number" id="rhQuiet" min="0" max="240" value="${r.quiet}"></label><label class="grow t-s">Just us (min)<input type="number" id="rhOur" min="0" max="240" value="${r.our}"></label></div><button class="btn dad" data-act="saveRhythm">Save the promise</button></section>
    <p class="handnote" style="text-align:center;color:var(--on-dark2)">Wishes, not changes. Talk about it together.</p>`;
}

/* ---------- phones ---------- */
function phonesPage() {
  const pc = S.ui.pair, devs = S.ui.devices;
  if (!devs && !S.ui.devLoading) {
    S.ui.devLoading = true;
    Promise.all([api('/devices'), api('/boot')]).then(([r, b]) => { S.ui.devices = r.ok ? r : { devices: [] }; if (b.people) S.boot.people = b.people; S.ui.devLoading = false; S.render(); });
  }
  const left = pc ? Math.max(0, Math.round((pc.until - Date.now()) / 1000)) : 0;
  return `${back()}<p class="t-b">Phones</p>
    <section class="card"><h3>📲 Add a phone</h3>
      ${pc && left > 0 ? `<p class="note">On ${esc(nick(pc.who))}'s phone, open the Yumi link and type:</p>
        <div class="code6" aria-label="Code">${esc(pc.code.slice(0, 3))}&nbsp;${esc(pc.code.slice(3))}</div>
        <p class="note" style="text-align:center">Works for ${Math.ceil(left / 60)} more ${Math.ceil(left / 60) === 1 ? 'minute' : 'minutes'} · one phone only</p>
        <ol class="steps-howto"><li>Code accepted: "This phone is for ${esc(P(pc.who)?.name || '')} ♡"</li>${P(pc.who)?.role === 'kid' && !pc.hasCode ? `<li>She picks her 4-number code and her buddy</li>` : ''}<li>Share ↑ › Add to Home Screen</li><li>Done. It stays signed in until someone taps Sign out</li></ol>
        <button class="btn small" data-act="pairDone">Close</button>`
      : `<p class="note">Pick who the phone is for. You'll get a code that works once, for 10 minutes.</p><div class="row" style="flex-wrap:wrap">${people().map(p => `<button class="btn" data-act="pairMake" data-k="${esc(p.id)}">${esc(p.nick && p.role === 'kid' ? p.nick : p.name)}</button>`).join('')}</div>`}
    </section>
    <section class="card"><h3>🔢 The girls' codes</h3>${kids().map(k => `<div class="devrow"><span class="tt"><b>${esc(k.name)}</b><small>${k.hasCode ? 'Has a 4-number code' : 'No code yet. She picks one when her phone is added.'}</small></span><button class="btn small" data-act="kidCode" data-k="${esc(k.id)}">${k.hasCode ? 'Change' : 'Set'}</button></div>`).join('')}
      <p class="note">Forgot her code? Set a new one here and tell her.</p></section>
    <section class="card"><h3>📱 Signed-in phones</h3>
      ${!devs ? '<p class="note">Loading…</p>' : devs.devices?.length ? devs.devices.map(d => `<div class="devrow"><span class="tt"><b>${esc(d.label || 'Device')}${d.id === devs.mine ? ' (this one)' : ''}</b><small>${d.person ? `Last used by ${esc(short(d.person))} · ` : ''}${ago(d.lastSeen)}${d.signedIn ? '' : ' · signed out'}</small></span>${d.id === devs.mine ? '' : `<button class="btn small" data-act="forget" data-id="${esc(d.id)}">Remove</button>`}</div>`).join('') : '<p class="note">No phones yet.</p>'}
      <p class="note">Remove a lost phone and it's signed out straight away. It would need a new code to come back.</p></section>`;
}

/* ---------- settings ---------- */
function settingsPage() {
  const r = roster() || { pattern: {} }, pat = r.pattern || {};
  const lab = v => v === 'mum' ? 'Mum' : v === 'dad' ? 'Dad' : v === 'alt' ? 'Swap' : '—';
  const nextTue = (() => { let d = new Date(); while (d.getDay() !== 2) d = addDays(d, 1); return d; })();
  const g = Store.get('settings/goal') || {};
  return `${back()}<p class="t-b">Settings</p>
    <section class="card"><h3>🏠 Weekly house pattern</h3>
      <div class="pattern" id="pattern">${[1, 2, 3, 4, 5, 6, 0].map(dw => { const v = (S.ui.pattern || pat)[dw] || ''; return `<button class="h-${v === 'alt' ? 'swap' : v || 'unknown'}" data-act="patDay" data-dow="${dw}"><b>${DOW[dw]}</b>${lab(v)}</button>`; }).join('')}</div>
      <p class="note">Tap a day to switch Dad › Mum › Swap. Swap days go back and forth each week.</p>
      ${Object.values(S.ui.pattern || pat).includes('alt') ? `<p class="note">Which swap day is Mum's? ${[nextTue, addDays(nextTue, 7)].map(d => `<button class="btn small ${r.altMumTuesday === ymd(d) ? 'dad' : ''}" data-act="setAlt" data-d="${ymd(d)}">${fmtShort(ymd(d))}</button>`).join(' ')}</p>` : ''}
      <button class="btn dad" data-act="savePattern">Save pattern</button></section>
    <section class="card"><h3>🧭 Places the girls can pick</h3>
      ${places().map(p => `<div class="devrow"><span class="tt"><b>${esc(p.e || '✿')} ${esc(p.t)}</b></span>${['dad', 'mum'].includes(p.id) ? '' : `<button class="btn small" data-act="placeDel" data-id="${esc(p.id)}">Remove</button>`}</div>`).join('')}
      <div class="row"><input type="text" id="placeIn" maxlength="24" placeholder="Like: Nan's"><button class="btn dad small" data-act="placeAdd">Add</button></div></section>
    <section class="card"><h3>🎯 Family goal</h3>
      <input type="text" id="gTitle" maxlength="40" placeholder="Beach day" value="${esc(g.title || '')}">
      <div class="row"><input type="text" id="gEmoji" maxlength="4" style="width:70px" value="${esc(g.emoji || '🎯')}" aria-label="Emoji"><input type="number" id="gTarget" min="10" max="1000" value="${Number(g.target) || 100}" aria-label="Stars needed"></div>
      <p class="note">Every star the girls earn from now on fills it.</p>
      <button class="btn dad" data-act="goalSave">Start this goal</button></section>
    <section class="card"><h3>🔐 My code</h3>
      <input type="tel" inputmode="numeric" id="oldCode" maxlength="6" placeholder="Current 6-number code" autocomplete="off">
      <input type="tel" inputmode="numeric" id="newCode" maxlength="6" placeholder="New 6-number code" autocomplete="off">
      <button class="btn dad" data-act="changeCode">Change my code</button></section>
    <section class="card"><h3>💾 Backup</h3><p class="note">Download everything (except the girls' private journal pages) as a file you can keep in Drive.</p><a class="btn" href="/api/export" download>Download backup</a></section>
    <section class="card"><h3>🔊 Sounds</h3><button class="btn" data-act="sound">${Snd.on ? 'Turn sounds off' : 'Turn sounds on'}</button></section>
    <p class="note" style="text-align:center">Yumi · ${esc(famName())} · ${esc(S.boot?.version || '')}</p>`;
}

/* ---------- actions ---------- */
const kidsSheet = (title, inner) => openSheet(`<h2 id="sheetTitle">${title}</h2>${inner}`);
export const DAD_ACTIONS = {
  dadSub(el) { S.sub = el.dataset.sub || null; S.ui.devices = null; S.ui.pattern = null; Snd.tap(); window.scrollTo({ top: 0 }); S.render(); },
  async paid(el) { Snd.fanfare(); Confetti.from(el, 80); const r = await act('paydayPaid', { kid: el.dataset.k, id: el.dataset.id }); toast(r.ok ? 'Paid. Logged in your money.' : "That didn't save"); },
  async redSet(el) { const s = el.dataset.s; s === 'done' ? (Snd.check(), Confetti.from(el, 30)) : Snd.tap(); const r = await act('redeemSet', { kid: el.dataset.k, id: el.dataset.id, status: s }); toast(!r.ok ? "That didn't save" : s === 'done' ? 'Ticket done' : 'Stars given back'); },
  async seen(el) { Snd.tap(); await mergeDoc('inbox/' + el.dataset.id, { seen: true }); },
  readPage(el) {
    const i = Store.get('inbox/' + el.dataset.id), j = i?.ref ? Store.get(i.ref) : null;
    mergeDoc('inbox/' + el.dataset.id, { seen: true });
    openSheet(j ? `<h2 id="sheetTitle">${esc(j.title || 'A page')}</h2><p class="lead">${esc(short(i.kid))} shared this · ${ago(j.at)}</p><article class="jp"><p>${esc(j.body)}</p></article><div class="form"><div class="actions"><button class="btn solid" data-act="closeSheet">Close</button></div></div>`
      : `<h2 id="sheetTitle">Page not shared any more</h2><p class="lead">She made this page private again.</p><div class="form"><div class="actions"><button class="btn" data-act="closeSheet">OK</button></div></div>`);
  },
  quickStar() { const ks = kids(); kidsSheet('Give a star', `<div class="form">${ks.map(k => { const sister = ks.find(x => x.id !== k.id);
    return `<p class="sec-title">${esc(k.name)}</p><div class="reasons">${STAR_REASONS.map(r => r === 'Kind to sister' && sister ? `Kind to ${sister.nick || sister.name}` : r).map(r => `<button data-act="giveStar" data-k="${esc(k.id)}" data-r="${esc(r)}" data-n="1" data-close="1">★ ${esc(r)}</button>`).join('')}<button data-act="giveStar" data-k="${esc(k.id)}" data-r="Big win" data-n="3" data-close="1">★ Big win +3</button></div>`; }).join('')}</div>`); },
  quickStrike() { kidsSheet('Give a strike', `<div class="form">${kids().map(k => { const n = strikesOf(k.id) + 1, R = rules();
    return `<p class="sec-title">${esc(k.name)} · ${n >= R.principalAt ? `strike ${n}: principal message` : n % R.strikesPerStar === 0 ? `strike ${n} takes a star` : `would be strike ${n}`}</p><div class="reasons bad">${STRIKE_REASONS.map(r => `<button data-act="giveStrike" data-k="${esc(k.id)}" data-r="${esc(r)}" data-close="1">✕ ${esc(r)}</button>`).join('')}</div>`; }).join('')}</div>`); },
  async giveStar(el) {
    const k = el.dataset.k, n = Number(el.dataset.n) || 1;
    if (el.dataset.close) closeSheet();
    Snd.star(); Confetti.from(el, 40);
    const r = await act('giveStar', { kid: k, n, reason: el.dataset.r });
    toast(r.ok ? `+${n} ★ for ${short(k)}` : "That star didn't save");
  },
  async giveStrike(el) {
    const k = el.dataset.k;
    if (el.dataset.close) closeSheet();
    Snd.strike();
    const r = await act('giveStrike', { kid: k, reason: el.dataset.r });
    toast(!r.ok ? "That didn't save" : r.principal ? `${short(k)} is on ${r.strikes} strikes. She's been told about the principal.` : r.takesStar ? `${ordinal(r.strikes)} strike: 1 ★ taken` : `Strike ${r.strikes} for ${short(k)}`);
  },
  async undoLog(el) {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = '?'; toast('Tap again to undo it'); setTimeout(() => { delete el.dataset.sure; el.textContent = '↺'; }, 4000); return; }
    Snd.uncheck(); const r = await act('undoLog', { kid: el.dataset.k, id: el.dataset.id }); toast(r.ok ? 'Undone' : "That didn't work");
  },
  async wishGot(el) { const path = `kids/${el.dataset.k}/wishlist/${el.dataset.id}`, w = Store.get(path); if (!w) return; Snd.check(); await mergeDoc(path, { got: !w.got }); },
  noteTo(el) { S.ui.noteTo = el.dataset.k; Snd.tap(); S.render(); },
  async dadNoteSend(el) {
    const box = document.getElementById('dadNote'), text = (box?.value || '').trim(); if (!text) { box?.focus(); Snd.err(); return; }
    const to = S.ui.noteTo && S.ui.noteTo !== 'all' ? S.ui.noteTo : null;
    box.value = ''; Confetti.from(el, 30); Snd.pop();
    await setDoc('feed/' + uid(), { kid: S.me.id, text, ...(to ? { to } : {}) }); toast(to ? `Sent to ${short(to)}` : 'Sent to the girls');
  },
  async dadStep(el) {
    const id = el.dataset.id, d = today(), path = 'dad/days/' + d, day = Store.get(path) || { done: [] }, done = new Set(day.done || []);
    done.has(id) ? (done.delete(id), Snd.uncheck()) : (done.add(id), Snd.check());
    Store.hold(path); Store.docs.set(path, { ...day, date: d, done: [...done] }); S.render();
    await queued('dadtick', () => act('dadRoutineTick', { step: id, date: d, done: done.has(id) }));
    Store.release(path);
  },
  dadEdit() { S.ui.editDad = !S.ui.editDad; Snd.tap(); S.render(); },
  async dadStepAdd() { const t = document.getElementById('dadStepIn').value.trim(); if (!t) return; Snd.check(); await setDoc('dad/routine/' + uid(), { slot: document.getElementById('dadSlot').value, e: '⭐', t }); },
  async dadStepDel(el) { Snd.tap(); await delDoc('dad/routine/' + el.dataset.id); },
  async dadStarter() {
    const D = [['morning', '🛏️', 'Make the bed'], ['morning', '🥣', "Girls' breakfast"], ['morning', '🎒', 'School drop-off'], ['after', '💼', 'Work block'], ['after', '🧺', 'Housework'], ['bed', '🍽️', 'Dishes done'], ['bed', '👕', 'Clothes out for tomorrow'], ['bed', '📵', 'Phone away by 10']];
    await write(D.map(([slot, e, t], i) => ({ path: 'dad/routine/d' + String(i + 1).padStart(2, '0'), set: { slot, e, t, at: new Date(Date.now() + i).toISOString() } })));
    Snd.magic();
  },
  weekKid(el) { S.ui.weekKid = el.dataset.k; Snd.tap(); S.render(); },
  dadWeekOff(el) { S.ui.dadWeekOff = Math.max(-1, Math.min(1, (S.ui.dadWeekOff || 0) + Number(el.dataset.n))); Snd.tap(); S.render(); },
  async saveRhythm() { const q = Math.max(0, Math.min(240, Number(document.getElementById('rhQuiet').value) || 0)), o = Math.max(0, Math.min(240, Number(document.getElementById('rhOur').value) || 0)); Snd.check(); await setDoc('settings/rhythm', { quiet: q, our: o }); toast('Saved. The girls see it in My week.'); },
  async pairMake(el) {
    const who = el.dataset.k, r = await api('/pair/create', { who });
    if (!r.ok) { toast("Couldn't make a code"); Snd.err(); return; }
    S.ui.pair = { who, code: r.code, hasCode: r.hasCode, until: Date.now() + r.minutes * 60e3 }; Snd.magic(); S.render();
    clearInterval(S.ui.pairT); S.ui.pairT = setInterval(() => { if (S.sub !== 'phones' || !S.ui.pair || Date.now() > S.ui.pair.until) { clearInterval(S.ui.pairT); S.ui.devices = null; } S.render(); }, 30000);
  },
  pairDone() { S.ui.pair = null; S.ui.devices = null; Snd.tap(); S.render(); },
  async forget(el) {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'Sure?'; return; }
    const r = await api('/devices/forget', { id: el.dataset.id }); Snd.tap(); S.ui.devices = null; toast(r.ok ? 'Phone removed and signed out' : "Couldn't remove it"); S.render();
  },
  kidCode(el) {
    const k = el.dataset.k;
    openSheet(`<h2 id="sheetTitle">${esc(short(k))}'s code</h2><div class="form"><label>New 4-number code<input type="tel" inputmode="numeric" id="kc" maxlength="4" autocomplete="off" autofocus></label>
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn dad" data-act="kidCodeSave" data-k="${esc(k)}">Save</button></div></div>`);
  },
  async kidCodeSave(el) {
    const code = document.getElementById('kc').value.trim();
    if (!/^\d{4}$/.test(code)) { toast('Use exactly 4 numbers'); Snd.err(); return; }
    const r = await api('/me/code', { who: el.dataset.k, code });
    closeSheet(); toast(r.ok ? `Saved. Tell ${short(el.dataset.k)} her new code.` : "Couldn't save it"); if (r.ok) { Snd.check(); S.ui.devices = null; S.render(); }
  },
  patDay(el) { const cur = { ...(S.ui.pattern || roster()?.pattern || {}) }, dw = el.dataset.dow, order = ['dad', 'mum', 'alt']; cur[dw] = order[(order.indexOf(cur[dw]) + 1) % 3]; S.ui.pattern = cur; Snd.tick(); S.render(); },
  async setAlt(el) { const r = roster() || {}; Snd.check(); await setDoc('settings/roster', { pattern: S.ui.pattern || r.pattern || {}, altMumTuesday: el.dataset.d }); },
  async savePattern() { const r = roster() || {}; const pattern = S.ui.pattern || r.pattern || {}; Snd.check(); S.ui.pattern = null; await setDoc('settings/roster', { pattern, altMumTuesday: r.altMumTuesday || null }); toast('House pattern saved'); },
  async placeAdd() {
    const t = document.getElementById('placeIn').value.trim().slice(0, 24); if (!t) return;
    const items = [...places(), { id: 'p' + uid().slice(-6), t, e: '✿' }]; Snd.check(); await setDoc('settings/places', { items });
  },
  async placeDel(el) { const items = places().filter(p => p.id !== el.dataset.id); Snd.tap(); await setDoc('settings/places', { items }); },
  goalEdit() { S.mode = 'dad'; S.sub = 'settings'; S.render(); setTimeout(() => document.getElementById('gTitle')?.scrollIntoView({ block: 'center' }), 50); },
  async goalSave() {
    const title = document.getElementById('gTitle').value.trim(); if (!title) { toast('Give the goal a name'); Snd.err(); return; }
    const target = Math.max(10, Math.min(1000, Number(document.getElementById('gTarget').value) || 100));
    Snd.fanfare(); await setDoc('settings/goal', { title, emoji: document.getElementById('gEmoji').value.trim() || '🎯', target, start: nowIso() }); toast('New family goal started');
  },
  async changeCode() {
    const old = document.getElementById('oldCode').value.trim(), code = document.getElementById('newCode').value.trim();
    if (!/^\d{6}$/.test(code)) { toast('The new code needs 6 numbers'); Snd.err(); return; }
    const r = await api('/me/code', { old, code });
    toast(r.ok ? 'Code changed' : r.error === 'old_code_wrong' ? 'Your current code was wrong' : "Couldn't change it"); r.ok ? Snd.check() : Snd.err();
    if (r.ok) { document.getElementById('oldCode').value = ''; document.getElementById('newCode').value = ''; }
  },
};
