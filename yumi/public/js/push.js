/* Lock-screen notifications on this phone.
   iPhones only allow them once Yumi is on the Home Screen (iOS 16.4 or later), so the app says how. */
import { api } from './core.js';
import { S } from './model.js';

export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

let reg = null;
export async function swReady() {
  if (!('serviceWorker' in navigator)) return null;
  try { reg = reg || await navigator.serviceWorker.register('/sw.js'); return reg; } catch (e) { return null; }
}
const keyBytes = b64 => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); };
const sameKey = (sub, key) => { const a = sub?.options?.applicationServerKey; if (!a) return true; const x = new Uint8Array(a); return x.length === key.length && x.every((v, i) => v === key[i]); };
async function currentSub() { const r = await swReady(); return r ? r.pushManager.getSubscription() : null; }

/* on | off | blocked | install (iPhone, not on the Home Screen yet) | unsupported */
export async function pushStatus() {
  if (!supported()) return isIOS && !standalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const s = await currentSub().catch(() => null);
  return s && Notification.permission === 'granted' ? 'on' : 'off';
}
export async function refreshPush() { S.ui.pushState = await pushStatus(); S.render(); return S.ui.pushState; }

/* Must start from a tap: the permission prompt is the first thing it does. */
export async function turnOn() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const r = await swReady(); if (!r || !S.boot?.push) return 'error';
  await navigator.serviceWorker.ready;
  const key = keyBytes(S.boot.push);
  let sub = await r.pushManager.getSubscription();
  if (sub && !sameKey(sub, key)) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const res = await api('/push/subscribe', { sub: sub.toJSON(), hello: true });
  return res.ok ? 'on' : 'error';
}
export async function turnOff() {
  const s = await currentSub();
  if (s) { await api('/push/unsubscribe', { endpoint: s.endpoint }); await s.unsubscribe().catch(() => {}); }
}
/* Each time the app opens: make sure this phone's notifications go to whoever is signed in now. */
export async function pushSync() {
  if (!S.me || !supported() || Notification.permission !== 'granted' || !S.boot?.push) return;
  const s = await currentSub().catch(() => null);
  if (s && sameKey(s, keyBytes(S.boot.push))) api('/push/subscribe', { sub: s.toJSON() });
}
