/* HQ: a parent's own command centre inside Yumi, in the Cel-X Group look. Brain dump and the studio
   first, then the to-do list, money and subscriptions, then the iPhone widget. It all lives at
   hq/<person>/…, which the server only ever sends to that person's own phones. */
import { $, esc, api, Store, today, uid, nowIso, fmtShort, DOW, MON, MONL, Snd, Confetti, toast, openSheet, closeSheet, write, setDoc, mergeDoc, delDoc } from './core.js';
import { S, P } from './model.js';
import { PROJ, projOf, PRI_LABEL, sortTasks, openTasks, CATS, catOf, monthSummary, subsSummary, perMonth, money } from './hqmath.js';

const LIVE_DESK = 'https://claude.ai/artifact/Vz5x2Cj1YVjRB1fcQYhor7';
const STUDIO = [
  { id: 'runnit', name: 'Runnit', mark: 'R', status: 'Live at City Ink · pitching', url: 'https://claude.ai/artifact/DBEv1pxAc2jiphN1bCKLap', go: 'Runnit HQ' },
  { id: 'softr', name: 'SOFTR', mark: 'S', status: 'Pre-launch · waitlist first', url: 'https://claude.ai/artifact/NaAvxw2oknpd3JFyiFb2HM', go: 'SOFTR HQ' },
  { id: 'crew', name: 'Gibbons Crew', mark: 'GC', status: 'Live · family only', url: 'https://claude.ai/artifact/9YMjBbTMmdR4KEzgaHbvKR', go: 'Crew HQ' },
  { id: 'agency', name: 'Cel-X × Cyph', mark: '✕', status: 'Clients', url: 'https://claude.ai/artifact/NBVyamtXkQnwLfSnNqWAHq', go: 'Agency HQ' },
  { id: 'encap', name: 'Encapsulator', mark: 'E', status: 'Package ready to send', url: 'https://claude.ai/artifact/BWg2E735reSC5ntUNPLFSr', go: 'Encapsulator HQ' },
  { id: 'five8', name: 'Five Eights', mark: '58', status: 'Check status', url: 'https://claude.ai/artifact/Tzg5mFy6wUGyVPkmEjCJMn', go: 'Five Eights HQ' },
];
const PROMPTS = [['One thing today: ', 'The one thing today'], ['Idea: ', 'An idea to park'], ['Reply to ', 'Who I owe a reply'], ['Book ', 'Something to book in']];

const base = () => `hq/${S.me.id}`;
const tasks = () => Store.col(base() + '/tasks');
const txns = () => Store.col(base() + '/txns');
const subs = () => Store.col(base() + '/subs');
const imported = () => Store.get(base() + '/settings/imported');
const partner = () => Store.get(base() + '/settings/people')?.partner || '';
const firstName = () => { const p = P(S.me.id); return String(p?.nick || p?.name || '').trim().split(/\s+/)[0] || 'there'; };
const title = () => (/^brad/i.test(firstName()) ? 'BRAD' : firstName().toUpperCase()) + ' HQ';
const ym = () => today().slice(0, 7);
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'; };
const xmark = (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 L20 20" stroke="#FFD400" stroke-width="3.4" stroke-linecap="round"/><path d="M4 20 L22 2" stroke="#00E5FF" stroke-width="3.4" stroke-linecap="round"/></svg>`;
const ui = () => (S.ui.hq ||= { pri: 'next', proj: 'hq', tab: 'now', all: false, txAll: false });

/* ---------- the parent's Home: a way in ---------- */
export function hqHomeCard() {
  const open = openTasks(tasks()), now = open.filter(t => t.pri === 'now').length, top = open[0];
  return `<button class="hqmini" data-act="tab" data-tab="hq" aria-label="Open HQ">
    <span class="hqmini-x">${xmark(20)}</span>
    <span class="hqmini-t"><b>${esc(title())}</b><small>${open.length ? `${now ? `${now} now · ` : ''}${open.length} to do${top ? ` · ${esc(top.title)}` : ''}` : imported() ? 'All clear 🙌' : 'Your to-dos, money and widget'}</small></span>
    <span class="hqmini-go">›</span></button>`;
}

/* ---------- the page ---------- */
export function hqPage() {
  const u = ui(), open = openTasks(tasks()), m = monthSummary(txns(), ym()), d = new Date();
  const now = open.filter(t => t.pri === 'now').length;
  return `<div class="hqx">
    <header class="hqhead">
      <div class="hqbrand">${xmark()}<b>${esc(title())}</b><span>CEL-X GROUP</span></div>
      <h1>${greet()}, <em>${esc(firstName())}.</em></h1>
      <p class="hqsub">${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} · ${open.length} to do${now ? ` · <b>${now} now</b>` : ''} · ${money(m.out)} out in ${MONL[d.getMonth()]}</p>
      <nav class="hqjump" aria-label="HQ sections">
        ${[['hq-dump', '🧠 Dump'], ['hq-studio', '🛠️ Studio'], ['hq-todo', '⚡ To-do'], ['hq-money', '💸 Money'], ['hq-subs', '🔁 Subs'], ['hq-widget', '📱 Widget']].map(([id, t]) => `<button type="button" data-act="hqJump" data-to="${id}">${t}</button>`).join('')}
      </nav>
    </header>
    ${imported() ? '' : importCard()}
    ${dumpCard(u)}
    ${studioCard()}
    ${todoCard(u, open)}
    ${moneyCard(u, m)}
    ${subsCard()}
    ${widgetCard()}
    <a class="hqdesk" href="${LIVE_DESK}" target="_blank" rel="noopener"><span>📡</span><span class="grow"><b>Live desk in Claude</b><small>Gmail, Drive, your calendar and Brad 2.0 stay there</small></span><span>↗</span></a>
    ${imported() ? `<p class="hqfoot">Brought across from HQ on ${esc(fmtShort(String(imported().at).slice(0, 10)))}: ${imported().added?.tasks || 0} to-dos, ${imported().added?.txns || 0} money entries, ${imported().added?.subs || 0} subscriptions.</p>` : ''}
  </div>`;
}

function head(icon, t, meta, right = '') {
  return `<div class="hqh"><h2><span class="hqbow" aria-hidden="true">${icon}</span>${t}</h2>${meta ? `<span class="hqmeta">${meta}</span>` : ''}${right ? `<span class="hqright">${right}</span>` : ''}</div>`;
}

/* The move from the HQ page in Claude: it copies everything, this pastes it in. One time; it only fills empty spots. */
function importCard() {
  const pv = S.ui.hqPaste;
  return `<section class="hqcard hqimp" id="hq-import">${head('🗂️', 'Bring your HQ across')}
    <p class="hqp">Your to-dos, money and subscriptions on the HQ page in Claude come across once.</p>
    <ol class="hqsteps"><li>Open your <a href="${LIVE_DESK}" target="_blank" rel="noopener">HQ page in Claude</a> and tap <b>Copy for Yumi</b> at the top.</li><li>Come back here and tap <b>Paste from HQ</b>.</li></ol>
    ${pv ? `<p class="hqok">✓ Found ${pv.tasks} to-dos, ${pv.txns} money entries and ${pv.subs} subscriptions.</p>
      <div class="hqrow"><button class="hqbtn y" data-act="hqImportGo">Bring it across</button><button class="hqbtn" data-act="hqPasteClear">Start again</button></div>`
      : `<button class="hqbtn y" data-act="hqPaste">Paste from HQ</button>
      <textarea id="hqPasteBox" class="hqscript" rows="3" placeholder="Or press and hold here, then Paste" aria-label="Paste from HQ"></textarea>`}
  </section>`;
}

const readExport = text => {
  try { const j = JSON.parse(String(text || '').trim()); if (j && j.hqExport === 1 && j.data && typeof j.data === 'object') return j; } catch (e) {}
  return null;
};
const countOf = (j, k) => Object.keys(j.data[k] || {}).length;
function takePaste(text) {
  const j = readExport(text);
  if (!j) { Snd.err(); toast("That isn't the HQ copy. Tap Copy for Yumi on the HQ page first."); return; }
  S.ui.hqPasteData = j; S.ui.hqPaste = { tasks: countOf(j, 'tasks'), txns: countOf(j, 'txns'), subs: countOf(j, 'subs') };
  Snd.check(); S.render(true);
}
document.addEventListener('paste', e => { if (e.target?.id === 'hqPasteBox') setTimeout(() => takePaste(e.target.value), 0); });

function dumpCard(u) {
  return `<section class="hqcard" id="hq-dump">${head('🧠', 'Brain dump', 'write it out, then park it')}
    <textarea id="hqDump" class="hqpaper" rows="4" maxlength="2000" placeholder="What's on your mind? One line each, and every line becomes a to-do." aria-label="Brain dump">${esc(S.ui.hqDraft || '')}</textarea>
    <div class="hqrow">
      <select id="hqDumpProj" aria-label="Which project">${Object.entries(PROJ).map(([k, p]) => `<option value="${k}" ${u.proj === k ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
      <div class="hqseg" role="group" aria-label="How soon">${['now', 'next', 'later'].map(p => `<button type="button" data-act="hqDumpPri" data-v="${p}" aria-pressed="${u.pri === p}" class="${u.pri === p ? 'on' : ''}">${PRI_LABEL[p]}</button>`).join('')}</div>
    </div>
    <button class="hqbtn y wide" data-act="hqDumpAdd">Add to my list</button>
    <div class="hqprompts">${PROMPTS.map(([pre, t]) => `<button type="button" data-act="hqPrompt" data-pre="${esc(pre)}">${esc(t)} ›</button>`).join('')}</div>
  </section>`;
}

function studioCard() {
  const open = openTasks(tasks());
  return `<section class="hqcard" id="hq-studio">${head('🛠️', 'The studio', "what you're building")}
    <div class="hqtiles">${STUDIO.map(s => {
      const n = open.filter(t => t.project === s.id).length, c = projOf(s.id).color;
      return `<article class="hqtile" style="--c:${c}">
        <div class="hqtile-pic"><span>${esc(s.mark)}</span></div>
        <b>${esc(s.name)}</b><small>${esc(s.status)}</small>
        <div class="hqtile-acts"><a class="hqbtn y sm" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.go)} ↗</a>${n ? `<button class="hqcount" data-act="hqProj" data-p="${s.id}">${n} open</button>` : ''}</div>
      </article>`; }).join('')}</div>
  </section>`;
}

function todoCard(u, open) {
  const all = tasks(), done = all.filter(t => t.done).sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || '')));
  const byPri = p => open.filter(t => (t.pri || 'next') === p);
  let list = u.tab === 'done' ? done : byPri(u.tab);
  if (u.projF) list = list.filter(t => t.project === u.projF);
  const shown = u.all ? list : list.slice(0, 8);
  const tabs = [['now', 'Now', byPri('now').length], ['next', 'Next', byPri('next').length], ['later', 'Later', byPri('later').length], ['done', 'Done', done.length]];
  return `<section class="hqcard" id="hq-todo">${head('⚡', 'To-do', `${open.length} open`, `<button class="hqbtn sm" data-act="hqNew">＋ Add</button>`)}
    ${u.projF ? `<button class="hqfilter" data-act="hqProj" data-p="">${esc(projOf(u.projF).label)} only ✕</button>` : ''}
    <div class="hqseg four" role="tablist">${tabs.map(([id, t, n]) => `<button type="button" role="tab" data-act="hqTab" data-v="${id}" aria-selected="${u.tab === id}" class="${u.tab === id ? 'on' : ''}">${t}<i>${n}</i></button>`).join('')}</div>
    <ul class="hqtasks">${shown.map(taskRow).join('') || `<li class="hqempty">${u.tab === 'done' ? 'Nothing ticked off yet.' : u.tab === 'now' ? 'Nothing marked Now. Nice.' : 'Nothing here.'}</li>`}</ul>
    ${list.length > 8 ? `<button class="hqmore" data-act="hqAll">${u.all ? 'Show fewer' : `Show all ${list.length}`}</button>` : ''}
  </section>`;
}

function taskRow(t) {
  const p = projOf(t.project);
  return `<li class="hqt ${t.done ? 'done' : ''} ${t.needs ? 'needs' : ''} ${S.ui.hqFlash?.includes(t.id) ? 'flash' : ''}">
    <button class="hqcheck" data-act="hqTick" data-id="${esc(t.id)}" aria-pressed="${!!t.done}" aria-label="${t.done ? 'Not done' : 'Mark done'}: ${esc(t.title)}">${t.done ? '✓' : ''}</button>
    <button class="hqtbody" data-act="hqOpen" data-id="${esc(t.id)}"><b>${esc(t.title)}</b><small><i style="background:${p.color}"></i>${esc(p.label)}${t.tool ? ` · ${esc(t.tool)}` : ''}${t.done && t.doneAt ? ` · done ${esc(fmtShort(String(t.doneAt).slice(0, 10)))}` : ''}</small></button>
  </li>`;
}

function moneyCard(u, m) {
  const list = txns().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.seq || 0) - (a.seq || 0));
  const shown = u.txAll ? list : list.slice(0, 5);
  const d = new Date();
  return `<section class="hqcard" id="hq-money">${head('💸', `Money · ${MONL[d.getMonth()]}`, '', `<button class="hqbtn sm" data-act="hqTxNew">＋ Add</button>`)}
    <div class="hqmoney"><div><small>In</small><b class="good">${money(m.in)}</b></div><div><small>Out</small><b>${money(m.out)}</b></div><div><small>Left</small><b class="${m.net < 0 ? 'bad' : 'good'}">${m.net > 0 ? '+' : ''}${money(m.net)}</b></div></div>
    ${m.top ? `<p class="hqsmall">Most on ${esc(m.top.label)} · ${money(m.top.amount)}</p>` : ''}
    <ul class="hqtx">${shown.map(t => { const c = catOf(t.cat), a = Number(t.amount) || 0;
      return `<li><button data-act="hqTxOpen" data-id="${esc(t.id)}"><i style="background:${c.color}"></i><span class="grow"><b>${esc(t.note || c.label)}</b><small>${esc(t.date ? fmtShort(t.date) : '')} · ${esc(c.label)}${t.who === 'partner' ? ` · ${esc(partner() || 'Partner')}` : ''}${t.pending ? ' · pending' : ''}</small></span><em class="${a > 0 ? 'good' : ''}">${a > 0 ? '+' : ''}${money(a)}</em></button></li>`; }).join('') || '<li class="hqempty">No money entries yet. Tap Add.</li>'}</ul>
    ${list.length > 5 ? `<button class="hqmore" data-act="hqTxAll">${u.txAll ? 'Show fewer' : `Show all ${list.length}`}</button>` : ''}
  </section>`;
}

function subsCard() {
  const all = subs(), s = subsSummary(all, today());
  if (!all.length) return `<section class="hqcard" id="hq-subs">${head('🔁', 'Subscriptions')}<p class="hqp">None yet. They come across with your HQ.</p></section>`;
  const order = { payment_failing: 0, expiring: 1, active: 2, unknown: 3, cancelled: 4 };
  const list = all.slice().sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || String(a.name).localeCompare(String(b.name)));
  const ST = { active: 'Active', expiring: 'Ending', payment_failing: 'Card failing', cancelled: 'Ended', unknown: 'Check' }, CYC = { week: '/wk', month: '/mo', year: '/yr', usage: ' used' };
  return `<section class="hqcard" id="hq-subs">${head('🔁', 'Subscriptions', `about ${money(Math.round(s.monthly))}/mo · ${s.running} running`)}
    ${s.failing ? `<p class="hqwarn">⚠️ ${s.failing} card${s.failing === 1 ? '' : 's'} failing. Check the ones marked below.</p>` : ''}
    ${s.soon.length ? `<p class="hqlabel">Renewing in the next fortnight</p><ul class="hqsoon">${s.soon.map(x => `<li><b>${esc(x.name)}</b><span>${x.amount != null ? money(x.amount) : ''}</span><small>${x.inDays === 0 ? 'today' : x.inDays === 1 ? 'tomorrow' : `in ${x.inDays} days`}</small></li>`).join('')}</ul>` : '<p class="hqsmall">Nothing renews in the next fortnight.</p>'}
    <details class="hqall"><summary>All ${all.length} subscriptions</summary><ul class="hqsubs">${list.map(x => `<li class="st-${esc(x.status)}"><div class="grow"><b>${esc(x.name)}</b><small>${esc([x.plan, x.via, x.renews ? 'renews ' + String(x.renews).slice(0, 10) : ''].filter(Boolean).join(' · '))}</small></div>
      <div class="hqsub-r"><em>${x.amount != null ? money(x.amount) + (CYC[x.cycle] || '') : ''}</em><span class="hqpill">${ST[x.status] || 'Check'}</span>
      <select data-hqdecide="${esc(x.id)}" aria-label="Decision for ${esc(x.name)}"><option value="">Decide…</option>${['keep', 'cancel', 'cancelled'].map(v => `<option value="${v}" ${x.decision === v ? 'selected' : ''}>${{ keep: 'Keep', cancel: 'Cancel it', cancelled: 'Cancelled ✓' }[v]}</option>`).join('')}</select></div></li>`).join('')}</ul></details>
  </section>`;
}

function widgetCard() {
  const w = S.ui.hqWidget, sc = S.ui.hqScript;
  if (!w && !S.ui.hqWidgetLoading) { S.ui.hqWidgetLoading = true; api('/hq/widget').then(r => { S.ui.hqWidgetLoading = false; if (r.ok) { S.ui.hqWidget = r; S.render(); } }); }
  const on = w?.on;
  return `<section class="hqcard" id="hq-widget">${head('📱', 'iPhone widget', on ? `on since ${esc(fmtShort(String(w.made).slice(0, 10)))}` : 'off')}
    <p class="hqp">Your top to-dos, the next thing in your calendar and this month's money, on your Home Screen and lock screen. Tap a to-do to tick it off, 🧠 to add one, ⏱ for a 25-minute block.</p>
    ${sc ? `<ol class="hqsteps">
        <li>Get <b>Scriptable</b> from the App Store. It's free.</li>
        <li>Open it, tap <b>+</b>, paste this script and name it <b>${esc(title().replace(/ HQ$/, ' HQ').replace(/^(\w)(\w*)/, (m, a, b) => a + b.toLowerCase()))}</b>.</li>
        <li>Tap the script once, and say yes to Calendar and Notifications.</li>
        <li>Long-press your Home Screen, tap <b>+</b>, pick <b>Scriptable</b> and a size. Long-press the new widget, <b>Edit Widget</b>, and choose the script.</li>
      </ol>
      <textarea class="hqscript" id="hqScript" readonly rows="6" aria-label="Widget script">${esc(sc)}</textarea>
      <div class="hqrow"><button class="hqbtn y" data-act="hqCopy" data-from="hqScript">Copy script</button><button class="hqbtn" data-act="hqScriptHide">Done</button></div>
      <p class="hqsmall">🔒 The script holds a key to your HQ, so keep it to yourself. Making a new one, or turning it off, stops older copies.</p>`
      : `<div class="hqrow"><button class="hqbtn y" data-act="hqWidgetMake">${on ? 'Make a new widget script' : 'Make my widget'}</button>${on ? '<button class="hqbtn" data-act="hqWidgetOff">Turn off</button>' : ''}</div>
      <p class="hqsmall">If the Runnit widget is in Scriptable too, this one shows City Ink's numbers as well.</p>`}
  </section>`;
}

/* ---------- sheets ---------- */
function taskSheet(t) {
  const links = (Array.isArray(t.links) ? t.links : []).filter(l => l && /^https?:\/\//.test(l.url)).slice(0, 4);
  return `<div class="hqsheet"><h2 id="sheetTitle">${t.id ? 'To-do' : 'New to-do'}</h2><div class="form">
    <textarea id="hqTTitle" rows="2" maxlength="300" placeholder="What needs doing?" ${t.id ? '' : 'autofocus'}>${esc(t.title || '')}</textarea>
    ${t.how ? `<p class="hqhow">${esc(t.how)}</p>` : ''}
    ${links.length ? `<div class="hqlinks">${links.map(l => `<a class="hqbtn sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || 'Open')} ↗</a>`).join('')}</div>` : ''}
    <div class="hqseg" role="group" aria-label="How soon">${['now', 'next', 'later'].map(p => `<button type="button" data-act="pick" data-hqpri="${p}" class="${(t.pri || 'next') === p ? 'on' : ''}">${PRI_LABEL[p]}</button>`).join('')}</div>
    <select id="hqTProj" aria-label="Which project">${Object.entries(PROJ).map(([k, p]) => `<option value="${k}" ${(t.project || 'hq') === k ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
    <div class="actions">${t.id ? `<button class="btn" data-act="hqDel" data-id="${esc(t.id)}">Delete</button>` : '<button class="btn" data-act="closeSheet">Cancel</button>'}<button class="btn solid" data-act="hqSave" data-id="${esc(t.id || '')}">Save</button></div>
  </div></div>`;
}

function txSheet(t) {
  const a = Number(t.amount) || 0, kind = t.id ? (a > 0 ? 'in' : 'out') : (S.ui.hqTxKind || 'out');
  const cats = CATS.filter(c => c.kind === kind || c.kind === 'any' || (t.cat === c.id));
  const pn = partner();
  return `<div class="hqsheet"><h2 id="sheetTitle">${t.id ? 'Money entry' : 'Add money'}</h2><div class="form">
    <div class="hqseg" role="group" aria-label="In or out">${[['out', 'Money out'], ['in', 'Money in']].map(([k, l]) => `<button type="button" data-act="hqTxKind" data-v="${k}" class="${kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="hqfield"><span>Amount</span><input id="hqTxAmt" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${a ? Math.abs(a) : ''}" ${t.id ? '' : 'autofocus'}></label>
    <label class="hqfield"><span>What for</span><input id="hqTxNote" type="text" maxlength="120" placeholder="e.g. Coles" value="${esc(t.note || '')}"></label>
    <label class="hqfield"><span>Category</span><select id="hqTxCat">${cats.map(c => `<option value="${c.id}" ${(t.cat || (kind === 'in' ? 'income' : 'groceries')) === c.id ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
    <label class="hqfield"><span>Date</span><input id="hqTxDate" type="date" value="${esc(t.date || today())}"></label>
    ${pn ? `<div class="hqseg" role="group" aria-label="Who paid">${[['me', 'Me'], ['partner', pn]].map(([k, l]) => `<button type="button" data-act="pick" data-hqwho="${k}" class="${(t.who || 'me') === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>` : ''}
    <div class="actions">${t.id ? `<button class="btn" data-act="hqTxDel" data-id="${esc(t.id)}">Delete</button>` : '<button class="btn" data-act="closeSheet">Cancel</button>'}<button class="btn solid" data-act="hqTxSave" data-id="${esc(t.id || '')}">Save</button></div>
  </div></div>`;
}

/* ---------- typing is kept, so a live update can't wipe a half-written dump ---------- */
document.addEventListener('input', e => { if (e.target.id === 'hqDump') S.ui.hqDraft = e.target.value; });
document.addEventListener('change', e => {
  if (e.target.id === 'hqDumpProj') ui().proj = e.target.value;
  const id = e.target.dataset?.hqdecide;
  if (id) { Snd.tick(); mergeDoc(`${base()}/subs/${id}`, { decision: e.target.value }); }
});

/* A new or just-saved to-do sits last in its group (HQ's order), so open the group in full and show it. */
function reveal(ids, pri) {
  const u = ui(); u.tab = pri; u.all = true; u.projF = null; S.ui.hqFlash = ids;
  S.render(true);
  /* Instant, not smooth: the live update that follows a save redraws the page and would cut a smooth scroll short. */
  requestAnimationFrame(() => document.querySelector('.hqt.flash')?.scrollIntoView({ block: 'center' }));
  setTimeout(() => { if (S.ui.hqFlash === ids) S.ui.hqFlash = null; }, 2500);
}
const nextRank = () => Math.max(0, ...tasks().map(t => Number(t.rank) || 0)) + 1;
const twoTap = (el, label) => { if (el.dataset.sure) return true; el.dataset.sure = '1'; const was = el.textContent; el.textContent = label; setTimeout(() => { if (el.isConnected) { delete el.dataset.sure; el.textContent = was; } }, 4000); return false; };

export const HQ_ACTIONS = {
  hqJump(el) { Snd.tap(); document.getElementById(el.dataset.to)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); },
  hqDumpPri(el) { ui().pri = el.dataset.v; Snd.tick(); el.parentElement.querySelectorAll('button').forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
  hqPrompt(el) { const box = $('#hqDump'); if (!box) return; const pre = el.dataset.pre; const lines = box.value.split('\n'); const last = lines.pop() || ''; lines.push(last.startsWith(pre) ? last : pre + last); box.value = lines.join('\n'); S.ui.hqDraft = box.value; box.focus(); box.setSelectionRange(box.value.length, box.value.length); Snd.tick(); },
  async hqDumpAdd(el) {
    const box = $('#hqDump'), lines = (box?.value || '').split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20);
    if (!lines.length) { box?.focus(); Snd.err(); toast('Write something first'); return; }
    const u = ui(), r0 = nextRank(), at = nowIso();
    S.ui.hqDraft = ''; if (box) box.value = '';
    Confetti.from(el, 16); Snd.magic();
    const ids = lines.map((_, i) => uid() + i);
    await write(lines.map((title, i) => ({ path: `${base()}/tasks/${ids[i]}`, set: { title: title.slice(0, 300), pri: u.pri, project: u.proj, done: false, needs: false, how: '', tool: '', links: [], rank: r0 + i, by: 'yumi', added: at, at } })));
    reveal(ids, u.pri);
    toast(lines.length === 1 ? 'Added to your list ⚡' : `${lines.length} added to your list ⚡`);
  },
  hqProj(el) { const u = ui(); u.projF = el.dataset.p || null; u.tab = 'now'; const open = openTasks(tasks()).filter(t => !u.projF || t.project === u.projF); if (u.projF && !open.some(t => t.pri === 'now')) u.tab = open[0]?.pri || 'next'; Snd.tap(); S.render(true); $('#hq-todo')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
  hqTab(el) { const u = ui(); u.tab = el.dataset.v; u.all = false; Snd.tick(); S.render(true); },
  hqAll() { ui().all = !ui().all; Snd.tap(); S.render(true); },
  hqTxAll() { ui().txAll = !ui().txAll; Snd.tap(); S.render(true); },
  async hqTick(el) {
    const t = Store.get(`${base()}/tasks/${el.dataset.id}`); if (!t) return;
    const done = !t.done;
    if (done) { Confetti.from(el, 12); Snd.check(); } else Snd.uncheck();
    const next = { ...t, done }; if (done) next.doneAt = nowIso(); else delete next.doneAt;
    await write([{ path: `${base()}/tasks/${el.dataset.id}`, set: next }]);
    if (done) toast('Done ✓  Find it under Done to undo');
  },
  hqOpen(el) { const id = el.dataset.id, t = Store.get(`${base()}/tasks/${id}`); if (!t) return; Snd.tap(); openSheet(taskSheet({ id, ...t })); },
  hqNew() { Snd.tap(); openSheet(taskSheet({ pri: ui().pri, project: ui().projF || ui().proj })); },
  async hqSave(el) {
    const title = ($('#hqTTitle')?.value || '').replace(/\s+/g, ' ').trim(); if (!title) { Snd.err(); $('#hqTTitle')?.focus(); return; }
    const pri = document.querySelector('#sheetBody [data-hqpri].on')?.dataset.hqpri || 'next', project = $('#hqTProj')?.value || 'hq';
    const id = el.dataset.id; closeSheet(); Snd.check();
    const tid = id || uid();
    if (id) await mergeDoc(`${base()}/tasks/${id}`, { title, pri, project });
    else await setDoc(`${base()}/tasks/${tid}`, { title, pri, project, done: false, needs: false, how: '', tool: '', links: [], rank: nextRank(), by: 'yumi', added: nowIso() });
    reveal([tid], pri);
  },
  async hqDel(el) { if (!twoTap(el, 'Sure? Tap again')) return; closeSheet(); Snd.tap(); await delDoc(`${base()}/tasks/${el.dataset.id}`); toast('Deleted'); },
  hqTxNew() { Snd.tap(); S.ui.hqTxKind = 'out'; openSheet(txSheet({})); },
  hqTxOpen(el) { const id = el.dataset.id, t = Store.get(`${base()}/txns/${id}`); if (!t) return; Snd.tap(); openSheet(txSheet({ id, ...t })); },
  hqTxKind(el) {
    const kind = el.dataset.v; S.ui.hqTxKind = kind; Snd.tick();
    el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
    const sel = $('#hqTxCat');
    if (sel) { sel.innerHTML = CATS.filter(c => c.kind === kind || c.kind === 'any').map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join(''); sel.value = kind === 'in' ? 'income' : 'groceries'; }
  },
  async hqTxSave(el) {
    const amt = Math.abs(Number($('#hqTxAmt')?.value)); if (!amt) { Snd.err(); $('#hqTxAmt')?.focus(); toast('How much?'); return; }
    const kind = document.querySelector('#sheetBody [data-act="hqTxKind"].on')?.dataset.v || 'out';
    const doc = { amount: Math.round((kind === 'in' ? amt : -amt) * 100) / 100, note: ($('#hqTxNote')?.value || '').trim().slice(0, 120), cat: $('#hqTxCat')?.value || 'other', date: /^\d{4}-\d{2}-\d{2}$/.test($('#hqTxDate')?.value || '') ? $('#hqTxDate').value : today(), who: document.querySelector('#sheetBody [data-hqwho].on')?.dataset.hqwho || 'me' };
    const id = el.dataset.id; closeSheet(); Snd.check();
    if (id) await mergeDoc(`${base()}/txns/${id}`, doc);
    else await setDoc(`${base()}/txns/${uid()}`, { ...doc, source: 'yumi', pending: false, added: nowIso() });
  },
  async hqTxDel(el) { if (!twoTap(el, 'Sure? Tap again')) return; closeSheet(); Snd.tap(); await delDoc(`${base()}/txns/${el.dataset.id}`); },
  async hqPaste() {
    const box = $('#hqPasteBox');
    if (box?.value.trim()) { takePaste(box.value); return; }
    try { takePaste(await navigator.clipboard.readText()); }
    catch (e) { box?.focus(); toast('Press and hold the box, then tap Paste'); }
  },
  hqPasteClear() { S.ui.hqPaste = null; S.ui.hqPasteData = null; Snd.tap(); S.render(true); },
  async hqImportGo(el) {
    const j = S.ui.hqPasteData; if (!j) return;
    el.disabled = true; el.textContent = 'Bringing it across…';
    const r = await api('/hq/import-mine', { from: String(j.from || 'HQ page'), data: j.data });
    if (!r.ok) { el.disabled = false; el.textContent = 'Bring it across'; Snd.err(); toast("That didn't come across. Try again."); return; }
    S.ui.hqPaste = null; S.ui.hqPasteData = null; Confetti.from(el, 30); Snd.magic();
    toast(`${r.added.tasks} to-dos, ${r.added.txns} money entries and ${r.added.subs} subscriptions are in ✓`);
  },
  async hqWidgetMake() { Snd.tap(); const r = await api('/hq/widget', {}); if (!r.ok) { toast("Couldn't make it. Try again."); return; } S.ui.hqScript = r.script; S.ui.hqWidget = { on: true, made: r.made }; S.render(true); $('#hq-widget')?.scrollIntoView({ block: 'start' }); },
  hqScriptHide() { S.ui.hqScript = null; Snd.tap(); S.render(true); },
  async hqWidgetOff(el) { if (!twoTap(el, 'Sure? Tap again')) return; Snd.tap(); await api('/hq/widget/off', {}); S.ui.hqWidget = { on: false }; S.ui.hqScript = null; toast('Widget turned off'); S.render(true); },
  /* iPhone Safari only lets a page copy inside the tap itself, so this writes straight away and,
     if that's refused, selects the text so it can be copied by hand. */
  hqCopy(el) {
    const src = el.dataset.from ? $('#' + el.dataset.from) : null, text = src ? src.value : el.dataset.copy || '';
    const fallback = () => { if (src) { src.focus(); src.select(); src.setSelectionRange(0, text.length); toast('Selected. Tap Copy in the menu.'); } else toast(text); };
    try { navigator.clipboard.writeText(text).then(() => { Snd.check(); toast('Copied'); }, fallback); } catch (e) { fallback(); }
  },
};
