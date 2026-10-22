/* Shared plumbing: talking to the server, the local copy of the family's data, live sync,
   dates, sounds, confetti, toasts and bottom sheets. */

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7));
export const today = () => ymd(new Date());
export const nowIso = () => new Date().toISOString();
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmtShort = s => { const d = parseYmd(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
export const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + pad(m) : ''}${h >= 12 ? 'pm' : 'am'}`; };
export const ago = iso => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (!isFinite(s)) return '';
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  const d = Math.floor(s / 86400); return d === 1 ? 'yesterday' : d < 7 ? d + ' days ago' : fmtShort(ymd(new Date(iso)));
};
export const byAtDesc = (a, b) => String(b.at || '').localeCompare(String(a.at || ''));
export const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- server ---------- */
export async function api(path, body, method) {
  const opts = { method: method || (body ? 'POST' : 'GET'), headers: {}, credentials: 'same-origin' };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let r;
  try { r = await fetch('/api' + path, opts); } catch (e) { return { ok: false, error: 'offline', status: 0 }; }
  let j = {};
  try { j = await r.json(); } catch (e) {}
  if (r.status === 401 && j.error === 'signed_out') Store.onSignedOut?.();
  return { status: r.status, ...j, ok: r.ok && j.ok !== false };
}

/* ---------- local copy + live sync ---------- */
export const Store = {
  docs: new Map(), seq: 0, live: false, ctl: null, onChange: null, onSignedOut: null, offline: false, ready: false,
  get(path) { return this.docs.get(path) || null; },
  col(parent) {
    const out = [], pre = parent + '/';
    for (const [p, d] of this.docs) if (p.startsWith(pre) && !p.slice(pre.length).includes('/')) out.push({ id: p.slice(pre.length), ...d });
    return out;
  },
  /* While a tap is still on its way to the server, a sync can't undo what the screen shows. */
  holds: new Map(),
  hold(path) { const h = this.holds.get(path) || { n: 0, latest: undefined }; h.n++; this.holds.set(path, h); },
  release(path) {
    const h = this.holds.get(path); if (!h) return;
    if (--h.n > 0) return;
    this.holds.delete(path);
    if (h.latest !== undefined) { if (h.latest === null) this.docs.delete(path); else this.docs.set(path, h.latest); this.onChange?.(); }
  },
  apply(docs) {
    for (const d of docs) {
      const h = this.holds.get(d.path);
      if (h) { h.latest = d.deleted ? null : d.data; continue; }
      if (d.deleted) this.docs.delete(d.path); else this.docs.set(d.path, d.data);
    }
  },
  async start() {
    this.stop(); this.docs.clear(); this.seq = 0; this.live = true; this.ready = false;
    for (let i = 0; ; i++) {
      try { await this.pull(0); break; }
      catch (e) { if (e.name !== 'AbortError' && i >= 2) throw e; if (e.message === 'signed_out') throw e; await sleep(400); }
    }
    this.ready = true; this.onChange?.();
    this.loop();
  },
  stop() { this.live = false; try { this.ctl?.abort(); } catch (e) {} this.ctl = null; },
  async pull(wait) {
    let more = true;
    while (more) {
      this.ctl = new AbortController();
      const r = await fetch(`/api/sync?since=${this.seq}&wait=${wait}`, { signal: this.ctl.signal, credentials: 'same-origin' });
      if (r.status === 401) { this.onSignedOut?.(); throw new Error('signed_out'); }
      if (!r.ok) throw new Error('sync ' + r.status);
      const j = await r.json();
      this.apply(j.docs || []); this.seq = Math.max(this.seq, j.seq || 0); more = !!j.more; wait = 0;
      if (j.docs?.length) this.onChange?.();
      this.setOffline(false);
    }
  },
  async loop() {
    let backoff = 1000;
    while (this.live) {
      try { await this.pull(document.hidden ? 0 : 25); backoff = 1000; if (document.hidden) await new Promise(r => { this.wake = r; setTimeout(r, 20000); }); }
      catch (e) {
        if (!this.live || e.message === 'signed_out') return;
        if (e.name !== 'AbortError') { this.setOffline(true); await sleep(backoff); backoff = Math.min(backoff * 2, 30000); }
      }
    }
  },
  kick() { try { this.ctl?.abort(); } catch (e) {} this.wake?.(); },
  setOffline(v) { if (this.offline === v) return; this.offline = v; const el = $('#offline'); if (v && !el) { const d = document.createElement('div'); d.id = 'offline'; d.className = 'offline'; d.textContent = 'Reconnecting…'; document.body.appendChild(d); } else if (!v && el) el.remove(); },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
document.addEventListener('visibilitychange', () => { if (!document.hidden) Store.kick(); });

/* Writes show straight away on this phone, then go to the server. If the server says no,
   the next sync puts things back. */
export async function write(ops) {
  for (const op of ops) {
    if (op.del) Store.docs.delete(op.path);
    else if (op.merge) Store.docs.set(op.path, { ...(Store.get(op.path) || {}), ...op.merge });
    else Store.docs.set(op.path, op.set);
  }
  Store.onChange?.();
  const r = await api('/write', { ops });
  if (!r.ok) {
    const why = (r.results || []).find(x => !x.ok)?.error || r.error;
    toast(why === 'offline' ? "Couldn't save. Check the internet and try again." : "That didn't save. Try again.");
    Snd.err(); Store.kick();
  }
  return r;
}
export const setDoc = (path, data) => write([{ path, set: { ...data, at: data.at || nowIso() } }]);
export const mergeDoc = (path, data) => write([{ path, merge: data }]);
export const delDoc = path => write([{ path, del: true }]);
/* Runs server actions for one key one at a time, in the order they were tapped. */
const queues = new Map();
export function queued(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const p = prev.then(fn, fn);
  queues.set(key, p.catch(() => {}));
  return p;
}
export async function act(name, body) {
  const r = await api('/act/' + name, body);
  if (!r.ok && r.error !== 'offline') { /* handled by callers */ }
  Store.kick();
  return r;
}

/* ---------- sound (made in the browser, no files) ---------- */
export const Snd = {
  ctx: null, on: true,
  init() { if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; } try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
  t(f, d = .12, type = 'sine', v = .16, delay = 0, f2 = null) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + d + .03);
  },
  tap() { this.t(640, .07, 'triangle', .11); },
  pop() { this.t(380, .1, 'sine', .2, 0, 900); },
  check() { this.t(880, .07, 'triangle', .12); this.t(1320, .1, 'triangle', .12, .06); },
  uncheck() { this.t(520, .08, 'triangle', .08, 0, 380); },
  star() { [1047, 1319, 1568, 2093].forEach((f, i) => this.t(f, .2, 'triangle', .13, i * .07)); },
  strike() { this.t(190, .24, 'square', .06, 0, 95); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.t(f, .15, 'square', .05, i * .09)); this.t(1568, .5, 'triangle', .12, .56); },
  magic() { [784, 988, 1175, 1568, 1976].forEach((f, i) => this.t(f, .24, 'sine', .1, i * .05)); },
  tick() { this.t(1300, .03, 'square', .04); },
  err() { this.t(230, .12, 'sawtooth', .05); this.t(170, .16, 'sawtooth', .05, .1); },
  boop() { this.t(520, .09, 'sine', .16, 0, 700); this.t(780, .12, 'sine', .12, .09, 1040); },
};
try { Snd.on = localStorage.getItem('yumi-sound') !== 'off'; } catch (e) {}
addEventListener('pointerdown', () => Snd.init(), { passive: true });

/* ---------- confetti ---------- */
export const Confetti = {
  cv: null, cx: null, parts: [], raf: 0,
  burst(x, y, n = 90) {
    if (reduceMotion) return;
    if (!this.cv) { this.cv = $('#confetti'); this.cx = this.cv.getContext('2d'); }
    const dpr = devicePixelRatio || 1; this.cv.width = innerWidth * dpr; this.cv.height = innerHeight * dpr; this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#EC3D7C';
    const cols = [accent, '#FFB81F', '#5B8CFF', '#1E9E64', '#8B5BE6', '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 8;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4, w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, c: cols[i % cols.length], life: 90 + Math.random() * 40, star: Math.random() < .25 });
    }
    if (!this.raf) this.loop();
  },
  loop() {
    const cx = this.cx; cx.clearRect(0, 0, innerWidth, innerHeight);
    this.parts = this.parts.filter(p => p.life-- > 0);
    for (const p of this.parts) {
      p.vy += .28; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = Math.min(1, p.life / 30); cx.fillStyle = p.c;
      if (p.star) { cx.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.5708; cx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); cx.lineTo(Math.cos(a + .628) * 2.6, Math.sin(a + .628) * 2.6); } cx.fill(); }
      else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cx.restore();
    }
    this.raf = this.parts.length ? requestAnimationFrame(() => this.loop()) : 0;
    if (!this.raf) cx.clearRect(0, 0, innerWidth, innerHeight);
  },
  from(el, n) { const r = el?.getBoundingClientRect?.(); this.burst(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 2, n); },
};

/* ---------- toast + sheet ---------- */
export function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
export function openSheet(html, after) {
  $('#sheetBody').innerHTML = html; $('#sheetWrap').hidden = false;
  after && after($('#sheetBody'));
  const f = $('#sheetBody').querySelector('[autofocus]');
  if (f && !matchMedia('(pointer:coarse)').matches) setTimeout(() => f.focus(), 120);
}
export function closeSheet() { $('#sheetWrap').hidden = true; $('#sheetBody').innerHTML = ''; }
export const sheetOpen = () => !$('#sheetWrap').hidden;
export const pickRow = (name, list, sel) => `<div class="emoji-pick" data-pick="${name}">${list.map(e => `<button type="button" class="${e === sel ? 'on' : ''}" data-act="pick" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div>`;
export const picked = name => document.querySelector(`#sheetBody [data-pick="${name}"] button.on`)?.dataset.v || '';
