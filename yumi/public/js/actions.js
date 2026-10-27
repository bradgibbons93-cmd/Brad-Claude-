/* Everything a tap can do. Views live in views.js. */
import { $, esc, Store, api, today, ymd, parseYmd, addDays, DOW, uid, nowIso, ordinal, ago, fmtShort, Snd, Confetti, toast, openSheet, closeSheet, pickRow, picked, act, queued, write, setDoc, mergeDoc, delDoc } from './core.js';
import { S, P, people, kids, avatar, short, nick, MOODS, STAR_REASONS, STRIKE_REASONS, EVENT_EMOJI, STARTER_ROUTINE, JOURNAL_PROMPTS, STICKERS, WISH_EMOJI, COVERS, PLAN_COLORS,
  homeFor, places, roster, routineOf, dayOf, strikesOf, starsOf, rules, ideasList, isParent, isKid, rewardById } from './model.js';
import { isIOS, standalone, pushStatus, turnOn, turnOff } from './push.js';
import { starReasonButtons } from './extras.js';

const kidOf = el => el?.dataset?.k || S.me.id;
export const ROOM_ACTIONS = {
  principalSeen(el) { try { localStorage.setItem(el.dataset.key, '1'); } catch (e) {} Snd.tap(); S.render(); },
  buddyTap(el) { S.ui.bump = (S.ui.bump || 0) + 1; Snd.boop(); Confetti.from(el, 14); S.render(); },
  openMine() { S.tab = 'me'; S.sub = 'mine'; Snd.tap(); window.scrollTo({ top: 0 }); S.render(); },
  sub(el) { S.sub = el.dataset.sub || null; S.ui.intro = false; Snd.tap(); window.scrollTo({ top: 0 }); S.render(); },
  introDone() { S.ui.intro = false; S.sub = null; S.tab = 'home'; Snd.magic(); window.scrollTo({ top: 0 }); S.render(); },
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
    else if (r.asked) { setTimeout(() => { Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 140); toast('Whole routine done! 🎉 Sent to Dad to check'); }, 150); }
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
    if (r.done) { Confetti.from(el, 30); Snd.check(); if (r.pending) toast('Nice! Sent to Dad to check ⭐'); } else Snd.uncheck();
  },
  async routineOk(el) {
    const ok = el.dataset.ok === '1', who = short(el.dataset.k);
    el.disabled = true;
    const r = await act('routineApprove', { kid: el.dataset.k, date: el.dataset.d, ok });
    if (!r.ok) { el.disabled = false; toast(r.error === 'gone' ? 'Already sorted' : "That didn't save"); return; }
    if (ok) { Snd.star(); Confetti.from(el, 40); toast(`Star given to ${who} ⭐`); } else { Snd.tap(); toast(`Told ${who} not yet`); }
  },
  async jobOk(el) {
    const ok = el.dataset.ok === '1';
    el.disabled = true;
    const r = await act('jobApprove', { id: el.dataset.id, ok });
    if (!r.ok) { el.disabled = false; toast(r.error === 'gone' ? 'Already sorted' : "That didn't save"); return; }
    if (ok) { Snd.star(); Confetti.from(el, 40); toast('Stars given ⭐'); } else { Snd.tap(); toast('Told her not yet'); }
  },
  async taskDel(el) { Snd.tap(); await delDoc('tasks/' + el.dataset.id); },
  weekOff(el) { S.ui.weekOff = Math.max(-1, Math.min(1, (S.ui.weekOff || 0) + Number(el.dataset.n))); S.ui.weekSel = null; Snd.tap(); S.render(); },
  weekSel(el) { S.ui.weekSel = el.dataset.d; Snd.tap(); S.render(); },
  async pickPlace(el) { await savePick(el.dataset.d, { place: el.dataset.v }, 'place'); },
  async pickFood(el) { await savePick(el.dataset.d, { food: el.dataset.v }, 'food'); },
  async saveWeekNote(el) { const v = (document.getElementById('weekNote')?.value || '').trim().slice(0, 200); await savePick(el.dataset.d, { note: v }, 'note'); toast('Note saved'); },
  /* Tap a treat: see what it costs, what's left after, and get it. */
  rewardOpen(el) {
    const R = rules(), n = starsOf(S.me.id);
    if (el.dataset.id === 'payday') {
      Snd.tap();
      openSheet(`<div class="rsheet"><span class="re">💵</span><h2 id="sheetTitle">$${R.paydayDollars} payday</h2><p class="lead">Fill your jar to ${R.paydayStars} stars and Dad pays you $${R.paydayDollars}. It happens by itself, no need to tap anything.</p>
        <div class="rmath"><span>In your jar<b>${n} ★</b></span><span>To go<b>${Math.max(0, R.paydayStars - n)} ★</b></span></div>
        <button class="btn wide" data-act="closeSheet">Keep saving</button></div>`);
      return;
    }
    const r = rewardById(el.dataset.id); if (!r) return;
    const can = n >= r.cost; Snd.pop();
    openSheet(`<div class="rsheet"><span class="re">${esc(r.e)}</span><h2 id="sheetTitle">${esc(r.t)}</h2><p class="lead">${esc(r.d)}</p>
      <div class="rmath"><span>Costs<b>${r.cost} ★</b></span><span>You have<b>${n} ★</b></span><span>${can ? 'Left after' : 'To go'}<b>${can ? n - r.cost : r.cost - n} ★</b></span></div>
      ${can ? `<button class="btn solid wide big" data-act="rewardGet" data-id="${esc(r.id)}">Get it! Spend ${r.cost} ★</button><p class="note" style="text-align:center">Dad gets a message straight away.</p>`
        : `<button class="btn wide" disabled>${r.cost - n} more ${r.cost - n === 1 ? 'star' : 'stars'} to go</button><p class="note" style="text-align:center">Keep going, you're getting there! ⭐</p>`}
      <button class="btn wide" data-act="closeSheet">${can ? 'Save my stars' : 'OK'}</button></div>`);
  },
  async rewardGet(el) {
    if (el.disabled) return; el.disabled = true; el.textContent = 'Sending to Dad…';
    const r = await act('redeem', { reward: el.dataset.id });
    if (!r.ok) { el.disabled = false; toast(r.error === 'not_enough' ? 'Not enough stars yet' : "That didn't work. Try again."); Snd.err(); return; }
    closeSheet(); Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 120);
    toast(`Sent to Dad! 🎉 ${r.stars} ★ left in your jar`);
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
  ideaToday(el) { S.ui.idea = el.dataset.t; S.ui.ideaFilter = 'all'; S.tab = 'family'; S.sub = 'ideas'; Snd.pop(); window.scrollTo({ top: 0 }); S.render(); },
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
  quickStar() { kidsSheet('Give a star', `<div class="form">${kids().map(k => `<p class="sec-title">${esc(k.name)}</p>${starReasonButtons(k.id, true)}`).join('')}</div>`); },
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
  goalEdit() { S.tab = 'me'; S.sub = 'settings'; S.render(); setTimeout(() => document.getElementById('gTitle')?.scrollIntoView({ block: 'center' }), 50); },
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

/* ---------- new home-screen buttons ---------- */
const go = (tab, sub = null) => { S.tab = tab; S.sub = sub; Snd.tap(); window.scrollTo({ top: 0 }); S.render(); };
S.loadDevices = () => {
  S.ui.devLoading = true;
  Promise.all([api('/devices'), api('/boot')]).then(([r, b]) => { S.ui.devices = r.ok ? r : { devices: [] }; if (b.people) S.boot.people = b.people; S.ui.devLoading = false; S.render(); });
};
const fmtLeft = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
setInterval(() => {
  const t = S.ui?.timer; if (!t?.end) return;
  const left = t.end - Date.now();
  const a = document.getElementById('timerLeft'), big = document.getElementById('tBig'), ring = document.getElementById('tRing');
  if (a) a.textContent = fmtLeft(left);
  if (big) big.textContent = fmtLeft(left);
  if (ring) ring.style.setProperty('--p', `${Math.min(100, 100 - left / t.total * 100)}%`);
  if (left <= 0) { S.ui.timer = null; Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 140); toast(`⏰ Time's up! ${t.label || ''}`); closeSheet(); S.render(); }
}, 1000);

export const EXTRA_ACTIONS = {
  personTap(el) {
    const k = el.dataset.k, p = P(k); if (!p) return;
    if (isParent() && p.role === 'kid') { S.ui.rk = k; go('rewards'); return; }
    if (k === S.me.id) { go(isParent() ? 'routines' : 'routines'); if (isParent()) S.ui.rk = 'me'; return; }
    Snd.boop(); toast(p.role === 'kid' ? `${p.nick || p.name} has ★ ${Number(p.pub?.stars) || 0} in her jar` : `${p.nick || p.name}: 🔥 ${Number(p.pub?.streak) || 0} day streak`);
  },
  openInbox() { go('home'); setTimeout(() => document.getElementById('waiting')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); },
  goNotes() { go('family', 'notes'); },
  goCal() { go('family', 'cal'); },
  goGirlsWeek() { go('family', 'week'); },
  pickKid(el) { S.ui.rk = el.dataset.k; S.ui.slot = null; S.ui.editRoutine = null; Snd.tap(); S.render(); },
  async focusSend(el) {
    const box = document.getElementById('fbText'), text = (box?.value || '').trim();
    if (!text) { box?.focus(); Snd.err(); return; }
    box.value = ''; Confetti.from(el, 24); Snd.pop();
    await setDoc('feed/' + uid(), { kid: S.me.id, text }); toast('Posted for the family 💗');
  },
  noteNew() {
    openSheet(`<h2 id="sheetTitle">💗 Family note</h2><div class="form"><textarea id="noteText" class="hand" rows="4" maxlength="280" placeholder="Be kind, work hard, have fun!" autofocus></textarea>
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="noteSend">Post it</button></div></div>`);
  },
  async noteSend(el) {
    const text = (document.getElementById('noteText')?.value || '').trim(); if (!text) { Snd.err(); return; }
    closeSheet(); Snd.pop(); Confetti.burst(innerWidth / 2, innerHeight / 2, 40);
    await setDoc('feed/' + uid(), { kid: S.me.id, text }); toast('Posted for the family 💗');
  },
  timerOpen() {
    const t = S.ui.timer;
    const left = t?.end ? t.end - Date.now() : 0;
    openSheet(`<h2 id="sheetTitle">⏱️ Timer</h2><div class="timer">
      ${t?.end ? `<div class="ring" id="tRing" style="--p:${Math.min(100, 100 - left / t.total * 100)}%"><span id="tBig">${fmtLeft(left)}</span></div><p class="handnote">${esc(t.label || '')}</p>
        <div class="row"><button class="btn bad" data-act="timerStop">Stop</button><button class="btn solid" data-act="closeSheet">Keep going</button></div>`
      : `<div class="ring" style="--p:0%"><span>⏱️</span></div><div class="form" style="width:100%"><input type="text" id="tLabel" maxlength="24" placeholder="What for? Quiet time, homework…"></div>
        <div class="presets">${[2, 5, 10, 15, 20, 30, 60].map(m => `<button class="btn" data-act="timerStart" data-m="${m}">${m} min</button>`).join('')}</div>`}
    </div>`);
  },
  timerStart(el) {
    const m = Number(el.dataset.m) || 5, label = (document.getElementById('tLabel')?.value || '').trim();
    S.ui.timer = { end: Date.now() + m * 60e3, total: m * 60e3, label: label || `${m} min` };
    closeSheet(); Snd.magic(); toast(`Timer started: ${m} min`); S.render();
  },
  timerStop() { S.ui.timer = null; closeSheet(); Snd.tap(); S.render(); },
};

/* ---------- notifications ---------- */
const SHARE_IC = '<svg class="ios-ic" viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function pushSheet(st) {
  const kid = isKid(), remind = P(S.me.id)?.remind !== false;
  const body = {
    on: `<p class="banner good">✓ On for this phone</p>
      <p class="note">${kid ? 'You get a ping for stars, strikes, notes from Dad and your routine reminders.' : "You get a ping when the girls finish a routine, check in, pick a reward, share a page or want a hug."}</p>
      ${kid ? `<button class="btn wide" data-act="remindToggle">⏰ Routine reminders: <b>${remind ? 'On' : 'Off'}</b></button>` : ''}
      <div class="actions"><button class="btn bad small" data-act="pushOff">Turn off</button><button class="btn solid" data-act="pushTest">Send a test</button></div>`,
    off: `<p class="note">${kid ? 'Get a ping when you earn a star, a note from Dad, and little reminders for your routine.' : 'Know the moment the girls finish their routine, check in, pick a reward or want a hug.'}</p>
      <button class="btn solid wide" data-act="pushOn">Turn on notifications</button>`,
    install: `<p class="note">On an iPhone, notifications work once Yumi is on your Home Screen:</p>
      <ol class="installsteps"><li><i>1</i><span>Tap <b>Share</b> ${SHARE_IC} at the bottom of Safari</span></li><li><i>2</i><span>Tap <b>Add to Home Screen</b>, then <b>Add</b></span></li><li><i>3</i><span>Open <b>Yumi</b> from your Home Screen and tap <b>Turn on notifications</b></span></li></ol>
      <p class="note">You'll still be signed in there.</p>`,
    blocked: `<p class="note">Notifications for Yumi are switched off in this phone's settings.</p>
      <p class="note"><b>iPhone:</b> Settings › Notifications › Yumi › Allow Notifications.<br><b>Android:</b> hold the Yumi icon › App info › Notifications.</p>`,
    unsupported: `<p class="note">This browser can't show notifications. On an iPhone, add Yumi to your Home Screen (iOS 16.4 or newer). On Android, use Chrome.</p>`,
  }[st] || '';
  return `<h2 id="sheetTitle">🔔 Notifications</h2><div class="form">${body}</div>`;
}
const showPush = st => { S.ui.pushState = st; openSheet(pushSheet(st)); S.render(); };

/* On an iPhone in Safari, the Home Screen copy opens holding a fresh one-time code, so it signs
   straight in even if iOS keeps it separate from Safari. */
async function primeInstall() {
  if (!isIOS || standalone() || !S.me) return;
  const r = await api('/pair/self', {});
  if (r.ok) document.querySelector('link[rel=manifest]')?.setAttribute('href', '/manifest.webmanifest?join=' + r.code);
}

/* ---------- pictures ---------- */
async function shrink(file, size = 400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
    const c = document.createElement('canvas'); c.width = c.height = size;
    /* Square from the middle, a little high, where faces usually are. */
    c.getContext('2d').drawImage(img, (w - s) / 2, (h - s) * 0.3, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.86);
  } finally { URL.revokeObjectURL(url); }
}
document.addEventListener('change', async e => {
  const inp = e.target.closest?.('input[data-pic]');
  const file = inp?.files?.[0]; if (!file) return;
  const who = inp.dataset.pic; inp.value = '';
  if (!/^image\//.test(file.type) && file.type) { toast("That's not a picture"); Snd.err(); return; }
  toast('Saving your picture…');
  let data; try { data = await shrink(file); } catch (err) { toast("Couldn't open that picture. Try another one."); Snd.err(); return; }
  const r = await api('/me/picture', { data, who });
  if (!r.ok) { toast(r.error === 'too_big' ? 'That picture is too big' : "Couldn't save it. Try again."); Snd.err(); return; }
  Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 60); toast('New picture saved ✨');
});

export const MORE_ACTIONS = {
  async pushOpen() {
    Snd.tap();
    const st = await pushStatus(); showPush(st);
    if (st === 'install') primeInstall();
  },
  async pushOn(el) {
    if (el) el.disabled = true;
    let st;
    try { st = await turnOn(); } catch (err) { console.error(err); st = 'error'; }
    if (st === 'on') { Snd.fanfare(); Confetti.burst(innerWidth / 2, innerHeight / 3, 80); toast('Notifications on 🔔'); }
    else if (st === 'blocked') toast('Notifications are switched off in Settings');
    else if (st === 'error') { toast("Couldn't turn them on. Try again."); Snd.err(); }
    showPush(await pushStatus());
  },
  async pushOff() { await turnOff().catch(() => {}); Snd.tap(); toast('Notifications off'); showPush(await pushStatus()); },
  async pushTest() { const r = await api('/push/test', {}); toast(r.ok ? 'Sent! Check your lock screen 🔔' : "Couldn't reach this phone. Turn notifications off and on again."); },
  async remindToggle() { const on = P(S.me.id)?.remind !== false; Snd.tick(); await mergeDoc('people/' + S.me.id, { remind: !on }); openSheet(pushSheet('on')); toast(on ? 'Reminders off' : 'Reminders on ⏰'); },
  pushHide() { try { localStorage.setItem('yumi-push-hide', '1'); } catch (e) {} Snd.tap(); S.render(); },

  async picClear(el) { const r = await api('/me/picture', { clear: true, who: el.dataset.k }); Snd.tap(); toast(r.ok ? 'Back to your old picture' : "Couldn't change it"); },

  async linkMake(el) {
    const who = el.dataset.k, r = await api('/pair/create', { who, link: true });
    if (!r.ok) { toast("Couldn't make a link"); Snd.err(); return; }
    S.ui.link = { who, code: r.code, url: `${location.origin}/?join=${r.code}` }; Snd.magic(); S.render();
  },
  async linkShare() {
    const l = S.ui.link; if (!l) return;
    const text = `Hi ${short(l.who)}! ⭐ Here's your Yumi link. Tap it on your phone:`;
    if (navigator.share) { try { await navigator.share({ title: 'Yumi', text, url: l.url }); return; } catch (err) { if (err.name === 'AbortError') return; } }
    MORE_ACTIONS.linkCopy();
  },
  async linkCopy() {
    const l = S.ui.link; if (!l) return;
    try { await navigator.clipboard.writeText(`Hi ${short(l.who)}! ⭐ Here's your Yumi link. Tap it on your phone: ${l.url}`); toast('Copied. Paste it into Messages'); Snd.check(); }
    catch (err) { toast('Press and hold the link to copy it'); }
  },
  linkDone() { S.ui.link = null; S.ui.devices = null; Snd.tap(); S.render(); },
};
