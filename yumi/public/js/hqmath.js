/* HQ's sums, in one place: the HQ page, the server's widget summary and the tests all read these,
   so the page and the widget on the Home Screen can never disagree about what's next or what went out.
   Plain JavaScript with no imports, so the browser and the server can both load it. */

export const PROJ = {
  money: { label: 'Money & admin', color: '#3DDC97' },
  runnit: { label: 'Runnit', color: '#D9A94E' },
  agency: { label: 'Cel-X × Cyph', color: '#00E5FF' },
  softr: { label: 'SOFTR', color: '#FFB6D5' },
  crew: { label: 'Gibbons Crew', color: '#EC3D7C' },
  encap: { label: 'Encapsulator', color: '#5B9BE0' },
  five8: { label: 'Five Eights', color: '#E2453C' },
  hq: { label: 'HQ & systems', color: '#7A5CFF' },
};
export const projOf = k => PROJ[k] || { label: 'Other', color: '#9AA0AA' };

/* Same order as HQ's "Top of the list": Now, Next, Later, then the rank it was given, then A–Z. */
export const PRI = { now: 0, next: 1, later: 2 };
export const PRI_LABEL = { now: 'Now', next: 'Next', later: 'Later' };
export function sortTasks(list) {
  return list.slice().sort((a, b) => (PRI[a.pri] ?? 1) - (PRI[b.pri] ?? 1) || (a.rank ?? 999) - (b.rank ?? 999) || String(a.title).localeCompare(String(b.title)));
}
export const openTasks = tasks => sortTasks(tasks.filter(t => !t.done));

/* Money categories, as HQ had them. "skip" ones (lent, own transfers, paid back, let go) are left out of totals. */
export const CATS = [
  ['groceries', 'Groceries', '#2F9D67', 'out'], ['eatingout', 'Eating out', '#EC8A2B', 'out'], ['kids', 'Kids', '#C9479C', 'out'],
  ['fuel', 'Fuel & car', '#937650', 'out'], ['shopping', 'Shopping & household', '#8C9E36', 'out'], ['bills', 'Home & bills', '#56789B', 'out'],
  ['phone', 'Phone & internet', '#7466DB', 'out'], ['travel', 'Travel & stays', '#3A88D8', 'out'], ['subs', 'Subscriptions', '#A755CF', 'out'],
  ['business', 'Business', '#169C9C', 'out'], ['personal', 'Personal care', '#E3789A', 'out'], ['pokies', 'Pokies & betting', '#E04A3F', 'out'],
  ['cash', 'Cash out', '#BF9A1C', 'out'], ['other', 'Other', '#8791A5', 'out'],
  ['family', 'From family', '#1B9968', 'in'], ['income', 'Work income', '#0E7F86', 'in'], ['refund', 'Refunds', '#5DA56A', 'in'],
  ['loan', 'Lent / borrowed', '#6C8EA8', 'skip'], ['transfer', 'Own transfers', '#9AA2B4', 'skip'],
  ['settle', 'Paid back', '#5F9C8A', 'skip'], ['writeoff', 'Let go', '#8C94A5', 'skip'], ['check', 'Needs sorting', '#A7AEBD', 'any'],
].map(([id, label, color, kind]) => ({ id, label, color, kind }));
export const catOf = id => CATS.find(c => c.id === id) || CATS.find(c => c.id === 'other');
const round2 = n => Math.round(n * 100) / 100;

/* One month of your own money ("ym" is "2026-10"). A partner's spending and the skip kinds stay out. */
export function monthSummary(txns, ym) {
  let out = 0, inn = 0; const by = {};
  for (const t of txns) {
    if (!String(t.date || '').startsWith(ym) || t.who === 'partner') continue;
    const c = catOf(t.cat), a = Number(t.amount) || 0;
    if (c.kind === 'skip') continue;
    if (a < 0) { out += -a; by[c.id] = (by[c.id] || 0) - a; } else if (a > 0) inn += a;
  }
  const topId = Object.keys(by).sort((a, b) => by[b] - by[a])[0];
  return { out: round2(out), in: round2(inn), net: round2(inn - out), top: topId ? { id: topId, label: catOf(topId).label, amount: round2(by[topId]) } : null };
}

/* Subscriptions: what's still running, roughly per month, and what renews in the next fortnight. */
export const perMonth = s => { const a = Number(s.amount) || 0; return s.cycle === 'week' ? a * 52 / 12 : s.cycle === 'year' ? a / 12 : s.cycle === 'month' ? a : 0; };
export const liveSub = s => ['active', 'expiring'].includes(s.status) && s.decision !== 'cancelled';
export function subsSummary(subs, todayYmd) {
  const running = subs.filter(liveSub), t0 = Date.parse(todayYmd + 'T00:00:00Z');
  const soon = running.filter(s => s.renews && s.cycle !== 'usage').map(s => ({ ...s, inDays: Math.round((Date.parse(String(s.renews).slice(0, 10) + 'T00:00:00Z') - t0) / 864e5) }))
    .filter(s => s.inDays >= 0 && s.inDays <= 14).sort((a, b) => a.inDays - b.inDays);
  return {
    running: running.length, monthly: round2(running.reduce((a, s) => a + perMonth(s), 0)),
    failing: subs.filter(s => s.status === 'payment_failing' && s.decision !== 'cancelled').length,
    soon: soon.map(s => ({ id: s.id, name: s.name, amount: s.amount ?? null, renews: String(s.renews).slice(0, 10), inDays: s.inDays })),
  };
}

export const money = n => (n < 0 ? '−$' : '$') + Math.abs(Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: Math.abs(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
