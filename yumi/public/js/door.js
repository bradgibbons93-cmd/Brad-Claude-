/* Getting in: the front door, codes, "Add a phone", and first-time setup. */
import { esc, api, Snd, toast, today } from './core.js';
import { S, people, P, avatar, picOf, accentOf, famName, homeFor, homeName, nextSwitch, rules } from './model.js';

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const lockup = () => `<div class="lockup"><span class="word"><i>★</i>yumi</span>${S.boot?.family ? `<span class="fam">${esc(S.boot.family)}</span>` : ''}</div>`;

function keypad(len, buf) {
  return `<div class="dots" id="dots">${Array.from({ length: len }, (_, i) => `<i class="${i < buf.length ? 'on' : ''}"></i>`).join('')}</div>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-act="key" data-k="${n}" aria-label="${n}">${n}</button>`).join('')}<button class="blank" tabindex="-1" aria-hidden="true"></button><button data-act="key" data-k="0" aria-label="0">0</button><button data-act="key" data-k="back" aria-label="Delete">⌫</button></div>`;
}

export function viewDoor() {
  const u = S.ui;
  if (u.join) return viewJoin();
  if (u.setup) return viewSetup();
  if (u.choose) return viewChoose();
  if (u.pin) return viewPin();
  if (u.pair) return viewPair();
  const known = S.boot?.known && people().length;
  if (!known) return viewWelcome();
  const ps = people();
  const t = today(), h = homeFor(t), nx = nextSwitch();
  return `<div class="screen"><div class="door">
    ${lockup()}
    <p class="t-b" style="font-size:22px">Who's here?</p>
    <div class="who" style="--n:${Math.min(ps.length, 3)}">${ps.map(p => `<button class="pa" data-act="pickWho" data-who="${esc(p.id)}" style="--pc:${accentOf(p.id)}" aria-label="${esc(p.name)}">
      <span class="fr">${picOf(p.id, 'p') ? `<img src="${esc(picOf(p.id, 'p'))}" alt="">` : `<span>${esc(p.name[0])}</span>`}</span>
      ${p.role === 'parent' ? `<small class="lk">🔒 ${esc(p.nick || 'Grown-up')}</small>` : `<small>★ ${Number(p.pub?.stars) || 0}</small>`}
      <b>${esc(p.name)}</b></button>`).join('')}</div>
    ${h !== 'unknown' ? `<div class="glass"><b>📅 Tonight: ${esc(homeName(h))}</b><small>${nx ? `${nx.home === 'dad' ? "Dad's" : nx.home === 'mum' ? "Mum's" : 'Swap'} in ${nx.sleeps} ${nx.sleeps === 1 ? 'sleep' : 'sleeps'}` : 'Same all fortnight'}</small></div>` : ''}
    <p class="handnote" style="color:var(--ink2)">Tap your picture to come in</p>
    <button class="linkish" data-act="pairOpen">Got a code from Dad for a new phone?</button>
  </div></div>`;
}

function viewWelcome() {
  return `<div class="screen"><div class="door">
    ${lockup()}
    <p class="t-b">Welcome to Yumi</p>
    <p class="lead">Your family's stars, routines, week and messages, on your own phone.</p>
    ${isIOS && !standalone() ? `<div class="glass"><b>📲 On an iPhone or iPad? Do this first</b><small>Tap Share <b>↑</b>, then <b>Add to Home Screen</b>. Then open Yumi from your Home Screen and type your code there, so it remembers you.</small></div>` : ''}
    <div class="glass" style="gap:10px"><b>Got a code from Dad?</b>
      <div class="codebox"><input id="pairIn" type="text" inputmode="text" autocomplete="one-time-code" autocapitalize="characters" maxlength="7" placeholder="ABC 123" aria-label="Code from Dad"></div>
      <button class="btn solid wide" data-act="pairGo">Come in</button>
      <p class="status" id="pairSt"></p>
    </div>
    <button class="linkish" data-act="parentPin">I'm a grown-up in this family</button>
  </div></div>`;
}

const SHARE_IC = '<svg class="ios-ic" viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ADD_IC = '<svg class="ios-ic" viewBox="0 0 24 24" aria-label="Add"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/* Opened from the link Dad sent. On an iPhone, Yumi goes on the Home Screen first (that's where
   notifications work and where it stays signed in), and opens there already holding the link. */
function viewJoin() {
  const j = S.ui.join, c = j.code;
  if (j.install) return `<div class="screen"><div class="door">
    ${lockup()}
    <p class="t-b">Hi! ⭐ Let's put Yumi on your phone</p>
    <ol class="installsteps">
      <li><i>1</i><span>Tap <b>Share</b> ${SHARE_IC} at the bottom of Safari</span></li>
      <li><i>2</i><span>Scroll down, tap <b>Add to Home Screen</b> ${ADD_IC}, then <b>Add</b></span></li>
      <li><i>3</i><span>Open <b>Yumi</b> from your Home Screen</span></li>
    </ol>
    <div class="glass"><b>Your code from Dad</b><div class="code6">${esc(c.slice(0, 3))}&nbsp;${esc(c.slice(3))}</div><small>If Yumi asks for a code, type this one. It works once.</small></div>
    <button class="linkish" data-act="joinHere">Skip and use Yumi in Safari</button>
  </div></div>`;
  return `<div class="screen"><div class="door">
    ${lockup()}
    ${j.err ? `<p class="t-b">That link didn't work</p><p class="lead">${esc(j.err)}</p><button class="btn solid wide" style="max-width:420px" data-act="joinDone">OK</button>`
      : `<p class="t-b">Opening your Yumi…</p><span class="splash-star" aria-hidden="true">★</span>`}
  </div></div>`;
}
async function joinClaim() {
  const j = S.ui.join; if (!j) return;
  j.install = false; j.err = null; S.render(true);
  const r = await api('/pair/claim', { code: j.code });
  if (!r.ok) {
    j.err = r.error === 'locked' ? 'Too many tries. Wait a few minutes, then tap the link again.' : r.error === 'offline' ? "Can't reach Yumi. Check the internet, then tap the link again." : "It's been used already or it's too old. Ask Dad to send you a new one.";
    Snd.err(); S.render(true); return;
  }
  history.replaceState(null, '', '/');
  Snd.fanfare(); S.ui.join = null;
  await S.reboot({ intro: true });
}
S.joinStart = () => { if (isIOS && !standalone()) { S.ui.join.install = true; S.render(true); } else joinClaim(); };

function viewPair() {
  return `<div class="screen"><div class="door">
    ${lockup()}
    <p class="t-b">Add this phone</p>
    <p class="lead">Type the code Dad made for you. It works once.</p>
    <div class="glass" style="gap:10px">
      <div class="codebox"><input id="pairIn" type="text" autocapitalize="characters" autocomplete="one-time-code" maxlength="7" placeholder="ABC 123" aria-label="Code from Dad"></div>
      <button class="btn solid wide" data-act="pairGo">Come in</button>
      <p class="status" id="pairSt">${esc(S.ui.pair?.msg || '')}</p>
    </div>
    <button class="linkish" data-act="doorBack">Back</button>
  </div></div>`;
}

function viewPin() {
  const pn = S.ui.pin, p = pn.who ? P(pn.who) : null;
  return `<div class="screen"><div class="door"><div class="pin">
    ${p ? `<span class="face">${picOf(p.id) ? `<img src="${esc(picOf(p.id))}" alt="">` : ''}</span><p class="t-b">${p.role === 'parent' ? `${esc(p.nick || p.name)} mode` : `Hi ${esc(p.name)}!`}</p>` : `${lockup()}<p class="t-b">Grown-up sign in</p>`}
    <p class="handnote" style="color:var(--ink2)">Type your secret code</p>
    ${keypad(pn.len, pn.buf)}
    <p class="status ${pn.err ? 'err' : ''}" id="pinSt">${esc(pn.msg || '')}</p>
    <span class="stay">🔓 You'll stay signed in on this phone until you tap Sign out.</span>
    <button class="linkish" data-act="doorBack">Back</button>
  </div></div></div>`;
}

function viewChoose() {
  const c = S.ui.choose, me = P(S.me.id);
  return `<div class="screen"><div class="door"><div class="pin">
    <span class="face">${picOf(S.me.id) ? `<img src="${esc(picOf(S.me.id))}" alt="">` : ''}</span>
    <p class="t-b">This phone is for ${esc(me?.name || S.me.name)} ♡</p>
    <p class="handnote" style="color:var(--ink2)">${c.first ? 'Type it one more time' : 'Pick your own 4-number secret code'}</p>
    ${keypad(4, c.buf)}
    <p class="status ${c.err ? 'err' : ''}">${esc(c.msg || "Only you need to know it. You'll use it if you ever sign out.")}</p>
  </div></div></div>`;
}

function viewSetup() {
  const st = S.ui.setup, fresh = !people().some(p => p.role === 'parent');
  if (st.step === 'code') {
    return `<div class="screen"><div class="door"><div class="pin">
      ${lockup()}
      <p class="t-b">${st.first ? 'Type it again' : 'Make your 6-number grown-up code'}</p>
      <p class="lead">This code opens Dad mode. Keep it to yourself.</p>
      ${keypad(6, st.buf)}
      <p class="status ${st.err ? 'err' : ''}">${esc(st.msg || '')}</p>
    </div></div></div>`;
  }
  return `<div class="screen"><div class="door">
    ${lockup()}
    <p class="t-b">Set up Yumi</p>
    ${fresh ? `<div class="glass form" style="gap:10px">
        <label>Family name<input type="text" id="suFam" maxlength="40" placeholder="The Smith Crew"></label>
        <label>Your name<input type="text" id="suParent" maxlength="30" placeholder="Your first name"></label>
        <label>Kids' first names (one per line)<textarea id="suKids" rows="3"></textarea></label>
      </div>` : `<p class="lead">Everything from Crew OS is here already: ${people().filter(p => p.role === 'kid').map(p => esc(p.name)).join(' and ')}'s stars, routines, the calendar and your messages.</p>`}
    <button class="btn solid wide" style="max-width:420px" data-act="setupNext">Next: make your code</button>
  </div></div>`;
}

/* ---------- actions ---------- */
async function finishPin(code) {
  const pn = S.ui.pin;
  pn.msg = 'Checking…'; pn.err = false; S.render();
  const r = await api('/login', { who: pn.who || null, code });
  if (r.ok) { Snd.magic(); S.ui.pin = null; await S.reboot(); return; }
  pn.buf = ''; pn.err = true;
  pn.msg = r.error === 'locked' ? `Too many tries. Wait ${Math.ceil((r.wait || 60) / 60)} min.` : r.error === 'no_code' ? 'No code set yet. Ask Dad for a code to add this phone.' : r.error === 'unknown_device' ? 'This phone needs a code from Dad first.' : r.error === 'offline' ? "Can't reach Yumi. Check the internet." : `That's not it.${r.left ? ` ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.` : ''}`;
  Snd.err(); S.render(); document.getElementById('dots')?.classList.add('shake');
}

async function finishChoose(code) {
  const c = S.ui.choose;
  if (!c.first) { c.first = code; c.buf = ''; c.msg = ''; c.err = false; Snd.tick(); S.render(); return; }
  if (c.first !== code) { c.first = ''; c.buf = ''; c.err = true; c.msg = "Those didn't match. Let's try again."; Snd.err(); S.render(); return; }
  const r = await api('/me/code', { code });
  if (!r.ok) { c.first = ''; c.buf = ''; c.err = true; c.msg = "Couldn't save that. Try again."; S.render(); return; }
  S.ui.choose = null; Snd.magic(); toast('Code saved');
  await S.reboot({ intro: true });
}

async function finishSetup(code) {
  const st = S.ui.setup;
  if (!st.first) { st.first = code; st.buf = ''; st.msg = ''; Snd.tick(); S.render(); return; }
  if (st.first !== code) { st.first = ''; st.buf = ''; st.err = true; st.msg = "Those didn't match. Try again."; Snd.err(); S.render(); return; }
  const r = await api('/setup', { token: st.token, code, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ...st.form });
  if (!r.ok) { st.first = ''; st.buf = ''; st.err = true; st.msg = r.error === 'bad_token' ? 'This setup link is not right. Copy it again from Railway.' : r.error === 'already_set_up' ? 'Yumi is already set up. Sign in instead.' : "Couldn't finish setup."; S.render(); return; }
  history.replaceState(null, '', '/');
  S.ui.setup = null; Snd.fanfare(); toast("You're in. Welcome to Yumi!");
  await S.reboot();
}

export const DOOR_ACTIONS = {
  pickWho(el) {
    const p = P(el.dataset.who); if (!p) return;
    Snd.pop();
    if (p.role === 'kid' && !p.hasCode) { S.ui.pair = { msg: `${p.name} needs a code from Dad to add this phone.` }; S.render(); return; }
    S.ui.pin = { who: p.id, len: p.role === 'parent' ? 6 : 4, buf: '' }; S.render();
  },
  joinHere() { Snd.tap(); joinClaim(); },
  joinDone() { S.ui.join = null; history.replaceState(null, '', '/'); S.reboot(); },
  parentPin() { Snd.tap(); S.ui.pin = { who: null, len: 6, buf: '' }; S.render(); },
  pairOpen() { Snd.tap(); S.ui.pair = {}; S.render(); setTimeout(() => document.getElementById('pairIn')?.focus(), 50); },
  doorBack() { Snd.tap(); S.ui.pin = null; S.ui.pair = null; S.render(); },
  async pairGo() {
    const inp = document.getElementById('pairIn'), st = document.getElementById('pairSt');
    const code = (inp?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) { st.textContent = 'The code has 6 letters and numbers.'; st.className = 'status err'; Snd.err(); return; }
    st.textContent = 'Checking…'; st.className = 'status';
    const r = await api('/pair/claim', { code });
    if (!r.ok) { st.textContent = r.error === 'locked' ? 'Too many tries. Wait a few minutes.' : r.error === 'offline' ? "Can't reach Yumi. Check the internet." : "That code didn't work. Ask Dad for a fresh one."; st.className = 'status err'; Snd.err(); return; }
    Snd.fanfare(); S.ui.pair = null;
    await S.reboot({ intro: true });
  },
  key(el) {
    const k = el.dataset.k, box = S.ui.setup?.step === 'code' ? S.ui.setup : S.ui.choose || S.ui.pin;
    if (!box) return;
    const len = S.ui.setup?.step === 'code' ? 6 : S.ui.choose ? 4 : S.ui.pin.len;
    if (k === 'back') { box.buf = box.buf.slice(0, -1); Snd.tick(); S.render(); return; }
    if (box.buf.length >= len) return;
    box.buf += k; box.err = false; Snd.tick(); S.render();
    if (box.buf.length === len) {
      const code = box.buf;
      setTimeout(() => { if (S.ui.setup?.step === 'code') finishSetup(code); else if (S.ui.choose) finishChoose(code); else finishPin(code); }, 120);
    }
  },
  setupNext() {
    const fresh = !people().some(p => p.role === 'parent');
    const form = {};
    if (fresh) {
      form.family = (document.getElementById('suFam')?.value || '').trim();
      form.parent = (document.getElementById('suParent')?.value || '').trim();
      form.kids = (document.getElementById('suKids')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!form.parent) { toast('Add your name first'); Snd.err(); return; }
    }
    Object.assign(S.ui.setup, { step: 'code', buf: '', first: '', form });
    Snd.tap(); S.render();
  },
};

/* Lets a typed keyboard work on the code pads too. */
addEventListener('keydown', e => {
  if (S.mode !== 'door' || !(S.ui.pin || S.ui.choose || S.ui.setup?.step === 'code')) return;
  if (/^\d$/.test(e.key)) DOOR_ACTIONS.key({ dataset: { k: e.key } });
  else if (e.key === 'Backspace') DOOR_ACTIONS.key({ dataset: { k: 'back' } });
});
