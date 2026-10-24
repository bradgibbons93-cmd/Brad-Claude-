import { join, normalize } from "node:path";
import { sql, FAM, migrate, validPath, getDoc, putDoc, delDoc, changesSince, currentSeq, waitForChange, meta } from "./db";
import * as auth from "./auth";
import { readPath, canRead, checkWrite, type WriteOp } from "./rules";
import { ACTIONS, afterWrite, refreshAll, remindTick, DEFAULT_REWARDS, PAYDAY_STARS, PAYDAY_DOLLARS, STRIKES_PER_STAR, PRINCIPAL_AT } from "./stars";
import * as push from "./push";
import { runImport, importFromBody, importArtBundle } from "./importer";
import * as hq from "./hq";

const PORT = Number(process.env.PORT || 8080);
const PUBLIC = join(import.meta.dir, "..", "public");
const VERSION = (process.env.RAILWAY_GIT_COMMIT_SHA || "dev").slice(0, 7);

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

function json(body: any, status = 200, extra: Record<string, string> | [string, string][] = {}) {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS });
  for (const [k, v] of Array.isArray(extra) ? extra : Object.entries(extra)) h.append(k, v);
  return new Response(JSON.stringify(body), { status, headers: h });
}
const withCookies = (cookies: string[]) => cookies.map(c => ["Set-Cookie", c] as [string, string]);

async function kidsSet() {
  return new Set((await auth.people()).filter(p => p.role === "kid").map(p => p.id));
}

/* ---------- static files ---------- */
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
async function serveStatic(pathname: string) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  rel = normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const file = Bun.file(join(PUBLIC, rel));
  if (!rel.startsWith("/") || !(await file.exists())) return null;
  const ext = rel.slice(rel.lastIndexOf("."));
  const html = ext === ".html";
  return new Response(file, { headers: { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": html || rel === "/sw.js" ? "no-cache" : rel.startsWith("/img/") ? "public, max-age=604800" : "no-cache", ...SECURITY_HEADERS } });
}

/* ---------- API ---------- */
async function body(req: Request, max = 200_000): Promise<any> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) throw new Error("too_big");
  try { return await req.json(); } catch { return {}; }
}

/* State-changing requests must come from this site, as JSON. */
function sameOrigin(req: Request, url: URL) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  if (!(req.headers.get("content-type") || "").includes("application/json")) return false;
  const o = req.headers.get("origin");
  if (!o) return true;
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
    return new URL(o).host === host;
  } catch { return false; }
}

/* The address phones reach this server on, for the widget script. Railway passes it in the forwarded headers. */
function originOf(req: Request, url: URL) {
  const proto = (req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0].trim();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host).split(",")[0].trim();
  return (proto === "http" ? "http" : "https") + "://" + (/^[A-Za-z0-9.-]+(:\d+)?$/.test(host) ? host : url.host);
}

async function familyName() {
  const r = await sql`SELECT name FROM y_family WHERE id = ${FAM}`;
  return r.length ? r[0].name : null;
}

async function boot(req: Request, url: URL) {
  const me = await auth.whoAmI(req);
  const device = me?.device || (await auth.knownDevice(req));
  const setup = await auth.setupNeeded();
  const tok = setup ? await auth.setupToken() : null;
  const setupOk = !!tok && auth.sha(url.searchParams.get("setup") || "") === auth.sha(tok);
  const out: any = {
    version: VERSION, family: await familyName(), setupNeeded: setup, known: !!device,
    setupOk, rules: { paydayStars: PAYDAY_STARS, paydayDollars: PAYDAY_DOLLARS, strikesPerStar: STRIKES_PER_STAR, principalAt: PRINCIPAL_AT },
    me: me ? { id: me.id, name: me.name, role: me.role, hasCode: me.hasCode } : null,
  };
  if (me) out.push = push.vapidPublic();
  /* The front door (pictures and star counts) only shows on phones the family has signed in on. */
  if (device || me || setupOk) {
    const ps = await auth.people();
    out.art = (await sql`SELECT k FROM y_art WHERE fam = ${FAM}`).map((x: any) => x.k);
    out.people = await Promise.all(ps.map(async p => ({ id: p.id, name: p.name, role: p.role, hasCode: p.hasCode, profile: (await getDoc("people/" + p.id)) || {}, pub: (await getDoc("pub/" + p.id)) || {} })));
  }
  return out;
}

async function sync(req: Request, url: URL, me: auth.Me) {
  const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
  const wait = Math.min(25, Math.max(0, Number(url.searchParams.get("wait")) || 0));
  const ctx = { me, kids: await kidsSet() };
  let rows = await changesSince(since);
  if (!rows.length && wait) {
    await waitForChange(wait * 1000, req.signal);
    rows = await changesSince(since);
  }
  const docs: any[] = [];
  for (const r of rows) {
    const rp = readPath(ctx, r.path);
    if (rp === "no") continue;
    if (r.deleted) { if (since) docs.push({ path: r.path, deleted: true }); continue; }
    if (canRead(ctx, r.path, r.data)) docs.push({ path: r.path, data: r.data });
    else if (rp === "cond" && since) docs.push({ path: r.path, deleted: true });
  }
  const seq = rows.length ? rows[rows.length - 1].seq : Math.max(since, since === 0 ? await currentSeq() : since);
  return { seq, more: rows.length >= 1500, docs };
}

async function write(me: auth.Me, b: any) {
  const ops: WriteOp[] = Array.isArray(b.ops) ? b.ops.slice(0, 40) : [];
  if (!ops.length) return json({ ok: false, error: "no_ops" }, 400);
  const ctx = { me, kids: await kidsSet() };
  const results: any[] = [];
  for (const op of ops) {
    if (!validPath(op?.path)) { results.push({ path: op?.path, ok: false, error: "bad_path" }); continue; }
    const old = await getDoc(op.path);
    if (op.del && !old) { results.push({ path: op.path, ok: true }); continue; }
    if (!op.del && op.merge && !old) { results.push({ path: op.path, ok: false, error: "missing" }); continue; }
    const c = checkWrite(ctx, op, old);
    if (!c.ok) { results.push({ path: op.path, ok: false, error: c.why }); continue; }
    if (op.del) await delDoc(op.path, me.id);
    else await putDoc(op.path, c.data, me.id);
    try { await afterWrite(me, op.path, old, op.del ? null : c.data); } catch (e) { console.error("afterWrite", e); }
    results.push({ path: op.path, ok: true });
  }
  return json({ ok: results.every(r => r.ok), results, seq: await currentSeq() });
}

async function api(req: Request, url: URL, server: any): Promise<Response> {
  const path = url.pathname.slice(4);
  const ip = auth.ipOf(req, server);
  if (!sameOrigin(req, url)) return json({ ok: false, error: "origin" }, 403);

  if (path === "/boot" && req.method === "GET") {
    const b = await boot(req, url);
    /* Signed-in phones stay signed in: refresh the cookies' 400-day clock each time the app opens. */
    const c = auth.cookieMap(req), extra: [string, string][] = [];
    if (b.me && c.ys) extra.push(["Set-Cookie", auth.setCookie("ys", c.ys)]);
    if (b.known && c.yd) extra.push(["Set-Cookie", auth.setCookie("yd", c.yd)]);
    return json(b, 200, extra);
  }

  if (path === "/setup" && req.method === "POST") {
    const b = await body(req);
    if (!(await auth.setupNeeded())) return json({ ok: false, error: "already_set_up" }, 409);
    const tok = await auth.setupToken();
    if (!tok || typeof b.token !== "string" || auth.sha(b.token) !== auth.sha(tok)) return json({ ok: false, error: "bad_token" }, 403);
    if (!/^\d{6}$/.test(String(b.code || ""))) return json({ ok: false, error: "six_numbers" }, 400);
    let ps = await auth.people();
    if (!ps.some(p => p.role === "parent")) {
      /* A fresh family with no imported data: make it from the form. */
      const fam = String(b.family || "").trim().slice(0, 40) || "Family";
      const parent = String(b.parent || "").trim().slice(0, 30) || "Parent";
      const kids: string[] = (Array.isArray(b.kids) ? b.kids : []).map((k: any) => String(k || "").trim().slice(0, 30)).filter(Boolean).slice(0, 6);
      await sql`INSERT INTO y_family (id, name) VALUES (${FAM}, ${fam}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`;
      const slug = (s: string, i: number) => (s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "p") + (i ? i : "");
      const pid = slug(parent, 0);
      await sql`INSERT INTO y_people (fam, id, name, role, sort) VALUES (${FAM}, ${pid}, ${parent}, 'parent', 0) ON CONFLICT DO NOTHING`;
      await putDoc("people/" + pid, { name: parent, role: "parent", colour: "#5B8CFF" }, "setup");
      const colours = ["pink", "lilac", "mint", "sun", "ocean", "pink"];
      for (const [i, k] of kids.entries()) {
        let id = slug(k, 0); if (id === pid || kids.slice(0, i).some(x => slug(x, 0) === id)) id = slug(k, i + 1);
        await sql`INSERT INTO y_people (fam, id, name, role, sort) VALUES (${FAM}, ${id}, ${k}, 'kid', ${i + 1}) ON CONFLICT DO NOTHING`;
        await putDoc("people/" + id, { name: k, role: "kid", accent: colours[i], buddy: null, theme: "classic" }, "setup");
      }
      ps = await auth.people();
    }
    const parent = ps.find(p => p.role === "parent")!;
    await auth.setCode(parent.id, String(b.code));
    if (typeof b.tz === "string" && /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(b.tz) && !(await getDoc("settings/family"))?.tz) {
      try { new Intl.DateTimeFormat("en", { timeZone: b.tz }); await putDoc("settings/family", { ...((await getDoc("settings/family")) || {}), tz: b.tz }, "setup"); } catch {}
    }
    const cookies = await auth.startSession(req, parent.id);
    await refreshAll();
    return json({ ok: true }, 200, withCookies(cookies));
  }

  /* One-time data move, locked with the setup token and only before the parent code exists. */
  if (path === "/import" && req.method === "POST") {
    const b = await body(req, 3_000_000);
    const tok = await auth.setupToken();
    if (!(await auth.setupNeeded())) return json({ ok: false, error: "already_set_up" }, 409);
    if (!tok || typeof b.token !== "string" || auth.sha(b.token) !== auth.sha(tok)) return json({ ok: false, error: "bad_token" }, 403);
    if (typeof b.payload !== "string" || !b.payload) return json({ ok: false, error: "no_payload" }, 400);
    try {
      const r = await importFromBody(b.payload);
      await refreshAll();
      const counts = await sql`SELECT (SELECT count(*) FROM y_people WHERE fam = ${FAM}) AS people, (SELECT count(*) FROM y_docs WHERE fam = ${FAM} AND NOT deleted) AS docs, (SELECT count(*) FROM y_art WHERE fam = ${FAM}) AS art`;
      return json({ ok: true, ...r, people: Number(counts[0].people), docs: Number(counts[0].docs), art: Number(counts[0].art) });
    } catch (e) { console.error("import", e); return json({ ok: false, error: "bad_payload" }, 400); }
  }

  if (path === "/login" && req.method === "POST") {
    const b = await body(req);
    const device = await auth.knownDevice(req);
    const r = await auth.checkCode(typeof b.who === "string" ? b.who : null, String(b.code || ""), ip, device);
    if (!r.ok) return json(r, r.error === "locked" ? 429 : 401);
    const cookies = await auth.startSession(req, r.person.id);
    return json({ ok: true }, 200, withCookies(cookies));
  }

  if (path === "/pair/claim" && req.method === "POST") {
    const b = await body(req);
    const r = await auth.claimPairCode(String(b.code || ""), ip);
    if (!r.ok) return json(r, r.error === "locked" ? 429 : 401);
    const cookies = await auth.startSession(req, r.person);
    return json({ ok: true, person: r.person }, 200, withCookies(cookies));
  }

  /* The iPhone widget has no cookie, only its own key (hq.ts). A wrong, old or turned-off key is a 404. */
  const wm = /^\/hq\/w\/([A-Za-z0-9_-]{30,80})(\/task|\/done)?$/.exec(path);
  if (wm) {
    const p = await hq.personForKey(wm[1]);
    if (!p) return json({ ok: false, error: "not_found" }, 404);
    if (!wm[2] && req.method === "GET") return json(await hq.summary(p.id, url.searchParams.get("all") === "1"));
    if (wm[2] && req.method === "POST") {
      const b = await body(req, 20_000);
      const r = wm[2] === "/task" ? await hq.addTask(p.id, { ...b, by: "widget" }) : await hq.setDone(p.id, b);
      return json(r, r.ok ? 200 : 400);
    }
    return json({ ok: false, error: "not_found" }, 404);
  }
  /* The one-time move from the HQ page in Claude, locked with a 30-minute code the parent made in the app. */
  if (path === "/hq/import" && req.method === "POST") {
    const { status, ...r } = await hq.importHq(await body(req, 3_000_000)) as any;
    return json(r, r.ok ? 200 : status || 400);
  }

  const me = await auth.whoAmI(req);
  if (!me) return json({ ok: false, error: "signed_out" }, 401);

  if (path === "/logout" && req.method === "POST") {
    await auth.endSession(me);
    /* A signed-out phone stops getting that person's notifications. */
    if (me.device) await push.forgetDevicePush(me.device);
    return json({ ok: true }, 200, [["Set-Cookie", auth.clearCookie("ys")]]);
  }
  if (path === "/sync" && req.method === "GET") return json(await sync(req, url, me));
  if (path === "/write" && req.method === "POST") return write(me, await body(req));

  if (path.startsWith("/act/") && req.method === "POST") {
    const fn = ACTIONS[path.slice(5)];
    if (!fn) return json({ ok: false, error: "no_action" }, 404);
    const r = await fn(me, await body(req));
    return json(r, r.ok ? 200 : 400);
  }

  /* Lock-screen notifications for whoever is signed in on this phone. */
  if (path === "/push/subscribe" && req.method === "POST") {
    const b = await body(req);
    const ok = await push.subscribe(me.id, me.device, b.sub);
    if (ok && b.hello) await push.notify([me.id], { title: "🔔 Notifications are on!", body: me.role === "kid" ? "Stars, notes and reminders will pop up here ⭐" : "The girls' stars, check-ins and requests will pop up here.", tag: "hello" });
    return json({ ok }, ok ? 200 : 400);
  }
  if (path === "/push/unsubscribe" && req.method === "POST") {
    const b = await body(req);
    if (typeof b.endpoint === "string") await push.unsubscribe(me.id, b.endpoint);
    return json({ ok: true });
  }
  /* An iPhone moving Yumi from Safari to its Home Screen: a short one-time code for the same person,
     so the Home Screen copy can sign itself in. */
  if (path === "/pair/self" && req.method === "POST") return json({ ok: true, code: await auth.makePairCode(me.id, 30) });
  if (path === "/push/test" && req.method === "POST") {
    const n = await push.notify([me.id], { title: "⭐ Testing, testing!", body: "If you can read this, Yumi can reach your lock screen.", tag: "test" });
    return json({ ok: n > 0, sent: n });
  }

  /* Anyone can change their own picture. Dad can change anyone's. It stays private like the other pictures. */
  if (path === "/me/picture" && req.method === "POST") {
    const b = await body(req, 800_000);
    const target = me.role === "parent" && typeof b.who === "string" ? b.who : me.id;
    if (!(await auth.person(target))) return json({ ok: false, error: "not_found" }, 404);
    const k = `${target}_me`, doc = (await getDoc("people/" + target)) || {};
    if (b.clear) {
      await sql`DELETE FROM y_art WHERE fam = ${FAM} AND k = ${k}`;
      await putDoc("people/" + target, { ...doc, pic: null, picV: Date.now() }, me.id);
      return json({ ok: true });
    }
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ""));
    if (!m) return json({ ok: false, error: "not_a_picture" }, 400);
    const bytes = Buffer.from(m[2], "base64");
    const magic = m[1] === "jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 : m[1] === "png" ? bytes.subarray(1, 4).toString() === "PNG" : bytes.subarray(8, 12).toString() === "WEBP";
    if (!magic || bytes.length < 100) return json({ ok: false, error: "not_a_picture" }, 400);
    if (bytes.length > 500_000) return json({ ok: false, error: "too_big" }, 413);
    await sql`INSERT INTO y_art (fam, k, mime, bytes) VALUES (${FAM}, ${k}, ${"image/" + m[1]}, ${bytes}) ON CONFLICT (fam, k) DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes`;
    await putDoc("people/" + target, { ...doc, pic: k, picV: Date.now() }, me.id);
    return json({ ok: true, pic: k });
  }

  /* A girl picks her own 4-number code the first time her phone is added. */
  if (path === "/me/code" && req.method === "POST") {
    const b = await body(req);
    const code = String(b.code || "");
    const target = me.role === "parent" && typeof b.who === "string" ? b.who : me.id;
    const p = await auth.person(target);
    if (!p) return json({ ok: false, error: "not_found" }, 404);
    if (target === me.id && me.role === "kid" && me.hasCode) return json({ ok: false, error: "ask_dad" }, 403);
    if (b.clear && me.role === "parent" && target !== me.id) { await auth.setCode(target, null); return json({ ok: true }); }
    const len = p.role === "parent" ? 6 : 4;
    if (!new RegExp(`^\\d{${len}}$`).test(code)) return json({ ok: false, error: len === 6 ? "six_numbers" : "four_numbers" }, 400);
    if (target === me.id && me.role === "parent") {
      const ok = await auth.checkCode(me.id, String(b.old || ""), ip, me.device);
      if (!ok.ok) return json({ ok: false, error: "old_code_wrong" }, 401);
    }
    await auth.setCode(target, code);
    return json({ ok: true });
  }

  if (me.role !== "parent") return json({ ok: false, error: "parent_only" }, 403);

  if (path === "/pair/create" && req.method === "POST") {
    const b = await body(req);
    const p = await auth.person(String(b.who || ""));
    if (!p) return json({ ok: false, error: "not_found" }, 404);
    /* A link sent by message lasts a day; a code typed in front of Dad lasts 10 minutes. Either works once. */
    const minutes = b.link ? 24 * 60 : 10;
    return json({ ok: true, code: await auth.makePairCode(p.id, minutes), minutes, hasCode: p.hasCode });
  }
  if (path === "/devices" && req.method === "GET") return json({ ok: true, devices: await auth.devicesList(), mine: me.device?.slice(0, 16) || null });
  if (path === "/devices/forget" && req.method === "POST") {
    const b = await body(req);
    return json({ ok: await auth.forgetDevice(String(b.id || "")) });
  }
  /* HQ: the widget's key and the one-time code for bringing the HQ page across. Each parent has their own. */
  if (path === "/hq/widget" && req.method === "GET") return json({ ok: true, ...(await hq.widgetState(me.id)) });
  if (path === "/hq/widget" && req.method === "POST") return json({ ok: true, ...(await hq.newWidgetKey(me.id, originOf(req, url), me.name)) });
  if (path === "/hq/widget/off" && req.method === "POST") { await hq.widgetOff(me.id); return json({ ok: true }); }
  if (path === "/hq/import-code" && req.method === "POST") return json({ ok: true, ...(await hq.makeImportCode(me.id)) });
  if (path === "/rewards" && req.method === "GET") return json({ ok: true, items: (await getDoc("settings/rewards"))?.items || DEFAULT_REWARDS });
  if (path === "/export" && req.method === "GET") {
    const rows = await sql`SELECT path, data, updated FROM y_docs WHERE fam = ${FAM} AND NOT deleted ORDER BY path`;
    const kids = await kidsSet();
    /* Private journal pages stay private even in a backup. */
    const out = rows.filter((r: any) => canRead({ me, kids }, r.path, r.data));
    return new Response(JSON.stringify({ exported: new Date().toISOString(), family: await familyName(), docs: out }, null, 1), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="yumi-backup-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store", ...SECURITY_HEADERS },
    });
  }
  return json({ ok: false, error: "not_found" }, 404);
}

/* Family pictures are private: only phones the family has signed in on can load them. */
async function art(req: Request, key: string) {
  if (!/^[a-z0-9_-]{1,40}$/.test(key)) return new Response("Not found", { status: 404 });
  const ok = (await auth.knownDevice(req)) || (await auth.whoAmI(req));
  if (!ok) return new Response("Not found", { status: 404 });
  const r = await sql`SELECT mime, bytes FROM y_art WHERE fam = ${FAM} AND k = ${key}`;
  if (!r.length) return new Response("Not found", { status: 404 });
  return new Response(r[0].bytes, { headers: { "Content-Type": r[0].mime, "Cache-Control": "private, max-age=86400", ...SECURITY_HEADERS } });
}

/* A phone added to the Home Screen from a "join" link opens straight onto that link, so it can sign in there. */
async function manifest(url: URL) {
  const m = await Bun.file(join(PUBLIC, "manifest.webmanifest")).json();
  const jc = (url.searchParams.get("join") || "").toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(jc)) m.start_url = "/?join=" + jc;
  return new Response(JSON.stringify(m), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache", ...SECURITY_HEADERS } });
}

await migrate();
await push.initPush();
await auth.ensureSetupToken();
await runImport();
await importArtBundle();
await refreshAll();
for (const p of await auth.people()) if (p.role === "kid") console.log(`jar ${p.id}: ${JSON.stringify(await getDoc("pub/" + p.id))}`);
if (await auth.setupNeeded()) {
  const tok = await auth.setupToken();
  console.log(process.env.SETUP_TOKEN ? "Setup: open /?setup=<your SETUP_TOKEN> to make the parent code." : `Setup: open /?setup=${tok} to make the parent code.`);
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 60,
  async fetch(req, srv) {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/healthz") { await sql`SELECT 1`; return new Response("ok"); }
      if (url.pathname.startsWith("/api/")) return await api(req, url, srv);
      if (url.pathname.startsWith("/art/")) return await art(req, url.pathname.slice(5));
      if (url.pathname === "/manifest.webmanifest") return await manifest(url);
      if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
      const s = await serveStatic(url.pathname);
      if (s) return s;
      if (!url.pathname.includes(".")) return (await serveStatic("/"))!;
      return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
    } catch (e: any) {
      if (e?.message === "too_big") return json({ ok: false, error: "too_big" }, 413);
      console.error(e);
      return json({ ok: false, error: "server" }, 500);
    }
  },
});
console.log(`Yumi ${VERSION} on :${server.port}`);
/* Routine reminders: checked every 20 seconds, sent once per slot per day. */
setInterval(() => { remindTick().catch(e => console.error("remind", e)); }, 20_000);
