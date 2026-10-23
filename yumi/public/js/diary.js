/* My diary: quick private notes for whoever is signed in (Dad's, today). Pages live at
   diary/<person>/<id>, and the server only ever sends them to that person's own phones. */
import { esc, Store, ymd, addDays, today, fmtShort, fmtTime, pad, ago, byAtDesc, uid, nowIso, Snd, Confetti, toast, openSheet, closeSheet, setDoc, mergeDoc, delDoc } from './core.js';
import { S } from './model.js';

const MOODS = ['😊', '😌', '💪', '🙏', '😴', '😤', '😢', '❤️'];
const PROMPTS = ['What happened today?', 'One win from today…', 'Something to remember…', "What's on my mind…", 'Grateful for…', 'Note to self…'];
const entries = () => Store.col(`diary/${S.me.id}`).sort(byAtDesc);
const prompt = () => PROMPTS[new Date().getDate() % PROMPTS.length];
const dayLabel = d => d === today() ? 'Today' : d === ymd(addDays(new Date(), -1)) ? 'Yesterday' : fmtShort(d);
const timeOf = iso => { const d = new Date(iso); return fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`); };
const moodRow = sel => `<div class="dmoods" id="dMoods" role="group" aria-label="How do you feel? (optional)">${MOODS.map(m => `<button type="button" class="${m === sel ? 'on' : ''}" data-act="diaryMood" data-v="${m}" aria-pressed="${m === sel}">${m}</button>`).join('')}</div>`;
const lock = '<p class="dlock">🔒 Only you can read this. Not the girls, not anyone else.</p>';

function composer() {
  return `<textarea id="diaryText" class="hand" rows="3" maxlength="4000" placeholder="${esc(prompt())}" aria-label="Quick note">${esc(S.ui.diaryDraft || '')}</textarea>
    ${moodRow(S.ui.diaryMood)}
    <button class="btn solid" data-act="diarySave">Save to my diary</button>`;
}

/* Home: write a line without leaving the screen. */
export function diaryQuickCard() {
  const last = entries()[0];
  return `<section class="card diaryq"><div class="ch"><span class="badge b-lilac">📔</span><h3>My diary</h3><button class="edit" data-act="goDiary">${entries().length ? `${entries().length} notes ›` : 'Open ›'}</button></div>
    ${lock}${composer()}
    ${last ? `<button class="dlast" data-act="goDiary"><span>${esc(last.mood || '📝')}</span><span class="grow">${esc(String(last.text || '').slice(0, 70))}${String(last.text || '').length > 70 ? '…' : ''}</span><time>${ago(last.at)}</time></button>` : ''}</section>`;
}

export function diaryPage() {
  const q = (S.ui.diaryQ || '').trim().toLowerCase();
  const all = entries(), list = q ? all.filter(e => String(e.text || '').toLowerCase().includes(q)) : all;
  const days = []; for (const e of list) { const d = ymd(new Date(e.at)); if (!days.length || days[days.length - 1].d !== d) days.push({ d, items: [] }); days[days.length - 1].items.push(e); }
  return `<div class="backrow"><button class="btn small" data-act="sub" data-sub="">‹ Back</button></div>
    <h1 class="t-b">📔 My diary</h1>${lock}
    <section class="card diaryq">${composer()}</section>
    ${all.length > 3 ? `<input type="search" id="diaryQ" placeholder="Search my notes" value="${esc(S.ui.diaryQ || '')}" aria-label="Search my notes">` : ''}
    ${days.length ? days.map(({ d, items }) => `<p class="sec-title">${esc(dayLabel(d))}</p>${items.map(e => `<article class="jp dentry"><div class="jh">${e.mood ? `<span style="font-size:22px">${esc(e.mood)}</span>` : ''}<time style="margin-left:0">${timeOf(e.at)}${e.editedAt ? ' · edited' : ''}</time>
        <span class="grow"></span><button class="x-btn" data-act="diaryEdit" data-id="${esc(e.id)}" aria-label="Edit note">✏️</button><button class="x-btn" data-act="diaryDel" data-id="${esc(e.id)}" aria-label="Delete note">🗑️</button></div><p>${esc(e.text)}</p></article>`).join('')}`).join('')
      : `<div class="empty">${q ? 'No notes match that.' : 'Nothing here yet. Write your first note above.'}</div>`}`;
}

/* Typing in the boxes is kept, so a live update from the girls' phones can't wipe a half-written note. */
document.addEventListener('input', e => {
  if (e.target.id === 'diaryText') S.ui.diaryDraft = e.target.value;
  if (e.target.id === 'diaryQ') { S.ui.diaryQ = e.target.value; S.render(true); const el = document.getElementById('diaryQ'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); }
});

export const DIARY_ACTIONS = {
  goDiary() { S.tab = 'me'; S.sub = 'diary'; Snd.tap(); window.scrollTo({ top: 0 }); S.render(true); },
  diaryMood(el) {
    const v = el.dataset.v; S.ui.diaryMood = S.ui.diaryMood === v ? null : v; Snd.tick();
    el.closest('#dMoods')?.querySelectorAll('button').forEach(b => { const on = b.dataset.v === S.ui.diaryMood; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  },
  async diarySave(el) {
    const box = document.getElementById('diaryText'), text = (box?.value || '').trim();
    if (!text) { box?.focus(); Snd.err(); toast('Write a few words first'); return; }
    const mood = S.ui.diaryMood || null;
    S.ui.diaryDraft = ''; S.ui.diaryMood = null; if (box) box.value = '';
    Confetti.from(el, 18); Snd.magic();
    await setDoc(`diary/${S.me.id}/${uid()}`, { text, mood });
    toast('Saved to your diary 🔒');
  },
  diaryEdit(el) {
    const e = Store.get(`diary/${S.me.id}/${el.dataset.id}`); if (!e) return;
    Snd.tap();
    openSheet(`<h2 id="sheetTitle">Edit note</h2><div class="form"><textarea id="dEdit" class="hand" rows="6" maxlength="4000">${esc(e.text)}</textarea>
      <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="diaryEditSave" data-id="${esc(el.dataset.id)}">Save</button></div></div>`);
  },
  async diaryEditSave(el) {
    const text = (document.getElementById('dEdit')?.value || '').trim(); if (!text) { Snd.err(); return; }
    closeSheet(); Snd.check(); await mergeDoc(`diary/${S.me.id}/${el.dataset.id}`, { text, editedAt: nowIso() });
  },
  async diaryDel(el) {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = '❓'; toast('Tap the bin again to delete this note'); setTimeout(() => { if (el.isConnected) { delete el.dataset.sure; el.textContent = '🗑️'; } }, 4000); return; }
    Snd.tap(); await delDoc(`diary/${S.me.id}/${el.dataset.id}`);
  },
};
