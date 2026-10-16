/* The family side (night sky): home, calendar with Mum's and Dad's houses, jobs, ideas, messages. */
import { esc, Store, today, ymd, parseYmd, addDays, DOW, MON, MONL, ago, byAtDesc, fmtShort, fmtTime, uid, nowIso, Snd, Confetti, toast, openSheet, closeSheet, pickRow, picked, act, setDoc, mergeDoc, delDoc, write } from './core.js';
import { S, P, people, kids, avatar, accentOf, short, nick, famName, MOODS, EVENT_EMOJI, IDEA_FILTERS, homeFor, homeName, nextSwitch, roster, routineOf, dayOf, routineStats, starsOf, ideasList, jobsFor, isParent, isKid } from './model.js';
import { taskRow } from './room.js';

export const FAMILY_TABS = [['home', '⌂', 'Home'], ['cal', '📅', 'Calendar'], ['me', '', ''], ['jobs', '✅', 'Jobs'], ['ideas', '💡', 'Ideas']];

export function familyNav() {
  return `<nav class="nav dk">${FAMILY_TABS.map(([id, e, t]) => id === 'me'
    ? `<button class="mid" data-act="toMine" aria-label="${isParent() ? 'Dad mode' : 'My room'}">${avatar(S.me.id)}</button>`
    : `<button class="${S.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}" aria-current="${S.tab === id}"><i>${e}</i>${t}</button>`).join('')}</nav>`;
}

export function viewFamily() {
  const body = { home: tabHome, cal: tabCal, jobs: tabJobs, ideas: tabIdeas }[S.tab] || tabHome;
  return `<div class="screen dark"><div class="main">${body()}</div>${familyNav()}</div>`;
}

const notesOn = d => Store.col('notes').filter(n => n.date === d && (!n.priv || n.by === S.me.id)).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
const eventsOn = d => Store.col('events').filter(e => e.date === d).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

/* ---------- Home ---------- */
function tabHome() {
  const t = today(), h = homeFor(t), nx = nextSwitch(), ps = people(), d = new Date();
  const goal = Store.get('pub/family')?.goal;
  const hasHead = S.boot?.art?.includes('famhead');
  const evs = eventsOn(t), notes = notesOn(t), jobs = jobsFor('all');
  const myRoutine = isKid() ? routineOf(S.me.id) : [];
  const done = new Set(isKid() ? dayOf(S.me.id).done || [] : []);
  const slot = (() => { const hr = d.getHours(); return hr < 12 ? 'morning' : hr < 17 ? 'after' : 'bed'; })();
  const posts = Store.col('feed').sort(byAtDesc);
  const limit = S.ui.wallAll ? 30 : 4;
  const ideas = ideasList(), idea = ideas[(d.getDate() * 7 + d.getMonth()) % ideas.length];
  return `
  <div class="fhead ${hasHead ? '' : 'noimg'}">${hasHead ? `<img src="/art/famhead" alt="Our family, ${esc(famName())}">` : `<div class="ftitle"><h1>Our Family</h1><p>${esc(famName())} · Together every day brighter ♡</p></div>`}</div>
  <div class="pcards" style="--n:${Math.min(ps.length, 4)}">${ps.map(p => `<button class="pc" data-act="${p.id === S.me.id ? 'toMine' : 'noop'}" style="--pcs:${p.role === 'parent' ? '#E1EAFF' : p.accent === 'lilac' ? '#EFE5FF' : p.accent === 'mint' ? '#D3F2E4' : p.accent === 'sun' ? '#FFF1C7' : p.accent === 'ocean' ? '#DAEBFF' : '#FFE1EC'}">
    ${avatar(p.id, p.art?.mini ? 'mini' : 'head')}<b>${esc(p.role === 'parent' ? p.name : p.name)}${p.role === 'kid' ? ` ★${Number(p.pub?.stars) || 0}` : ''}</b><small>🔥 ${Number(p.pub?.streak) || 0} ${Number(p.pub?.streak) === 1 ? 'day' : 'days'}</small></button>`).join('')}</div>
  ${goal ? `<div class="goalcard"><span style="font-size:22px">${esc(goal.emoji || '🎯')}</span><b>Family goal: ${esc(goal.title)}</b><b>★ ${Math.min(goal.progress, goal.target)}/${goal.target}</b><span class="bar"><i style="width:${Math.min(100, Math.round(goal.progress / goal.target * 100))}%"></i></span>${goal.progress >= goal.target ? '<b style="grid-column:1/-1">🎉 We did it! Time to plan it.</b>' : ''}</div>` : isParent() ? `<button class="card" data-act="goalEdit" style="text-align:left"><h3>🎯 Set a family goal</h3><p class="note">Every star the girls earn fills it up together.</p></button>` : ''}
  ${isKid() && myRoutine.length ? `<section class="card white"><h3>📅 My ${slot === 'morning' ? 'morning' : slot === 'after' ? 'after school' : 'bedtime'} list <em>${DOW[d.getDay()]}</em></h3>
    <div class="rtiles">${myRoutine.filter(r => r.slot === slot).map(r => `<button class="${done.has(r.id) ? 'ok' : ''}" data-act="step" data-k="${esc(S.me.id)}" data-id="${esc(r.id)}"><i>${esc(r.e || '•')}</i>${esc(r.t)}<u>${done.has(r.id) ? '✓' : ''}</u></button>`).join('')}</div></section>` : ''}
  ${isParent() ? `<section class="card white"><h3>👧 The girls today</h3>${kids().map(k => { const rs = routineStats(k.id); return `<div class="tl">${avatar(k.id, 'head', 'av', 'width:30px;height:30px')}<span>${esc(k.name)}: routine ${rs.done}/${rs.total}</span><time>★ ${starsOf(k.id)}</time></div>`; }).join('')}</section>` : ''}
  <section class="card white"><h3>📅 Today <em>${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}</em></h3>
    ${evs.map(e => `<div class="tl"><i class="${P(e.who)?.role === 'parent' ? 'parent' : ''}"></i><span>${esc(e.emoji || '📌')} ${esc(e.title)}</span><time>${e.time ? fmtTime(e.time) : 'All day'}</time></div>`).join('')}
    ${notes.map(n => `<div class="tl"><i class="note"></i><span>📝 ${esc(n.text)}</span><time>${n.time ? fmtTime(n.time) : ''}</time></div>`).join('')}
    <button class="tl" data-act="tab" data-tab="jobs"><i class="job"></i><span>${jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} to do together` : 'No family jobs yet'}</span><time>Jobs ›</time></button>
    ${evs.length ? '' : '<button class="tl" data-act="addEvent"><i></i><span class="muted">Nothing on the calendar today</span><time>Add ›</time></button>'}
  </section>
  ${h !== 'unknown' ? `<button class="tonight h-${h}" data-act="tab" data-tab="cal"><span class="big">${h === 'swap' ? '⇄' : '⌂'}</span><span><b>Tonight: ${esc(homeName(h))}</b><small>${nx ? `${nx.home === 'dad' ? "Dad's" : nx.home === 'mum' ? "Mum's" : 'Swap'} in ${nx.sleeps} ${nx.sleeps === 1 ? 'sleep' : 'sleeps'}` : 'Same all fortnight'}</small></span></button>` : ''}
  <section class="card white" id="msgs"><h3>💬 Family messages</h3>
    <div class="compose">${avatar(S.me.id)}<textarea id="msgText" rows="1" maxlength="280" placeholder="Write to the family…" aria-label="Write to the family"></textarea><button class="btn solid small" data-act="msgSend">Post</button></div>
    ${posts.length ? posts.slice(0, limit).map(postHtml).join('') : '<div class="empty">No messages yet. Say hi!</div>'}
    ${posts.length > limit ? '<button class="btn small" data-act="wallMore">Show more</button>' : ''}
  </section>
  ${idea ? `<button class="card white idea" data-act="ideaToday" data-t="${esc(idea.t)}"><span class="eyebrow">Idea for today</span><span class="ie">${idea.e}</span><b>${esc(idea.t)}</b><p>${esc(idea.d)}</p></button>` : ''}`;
}

function postHtml(f) {
  const who = P(f.kid) ? f.kid : null, m = MOODS.find(x => x.id === f.mood);
  const hearts = Object.keys(f.hearts || {}).filter(k => f.hearts[k]);
  const mine = hearts.includes(S.me.id);
  const cm = Store.col('comments').filter(c => c.post === f.id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return `<article class="post">${avatar(who || 'x')}<div class="bd">
    <div class="meta">${esc(who ? nick(who) : 'Someone')}${f.to && P(f.to) ? ` <span class="chip">to ${esc(P(f.to).name)}</span>` : ''}${f.type === 'idea' ? ' <span class="chip">wants to do this</span>' : m ? ` <span class="chip">${m.e} ${m.t}</span>` : ''}<time>${ago(f.at)}</time></div>
    ${f.text ? `<p class="txt">${esc(f.text)}</p>` : ''}
    ${f.hug ? '<span class="chip" style="width:fit-content">🤗 Would love a hug</span>' : ''}
    ${cm.slice(-2).map(c => `<p class="cmt"><b>${esc(nick(c.who))}</b> ${esc(c.text)}</p>`).join('')}
    <div class="acts"><button class="${mine ? 'on' : ''}" data-act="heart" data-id="${esc(f.id)}" aria-pressed="${mine}">${mine ? '♥' : '♡'} ${hearts.length ? hearts.map(h => esc(short(h))).join(', ') : 'Love'}</button>
      <button data-act="comment" data-id="${esc(f.id)}">💬 ${cm.length || 'Reply'}</button>
      ${isParent() || f.kid === S.me.id ? `<button data-act="postDel" data-id="${esc(f.id)}" aria-label="Remove message" style="margin-left:auto">✕</button>` : ''}</div>
  </div></article>`;
}

/* ---------- Calendar ---------- */
function tabCal() {
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i)));
  const sel = S.ui.calSel || today();
  const m = S.ui.calMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const y = m.getFullYear(), mo = m.getMonth(), first = new Date(y, mo, 1), offset = (first.getDay() + 6) % 7, n = new Date(y, mo + 1, 0).getDate(), t = today();
  let cells = ''; for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let dd = 1; dd <= n; dd++) {
    const s = ymd(new Date(y, mo, dd)), h = homeFor(s), ev = eventsOn(s).length + notesOn(s).length, ov = Store.get('stays/' + s);
    cells += `<button class="cday h-${h} ${s === t ? 'is-today' : ''} ${s === sel ? 'is-sel' : ''} ${s < t ? 'past' : ''}" data-act="calDay" data-d="${s}" aria-label="${fmtShort(s)}, ${homeName(h)}">${dd}${ev ? '<i class="evdot"></i>' : ''}${ov && isParent() ? '<i class="ov"></i>' : ''}</button>`;
  }
  const sh = homeFor(sel), sev = eventsOn(sel), snotes = notesOn(sel);
  const r = roster(), needsAlt = r?.pattern && !r.altMumTuesday && Object.values(r.pattern).includes('alt');
  return `<div class="row"><p class="t-b grow">Calendar</p><button class="btn solid small" data-act="addEvent">＋ Add</button></div>
    <div class="strip">${days.map((d, i) => { const dt = parseYmd(d), h = homeFor(d); return `<button class="${sel === d ? 'on' : ''}" data-act="calSel" data-d="${d}">${i === 0 ? 'Today' : DOW[dt.getDay()]}<b>${dt.getDate()}</b><span class="hd ${h}"></span></button>`; }).join('')}</div>
    <section class="card white"><h3>${esc(fmtShort(sel))} <em>${esc(homeName(sh))}</em></h3>
      ${sev.map(e => `<div class="evrow"><span class="e">${esc(e.emoji || '📌')}</span><span class="grow"><b>${esc(e.title)}</b><small>${e.time ? fmtTime(e.time) : 'All day'} · ${!e.who || e.who === 'all' ? 'Whole crew' : esc(short(e.who))}</small></span>${isParent() || e.by === S.me.id ? `<button class="x-btn" data-act="delEvent" data-id="${esc(e.id)}" aria-label="Delete">✕</button>` : ''}</div>`).join('')}
      ${snotes.map(nn => `<div class="evrow"><span class="e">📝</span><span class="grow"><b>${esc(nn.text)}</b><small>${nn.time ? fmtTime(nn.time) : ''}${nn.priv ? ' · just you' : ''}</small></span></div>`).join('')}
      ${sev.length || snotes.length ? '' : '<p class="note">Nothing on yet.</p>'}
      ${isParent() ? `<div class="row"><button class="btn small" data-act="flipHome" data-d="${sel}">Switch to ${sh === 'dad' ? "Mum's" : "Dad's"}</button>${Store.get('stays/' + sel) ? `<button class="btn small" data-act="clearHome" data-d="${sel}">Back to the usual</button>` : ''}</div>` : ''}
    </section>
    <section class="card white">
      <div class="calhead"><button class="iconbtn" data-act="calMove" data-n="-1" aria-label="Previous month">‹</button><h3>${MONL[mo]} ${y}</h3><button class="iconbtn" data-act="calMove" data-n="1" aria-label="Next month">›</button></div>
      <div class="legend"><span class="h-dad">Dad's house</span><span class="h-mum">Mum's house</span>${needsAlt ? '<span class="h-swap">Swap day</span>' : ''}</div>
      <div class="calgrid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="dow">${x}</span>`).join('')}${cells}</div>
      ${!r?.pattern ? `<p class="note">${isParent() ? 'Set the weekly house pattern in Dad mode › Settings.' : "Dad hasn't set the house plan yet."}</p>` : ''}
    </section>`;
}

/* ---------- Jobs ---------- */
function tabJobs() {
  const f = S.ui.jobWho || 'all', t = today();
  const all = Store.col('tasks').filter(tk => f === 'all' || !tk.who || tk.who === f || tk.who === 'all');
  const now = all.filter(tk => tk.daily || !tk.date || tk.date <= t).sort((a, b) => (a.daily === b.daily ? 0 : a.daily ? -1 : 1) || String(a.at || '').localeCompare(String(b.at || '')));
  const later = all.filter(tk => !tk.daily && tk.date && tk.date > t).sort((a, b) => a.date.localeCompare(b.date));
  return `<div class="row"><p class="t-b grow">To do together</p><button class="btn solid small" data-act="taskNew">＋ Add</button></div>
    <p class="note">${isKid() ? 'Tick the jobs you do. Stars go straight in your jar.' : 'Daily jobs reset every morning. You set the stars.'}</p>
    <div class="chips">${[['all', 'Everyone'], ...people().map(p => [p.id, short(p.id)])].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="jobWho" data-w="${esc(k)}">${esc(l)}</button>`).join('')}</div>
    <section class="card white">${now.length ? now.map(taskRow).join('') : `<div class="empty">No jobs yet.${isParent() ? '<br><br><button class="btn solid" data-act="starterJobs">Add starter jobs</button>' : ''}</div>`}</section>
    ${later.length ? `<p class="sec-title">Coming up</p><section class="card white">${later.map(taskRow).join('')}</section>` : ''}`;
}

/* ---------- Ideas ---------- */
function tabIdeas() {
  const all = ideasList(), f = S.ui.ideaFilter || 'all';
  const list = f === 'all' ? all : all.filter(i => (i.tags || []).includes(f));
  if (!S.ui.idea || !list.some(x => x.t === S.ui.idea)) S.ui.idea = list[new Date().getDate() % Math.max(1, list.length)]?.t;
  const it = list.find(x => x.t === S.ui.idea);
  return `<p class="t-b">What should we do?</p>
    <div class="chips">${IDEA_FILTERS.map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-act="ideaFilter" data-f="${k}">${t}</button>`).join('')}</div>
    ${it ? `<div class="ideacard ${S.ui.spun ? 'spin' : ''}"><span class="ie">${it.e}</span><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div>
    <div class="row" style="flex-wrap:wrap;justify-content:center"><button class="btn solid" data-act="spin">✨ Spin again</button>${isKid() ? '<button class="btn" data-act="ideaPlan">＋ My planner</button><button class="btn" data-act="ideaAsk">♡ Ask Dad</button>' : '<button class="btn" data-act="ideaShare">📣 Suggest to the girls</button>'}</div>` : '<div class="empty">No ideas here.</div>'}
    <p class="sec-title">More ideas</p>
    <div class="minis">${list.filter(x => x !== it).slice(0, 8).map(x => `<button data-act="ideaPick" data-t="${esc(x.t)}"><span>${x.e}</span>${esc(x.t)}</button>`).join('')}</div>`;
}

/* ---------- actions ---------- */
export const FAMILY_ACTIONS = {
  noop() {},
  async msgSend(el) {
    const box = document.getElementById('msgText'), text = (box?.value || '').trim();
    if (!text) { box?.focus(); Snd.err(); return; }
    box.value = ''; Confetti.from(el, 30); Snd.pop();
    await setDoc('feed/' + uid(), { kid: S.me.id, text });
    toast('Posted to the family');
  },
  wallMore() { S.ui.wallAll = true; Snd.tap(); S.render(); },
  async heart(el) {
    const id = el.dataset.id, f = Store.get('feed/' + id); if (!f) return;
    const h = { ...(f.hearts || {}) }; h[S.me.id] ? delete h[S.me.id] : (h[S.me.id] = true);
    Store.docs.set('feed/' + id, { ...f, hearts: h }); S.render();
    if (h[S.me.id]) { Snd.boop(); Confetti.from(el, 16); } else Snd.tap();
    await act('heart', { post: id });
  },
  comment(el) {
    const id = el.dataset.id, f = Store.get('feed/' + id); if (!f) return;
    const cm = Store.col('comments').filter(c => c.post === id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    openSheet(`<h2 id="sheetTitle">Replies</h2><p class="lead">${esc(nick(f.kid))}${f.text ? `: “${esc(f.text.slice(0, 90))}”` : ''}</p>
      <div style="display:grid;gap:8px;margin-bottom:12px">${cm.map(c => `<div class="row">${avatar(c.who, 'head', 'av', 'width:30px;height:30px')}<p class="grow"><b>${esc(nick(c.who))}</b> ${esc(c.text)}</p>${isParent() || c.who === S.me.id ? `<button class="x-btn" data-act="cmtDel" data-id="${esc(c.id)}" aria-label="Delete">✕</button>` : ''}</div>`).join('')}</div>
      <div class="form"><textarea id="cmtText" maxlength="240" placeholder="Write something kind…" autofocus></textarea>
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="cmtSave" data-post="${esc(id)}">Reply</button></div></div>`);
  },
  async cmtSave(el) {
    const t = (document.getElementById('cmtText')?.value || '').trim(); if (!t) { Snd.err(); return; }
    closeSheet(); Snd.pop(); await setDoc('comments/' + uid(), { post: el.dataset.post, who: S.me.id, text: t });
  },
  async cmtDel(el) { el.closest('.row')?.remove(); Snd.tap(); await delDoc('comments/' + el.dataset.id); },
  async postDel(el) { Snd.tap(); await delDoc('feed/' + el.dataset.id); },
  addEvent() {
    openSheet(`<h2 id="sheetTitle">Add to the calendar</h2><div class="form">
      <label>What's on<input type="text" id="evTitle" maxlength="60" placeholder="Swimming lesson" autofocus></label>
      <div class="two"><label>Day<input type="date" id="evDate" value="${S.ui.calSel || today()}"></label><label>Time<input type="time" id="evTime"></label></div>
      <label>Who<select id="evWho"><option value="all">The whole crew</option>${people().map(p => `<option value="${esc(p.id)}" ${p.id === S.me.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label>Sticker</label>${pickRow('ev', EVENT_EMOJI, EVENT_EMOJI[0])}
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="saveEvent">Add it</button></div></div>`);
  },
  async saveEvent() {
    const title = document.getElementById('evTitle').value.trim(), date = document.getElementById('evDate').value;
    if (!title || !date) { toast('Add a name and a day first'); Snd.err(); return; }
    const body = { title, date, time: document.getElementById('evTime').value || '', who: document.getElementById('evWho').value, emoji: picked('ev') || '📌' };
    closeSheet(); Snd.check(); S.ui.calSel = date;
    await setDoc('events/' + uid(), body); toast('Added to the calendar');
  },
  async delEvent(el) { Snd.tap(); await delDoc('events/' + el.dataset.id); },
  calSel(el) { S.ui.calSel = el.dataset.d; Snd.tap(); S.render(); },
  calDay(el) { S.ui.calSel = el.dataset.d; Snd.tap(); S.render(); },
  calMove(el) { const m = S.ui.calMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1); S.ui.calMonth = new Date(m.getFullYear(), m.getMonth() + Number(el.dataset.n), 1); Snd.tap(); S.render(); },
  async flipHome(el) {
    const d = el.dataset.d, cur = homeFor(d);
    Snd.check(); await setDoc('stays/' + d, { home: cur === 'dad' ? 'mum' : 'dad' });
  },
  async clearHome(el) { Snd.tap(); await delDoc('stays/' + el.dataset.d); },
  jobWho(el) { S.ui.jobWho = el.dataset.w; Snd.tap(); S.render(); },
  taskNew() {
    openSheet(`<h2 id="sheetTitle">Add a job</h2><div class="form">
      <label>What needs doing?<input type="text" id="tkTitle" maxlength="60" placeholder="Set the table" autofocus></label>
      <label>Picture</label>${pickRow('tke', ['✅', '🍽️', '🧺', '🧹', '🐶', '📚', '🛏️', '🌱', '🚗', '🗑️', '🦷', '🎒'], '✅')}
      <label>Who's it for?<select id="tkWho"><option value="all">Everyone</option>${people().map(p => `<option value="${esc(p.id)}" ${p.id === S.me.id && isKid() ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="hug" style="color:var(--ink)"><input type="checkbox" id="tkDaily" checked> Every day</label>
      <label>Or on one day<input type="date" id="tkDate"></label>
      ${isParent() ? `<label>Stars for doing it</label>${pickRow('tks', ['0', '1', '2', '3', '5'], '1')}` : '<p class="note">Dad sets the stars for jobs.</p>'}
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="taskSave">Add job</button></div></div>`);
  },
  async taskSave() {
    const t = document.getElementById('tkTitle').value.trim(); if (!t) { Snd.err(); return; }
    const date = document.getElementById('tkDate').value || null, daily = document.getElementById('tkDaily').checked && !date;
    const body = { t, e: picked('tke') || '✅', who: document.getElementById('tkWho').value, daily, date: daily ? null : date, stars: isParent() ? Number(picked('tks') || 0) : 0 };
    closeSheet(); Snd.check(); await setDoc('tasks/' + uid(), body); toast('Job added');
  },
  async starterJobs() {
    const J = [['🍽️', 'Set the table', 1], ['🧺', 'Put my washing away', 1], ['📚', 'Read for 20 minutes', 1], ['🐶', 'Help with a pet or plant', 1], ['📵', 'Family time, no screens', 2]];
    await write(J.map(([e, t, n], i) => ({ path: 'tasks/' + uid() + i, set: { t, e, who: 'all', daily: true, date: null, stars: n, at: nowIso() } })));
    Snd.magic(); toast('Starter jobs added');
  },
  ideaFilter(el) { S.ui.ideaFilter = el.dataset.f; S.ui.idea = null; Snd.tap(); S.render(); },
  ideaPick(el) { S.ui.idea = el.dataset.t; Snd.pop(); window.scrollTo({ top: 0 }); S.render(); },
  ideaToday(el) { S.ui.idea = el.dataset.t; S.ui.ideaFilter = 'all'; S.tab = 'ideas'; Snd.pop(); window.scrollTo({ top: 0 }); S.render(); },
  spin() {
    const all = ideasList(), f = S.ui.ideaFilter || 'all', list = f === 'all' ? all : all.filter(i => (i.tags || []).includes(f));
    if (list.length < 2) return;
    let next; do { next = list[Math.floor(Math.random() * list.length)].t; } while (next === S.ui.idea);
    S.ui.idea = next; S.ui.spun = true; Snd.magic(); S.render(); setTimeout(() => { S.ui.spun = false; }, 700);
  },
  async ideaPlan() { const it = ideasList().find(x => x.t === S.ui.idea); if (!it) return; Snd.pop(); await setDoc(`kids/${S.me.id}/plans/${uid()}`, { title: `${it.e} ${it.t}`, date: null, color: '#8D55E0', done: false }); toast('Added to your planner'); },
  async ideaAsk(el) { const it = ideasList().find(x => x.t === S.ui.idea); if (!it) return; Confetti.from(el, 30); Snd.boop(); await setDoc('feed/' + uid(), { kid: S.me.id, type: 'idea', text: `${it.e} Can we do this? ${it.t}` }); toast('Asked Dad on the family wall'); },
  async ideaShare(el) { const it = ideasList().find(x => x.t === S.ui.idea); if (!it) return; Confetti.from(el, 30); Snd.boop(); await setDoc('feed/' + uid(), { kid: S.me.id, type: 'idea', text: `${it.e} How about this? ${it.t}` }); toast('Posted to the family'); },
};
