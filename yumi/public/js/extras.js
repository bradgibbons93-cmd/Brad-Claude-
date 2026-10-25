/* Three small things around the girls: Dad's own reasons for a star (kept as buttons for next time),
   what each girl can spend her stars on, seen from Dad's phone (and changed there), and the girls'
   friends lists, with a "can we have a playdate?" that lands on Dad's Waiting for you. */
import { $, esc, Store, today, uid, parseYmd, MON, Snd, Confetti, toast, openSheet, closeSheet, act, setDoc, mergeDoc, delDoc } from './core.js';
import { S, P, kids, short, isParent, isKid, STAR_REASONS, PLAN_COLORS, rewardsList, TRAIL_REWARDS, starsOf, rules } from './model.js';

/* ---------- reasons for a star ---------- */
const customReasons = () => (Store.get('settings/starReasons')?.items || []).filter(r => r && r.t);
export function starReasonButtons(k, close = false) {
  const sister = kids().find(x => x.id !== k), editing = S.ui.editReasons;
  const base = STAR_REASONS.map(r => r === 'Kind to sister' ? `Kind to ${sister ? sister.nick || sister.name : 'family'}` : r);
  const c = close ? ' data-close="1"' : '';
  return `<div class="reasons">${base.map(r => `<button data-act="giveStar" data-k="${esc(k)}" data-r="${esc(r)}" data-n="1"${c}>★ ${esc(r)}</button>`).join('')}
    <button data-act="giveStar" data-k="${esc(k)}" data-r="Big win" data-n="3"${c}>★ Big win +3</button>
    ${customReasons().map((r, i) => editing
      ? `<button class="mine del" data-act="starReasonDel" data-i="${i}" aria-label="Remove ${esc(r.t)}">✕ ${esc(r.t)}</button>`
      : `<button class="mine" data-act="giveStar" data-k="${esc(k)}" data-r="${esc(r.t)}" data-n="${Number(r.n) || 1}"${c}>★ ${esc(r.t)}${Number(r.n) > 1 ? ` +${Number(r.n)}` : ''}</button>`).join('')}
    <button class="own" data-act="starOwn" data-k="${esc(k)}">＋ My own reason</button></div>
    ${customReasons().length ? `<button class="linkbtn" data-act="starReasonEdit">${editing ? 'Done' : 'Remove one of my reasons'}</button>` : ''}`;
}
function ownSheet(k) {
  return `<h2 id="sheetTitle">A star for ${esc(short(k))}</h2><div class="form">
    <label class="lbl" for="ownReason">What's it for?</label>
    <input type="text" id="ownReason" maxlength="60" placeholder="e.g. Read to her sister" autofocus>
    <p class="lbl">How many stars?</p>
    <div class="emoji-pick nums" role="group" aria-label="How many stars">${[1, 2, 3].map(n => `<button type="button" data-act="pick" data-n="${n}" class="${n === 1 ? 'on' : ''}">★ ${n}</button>`).join('')}</div>
    <label class="check"><input type="checkbox" id="ownKeep" checked> Keep it as a button for next time</label>
    <div class="actions"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn solid" data-act="starOwnGo" data-k="${esc(k)}">Give the star</button></div></div>`;
}

/* ---------- what she can get, on Dad's phone ---------- */
export function rewardsForDad(k) {
  const n = starsOf(k), R = rules(), name = esc(P(k)?.nick || P(k)?.name || 'She'), editing = S.ui.editRewards;
  const trail = [...TRAIL_REWARDS, { id: 'payday', e: '💵', t: `Payday: $${R.paydayDollars}`, d: 'Her jar starts again after.', cost: R.paydayStars }];
  const row = (r, edit) => `<div class="dadrew ${n >= r.cost ? 'can' : ''}"><span class="re">${esc(r.e)}</span><span class="grow"><b>${esc(r.t)}</b>${r.d ? `<small>${esc(r.d)}</small>` : ''}</span>
    <span class="rc"><span class="cost">★ ${r.cost}</span><small>${n >= r.cost ? 'She can get it' : `${r.cost - n} more`}</small></span>
    ${edit ? `<button class="x-btn" data-act="rewEdit" data-id="${esc(r.id)}" aria-label="Change ${esc(r.t)}">✏️</button>` : ''}</div>`;
  return `<section class="card" id="dadRewards"><div class="ch"><span class="badge b-pink">🎁</span><h3>What ${name} can get</h3><button class="edit" data-act="rewEditMode">${editing ? 'Done' : 'Change'}</button></div>
    <p class="note">${name} has <b>★ ${n}</b>. This is what she sees on her Rewards.</p>
    <p class="sec-title">Star trail · she taps a treat when she gets there</p>
    ${trail.map(r => row(r, false)).join('')}
    <p class="sec-title">Spend or save</p>
    ${rewardsList().map(r => row(r, editing)).join('')}
    ${editing ? '<button class="btn small" data-act="rewEdit" data-id="">＋ Add a reward</button><p class="note">The star trail treats are fixed for now; the Spend or save list is yours to change.</p>' : ''}
  </section>`;
}
function rewardSheet(r) {
  return `<h2 id="sheetTitle">${r.id ? 'Change reward' : 'New reward'}</h2><div class="form">
    <div class="row"><input type="text" id="rwE" maxlength="4" value="${esc(r.e || '🎁')}" aria-label="Emoji" style="max-width:76px;text-align:center;font-size:24px"><input type="text" id="rwT" maxlength="40" placeholder="e.g. Choose the music in the car" value="${esc(r.t || '')}" aria-label="Reward" ${r.id ? '' : 'autofocus'}></div>
    <input type="text" id="rwD" maxlength="80" placeholder="A few words about it (optional)" value="${esc(r.d || '')}" aria-label="Description">
    <label class="lbl" for="rwC">Stars it costs</label><input type="number" id="rwC" inputmode="numeric" min="1" max="100" value="${Number(r.cost) || 5}">
    <div class="actions">${r.id ? `<button class="btn" data-act="rewDel" data-id="${esc(r.id)}">Remove</button>` : '<button class="btn" data-act="closeSheet">Cancel</button>'}<button class="btn solid" data-act="rewSave" data-id="${esc(r.id || '')}">Save</button></div></div>`;
}

/* ---------- friends ---------- */
const FRIEND_EMOJI = ['🦄', '🐱', '🐶', '🐰', '🦋', '🌸', '⭐', '🌈', '🐼', '🦊', '🍓', '🎀'];
const friendsOf = k => Store.col(`kids/${k}/friends`).sort((a, b) => String(a.name).localeCompare(String(b.name)));
function nextBirthday(s) {
  const m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null;
  const t = parseYmd(today()), y = t.getFullYear();
  let d = new Date(y, Number(m[1]) - 1, Number(m[2])); if (d < t) d = new Date(y + 1, Number(m[1]) - 1, Number(m[2]));
  return { days: Math.round((d - t) / 864e5), label: `${d.getDate()} ${MON[d.getMonth()]}` };
}
function friendCard(k, f) {
  const b = nextBirthday(f.bday), mine = S.me.id === k;
  return `<article class="friend" style="--fc:${esc(f.color || PLAN_COLORS[0])}">
    <span class="fav">${esc(f.e || '⭐')}</span>
    <div class="grow"><b>${esc(f.name)}</b>
      ${b ? `<small>🎂 ${b.label}${b.days === 0 ? ' · today! 🎉' : b.days <= 30 ? ` · in ${b.days} day${b.days === 1 ? '' : 's'}` : ''}</small>` : ''}
      ${f.likes ? `<small>💖 Likes ${esc(f.likes)}</small>` : ''}
      ${f.school ? `<small>🏫 ${esc(f.school)}</small>` : ''}
      ${isParent() && f.grownup ? `<small>👤 ${esc(f.grownup)}</small>` : ''}
      ${f.askedAt ? `<small class="asked">🧸 Asked for a playdate</small>` : ''}</div>
    <div class="fbtns">${mine ? `<button class="btn small solid" data-act="playdate" data-id="${esc(f.id)}">🧸 Playdate?</button>` : ''}<button class="x-btn" data-act="friendEdit" data-k="${esc(k)}" data-id="${esc(f.id)}" aria-label="Change ${esc(f.name)}">✏️</button></div>
  </article>`;
}
export function friendsPage() {
  const list = isParent() ? kids() : [P(S.me.id)];
  return `${isKid() ? '<div class="backrow"><button class="btn small" data-act="sub" data-sub="">‹ Back</button></div><h1 class="t-b">🧸 My friends</h1>' : ''}
    ${list.map(k => { const fs = friendsOf(k.id);
      return `<section class="card"><div class="ch"><span class="badge b-pink">🧸</span><h3>${isParent() ? `${esc(k.name)}'s friends` : 'My friends'}</h3><em>${fs.length || ''}</em></div>
        ${fs.map(f => friendCard(k.id, f)).join('') || `<div class="empty">${isParent() ? `${esc(k.name)} hasn't added any friends yet.` : 'Add your friends here: their birthday, what they love, and ask Dad for a playdate.'}</div>`}
        <button class="btn ${isKid() ? 'solid' : 'small'}" data-act="friendEdit" data-k="${esc(k.id)}" data-id="">＋ Add a friend${isParent() ? ` for ${esc(k.name)}` : ''}</button></section>`; }).join('')}
    <p class="note" style="text-align:center">🔒 Only ${isParent() ? 'each girl and you' : 'you and Dad'} can see ${isParent() ? 'her' : 'your'} friends.</p>`;
}
function friendSheet(k, f) {
  return `<h2 id="sheetTitle">${f.id ? `Change ${esc(f.name)}` : 'Add a friend'}</h2><div class="form">
    <input type="text" id="frName" maxlength="40" placeholder="Their name" value="${esc(f.name || '')}" aria-label="Their name" ${f.id ? '' : 'autofocus'}>
    <p class="lbl">Pick a picture</p><div class="emoji-pick emo" role="group" aria-label="Picture">${FRIEND_EMOJI.map(e => `<button type="button" data-act="pick" data-e="${e}" class="${(f.e || FRIEND_EMOJI[0]) === e ? 'on' : ''}">${e}</button>`).join('')}</div>
    <p class="lbl">Their colour</p><div class="emoji-pick cols" role="group" aria-label="Colour">${PLAN_COLORS.map(c => `<button type="button" data-act="pick" data-c="${c}" class="dot ${(f.color || PLAN_COLORS[0]) === c ? 'on' : ''}" style="background:${c}" aria-label="Colour"></button>`).join('')}</div>
    <label class="lbl" for="frBday">Birthday (if you know it)</label><input type="date" id="frBday" value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(f.bday || '') ? f.bday : '')}">
    <input type="text" id="frLikes" maxlength="80" placeholder="What do they love? (e.g. horses, KATSEYE)" value="${esc(f.likes || '')}" aria-label="What they love">
    <input type="text" id="frSchool" maxlength="40" placeholder="School or class (optional)" value="${esc(f.school || '')}" aria-label="School or class">
    <input type="text" id="frGrown" maxlength="60" placeholder="Their grown-up's name and number, for Dad (optional)" value="${esc(f.grownup || '')}" aria-label="Their grown-up">
    <div class="actions">${f.id ? `<button class="btn" data-act="friendDel" data-k="${esc(k)}" data-id="${esc(f.id)}">Remove</button>` : '<button class="btn" data-act="closeSheet">Cancel</button>'}<button class="btn solid" data-act="friendSave" data-k="${esc(k)}" data-id="${esc(f.id || '')}">Save</button></div></div>`;
}

const twoTap = (el, label) => { if (el.dataset.sure) return true; el.dataset.sure = '1'; const was = el.textContent; el.textContent = label; setTimeout(() => { if (el.isConnected) { delete el.dataset.sure; el.textContent = was; } }, 4000); return false; };
const picked = (sel, attr) => document.querySelector(`#sheetBody ${sel} button.on`)?.dataset[attr];

export const EXTRA2_ACTIONS = {
  starOwn(el) { Snd.tap(); openSheet(ownSheet(el.dataset.k)); },
  async starOwnGo(el) {
    const k = el.dataset.k, t = ($('#ownReason')?.value || '').replace(/\s+/g, ' ').trim();
    if (!t) { Snd.err(); $('#ownReason')?.focus(); toast('Write what the star is for'); return; }
    const n = Number(picked('.nums', 'n')) || 1, keep = $('#ownKeep')?.checked;
    closeSheet(); Snd.star(); Confetti.from(el, 40);
    const r = await act('giveStar', { kid: k, n, reason: t });
    toast(r.ok ? `+${n} ★ for ${short(k)}: ${t}` : "That star didn't save");
    if (r.ok && keep && !customReasons().some(x => x.t.toLowerCase() === t.toLowerCase())) await setDoc('settings/starReasons', { items: [...customReasons(), { t, n }].slice(-20) });
  },
  starReasonEdit() { S.ui.editReasons = !S.ui.editReasons; Snd.tap(); S.render(true); },
  async starReasonDel(el) { const items = customReasons().filter((_, i) => i !== Number(el.dataset.i)); Snd.tap(); await setDoc('settings/starReasons', { items }); if (!items.length) S.ui.editReasons = false; },
  rewEditMode() { S.ui.editRewards = !S.ui.editRewards; Snd.tap(); S.render(true); },
  rewEdit(el) { const r = rewardsList().find(x => x.id === el.dataset.id) || {}; Snd.tap(); openSheet(rewardSheet(r)); },
  async rewSave(el) {
    const t = ($('#rwT')?.value || '').trim(); if (!t) { Snd.err(); $('#rwT')?.focus(); return; }
    const item = { id: el.dataset.id || 'r' + uid(), e: ($('#rwE')?.value || '🎁').trim().slice(0, 4) || '🎁', t: t.slice(0, 40), d: ($('#rwD')?.value || '').trim().slice(0, 80), cost: Math.max(1, Math.min(100, Math.round(Number($('#rwC')?.value) || 5))) };
    const list = rewardsList().map(x => ({ ...x }));
    const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item);
    closeSheet(); Snd.check(); await setDoc('settings/rewards', { items: list.sort((a, b) => a.cost - b.cost) }); toast('Saved. The girls see it straight away');
  },
  async rewDel(el) { if (!twoTap(el, 'Sure? Tap again')) return; closeSheet(); Snd.tap(); await setDoc('settings/rewards', { items: rewardsList().filter(x => x.id !== el.dataset.id) }); },
  friendEdit(el) { const k = el.dataset.k, f = el.dataset.id ? { id: el.dataset.id, ...(Store.get(`kids/${k}/friends/${el.dataset.id}`) || {}) } : {}; Snd.tap(); openSheet(friendSheet(k, f)); },
  async friendSave(el) {
    const k = el.dataset.k, name = ($('#frName')?.value || '').replace(/\s+/g, ' ').trim();
    if (!name) { Snd.err(); $('#frName')?.focus(); toast('Write their name'); return; }
    const doc = { name, e: picked('.emo', 'e') || FRIEND_EMOJI[0], color: picked('.cols', 'c') || PLAN_COLORS[0], bday: $('#frBday')?.value || '', likes: ($('#frLikes')?.value || '').trim(), school: ($('#frSchool')?.value || '').trim(), grownup: ($('#frGrown')?.value || '').trim() };
    closeSheet(); Snd.check();
    if (el.dataset.id) await mergeDoc(`kids/${k}/friends/${el.dataset.id}`, doc);
    else { Confetti.from(el, 24); await setDoc(`kids/${k}/friends/${uid()}`, doc); toast(`${name} is on ${S.me.id === k ? 'your' : 'her'} friends list 💖`); }
  },
  async friendDel(el) { if (!twoTap(el, 'Sure? Tap again')) return; closeSheet(); Snd.tap(); await delDoc(`kids/${el.dataset.k}/friends/${el.dataset.id}`); },
  playdate(el) {
    const f = Store.get(`kids/${S.me.id}/friends/${el.dataset.id}`); if (!f) return; Snd.tap();
    openSheet(`<h2 id="sheetTitle">Playdate with ${esc(f.name)}? 🧸</h2><div class="form"><p class="lead">Dad gets a message and sorts it out.</p>
      <input type="text" id="pdWhen" maxlength="60" placeholder="When? (e.g. Saturday, after school)" aria-label="When">
      <div class="actions"><button class="btn" data-act="closeSheet">Not now</button><button class="btn solid" data-act="playdateGo" data-id="${esc(el.dataset.id)}">Ask Dad</button></div></div>`);
  },
  async playdateGo(el) {
    const when = $('#pdWhen')?.value || ''; closeSheet(); Confetti.from(el, 30); Snd.magic();
    const r = await act('askPlaydate', { friend: el.dataset.id, when });
    toast(r.ok ? 'Asked Dad! 🧸' : "That didn't send. Try again.");
  },
};
