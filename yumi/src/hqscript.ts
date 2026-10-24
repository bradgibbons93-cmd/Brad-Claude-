/* The iPhone widget: a script for the free Scriptable app, made with the parent's widget key inside it.
   A web app can't have a real iPhone widget (that needs an App Store app), and Scriptable widgets can't
   run code on a tap, only open a link. So every tap opens this same script in Scriptable with what to do:
   tick a to-do off, add one (brain dump), start a 25-minute block, or show the whole list.
   Today's events come from the phone's own calendar, so nothing about them leaves the phone. */

export function hqWidgetScript(o: { origin: string; key: string; name: string; made: string }) {
  const first = (o.name || "").trim().split(/\s+/)[0] || "My";
  const title = (/^brad/i.test(first) ? "BRAD" : first.toUpperCase()) + " HQ";
  const day = new Date(o.made).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Melbourne" });
  return `// ${title} widget for Scriptable. Made in Yumi > HQ > iPhone widget on ${day}.
// Keep it to yourself: the address below opens your HQ list and money totals.
// Turning the widget off in Yumi (or making a new one) stops this copy working.
const HQ = ${JSON.stringify(`${o.origin}/api/hq/w/${o.key}`)};
const OPEN = ${JSON.stringify(`${o.origin}/?tab=hq`)};
const TITLE = ${JSON.stringify(title)};

const C = {
  bg: new Color("#08090C"), bg2: new Color("#121821"), card: new Color("#1A1F28"), fg: new Color("#F5F5F3"),
  dim: new Color("#F5F5F3", 0.62), faint: new Color("#F5F5F3", 0.4), yellow: new Color("#FFD400"),
  cyan: new Color("#00E5FF"), pink: new Color("#FF6FA8"), good: new Color("#3DDC97"), bad: new Color("#FF6B6B"), ink: new Color("#0B0B0B"),
};
const PROJ = { money: "#3DDC97", runnit: "#D9A94E", agency: "#00E5FF", softr: "#FFB6D5", crew: "#EC3D7C", encap: "#5B9BE0", five8: "#E2453C", hq: "#7A5CFF" };
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.cacheDirectory(), "brad-hq-widget.json");
const RUN = (function () { try { return URLScheme.forRunningScript(); } catch (e) { return "scriptable:///run/" + encodeURIComponent(Script.name()); } })();
const act = function (q) { return RUN + "?" + q; };
const money = function (n) { n = Number(n) || 0; return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-AU", { maximumFractionDigits: Math.abs(n) % 1 ? 2 : 0 }); };
const timeOf = function (d) { const f = new DateFormatter(); f.useNoDateStyle(); f.useShortTimeStyle(); return f.string(d).replace(/\\s?(am|pm)$/i, function (m) { return m.trim().toLowerCase(); }); };

/* ---------- talking to Yumi ---------- */
async function call(path, body) {
  const req = new Request(HQ + path);
  req.timeoutInterval = 15;
  if (body) { req.method = "POST"; req.headers = { "Content-Type": "application/json" }; req.body = JSON.stringify(body); }
  const json = await req.loadJSON();
  const code = req.response.statusCode;
  if (code !== 200) { const e = new Error((json && json.error) || "HTTP " + code); e.code = code; throw e; }
  return json;
}
async function load(all) {
  try {
    const d = await call(all ? "?all=1" : "");
    try { fm.writeString(CACHE, JSON.stringify(d)); } catch (e) {}
    return { d: d, fresh: true };
  } catch (e) {
    if (e.code === 404) return { d: null, off: true };
    try { if (fm.fileExists(CACHE)) return { d: JSON.parse(fm.readString(CACHE)), fresh: false }; } catch (e2) {}
    return { d: null };
  }
}
async function events(n) {
  try {
    const now = new Date(), end = new Date(now.getTime() + 36 * 3600000);
    const list = await CalendarEvent.between(now, end, []);
    return list.filter(function (e) { return e.isAllDay || e.endDate > now; })
      .sort(function (a, b) { return a.startDate - b.startDate; }).slice(0, n);
  } catch (e) { return []; }
}
/* City Ink's numbers, if the Runnit widget script is in Scriptable too: its address is read from that script. */
async function cityInk() {
  const MEMO = fm.joinPath(fm.cacheDirectory(), "brad-hq-cityink.txt");
  let url = null;
  try { if (fm.fileExists(MEMO)) url = fm.readString(MEMO) || null; } catch (e) {}
  if (!url) {
    const places = [];
    try { places.push(FileManager.iCloud()); } catch (e) {}
    places.push(fm);
    for (const f of places) {
      try {
        const dir = f.documentsDirectory();
        for (const file of f.listContents(dir)) {
          if (!/\\.js$/.test(file) || file === Script.name() + ".js") continue;
          const p = f.joinPath(dir, file);
          if (f.isFileStoredIniCloud(p)) await f.downloadFileFromiCloud(p);
          const src = f.readString(p) || "";
          const m = /Runnit widget/.test(src) && src.match(/const DATA = "(https:\\/\\/[^"\\s]+\\/api\\/widget\\/[A-Za-z0-9_-]+)"/);
          if (m) { url = m[1]; break; }
        }
      } catch (e) {}
      if (url) break;
    }
    if (url) { try { fm.writeString(MEMO, url); } catch (e) {} }
  }
  if (!url) return null;
  try { const r = new Request(url); r.timeoutInterval = 8; const j = await r.loadJSON(); return r.response.statusCode === 200 ? j : null; } catch (e) { return null; }
}

/* ---------- the widget ---------- */
function text(stack, s, size, color, weight) {
  const t = stack.addText(String(s));
  t.font = weight === "heavy" ? Font.heavySystemFont(size) : weight === "bold" ? Font.boldSystemFont(size) : weight === "semi" ? Font.semiboldSystemFont(size) : weight === "medium" ? Font.mediumSystemFont(size) : Font.systemFont(size);
  t.textColor = color || C.fg;
  t.lineLimit = 1;
  return t;
}
function header(w, d, fresh) {
  const top = w.addStack();
  top.centerAlignContent();
  text(top, "✕", 12, C.yellow, "heavy");
  top.addSpacer(5);
  text(top, TITLE, 11, C.fg, "heavy");
  top.addSpacer();
  if (d) text(top, fresh ? timeOf(new Date()) : "offline · " + timeOf(new Date(d.at)), 9, fresh ? C.faint : C.bad, "medium");
}
function label(stack, s, color) { const t = text(stack, s, 9, color || C.faint, "heavy"); return t; }
function taskRow(stack, t, size) {
  const row = stack.addStack();
  row.centerAlignContent();
  row.url = act("do=done&id=" + encodeURIComponent(t.id) + "&t=" + encodeURIComponent(t.title));
  text(row, "○", size + 2, new Color(PROJ[t.project] || "#9AA0AA"), "bold");
  row.addSpacer(6);
  if (t.pri === "now") { text(row, "NOW", size - 4, C.yellow, "heavy"); row.addSpacer(4); }
  text(row, t.title, size, C.fg, "semi");
  row.addSpacer();
  return row;
}
function buttons(w) {
  const r = w.addStack();
  r.spacing = 6;
  const b = function (s, url, main) {
    const x = r.addStack();
    x.backgroundColor = main ? C.yellow : C.card;
    x.cornerRadius = 9;
    x.setPadding(5, 9, 5, 9);
    x.url = url;
    text(x, s, 11, main ? C.ink : C.fg, "semi");
  };
  b("🧠 Dump", act("do=dump"), true);
  b("⏱ 25", act("do=focus"));
  b("☰ All", act("do=list"));
}
function eventLine(stack, e, size) {
  const when = e.isAllDay ? "All day" : timeOf(e.startDate);
  const row = stack.addStack();
  text(row, when, size, C.cyan, "semi");
  row.addSpacer(5);
  text(row, e.title, size, C.fg, "medium");
}
function noData(w, off) {
  w.addSpacer();
  text(w, off ? "Turned off in Yumi" : "Can't reach Yumi", 14, C.fg, "semi");
  const t = text(w, off ? "Make a new widget in Yumi > HQ." : "It'll try again in a few minutes.", 11, C.dim);
  t.lineLimit = 2;
  w.addSpacer();
}

async function small(w, d) {
  const n = d.tasks.now || d.tasks.open;
  const row = w.addStack();
  row.bottomAlignContent();
  text(row, n, 34, d.tasks.now ? C.yellow : C.fg, "heavy");
  row.addSpacer(5);
  const l = row.addStack();
  l.layoutVertically();
  text(l, d.tasks.now ? "now" : "to do", 12, C.fg, "semi");
  l.addSpacer(5);
  w.addSpacer(4);
  const top = d.tasks.top[0];
  const t = text(w, top ? top.title : "All clear 🙌", 12, C.fg, "semi");
  t.lineLimit = 3;
  w.addSpacer();
  text(w, d.tasks.open + " to do · " + money(d.money.out) + " out", 10, C.dim, "medium");
}

async function medium(w, d) {
  const body = w.addStack();
  const left = body.addStack();
  left.layoutVertically();
  left.spacing = 4;
  label(left, "TOP OF THE LIST · " + d.tasks.open);
  for (const t of d.tasks.top.slice(0, 3)) taskRow(left, t, 12);
  if (!d.tasks.top.length) text(left, "All clear 🙌", 12, C.fg, "semi");
  body.addSpacer(10);
  const right = body.addStack();
  right.layoutVertically();
  right.spacing = 3;
  right.size = new Size(104, 0);
  const evs = await events(1);
  label(right, "NEXT");
  if (evs.length) { const e = evs[0]; text(right, e.isAllDay ? "All day" : timeOf(e.startDate), 11, C.cyan, "semi"); text(right, e.title, 11, C.fg, "medium"); }
  else text(right, "Nothing soon", 11, C.dim);
  right.addSpacer(2);
  label(right, String(d.month).toUpperCase());
  text(right, money(d.money.out) + " out", 11, C.fg, "semi");
  const ci = await cityInk();
  if (ci) text(right, "City Ink " + ci.waiting + " waiting", 10, ci.waiting ? C.pink : C.dim, "medium");
  w.addSpacer();
  buttons(w);
}

async function large(w, d) {
  label(w, "TOP OF THE LIST · " + d.tasks.open + " TO DO · " + d.tasks.now + " NOW");
  w.addSpacer(5);
  const list = w.addStack();
  list.layoutVertically();
  list.spacing = 6;
  for (const t of d.tasks.top.slice(0, 5)) taskRow(list, t, 13);
  if (!d.tasks.top.length) text(list, "All clear 🙌", 13, C.fg, "semi");
  w.addSpacer(10);
  const cols = w.addStack();
  const a = cols.addStack();
  a.layoutVertically();
  a.spacing = 3;
  label(a, "TODAY & TOMORROW");
  const evs = await events(3);
  for (const e of evs) eventLine(a, e, 11);
  if (!evs.length) text(a, "Nothing in the calendar", 11, C.dim);
  cols.addSpacer();
  const b = cols.addStack();
  b.layoutVertically();
  b.spacing = 3;
  b.size = new Size(120, 0);
  label(b, String(d.month).toUpperCase());
  text(b, money(d.money.out) + " out", 12, C.fg, "semi");
  text(b, money(d.money.in) + " in", 11, C.good, "medium");
  text(b, "Subs " + money(d.subs.monthly) + "/mo", 11, C.dim, "medium");
  w.addSpacer(8);
  const ci = await cityInk();
  if (ci) text(w, "City Ink · " + ci.waiting + " waiting · " + ci.draftsReady + " replies ready", 11, ci.waiting ? C.pink : C.dim, "medium");
  if (d.kids && d.kids.length) text(w, d.kids.map(function (k) { return k.name + " " + k.stars + "★"; }).join("  ·  "), 11, C.yellow, "medium");
  if (d.subs.soon && d.subs.soon.length) text(w, "Renews soon: " + d.subs.soon.slice(0, 2).map(function (s) { return s.name + (s.amount != null ? " " + money(s.amount) : ""); }).join(", "), 10, C.dim);
  w.addSpacer();
  buttons(w);
}

function accessory(w, family, d) {
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack();
    s.layoutVertically();
    s.centerAlignContent();
    const n = text(s, d ? (d.tasks.now || d.tasks.open) : "–", 20, C.fg, "heavy");
    n.centerAlignText();
    const l = text(s, d && d.tasks.now ? "now" : "to do", 9, C.fg, "semi");
    l.centerAlignText();
    return w;
  }
  const top = d && d.tasks.top[0];
  if (family === "accessoryInline") { text(w, d ? "✕ " + d.tasks.now + " now · " + (top ? top.title : "all clear") : "✕ HQ", 12, C.fg, "semi"); return w; }
  text(w, d ? "✕ HQ · " + d.tasks.open + " to do · " + d.tasks.now + " now" : "✕ HQ", 12, C.fg, "heavy");
  const t = text(w, top ? top.title : d ? "All clear" : "Can't reach Yumi", 12, C.fg, "medium");
  t.lineLimit = 2;
  return w;
}

async function widget(family) {
  const r = await load(false), d = r.d;
  const w = new ListWidget();
  w.url = act("do=list");
  w.refreshAfterDate = new Date(Date.now() + 5 * 60000);
  if (family.indexOf("accessory") === 0) return accessory(w, family, d);
  const g = new LinearGradient();
  g.colors = [C.bg2, C.bg];
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.setPadding(12, 14, 12, 14);
  header(w, d, r.fresh);
  w.addSpacer(6);
  if (!d) { noData(w, r.off); return w; }
  if (family === "small") await small(w, d);
  else if (family === "large" || family === "extraLarge") await large(w, d);
  else await medium(w, d);
  return w;
}

/* ---------- taps: run in the Scriptable app ---------- */
async function say(title, message) { const a = new Alert(); a.title = title; a.message = message || ""; a.addAction("OK"); await a.presentAlert(); }
async function dump() {
  const a = new Alert();
  a.title = "Brain dump";
  a.message = "A few words. It goes straight on your HQ list.";
  a.addTextField("e.g. Send Johnny the studio page", "");
  a.addAction("Add as Next");
  a.addAction("Add as Now");
  a.addAction("Park for Later");
  a.addCancelAction("Cancel");
  const i = await a.presentAlert();
  const title = (a.textFieldValue(0) || "").trim();
  if (i < 0 || !title) return false;
  try { await call("/task", { title: title, pri: ["next", "now", "later"][i], by: "widget" }); return true; }
  catch (e) { await say("That didn't save", "Check the internet and try again."); return false; }
}
async function tick(id, title) {
  if (!id) return false;
  const a = new Alert();
  a.title = "Done?";
  a.message = title || "";
  a.addAction("Done ✓");
  a.addCancelAction("Not yet");
  if ((await a.presentAlert()) < 0) return false;
  try { await call("/done", { id: id }); return true; }
  catch (e) { await say("Couldn't tick that off", "Check the internet and try again."); return false; }
}
async function focus() {
  const end = new Date(Date.now() + 25 * 60000);
  try { await Notification.removePending(["brad-hq-focus"]); } catch (e) {}
  const n = new Notification();
  n.identifier = "brad-hq-focus";
  n.title = "25 minutes done ✓";
  n.body = "Stand up, stretch, then pick the next thing.";
  n.setTriggerDate(end);
  await n.schedule();
  await say("Focus block started", "I'll buzz you at " + timeOf(end) + ".");
}

function row(table, title, sub, onSelect, opts) {
  const r = new UITableRow();
  r.height = (opts && opts.height) || 56;
  r.backgroundColor = (opts && opts.bg) || C.bg;
  r.dismissOnSelect = false;
  const c = r.addText(title, sub || null);
  c.titleColor = (opts && opts.color) || C.fg;
  c.subtitleColor = C.dim;
  c.titleFont = opts && opts.big ? Font.heavySystemFont(22) : Font.semiboldSystemFont(16);
  c.subtitleFont = Font.systemFont(12);
  if (onSelect) r.onSelect = onSelect;
  table.addRow(r);
  return r;
}
async function list() {
  const table = new UITable();
  table.showSeparators = true;
  async function draw() {
    table.removeAllRows();
    const r = await load(true), d = r.d;
    row(table, TITLE, d ? d.tasks.open + " to do · " + d.tasks.now + " now" + (r.fresh ? "" : " · offline, showing the last copy") : r.off ? "This widget was turned off in Yumi." : "Can't reach Yumi right now.", null, { big: true, color: C.yellow, height: 76 });
    row(table, "🧠  Brain dump", "Add a to-do in a few words", async function () { if (await dump()) await draw(); });
    row(table, "⏱  Start a 25-minute block", "Your phone buzzes when it's up", async function () { await focus(); });
    if (d) {
      const all = d.tasks.all || d.tasks.top;
      for (const pri of ["now", "next", "later"]) {
        const items = all.filter(function (t) { return t.pri === pri; });
        if (!items.length) continue;
        row(table, { now: "NOW", next: "NEXT", later: "LATER" }[pri] + " · " + items.length, null, null, { color: pri === "now" ? C.yellow : C.faint, height: 36, bg: C.bg2 });
        for (const t of items) row(table, "○  " + t.title, t.projectLabel || null, async function () { if (await tick(t.id, t.title)) await draw(); });
      }
      row(table, String(d.month) + ": " + money(d.money.out) + " out · " + money(d.money.in) + " in", "Subscriptions about " + money(d.subs.monthly) + " a month", null, { bg: C.bg2 });
    }
    row(table, "👀  Preview the widget", "How it looks on the Home Screen", async function () { await (await widget("medium")).presentMedium(); });
    row(table, "Open Yumi", "Everything else lives there", function () { Safari.open(OPEN); });
    table.reload();
  }
  await draw();
  await table.present(false);
}

const q = (typeof args !== "undefined" && args.queryParameters) || {};
if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(await widget(config.widgetFamily || "medium"));
} else {
  if (q.do === "dump") await dump();
  else if (q.do === "done") await tick(q.id, q.t);
  else if (q.do === "focus") await focus();
  await list();
}
Script.complete();
`;
}
