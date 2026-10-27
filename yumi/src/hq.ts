/* HQ inside Yumi: a parent's own to-dos, brain dump, money and subscriptions, kept at
   hq/<person>/<collection>/<id>. Only that person's phones receive it (rules.ts).

   Two ways in that don't use the app's cookie:
   - The iPhone widget. Scriptable has no session, so it carries a key: 32 random bytes, shown once
     inside the script, and only its SHA-256 is kept. A new key, or Turn off, stops every older copy.
   - The one-time move from the HQ page in Claude, by code: the parent makes a code (30 minutes,
     single use) and Claude sends the HQ data with it. The app itself uses importMine instead: the HQ
     page copies everything and the signed-in parent pastes it in. Either way it only fills empty spots. */
import { sql, FAM, getDoc, putDoc, listDocs, insertDocIfMissing, meta, setMeta, bump } from "./db";
import * as auth from "./auth";
import * as push from "./push";
import { familyTz, ymdIn, uid } from "./stars";
import { HQ_COLS, clean } from "./rules";
import { openTasks, monthSummary, subsSummary, projOf } from "../public/js/hqmath.js";
import { hqWidgetScript } from "./hqscript";

const MAX_DOC_BYTES = 12000;
const okId = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_@~.-]{1,80}$/.test(s) && s !== "." && s !== "..";
const delMeta = (k: string) => sql`DELETE FROM y_meta WHERE fam = ${FAM} AND k = ${k}`;

/* ---------- widget key ---------- */
export async function widgetState(person: string) {
  const v = await meta("hqw-of:" + person);
  if (!v) return { on: false };
  try { return { on: true, made: JSON.parse(v).made as string }; } catch { return { on: false }; }
}

export async function newWidgetKey(person: string, origin: string, name: string) {
  await widgetOff(person);
  const key = auth.token(32), hash = auth.sha(key), made = new Date().toISOString();
  await setMeta("hqw:" + hash, person);
  await setMeta("hqw-of:" + person, JSON.stringify({ hash, made }));
  return { key, made, script: hqWidgetScript({ origin, key, name, made }) };
}

export async function widgetOff(person: string) {
  const v = await meta("hqw-of:" + person);
  if (v) { try { await delMeta("hqw:" + JSON.parse(v).hash); } catch {} }
  await delMeta("hqw-of:" + person);
}

/* The person a widget key belongs to, if it's still the current one and they're still a parent. */
export async function personForKey(key: string) {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(key)) return null;
  const id = await meta("hqw:" + auth.sha(key));
  if (!id) return null;
  const p = await auth.person(id);
  return p && p.role === "parent" ? p : null;
}

/* ---------- what the widget shows ---------- */
const brief = (t: any) => ({ id: t.id, title: String(t.title || "").slice(0, 120), pri: t.pri || "next", project: t.project || "", projectLabel: projOf(t.project).label });
const col = async (person: string, c: string) => (await listDocs(`hq/${person}/${c}`)).map(d => ({ id: d.id, ...d.data }));

export async function summary(person: string, all = false) {
  const tz = await familyTz(), today = ymdIn(tz), ym = today.slice(0, 7);
  const tasks = await col(person, "tasks"), open = openTasks(tasks);
  const kids = (await auth.people()).filter(p => p.role === "kid");
  const p = await auth.person(person);
  return {
    ok: true, name: p?.name || "HQ", at: new Date().toISOString(), today,
    month: new Intl.DateTimeFormat("en-AU", { timeZone: tz, month: "long" }).format(new Date()),
    tasks: {
      open: open.length,
      now: open.filter(t => t.pri === "now").length, next: open.filter(t => t.pri === "next").length, later: open.filter(t => t.pri === "later").length,
      doneToday: tasks.filter(t => t.done && t.doneAt && ymdIn(tz, new Date(t.doneAt)) === today).length,
      top: open.slice(0, 6).map(brief),
      ...(all ? { all: open.slice(0, 200).map(brief) } : {}),
    },
    money: monthSummary(await col(person, "txns"), ym),
    subs: subsSummary(await col(person, "subs"), today),
    kids: await Promise.all(kids.map(async k => ({ name: k.name, stars: Number((await getDoc("pub/" + k.id))?.stars) || 0 }))),
  };
}

/* ---------- what the widget can do ---------- */
export async function addTask(person: string, b: any) {
  const title = String(b?.title || "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!title) return { ok: false, error: "needs_a_title" };
  const pri = ["now", "next", "later"].includes(b?.pri) ? b.pri : "next";
  const project = typeof b?.project === "string" && /^[a-z0-9]{1,12}$/.test(b.project) ? b.project : "hq";
  const ranks = (await col(person, "tasks")).map(t => Number(t.rank) || 0);
  const id = uid(), at = new Date().toISOString();
  await putDoc(`hq/${person}/tasks/${id}`, { title, pri, project, done: false, needs: false, how: "", tool: "", links: [], rank: Math.max(0, ...ranks) + 1, by: b?.by === "widget" ? "widget" : "yumi", added: at, at }, person);
  return { ok: true, id };
}

export async function setDone(person: string, b: any) {
  if (!okId(b?.id)) return { ok: false, error: "bad_id" };
  const path = `hq/${person}/tasks/${b.id}`, t = await getDoc(path);
  if (!t) return { ok: false, error: "not_found" };
  const done = b.done !== false;
  const next: any = { ...t, done };
  if (done) next.doneAt = new Date().toISOString(); else delete next.doneAt;
  await putDoc(path, next, person);
  return { ok: true, done };
}

/* ---------- the one-time move from the HQ page in Claude ---------- */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const normCode = (s: unknown) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^HQ/, "");

export async function makeImportCode(person: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const raw = [...bytes].map(b => CODE_CHARS[b % CODE_CHARS.length]).join("");
  const until = Date.now() + 30 * 60_000;
  await setMeta("hqimp:" + auth.sha(raw), JSON.stringify({ person, until }));
  return { code: `HQ-${raw.slice(0, 4)}-${raw.slice(4)}`, minutes: 30 };
}

export async function importHq(b: any) {
  const k = "hqimp:" + auth.sha(normCode(b?.code));
  const v = await meta(k);
  let c: { person: string; until: number } | null = null;
  try { c = v ? JSON.parse(v) : null; } catch {}
  if (!c || c.until < Date.now()) { if (c) await delMeta(k); return { ok: false, error: "bad_code", status: 403 }; }
  const p = await auth.person(c.person);
  if (!p || p.role !== "parent") return { ok: false, error: "bad_code", status: 403 };
  await delMeta(k);
  return importInto(p.id, b?.data, b?.from);
}

/* The same move, pasted into the app by the signed-in parent: the HQ page copies everything, Yumi pastes it. */
export async function importMine(person: string, b: any) {
  if (!b?.data || typeof b.data !== "object" || Array.isArray(b.data)) return { ok: false, error: "nothing_to_import", status: 400 };
  return importInto(person, b.data, b.from);
}

async function importInto(person: string, data: any, from: unknown) {
  data = data && typeof data === "object" ? data : {};
  const added: Record<string, number> = {}, skipped: Record<string, number> = {};
  for (const name of HQ_COLS) {
    added[name] = 0; skipped[name] = 0;
    const rows = data[name] && typeof data[name] === "object" ? Object.entries(data[name]).slice(0, 2000) : [];
    for (const [id, raw] of rows) {
      const doc = clean(raw);
      if (!okId(id) || id === "imported" || !doc || typeof doc !== "object" || Array.isArray(doc) || JSON.stringify(doc).length > MAX_DOC_BYTES) { skipped[name]++; continue; }
      if (name === "tasks" && !String(doc.title || "").trim()) { skipped[name]++; continue; }
      if (await insertDocIfMissing(`hq/${person}/${name}/${id}`, doc, "import")) added[name]++; else skipped[name]++;
    }
  }
  const at = new Date().toISOString();
  await putDoc(`hq/${person}/settings/imported`, { at, from: String(from || "HQ").slice(0, 60), added, skipped }, "import");
  bump();
  console.log(`hq import for ${person}: ${JSON.stringify(added)} added, ${JSON.stringify(skipped)} skipped`);
  await push.notify([person], { title: "🗂️ Your HQ is in Yumi", body: `${added.tasks} to-dos, ${added.txns} money entries and ${added.subs} subscriptions came across.`, tag: "hq", url: "/?tab=hq" });
  return { ok: true, added, skipped };
}

export { HQ_COLS };
