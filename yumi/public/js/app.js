/* Yumi: starts the app, decides which screen to show, and routes taps to actions. */
import { $, api, Store, Snd, toast, closeSheet, sheetOpen } from './core.js';
import { S, P, isKid, isParent, accentOf, ACCENT_SOFT, buddyOf } from './model.js';
import { viewDoor, DOOR_ACTIONS } from './door.js';
import { viewApp } from './views.js';
import { ROOM_ACTIONS, FAMILY_ACTIONS, DAD_ACTIONS, EXTRA_ACTIONS, MORE_ACTIONS } from './actions.js';
import { swReady, pushSync, refreshPush } from './push.js';
import { GAME_ACTIONS } from './games.js';
import { G2_ACTIONS } from './games2.js';
import { MINI_ACTIONS } from './minigames.js';
import { DIARY_ACTIONS } from './diary.js';
import { HQ_ACTIONS } from './hq.js';
import { EXTRA2_ACTIONS } from './extras.js';

const TABS = ['home', 'routines', 'rewards', 'family', 'hq', 'me'];

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
  /* A finger mid-drag on the word search: draw once it lifts, or the line under it vanishes. */
  if (S.ui?.wsDragging) { deferred = true; return; }
  deferred = false;
  const view = S.mode === 'app' ? viewApp : viewDoor;
  const p = S.me && S.mode === 'app' && isKid() ? P(S.me.id) : null;
  document.documentElement.style.setProperty('--accent', p ? accentOf(S.me.id) : '#EC3D7C');
  document.documentElement.style.setProperty('--accent-soft', p ? (ACCENT_SOFT[p.accent] || '#FFE1EC') : '#FFE1EC');
  /* A parent's HQ wears the Cel-X Group look, dark from edge to edge. */
  const hqOn = S.mode === 'app' && isParent() && S.tab === 'hq';
  document.body.className = hqOn ? 't-hq' : p && p.theme && p.theme !== 'classic' ? 't-' + p.theme : '';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', hqOn ? '#08090C' : '#FFF4EA');
  app.innerHTML = view();
}
document.addEventListener('focusout', () => { if (deferred) setTimeout(() => S.render(), 30); });

/* (Re)loads who is signed in and starts live sync. */
S.reboot = async (opts = {}) => {
  const qs = new URLSearchParams(location.search), setup = qs.get('setup');
  const join = (qs.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const goTab = TABS.includes(qs.get('tab')) ? qs.get('tab') : null, goSub = qs.get('sub');
  const r = await api('/boot' + (setup ? '?setup=' + encodeURIComponent(setup) : ''));
  if (!r.ok && r.error === 'offline') {
    $('#app').innerHTML = `<div class="screen dark"><div class="door"><div class="lockup"><span class="word"><i>★</i>yumi</span></div><p class="t-b">Can't reach Yumi</p><p class="lead">Check the internet, then try again.</p><button class="btn solid" data-act="retry">Try again</button></div></div>`;
    return;
  }
  S.boot = r; S.me = r.me;
  if (!opts.keep) S.ui = {};
  if (setup && r.setupNeeded && r.setupOk) { S.ui.setup = { token: setup, step: 'names' }; S.mode = 'door'; Store.stop(); S.render(true); return; }
  if (setup && !r.setupNeeded) history.replaceState(null, '', '/');
  /* A "join" link from Dad: add this phone for her (on an iPhone, once it's on the Home Screen). */
  if (join.length === 6 && !S.me) {
    document.querySelector('link[rel=manifest]')?.setAttribute('href', '/manifest.webmanifest?join=' + join);
    Store.stop(); S.mode = 'door'; S.ui.join = { code: join }; S.render(true);
    S.joinStart?.();
    return;
  }
  if (join || goTab || goSub) history.replaceState(null, '', '/');
  if (!S.me) { Store.stop(); S.mode = 'door'; S.render(true); return; }
  if (isKid() && !S.me.hasCode) { S.ui.choose = { buf: '', first: '' }; S.mode = 'door'; Store.stop(); S.render(true); return; }
  if (!opts.keep) { S.mode = 'app'; S.tab = goTab || 'home'; S.sub = goTab ? goSub : null; }
  try { await Store.start(); } catch (e) { if (e.message !== 'signed_out') toast("Couldn't load everything. Pull down to try again."); }
  pushSync(); refreshPush();
  if (opts.intro && isKid() && !buddyOf(S.me.id)) { S.mode = 'app'; S.tab = 'me'; S.sub = 'mine'; S.ui.intro = true; }
  S.render(true);
};
Store.onChange = () => S.render();
Store.onSignedOut = () => { if (S.me) { S.me = null; Store.stop(); S.reboot(); } };

const NAV = {
  retry() { S.reboot(); },
  tab(el) { S.tab = el.dataset.tab; S.sub = null; S.ui.confirm = null; Snd.tap(); window.scrollTo({ top: 0 }); S.render(true); },
  toFamily() { S.tab = 'family'; S.sub = null; Snd.tap(); window.scrollTo({ top: 0 }); S.render(true); },
  toMine() { S.tab = 'home'; S.sub = null; Snd.pop(); window.scrollTo({ top: 0 }); S.render(true); },
  goJobs() { S.tab = 'routines'; S.sub = null; Snd.tap(); window.scrollTo({ top: 0 }); S.render(true); },
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
const ACTIONS = { ...DOOR_ACTIONS, ...ROOM_ACTIONS, ...FAMILY_ACTIONS, ...DAD_ACTIONS, ...EXTRA_ACTIONS, ...MORE_ACTIONS, ...GAME_ACTIONS, ...MINI_ACTIONS, ...G2_ACTIONS, ...DIARY_ACTIONS, ...HQ_ACTIONS, ...EXTRA2_ACTIONS, ...NAV };

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

/* Tapping a notification while Yumi is open jumps to the right place. */
swReady();
navigator.serviceWorker?.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'open' || S.mode !== 'app') return;
  if (TABS.includes(d.tab)) { S.tab = d.tab; S.sub = d.sub || null; window.scrollTo({ top: 0 }); S.render(true); }
});

S.reboot();
