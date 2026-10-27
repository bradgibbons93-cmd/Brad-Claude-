/* Good & hard days. Each girl checks in on how a day went with Dad's partner and her kids, and sees
   her weeks as a graph: good days above the line, hard days below, and the week's average through it.
   It is there so a hard day is seen beside all the good ones, and so a long run of hard ones can't be
   missed either. Her answers are hers and Dad's: her sister never receives them. */
import { $, esc, Store, today, nowIso, fmtShort, parseYmd, MON, Snd, Confetti, toast, act, openSheet, closeSheet, setDoc, mergeDoc, delDoc } from './core.js';
import { S, kids, isParent, homeFor, avatar } from './model.js';
import { FEELS, NONE, feelOf, GOOD_TAGS, HARD_TAGS, DEFAULT_LABEL, series, weeks, summary, verdict, TREND } from './togethermath.js';

export const tgLabel = () => String(Store.get('settings/together')?.label || '').trim() || DEFAULT_LABEL;
const pathOf = (k, d) => `kids/${k}/together/${d}`;
const byDay = k => Object.fromEntries(Store.col(`kids/${k}/together`).map(x => [x.id, x]));
const rowsFor = (k, days) => series(byDay(k), today(), days);
const shortDay = s => { const d = parseYmd(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };

/* ---------- the graph ---------- */
function bar(x, w, y0, y1) {
  const r = Math.min(3, w / 2), up = y1 < y0, h = Math.abs(y1 - y0);
  if (h <= r) return `M${x},${y0}h${w}V${y1}h${-w}Z`;
  return up ? `M${x},${y0}V${y1 + r}q0,${-r} ${r},${-r}h${w - 2 * r}q${r},0 ${r},${r}V${y0}Z`
    : `M${x},${y0}V${y1 - r}q0,${r} ${r},${r}h${w - 2 * r}q${r},0 ${r},${-r}V${y0}Z`;
}
function graph(k, rows) {
  const W = 336, H = 150, mid = 64, unit = 26, n = rows.length, step = W / n, bw = Math.max(2.5, step - 2), sel = S.ui.tgSel?.[k];
  const wk = weeks(rows), every = wk.length > 6 ? 2 : 1;
  const tip = r => { const f = r.doc && feelOf(r.doc.feel); return `${fmtShort(r.day)}: ${f ? f.t : 'no check-in'}${r.doc?.tags?.length ? ' · ' + r.doc.tags.join(', ') : ''}`; };
  const marks = rows.map((r, i) => {
    const x = i * step + (step - bw) / 2, cx = i * step + step / 2;
    if (r.v > 0) return `<path class="tg-g" d="${bar(x, bw, mid - 1, mid - 1 - r.v * unit)}"/>`;
    if (r.v < 0) return `<path class="tg-h" d="${bar(x, bw, mid + 1, mid + 1 - r.v * unit)}"/>`;
    if (r.v === 0) return `<circle class="tg-o" cx="${cx}" cy="${mid}" r="${Math.min(3.5, step / 2.2)}"/>`;
    return r.none ? `<circle class="tg-n" cx="${cx}" cy="${mid}" r="${Math.min(2.5, step / 3)}"/>` : '';
  }).join('');
  const pts = wk.map(w => w.avg === null ? null : [((w.start + w.len / 2) * step).toFixed(1), (mid - w.avg * unit).toFixed(1)]);
  let segs = [], cur = [];
  for (const p of pts) { if (p) cur.push(p); else { if (cur.length) segs.push(cur); cur = []; } }
  if (cur.length) segs.push(cur);
  const line = segs.map(s => s.length > 1 ? `<polyline class="tg-l" points="${s.map(p => p.join(',')).join(' ')}"/>` : '').join('')
    + pts.filter(Boolean).map(([x, y]) => `<circle class="tg-ld" cx="${x}" cy="${y}" r="4.5"/>`).join('');
  const labels = wk.map((w, i) => (wk.length - 1 - i) % every ? '' : `<text class="tg-x" x="${(w.start * step + 2).toFixed(1)}" y="${H - 4}">${shortDay(w.from)}</text>`).join('');
  const hits = rows.map((r, i) => `<rect class="tg-hit ${r.day === sel ? 'on' : ''}" x="${(i * step).toFixed(2)}" y="2" width="${step.toFixed(2)}" height="${H - 22}" data-act="tgDay" data-k="${esc(k)}" data-d="${r.day}"><title>${esc(tip(r))}</title></rect>`).join('');
  return `<figure class="tg-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Good and hard days over ${Math.round(n / 7)} weeks">
      ${hits}<line class="tg-base" x1="0" x2="${W}" y1="${mid}" y2="${mid}"/>
      <text class="tg-y" x="0" y="11">Good ↑</text><text class="tg-y" x="0" y="${mid + 2 * unit + 6}">Hard ↓</text>
      ${marks}${line}${labels}</svg>
    <figcaption class="tg-key"><span><i class="kg"></i>Good day</span><span><i class="kh"></i>Hard day</span><span><i class="ko"></i>Okay</span><span><i class="kl"></i>Week's average</span></figcaption></figure>
    ${dayDetail(k, rows)}`;
}
function dayDetail(k, rows) {
  const d = S.ui.tgSel?.[k], r = d && rows.find(x => x.day === d);
  if (!r) return `<p class="note tg-hint">Tap a day to see it.${k === S.me.id ? ' Missed one? Tap it to fill it in.' : ''}</p>`;
  const f = r.doc && feelOf(r.doc.feel), mine = k === S.me.id;
  return `<div class="tg-day"><b>${esc(fmtShort(r.day))}</b> ${f ? `${f.e} ${esc(f.t)}` : '<span class="muted">No check-in</span>'}
    ${r.doc?.tags?.length ? `<small>${r.doc.tags.map(esc).join(' · ')}</small>` : ''}${r.doc?.note ? `<p>“${esc(r.doc.note)}”</p>` : ''}
    ${r.doc?.talkSent ? '<small>💬 Asked to talk to Dad</small>' : ''}
    ${mine ? `<button class="btn small" data-act="tgEdit" data-d="${r.day}">${r.doc ? 'Change it' : 'Fill it in'}</button>` : ''}</div>`;
}
const windowChips = (opts) => { const w = S.ui.tgWeeks || opts[0]; return `<div class="chips sm">${opts.map(n => `<button class="${w === n ? 'on' : ''}" data-act="tgWeeks" data-n="${n}">${n} weeks</button>`).join('')}</div>`; };
function counts(s) {
  return `<div class="tg-counts"><span class="g"><b>${s.good}</b>good</span><span class="o"><b>${s.okay}</b>okay</span><span class="h"><b>${s.hard}</b>hard</span><span><b>${s.checkins}</b>check-ins</span></div>`;
}
const tagLine = (title, list) => list.length ? `<p class="sec-title">${title}</p><div class="tg-tags">${list.map(([t, n]) => `<span>${esc(t)} <b>×${n}</b></span>`).join('')}</div>` : '';

/* ---------- her check-in, on Home ---------- */
export function togetherCard(k) {
  const t = today(), doc = Store.get(pathOf(k, t)), label = tgLabel();
  if (homeFor(t) === 'mum' && !doc) return '';
  if (doc) {
    const f = feelOf(doc.feel);
    return `<button class="tg-done" data-act="tgOpen"><span class="e">${f?.e || '💞'}</span><span class="grow"><b>Today with ${esc(label)}: ${esc(f?.t || '')}</b><small>Thanks for checking in · see your weeks ›</small></span></button>`;
  }
  return `<section class="card tg-card"><div class="ch"><span class="badge b-pink">💞</span><h3>How was today with ${esc(label)}?</h3></div>
    <div class="tg-feels">${FEELS.map(f => `<button data-act="tgStart" data-f="${f.id}"><i>${f.e}</i>${esc(f.t)}</button>`).join('')}<button class="none" data-act="tgStart" data-f="none"><i>${NONE.e}</i>Didn't see them</button></div>
    <button class="linkbtn" data-act="tgOpen">See my good &amp; hard days ›</button></section>`;
}

function sheet(k, day, st) {
  const label = tgLabel(), f = feelOf(st.feel), v = f && 'v' in f ? f.v : null, old = Store.get(pathOf(k, day));
  const tags = v === null ? [] : v > 0 ? GOOD_TAGS : v < 0 ? HARD_TAGS : [...GOOD_TAGS.slice(0, 3), ...HARD_TAGS.slice(0, 3)];
  const ask = v > 0 ? 'What made it good?' : v < 0 ? 'What would make it better next time?' : 'Anything you want Dad to know?';
  return `<h2 id="sheetTitle">${day === today() ? 'Today' : esc(fmtShort(day))} with ${esc(label)}</h2><div class="form" data-k="${esc(k)}" data-d="${day}">
    <div class="tg-feels in-sheet" role="group" aria-label="How was it?">${[...FEELS, NONE].map(x => `<button type="button" class="${st.feel === x.id ? 'on' : ''} ${x.id === 'none' ? 'none' : ''}" data-act="tgFeel" data-f="${x.id}" aria-pressed="${st.feel === x.id}"><i>${x.e}</i>${esc(x.t)}</button>`).join('')}</div>
    ${v !== null ? `<p class="lbl">What happened? (pick any)</p>
      <div class="tg-pick" id="tgTags">${tags.map(t => `<button type="button" class="${st.tags.includes(t) ? 'on' : ''}" data-act="tgTag" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <textarea id="tgNote" rows="2" maxlength="300" placeholder="${esc(ask)}" aria-label="${esc(ask)}">${esc(st.note)}</textarea>
      ${v <= 0 ? `<label class="check tg-talk"><input type="checkbox" id="tgTalk" ${st.talk ? 'checked' : ''}> I'd like to talk to Dad about it</label>` : ''}` : ''}
    <p class="note">🔒 Only you and Dad see this. It isn't a vote: it helps Dad see how things really are.</p>
    <div class="actions">${old ? `<button class="btn" data-act="tgDel">Remove</button>` : '<button class="btn" data-act="closeSheet">Cancel</button>'}<button class="btn solid" data-act="tgSave" ${st.feel ? '' : 'disabled'}>Save</button></div></div>`;
}
const sheetState = () => {
  const f = $('#sheetBody .form');
  return { k: f?.dataset.k, day: f?.dataset.d, feel: $('#sheetBody .tg-feels button.on')?.dataset.f || '',
    tags: [...document.querySelectorAll('#tgTags button.on')].map(b => b.dataset.t), note: $('#tgNote')?.value || '', talk: !!$('#tgTalk')?.checked };
};
function openFor(k, day, feel) {
  const old = Store.get(pathOf(k, day)) || {};
  const st = { feel: feel || old.feel || '', tags: old.tags || [], note: old.note || '', talk: old.talk === true || (feel === 'awful' && !old.feel) };
  openSheet(sheet(k, day, st));
}
async function save(k, day, st) {
  const old = Store.get(pathOf(k, day)), f = feelOf(st.feel); if (!f) return;
  const v = 'v' in f ? f.v : null;
  const doc = { feel: st.feel, tags: v === null ? [] : st.tags, note: v === null ? '' : st.note.trim().slice(0, 300), talk: v !== null && v <= 0 && st.talk, updatedAt: nowIso() };
  closeSheet();
  /* A first check-in is a new doc; after that, merge, so the server's note that Dad was told stays put. */
  const w = old ? await mergeDoc(pathOf(k, day), doc) : await setDoc(pathOf(k, day), doc);
  if (!w.ok) return;
  if (doc.talk && !old?.talkSent) await act('togetherTalk', { day });
  if (v === null) { Snd.tap(); toast('Thanks for checking in'); return; }
  if (v > 0) { Snd.magic(); Confetti.burst(innerWidth / 2, innerHeight / 3, 60); toast('Love that 💞'); }
  else if (v < 0) { Snd.pop(); toast(doc.talk ? 'Dad will check in with you 💞' : 'Thanks for telling. Hard days happen 💞'); }
  else { Snd.tap(); toast('Thanks for checking in'); }
}

/* ---------- her page (Me › Good & hard days) ---------- */
export function togetherPage() {
  const k = S.me.id, n = (S.ui.tgWeeks || 4) * 7, rows = rowsFor(k, n), s = summary(rows.slice(-28)), vd = verdict(s), label = tgLabel();
  const week = rowsFor(k, 7).slice().reverse();
  return `<div class="backrow"><button class="btn small" data-act="sub" data-sub="">‹ Back</button></div><h1 class="t-b">💞 Good &amp; hard days</h1>
    <section class="card tg-intro"><p><b>Every family has good days and hard days</b>, even families who love each other heaps.</p>
      <p>Checking in each day shows the whole picture over weeks, not just the last argument. It isn't a vote. It helps Dad really understand, so you can talk about it together.</p>
      <p class="note">🔒 Only you and Dad see this. Not your sister.</p></section>
    <section class="card"><div class="ch"><span class="badge b-pink">📊</span><h3>With ${esc(label)}</h3></div>
      ${windowChips([4, 8])}${graph(k, rows)}
      <p class="tg-verdict v-${vd.key}">${esc(vd.kid)}</p>${s.trend ? `<p class="note">${s.trend === 'better' ? '📈' : s.trend === 'harder' ? '📉' : '➡️'} ${esc(TREND[s.trend])}</p>` : ''}
      ${counts(s)}<p class="note">The last 4 weeks.</p></section>
    ${s.topGood.length || s.topHard.length ? `<section class="card">${tagLine('What made good days good', s.topGood)}${tagLine('What made hard days hard', s.topHard)}</section>` : ''}
    <section class="card"><div class="ch"><span class="badge b-lilac">🗓️</span><h3>This week</h3></div>
      ${week.map(r => { const f = r.doc && feelOf(r.doc.feel); return `<div class="tg-row"><span class="e">${f ? f.e : '·'}</span><span class="grow"><b>${r.day === today() ? 'Today' : esc(fmtShort(r.day))}</b><small>${f ? esc(f.t) : 'Not filled in'}</small></span><button class="btn small" data-act="tgEdit" data-d="${r.day}">${r.doc ? 'Change' : 'Fill in'}</button></div>`; }).join('')}</section>`;
}

/* ---------- Dad's view (Family › Together) ---------- */
export function togetherDad() {
  const n = (S.ui.tgWeeks || 8) * 7, label = tgLabel();
  return `<section class="card tg-intro"><div class="ch"><span class="badge b-pink">💞</span><h3>Good &amp; hard days</h3></div>
      <p>Each girl checks in on her day with ${esc(label)}: great, good, okay, hard or really hard, what happened, and whether she wants to talk. Good days sit above the line, hard days below, and the dark line is each week's average.</p>
      <p class="note">One argument can't make it "mostly hard": that takes more hard days than good ones across at least three different weeks. Her answers are only hers and yours; her sister never sees them.</p>
      <div class="row"><input type="text" id="tgLabelIn" maxlength="40" value="${esc(label)}" aria-label="Who the question is about"><button class="btn small" data-act="tgLabelSave">Save</button></div></section>
    ${windowChips([8, 4, 12])}
    ${kids().map(k => {
      const rows = rowsFor(k.id, n), s = summary(rows.slice(-28)), vd = verdict(s);
      const notes = rows.filter(r => r.doc && (r.doc.note || r.doc.talkSent)).reverse().slice(0, 6);
      return `<section class="card"><div class="ch">${avatar(k.id)}<h3>${esc(k.nick || k.name)}</h3><em>${s.checkins} check-ins · 4 wks</em></div>
        ${graph(k.id, rows)}
        <p class="tg-verdict v-${vd.key}">${esc(vd.dad)}</p>${s.trend ? `<p class="note">${s.trend === 'better' ? '📈' : s.trend === 'harder' ? '📉' : '➡️'} ${esc(TREND[s.trend])}${s.hardRun >= 3 ? ` · ${s.hardRun} hard days in a row` : ''}</p>` : s.hardRun >= 3 ? `<p class="note">${s.hardRun} hard days in a row</p>` : ''}
        ${counts(s)}${tagLine('Good days were', s.topGood)}${tagLine('Hard days were', s.topHard)}
        ${notes.length ? `<p class="sec-title">In her words</p>${notes.map(r => { const f = feelOf(r.doc.feel); return `<div class="tg-row"><span class="e">${f?.e || ''}</span><span class="grow"><b>${esc(fmtShort(r.day))}</b>${r.doc.note ? `<small>“${esc(r.doc.note)}”</small>` : ''}${r.doc.talkSent ? '<small>💬 Asked to talk</small>' : ''}</span></div>`; }).join('')}` : ''}
      </section>`; }).join('') || '<div class="empty">No girls set up yet.</div>'}
    <details class="card tg-tips"><summary><b>Talking about it</b></summary><ul>
      <li>Look at the graph together. Point out the good days too: they're real.</li>
      <li>Listen first. Ask what happened before fixing anything.</li>
      <li>Ask what makes the good days good, and do more of that.</li>
      <li>One hard day, even a big argument, isn't the whole story.</li>
      <li>If it's mostly hard for weeks, take it seriously. A family counsellor can help everyone, and it doesn't mean anyone failed.</li></ul></details>`;
}

export const TOGETHER_ACTIONS = {
  tgOpen() { S.tab = 'me'; S.sub = 'together'; Snd.tap(); window.scrollTo({ top: 0 }); S.render(); },
  tgDad() { S.tab = 'family'; S.sub = 'together'; Snd.tap(); window.scrollTo({ top: 0 }); S.render(); },
  async tgStart(el) {
    const f = el.dataset.f;
    if (f === 'none') { await save(S.me.id, today(), { feel: 'none', tags: [], note: '', talk: false }); return; }
    Snd.pop(); openFor(S.me.id, today(), f);
  },
  tgEdit(el) { Snd.tap(); openFor(S.me.id, el.dataset.d); },
  tgFeel(el) { const st = sheetState(); Snd.pop(); openSheet(sheet(st.k, st.day, { ...st, feel: el.dataset.f, talk: st.talk || (el.dataset.f === 'awful' && !Store.get(pathOf(st.k, st.day))?.feel) })); },
  tgTag(el) { el.classList.toggle('on'); Snd.tick(); },
  async tgSave() { const st = sheetState(); if (st.k === S.me.id && st.feel) await save(st.k, st.day, st); },
  async tgDel(el) {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'Sure? Tap again'; return; }
    const st = sheetState(); closeSheet(); Snd.tap(); await delDoc(pathOf(st.k, st.day));
  },
  tgDay(el) { S.ui.tgSel = { ...(S.ui.tgSel || {}), [el.dataset.k]: S.ui.tgSel?.[el.dataset.k] === el.dataset.d ? null : el.dataset.d }; Snd.tick(); S.render(true); },
  tgWeeks(el) { S.ui.tgWeeks = Number(el.dataset.n); Snd.tap(); S.render(true); },
  async tgLabelSave() {
    if (!isParent()) return;
    const label = ($('#tgLabelIn')?.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const w = await setDoc('settings/together', { ...(Store.get('settings/together') || {}), label: label || DEFAULT_LABEL });
    if (w.ok) { Snd.check(); toast('Saved. The girls see it straight away'); }
  },
};
