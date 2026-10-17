import { getDoc, listDocs, putDoc, delDoc } from "./db";
import { people, type Me } from "./auth";
import { notify, type PushMsg } from "./push";

/* The star rules, all worked out on the server so every phone agrees.
   - Stars and strikes never reset by the week.
   - Every 3rd strike takes a star (strikes 3, 6, 9...).
   - From strike 10 the girl sees that her principal will be told, and Dad gets an alert.
     The app itself never contacts the school.
   - When the jar reaches 100 stars it's payday: $100 from Dad. The jar and the strikes start
     again from zero (anything over 100 carries over). 100 is the most a jar can hold. */

export const PAYDAY_STARS = 100;
export const PAYDAY_DOLLARS = 100;
export const STRIKES_PER_STAR = 3;
export const PRINCIPAL_AT = 10;

export const DEFAULT_REWARDS = [
  { id: "dadnight", e: "🌙", t: "A night with just Dad", d: "Your pick of what we do, just us two.", cost: 15 },
  { id: "movie", e: "🎬", t: "Pick tonight's movie", d: "You choose, everyone watches.", cost: 5 },
  { id: "outing", e: "🚗", t: "Pick the weekend outing", d: "Choose where the crew goes.", cost: 10 },
  { id: "dinner", e: "🌮", t: "Choose dinner", d: "Tacos? Pancakes for tea? Your call.", cost: 6 },
  { id: "late", e: "⏰", t: "Stay up 20 minutes later", d: "One night, an extra 20 minutes.", cost: 8 },
  { id: "breakfast", e: "🥞", t: "Breakfast in bed", d: "Dad brings it to you.", cost: 12 },
  { id: "sleepover", e: "🏕️", t: "Friend sleepover", d: "Invite a friend over. Dad sorts it.", cost: 25 },
];

/* The treats on the star trail. They're rewards like the others: tap, spend, Dad gets told. */
export const TRAIL_REWARDS = [
  { id: "icecream", e: "🍦", t: "Ice cream trip", d: "Dad takes you out for an ice cream.", cost: 10 },
  { id: "cinema", e: "🎬", t: "Movies at the cinema", d: "A trip to the cinema, popcorn included.", cost: 25 },
  { id: "present", e: "🎁", t: "A surprise present", d: "Dad picks a surprise just for you.", cost: 50 },
  { id: "adventure", e: "🏕️", t: "Big adventure day", d: "A whole day out. You pick the adventure.", cost: 75 },
];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const iso = () => new Date().toISOString();
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

export async function familyTz(): Promise<string> {
  const f = await getDoc("settings/family");
  const tz = f?.tz;
  try { if (tz) { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); return tz; } } catch {}
  return "UTC";
}
export function ymdIn(tz: string, d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const shift = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* A phone may tick yesterday, today or tomorrow (time zones), nothing else. */
export function dateOk(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const now = new Date().toISOString().slice(0, 10);
  return date >= shift(now, -1) && date <= shift(now, 1);
}

async function kidIds() { return (await people()).filter(p => p.role === "kid").map(p => p.id); }
async function parentIds() { return (await people()).filter(p => p.role === "parent").map(p => p.id); }
async function nameOf(id: string) {
  const p = await getDoc("people/" + id);
  return p?.nick || (await people()).find(x => x.id === id)?.name || id;
}

/* Lock-screen notifications go out in the background, so a slow push service never slows a tap. */
const ping = (who: string[], msg: PushMsg) => { void notify(who, msg); };
const pingParents = async (msg: PushMsg) => ping(await parentIds(), msg);

/* Something for Dad's "Waiting for you" list, also sent to his lock screen. */
async function addInbox(data: { kind: string; kid: string; title: string; sub: string; ref?: string }, emoji = "🔔") {
  await putDoc(`inbox/${uid()}`, { ...data, at: iso(), seen: false }, "server");
  await pingParents({ title: `${emoji} ${data.title}`, body: data.sub, tag: `inbox-${data.kind}-${data.kid}`, url: "/?tab=home" });
}

/* ---------- the jar ---------- */
export async function kidSummary(k: string, tz?: string) {
  tz = tz || (await familyTz());
  const [log, redeemed, paydays, routine] = await Promise.all([
    listDocs(`kids/${k}/log`), listDocs(`kids/${k}/redeemed`), listDocs(`kids/${k}/payday`), listDocs(`kids/${k}/routine`),
  ]);
  const cycleStart = paydays.map(p => String(p.data.at || "")).sort().pop() || "";
  const inCycle = (at: any) => String(at || "") > cycleStart;
  const cyc = log.filter(l => inCycle(l.data.at));
  const earned = cyc.filter(l => l.data.type === "star" || l.data.type === "carry").reduce((a, l) => a + (Number(l.data.n) || 1), 0);
  const strikes = cyc.filter(l => l.data.type === "strike").length;
  const penalty = Math.floor(strikes / STRIKES_PER_STAR);
  const spent = redeemed.filter(r => r.data.status !== "declined" && inCycle(r.data.at)).reduce((a, r) => a + (Number(r.data.cost) || 0), 0);
  const raw = earned - penalty - spent;
  const today = ymdIn(tz);
  const days = await listDocs(`kids/${k}/days`);
  const starredSet = new Set(days.filter(d => d.data.starred).map(d => d.id));
  let streak = 0, d = today;
  if (!starredSet.has(d)) d = shift(d, -1);
  while (starredSet.has(d)) { streak++; d = shift(d, -1); }
  const ids = new Set(routine.map(r => r.id));
  const todayDoc = days.find(x => x.id === today)?.data;
  const routineDone = (todayDoc?.done || []).filter((x: string) => ids.has(x)).length;
  return {
    stars: Math.max(0, Math.min(PAYDAY_STARS, raw)), raw, earned, spent, penalty, strikes, streak,
    routineDone, routineTotal: ids.size, cycleStart, paydays: paydays.length,
    allTimeStars: log.filter(l => l.data.type === "star").reduce((a, l) => a + (Number(l.data.n) || 1), 0),
  };
}

const locks = new Map<string, Promise<any>>();
function locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  const p = prev.then(fn, fn);
  locks.set(key, p.catch(() => {}));
  return p;
}

/* Recomputes a girl's public numbers, and runs payday when the jar reaches 100. */
export async function refreshKid(k: string) {
  const tz = await familyTz();
  let s = await kidSummary(k, tz);
  if (s.raw >= PAYDAY_STARS) {
    const at = iso(), id = uid();
    await putDoc(`kids/${k}/payday/${id}`, { at, amount: PAYDAY_DOLLARS, stars: PAYDAY_STARS, strikes: s.strikes, status: "pending" }, "server");
    const carry = s.raw - PAYDAY_STARS;
    if (carry > 0) {
      const later = new Date(Date.parse(at) + 5).toISOString();
      await putDoc(`kids/${k}/log/${uid()}`, { type: "carry", n: carry, reason: "Carried over from my 100", at: later }, "server");
    }
    await addInbox({ kind: "payday", kid: k, ref: `kids/${k}/payday/${id}`, title: `${await nameOf(k)} filled her jar! 100 stars`, sub: `Pay her $${PAYDAY_DOLLARS}, then tap Paid` }, "💵");
    ping([k], { title: "💵 PAYDAY! You filled your jar!", body: `${PAYDAY_STARS} stars = $${PAYDAY_DOLLARS} from Dad. So proud of you! 🎉`, tag: "payday", url: "/?tab=rewards" });
    s = await kidSummary(k, tz);
  }
  const pub = await getDoc(`pub/${k}`);
  const next = { stars: s.stars, strikes: s.strikes, streak: s.streak, routineDone: s.routineDone, routineTotal: s.routineTotal, paydays: s.paydays, cycleStart: s.cycleStart };
  if (JSON.stringify(pub) !== JSON.stringify(next)) await putDoc(`pub/${k}`, next, "server");
  return s;
}

/* The family goal fills with every star the girls earn after it starts. */
export async function refreshFamily() {
  const goal = await getDoc("settings/goal");
  let progress = 0;
  if (goal?.target) {
    const start = String(goal.start || "");
    for (const k of await kidIds()) {
      for (const l of await listDocs(`kids/${k}/log`)) if (l.data.type === "star" && String(l.data.at || "") >= start) progress += Number(l.data.n) || 1;
    }
  }
  const next = { goal: goal ? { title: goal.title || "Family goal", target: Number(goal.target) || 100, progress, emoji: goal.emoji || "🎯" } : null };
  const pub = await getDoc("pub/family");
  if (JSON.stringify(pub) !== JSON.stringify(next)) await putDoc("pub/family", next, "server");
}

/* A parent's own routine streak is the only thing about it the girls see. */
export async function refreshParent(id: string) {
  const tz = await familyTz();
  const days = await listDocs("dad/days");
  const routine = await listDocs("dad/routine");
  const ids = routine.map(r => r.id);
  const full = new Set(days.filter(d => ids.length && ids.every(i => (d.data.done || []).includes(i))).map(d => d.id));
  let streak = 0, d = ymdIn(tz);
  if (!full.has(d)) d = shift(d, -1);
  while (full.has(d)) { streak++; d = shift(d, -1); }
  const next = { streak };
  const pub = await getDoc(`pub/${id}`);
  if (JSON.stringify(pub) !== JSON.stringify(next)) await putDoc(`pub/${id}`, next, "server");
}

export async function refreshAll() {
  for (const p of await people()) {
    if (p.role === "kid") await locked("kid:" + p.id, () => refreshKid(p.id));
    else await refreshParent(p.id);
  }
  await refreshFamily();
}

/* ---------- actions ---------- */
type R = { ok: true; [k: string]: any } | { ok: false; error: string };
const fail = (error: string): R => ({ ok: false, error });

async function mustBeKid(k: any) { return typeof k === "string" && (await kidIds()).includes(k); }

export const ACTIONS: Record<string, (me: Me, b: any) => Promise<R>> = {
  async giveStar(me, b) {
    if (me.role !== "parent") return fail("parent_only");
    if (!(await mustBeKid(b.kid))) return fail("bad_kid");
    const n = Math.max(1, Math.min(5, Math.round(Number(b.n) || 1)));
    return locked("kid:" + b.kid, async () => {
      const reason = String(b.reason || "Star from Dad").slice(0, 60);
      await putDoc(`kids/${b.kid}/log/${uid()}`, { type: "star", n, reason, at: iso(), by: me.id }, me.id);
      const s = await refreshKid(b.kid); await refreshFamily();
      ping([b.kid], { title: `⭐ ${await nameOf(me.id)} gave you ${n === 1 ? "a star" : n + " stars"}!`, body: `${reason} · ${s.stars} in your jar`, tag: "star", url: "/?tab=rewards" });
      return { ok: true, stars: s.stars };
    });
  },

  async giveStrike(me, b) {
    if (me.role !== "parent") return fail("parent_only");
    if (!(await mustBeKid(b.kid))) return fail("bad_kid");
    return locked("kid:" + b.kid, async () => {
      const before = await kidSummary(b.kid);
      const count = before.strikes + 1;
      const takesStar = count % STRIKES_PER_STAR === 0, principal = count >= PRINCIPAL_AT;
      await putDoc(`kids/${b.kid}/log/${uid()}`, { type: "strike", reason: String(b.reason || "Strike").slice(0, 60), at: iso(), by: me.id, count, takesStar, principal }, me.id);
      const name = await nameOf(b.kid);
      if (principal) await addInbox({ kind: "principal", kid: b.kid, title: `${name} is on ${count} strikes`, sub: "She's been told her principal will hear about it. The app doesn't contact the school, that's your call." }, "⚠️");
      else if (takesStar) await addInbox({ kind: "strike", kid: b.kid, title: `${name}'s ${ordinal(count)} strike`, sub: "1 ★ taken automatically" }, "✖️");
      const s = await refreshKid(b.kid);
      const reason = String(b.reason || "Strike").slice(0, 60);
      ping([b.kid], {
        title: `✖️ Strike: ${reason}`,
        body: principal ? `That's ${count} strikes. Dad will let your principal know.` : takesStar ? `That's your ${ordinal(count)} strike, so 1 ★ came out of your jar.` : `${count} ${count === 1 ? "strike" : "strikes"}. Every 3rd one takes a star.`,
        tag: "strike", url: "/?tab=rewards",
      });
      return { ok: true, strikes: s.strikes, takesStar, principal };
    });
  },

  async undoLog(me, b) {
    if (me.role !== "parent") return fail("parent_only");
    if (!(await mustBeKid(b.kid)) || typeof b.id !== "string") return fail("bad_input");
    return locked("kid:" + b.kid, async () => {
      const path = `kids/${b.kid}/log/${b.id}`;
      const l = await getDoc(path);
      if (!l) return fail("gone");
      await delDoc(path, me.id);
      if (l.auto === "routine" && l.day) {
        const dp = `kids/${b.kid}/days/${l.day}`, day = await getDoc(dp);
        if (day?.starLog === b.id) await putDoc(dp, { ...day, starred: false, starLog: null, undone: true }, me.id);
      }
      await refreshKid(b.kid); await refreshFamily();
      return { ok: true };
    });
  },

  async routineTick(me, b) {
    const k = b.kid;
    if (!(await mustBeKid(k))) return fail("bad_kid");
    if (me.id !== k && me.role !== "parent") return fail("not_yours");
    if (!dateOk(b.date)) return fail("bad_date");
    return locked("kid:" + k, async () => {
      const routine = await listDocs(`kids/${k}/routine`);
      const ids = routine.map(r => r.id);
      if (!ids.includes(b.step)) return fail("no_step");
      const dp = `kids/${k}/days/${b.date}`;
      const day = (await getDoc(dp)) || { date: b.date, done: [] };
      const done = new Set<string>(day.done || []);
      const want = typeof b.done === "boolean" ? b.done : !done.has(b.step);
      want ? done.add(b.step) : done.delete(b.step);
      const full = ids.every(i => done.has(i));
      const next: any = { ...day, date: b.date, done: [...done] };
      let gained = 0;
      if (full && !day.starred && !day.undone) {
        const lid = uid();
        await putDoc(`kids/${k}/log/${lid}`, { type: "star", n: 1, reason: "Did my whole routine", auto: "routine", day: b.date, at: iso() }, me.id);
        next.starred = true; next.starLog = lid; gained = 1;
      } else if (!full && day.starred) {
        if (day.starLog) await delDoc(`kids/${k}/log/${day.starLog}`, me.id);
        next.starred = false; next.starLog = null; gained = -1;
      }
      await putDoc(dp, next, me.id);
      const s = await refreshKid(k);
      if (gained) await refreshFamily();
      if (gained === 1 && me.id === k) await pingParents({ title: `⭐ ${await nameOf(k)} did her whole routine!`, body: `+1 star · ${s.stars} in her jar`, tag: `routine-${k}`, url: "/?tab=home" });
      return { ok: true, done: next.done, full, gained, stars: s.stars };
    });
  },

  async dadRoutineTick(me, b) {
    if (me.role !== "parent") return fail("parent_only");
    if (!dateOk(b.date)) return fail("bad_date");
    const ids = (await listDocs("dad/routine")).map(r => r.id);
    if (!ids.includes(b.step)) return fail("no_step");
    const dp = `dad/days/${b.date}`, day = (await getDoc(dp)) || { date: b.date, done: [] };
    const done = new Set<string>(day.done || []);
    const want = typeof b.done === "boolean" ? b.done : !done.has(b.step);
    want ? done.add(b.step) : done.delete(b.step);
    await putDoc(dp, { ...day, date: b.date, done: [...done] }, me.id);
    await refreshParent(me.id);
    return { ok: true, done: [...done] };
  },

  async taskTick(me, b) {
    if (typeof b.task !== "string" || !dateOk(b.date)) return fail("bad_input");
    const tk = await getDoc("tasks/" + b.task);
    if (!tk) return fail("gone");
    if (tk.who && tk.who !== "all" && tk.who !== me.id) return fail("not_your_job");
    const key = tk.daily ? b.date : "once";
    const path = `taskDone/${b.task}@${key}@${me.id}`;
    const run = async (): Promise<R> => {
      const was = await getDoc(path);
      const log = me.role === "kid" ? (await listDocs(`kids/${me.id}/log`)).find(l => l.data.task === b.task && l.data.key === key) : null;
      if (was) {
        await delDoc(path, me.id);
        if (log) { await delDoc(log.path, me.id); await refreshKid(me.id); await refreshFamily(); }
        return { ok: true, done: false };
      }
      await putDoc(path, { task: b.task, key, who: me.id, date: key, at: iso() }, me.id);
      let stars = 0;
      if (me.role === "kid" && Number(tk.stars) > 0 && !log) {
        stars = Math.min(5, Number(tk.stars));
        await putDoc(`kids/${me.id}/log/${uid()}`, { type: "star", n: stars, reason: `Job: ${String(tk.t || "").slice(0, 50)}`, task: b.task, key, at: iso() }, me.id);
        await refreshKid(me.id); await refreshFamily();
      }
      return { ok: true, done: true, stars };
    };
    return me.role === "kid" ? locked("kid:" + me.id, run) : run();
  },

  async redeem(me, b) {
    if (me.role !== "kid") return fail("kids_only");
    const list = [...((await getDoc("settings/rewards"))?.items || DEFAULT_REWARDS), ...TRAIL_REWARDS];
    const r = list.find((x: any) => x.id === b.reward);
    if (!r) return fail("no_reward");
    return locked("kid:" + me.id, async () => {
      const s = await kidSummary(me.id);
      if (s.raw < r.cost) return fail("not_enough");
      const id = uid();
      await putDoc(`kids/${me.id}/redeemed/${id}`, { reward: r.id, title: r.t, emoji: r.e, cost: r.cost, status: "pending", at: iso() }, me.id);
      const s2 = await refreshKid(me.id);
      await pingParents({ title: `🎁 ${await nameOf(me.id)} picked a reward`, body: `${r.e || ""} ${r.t} · ${r.cost} ★`.trim(), tag: `reward-${me.id}`, url: "/?tab=home" });
      return { ok: true, id, stars: s2.stars };
    });
  },

  async redeemSet(me, b) {
    if (me.role !== "parent") return fail("parent_only");
    if (!(await mustBeKid(b.kid)) || typeof b.id !== "string" || !["done", "declined"].includes(b.status)) return fail("bad_input");
    return locked("kid:" + b.kid, async () => {
      const path = `kids/${b.kid}/redeemed/${b.id}`, r = await getDoc(path);
      if (!r) return fail("gone");
      await putDoc(path, { ...r, status: b.status, doneAt: iso() }, me.id);
      await refreshKid(b.kid);
      if (r.status === "pending") ping([b.kid], b.status === "done"
        ? { title: `🎁 Yes! ${r.title || "Your reward"}`, body: `${await nameOf(me.id)} said yes. Enjoy it!`, tag: "reward", url: "/?tab=rewards" }
        : { title: `Not this time: ${r.title || "your reward"}`, body: "Your stars went back in your jar.", tag: "reward", url: "/?tab=rewards" });
      return { ok: true };
    });
  },

  async paydayPaid(me, b) {
    if (me.role !== "parent") return fail("parent_only");
    if (!(await mustBeKid(b.kid)) || typeof b.id !== "string") return fail("bad_input");
    const path = `kids/${b.kid}/payday/${b.id}`, p = await getDoc(path);
    if (!p) return fail("gone");
    if (p.status === "paid") return { ok: true };
    const at = iso();
    await putDoc(path, { ...p, status: "paid", paidAt: at }, me.id);
    await putDoc(`dad/money/${uid()}`, { kind: "out", amt: Number(p.amount) || PAYDAY_DOLLARS, cat: "Kids", what: `${await nameOf(b.kid)}'s 100-star payday`, date: at.slice(0, 10), at, by: me.id, mine: Number(p.amount) || PAYDAY_DOLLARS, share: 0, person: null }, me.id);
    for (const i of await listDocs("inbox")) if (i.data.ref === path && !i.data.seen) await putDoc(i.path, { ...i.data, seen: true }, me.id);
    return { ok: true };
  },

  async heart(me, b) {
    if (typeof b.post !== "string") return fail("bad_input");
    const path = "feed/" + b.post, f = await getDoc(path);
    if (!f) return fail("gone");
    const hearts = { ...(f.hearts || {}) };
    hearts[me.id] = !hearts[me.id];
    if (!hearts[me.id]) delete hearts[me.id];
    await putDoc(path, { ...f, hearts }, me.id);
    return { ok: true, on: !!hearts[me.id] };
  },
};

/* Small follow-ups after ordinary writes: alerts for Dad. */
export async function afterWrite(me: Me, path: string, old: any, next: any) {
  const p = path.split("/");
  if (p[0] === "feed" && !old && next?.hug) {
    await addInbox({ kind: "hug", kid: me.id, title: `${await nameOf(me.id)} would love a hug`, sub: next.text ? `"${String(next.text).slice(0, 80)}"` : "From her check-in" }, "🤗");
  } else if (p[0] === "feed" && !old && next) await feedPing(me, next);
  if (p[0] === "kids" && p[2] === "journal" && next?.shared && !old?.shared) {
    await addInbox({ kind: "journal", kid: p[1], ref: path, title: `${await nameOf(p[1])} shared a journal page`, sub: next.title ? `"${String(next.title).slice(0, 60)}"` : "Tap to read it" }, "📓");
  }
  if (p[0] === "kids" && p[2] === "routine") await locked("kid:" + p[1], () => refreshKid(p[1]));
  if (p[0] === "settings" && p[1] === "goal") await refreshFamily();
  if (p[0] === "dad" && p[1] === "routine") await refreshParent(me.id);
}

/* New posts on the family wall: a girl's check-in goes to Dad; notes and messages go to whoever they're for. */
async function feedPing(me: Me, f: any) {
  const name = await nameOf(me.id);
  if (f.mood) {
    if (me.role === "kid") await pingParents({ title: `${name} checked in: ${MOOD_WORDS[f.mood] || f.mood}`, body: f.text ? String(f.text).slice(0, 120) : "", tag: `mood-${me.id}`, url: "/?tab=home" });
    return;
  }
  if (!f.text) return;
  const all = (await people()).map(p => p.id).filter(id => id !== me.id);
  const to = typeof f.to === "string" && all.includes(f.to) ? [f.to] : all;
  ping(to, { title: `💌 ${f.to ? `${name} sent you a note` : `New note from ${name}`}`, body: String(f.text).slice(0, 140), tag: "note", url: "/?tab=family&sub=notes" });
}
const MOOD_WORDS: Record<string, string> = { happy: "😄 Happy", excited: "🤩 Excited", calm: "😌 Calm", silly: "🤪 Silly", tired: "😴 Tired", worried: "😟 Worried", sad: "😢 Sad", grumpy: "😤 Grumpy" };

/* ---------- routine reminders ---------- */
/* Once a minute: at each slot's time, a gentle nudge to a girl who still has steps left in that slot.
   Times can be changed in settings/family.reminders; a girl can turn them off (people/<id>.remind = false). */
export const REMIND_AT: Record<string, string> = { morning: "07:15", after: "16:00", bed: "19:30" };
const SLOT_WORDS: Record<string, [string, string]> = { morning: ["☀️", "Morning routine"], after: ["🎒", "After-school routine"], bed: ["🌙", "Bedtime routine"] };
const reminded = new Set<string>();
export async function remindTick(now = new Date()) {
  const fam = await getDoc("settings/family");
  if (fam?.reminders === false) return 0;
  const times = { ...REMIND_AT, ...(fam?.reminders && typeof fam.reminders === "object" ? fam.reminders : {}) };
  const tz = await familyTz();
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const slot = Object.keys(SLOT_WORDS).find(s => times[s] === hm);
  if (!slot) return 0;
  const date = ymdIn(tz, now);
  let n = 0;
  for (const k of await kidIds()) {
    const key = `${k}:${date}:${slot}`;
    if (reminded.has(key)) continue;
    reminded.add(key);
    if ((await getDoc("people/" + k))?.remind === false) continue;
    const routine = await listDocs(`kids/${k}/routine`);
    const done = new Set<string>((await getDoc(`kids/${k}/days/${date}`))?.done || []);
    const slotLeft = routine.filter(r => r.data.slot === slot && !done.has(r.id)).length;
    if (!slotLeft) continue;
    const dayLeft = routine.filter(r => !done.has(r.id)).length;
    const [e, t] = SLOT_WORDS[slot];
    ping([k], { title: `${e} ${t}`, body: `${slotLeft} ${slotLeft === 1 ? "step" : "steps"} to tick${dayLeft === slotLeft ? " and today's star is yours ⭐" : ". Every one gets you closer to today's star ⭐"}`, tag: "remind", url: "/?tab=home" });
    n++;
  }
  if (reminded.size > 500) reminded.clear();
  return n;
}
