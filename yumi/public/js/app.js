/* Yumi: starts the app, decides which screen to show, and routes taps to actions. */
import { $, api, Store, Snd, toast, closeSheet, sheetOpen } from './core.js';
import { S, P, isKid, isParent, accentOf, ACCENT_SOFT, buddyOf } from './model.js';
import { viewDoor, DOOR_ACTIONS } from './door.js';
import { viewRoom, ROOM_ACTIONS } from './room.js';
import { viewFamily, FAMILY_ACTIONS } from './family.js';
import { viewDad, DAD_ACTIONS } from './dad.js';

let pending = false, deferred = false;
S.render = (force) => {
  if (force === true) { draw(true); return; }
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; draw(false); });
};

function draw(force) {
  const app = $('#app'), a = document.activeElement;
  if (!force && a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox') { deferred = true; return; }
  deferred = false;
  const view = S.mode === 'room' ? viewRoom : S.mode === 'family' ? viewFamily : S.mode === 'dad' ? viewDad : viewDoor;
  if (S.me && S.mode === 'room') {
    const p = P(S.me.id);
    document.documentElement.style.setProperty('--accent', accentOf(S.me.id));
    document.documentElement.style.setProperty('--accent-soft', ACCENT_SOFT[p?.accent] || '#FFE1EC');
  } else {
    document.documentElement.style.setProperty('--accent', '#EC3D7C');
    document.documentElement.style.setProperty('--accent-soft', '#FFE1EC');
  }
  document.body.classList.toggle('dark', S.mode !== 'room');
  app.innerHTML = view();
}
document.addEventListener('focusout', () => { if (deferred) setTimeout(() => S.render(), 30); });

/* (Re)loads who is signed in and starts live sync. */
S.reboot = async (opts = {}) => {
  const qs = new URLSearchParams(location.search), setup = qs.get('setup');
  const r = await api('/boot' + (setup ? '?setup=' + encodeURIComponent(setup) : ''));
  if (!r.ok && r.error === 'offline') {
    $('#app').innerHTML = `<div class="screen dark"><div class="door"><div class="lockup"><span class="word"><i>★</i>yumi</span></div><p class="t-b">Can't reach Yumi</p><p class="lead">Check the internet, then try again.</p><button class="btn solid" data-act="retry">Try again</button></div></div>`;
    return;
  }
  S.boot = r; S.me = r.me;
  if (!opts.keep) S.ui = {};
  if (setup && r.setupNeeded && r.setupOk) { S.ui.setup = { token: setup, step: 'names' }; S.mode = 'door'; Store.stop(); S.render(true); return; }
  if (setup && !r.setupNeeded) history.replaceState(null, '', '/');
  if (!S.me) { Store.stop(); S.mode = 'door'; S.render(true); return; }
  if (isKid() && !S.me.hasCode) { S.ui.choose = { buf: '', first: '' }; S.mode = 'door'; Store.stop(); S.render(true); return; }
  if (!opts.keep) {
    S.mode = isKid() ? 'room' : 'dad'; S.tab = isKid() ? 'today' : 'home'; S.sub = null;
  }
  try { await Store.start(); } catch (e) { if (e.message !== 'signed_out') toast("Couldn't load everything. Pull down to try again."); }
  if (opts.intro && isKid() && !buddyOf(S.me.id)) { S.mode = 'room'; S.tab = 'more'; S.sub = 'mine'; S.ui.intro = true; }
  S.render(true);
};
Store.onChange = () => S.render();
Store.onSignedOut = () => { if (S.me) { S.me = null; Store.stop(); S.reboot(); } };

const NAV = {
  retry() { S.reboot(); },
  tab(el) {
    const t = el.dataset.tab;
    if (S.mode === 'room' && ['today', 'week', 'stars', 'journal', 'more'].includes(t)) { if (S.tab === t && S.sub) S.sub = null; S.tab = t; if (t !== 'more') S.sub = null; }
    else { S.mode = 'family'; S.tab = t; }
    S.ui.confirm = null; Snd.tap(); window.scrollTo({ top: 0 }); S.render(true);
  },
  toFamily() { S.mode = 'family'; S.tab = 'home'; Snd.tap(); window.scrollTo({ top: 0 }); S.render(true); },
  toMine() { if (isParent()) { S.mode = 'dad'; S.sub = null; } else { S.mode = 'room'; S.tab = 'today'; S.sub = null; } Snd.pop(); window.scrollTo({ top: 0 }); S.render(true); },
  goJobs() { S.mode = 'family'; S.tab = 'jobs'; Snd.tap(); window.scrollTo({ top: 0 }); S.render(true); },
  async signOut(el) {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'Sure? Tap again'; setTimeout(() => { if (el.isConnected) { delete el.dataset.sure; el.textContent = 'Sign out'; } }, 4000); return; }
    Snd.tap(); Store.stop(); closeSheet();
    await api('/logout', {});
    S.me = null; Store.docs.clear(); toast('Signed out. See you soon!');
    await S.reboot();
  },
  sound() { Snd.on = !Snd.on; try { localStorage.setItem('yumi-sound', Snd.on ? 'on' : 'off'); } catch (e) {} Snd.init(); Snd.tap(); toast(Snd.on ? 'Sounds on' : 'Sounds off'); S.render(); },
  closeSheet() { closeSheet(); },
  pick(el) { el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); Snd.tick(); },
};
const ACTIONS = { ...DOOR_ACTIONS, ...ROOM_ACTIONS, ...FAMILY_ACTIONS, ...DAD_ACTIONS, ...NAV };

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  try { await fn(el, e); } catch (err) { console.error(err); toast('Something went wrong. Try again.'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) closeSheet(); });

/* Pull data again when the day changes while the app stays open. */
let day = new Date().toDateString();
setInterval(() => { if (new Date().toDateString() !== day) { day = new Date().toDateString(); S.render(); } }, 60000);

S.reboot();
