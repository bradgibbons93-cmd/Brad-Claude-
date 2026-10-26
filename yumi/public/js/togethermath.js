/* The sums behind "Good & hard days", kept apart from the page so the tests can check them.
   A day is one check-in: kids/<k>/together/<YYYY-MM-DD> = { feel, tags, note, talk }. */

export const FEELS = [
  { id: 'great', v: 2, e: '😄', t: 'Great' },
  { id: 'good', v: 1, e: '🙂', t: 'Good' },
  { id: 'okay', v: 0, e: '😐', t: 'Okay' },
  { id: 'hard', v: -1, e: '😕', t: 'Hard' },
  { id: 'awful', v: -2, e: '😣', t: 'Really hard' },
];
export const NONE = { id: 'none', e: '🙅', t: "Didn't see them" };
export const feelOf = id => FEELS.find(f => f.id === id) || (id === 'none' ? NONE : null);
export const GOOD_TAGS = ['Played together', 'Laughed a lot', 'Got along', 'Felt included', 'Fun outing', 'Felt listened to'];
export const HARD_TAGS = ['Argument', 'Felt left out', 'Something unfair', 'Someone was mean', 'Missed time with Dad', 'Too busy or noisy'];
export const DEFAULT_LABEL = 'Riannon and her kids';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };

/* One row per day, oldest first, ending on `end`. v is null when she didn't check in or didn't see them. */
export function series(byDay, end, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shift(end, -i), doc = byDay[day], f = doc && feelOf(doc.feel);
    out.push({ day, v: f && 'v' in f ? f.v : null, none: doc?.feel === 'none', doc: doc || null });
  }
  return out;
}

/* Seven-day blocks ending on the last day, so the newest block is always a full week up to today. */
export function weeks(rows) {
  const out = [];
  for (let end = rows.length; end > 0; end -= 7) {
    const chunk = rows.slice(Math.max(0, end - 7), end), vals = chunk.filter(r => r.v !== null).map(r => r.v);
    out.unshift({ from: chunk[0].day, to: chunk[chunk.length - 1].day, start: Math.max(0, end - 7), len: chunk.length, n: vals.length,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null });
  }
  return out;
}

const avgOf = rows => { const v = rows.filter(r => r.v !== null).map(r => r.v); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const top = (rows, list) => {
  const n = {};
  for (const r of rows) for (const t of r.doc?.tags || []) if (list.includes(t)) n[t] = (n[t] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
};

/* Counts and the direction of travel over the rows given (normally the last four weeks). */
export function summary(rows) {
  const seen = rows.filter(r => r.v !== null);
  const good = seen.filter(r => r.v > 0).length, hard = seen.filter(r => r.v < 0).length, okay = seen.length - good - hard;
  const half = Math.floor(rows.length / 2), recent = avgOf(rows.slice(half)), before = avgOf(rows.slice(0, half));
  const recentN = rows.slice(half).filter(r => r.v !== null).length, beforeN = rows.slice(0, half).filter(r => r.v !== null).length;
  let trend = null;
  if (recent !== null && before !== null && recentN >= 3 && beforeN >= 3) trend = recent - before >= 0.5 ? 'better' : before - recent >= 0.5 ? 'harder' : 'same';
  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i--) { if (rows[i].v === null) continue; if (rows[i].v < 0) streak++; else break; }
  return { checkins: seen.length, good, okay, hard, none: rows.filter(r => r.none).length, avg: avgOf(rows), trend, hardRun: streak,
    weeksSeen: new Set(rows.map((r, i) => r.v === null ? null : Math.floor((rows.length - 1 - i) / 7)).filter(w => w !== null)).size,
    topGood: top(seen.filter(r => r.v > 0), GOOD_TAGS), topHard: top(seen.filter(r => r.v < 0), HARD_TAGS) };
}

/* What the picture says, in words for her and in words for Dad. One argument never makes it "mostly hard":
   that needs more hard days than good ones, across at least three different weeks. */
export function verdict(s) {
  if (s.checkins < 5) return { key: 'start', kid: 'Keep checking in. After a few weeks this shows the real picture, not just one day.', dad: 'Not enough check-ins yet to see a pattern. A few weeks will show it.' };
  if (s.hard > s.good && s.weeksSeen >= 3) return { key: 'mostlyHard', kid: 'There have been lots of hard days lately. Dad really wants to know, so tell him what would help.', dad: "More hard days than good ones, over several weeks. That's a pattern, not one argument: worth a proper talk with her, and maybe some help from a family counsellor." };
  if (s.good >= Math.max(1, s.hard) * 2) return { key: 'mostlyGood', kid: "Mostly good days, with some hard ones too. That's normal: every family has ups and downs.", dad: 'Mostly good. The hard days are worth talking about, but they are the exception, not the rule.' };
  return { key: 'mixed', kid: 'A mix of good days and hard days. Keep telling Dad how it goes, the good days too.', dad: 'Up and down. Worth asking her what makes the good days good, and doing more of that.' };
}

export const TREND = { better: 'Getting better lately', harder: 'A bit harder lately than before', same: 'About the same as before' };
