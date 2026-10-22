import { sql, FAM, meta, setMeta } from "./db";

/* Sign-in rules
   - Every person has a code: 6 numbers for a parent, 4 for a kid. Codes are hashed (bcrypt) and checked here.
   - A signed-in phone keeps a session cookie (ys) until someone taps Sign out.
   - A phone that has ever been signed in is a "known device" (yd cookie). Kids can only type their
     code on a known device, so a stranger with the link can't guess a 4-number code.
   - New phones get in with a one-time "Add a phone" code that a parent makes (10 minutes, or a day
     when it's sent as a link; one use either way).
   - Wrong codes: 5 tries, then a wait. Parent codes wait longer. */

export type Person = { id: string; name: string; role: "parent" | "kid"; hasCode: boolean; sort: number };
export type Me = Person & { session: string; device: string | null };

const YEAR400 = 400 * 24 * 3600;
const PAIR_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const sha = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");
export const token = (bytes = 32) => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");

export function cookieMap(req: Request) {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
export function setCookie(name: string, value: string, maxAge = YEAR400) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = (name: string) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export async function people(): Promise<Person[]> {
  const r = await sql`SELECT id, name, role, code_hash IS NOT NULL AS has_code, sort FROM y_people WHERE fam = ${FAM} ORDER BY sort, id`;
  return r.map((x: any) => ({ id: x.id, name: x.name, role: x.role, hasCode: !!x.has_code, sort: x.sort }));
}
export async function person(id: string): Promise<Person | null> {
  return (await people()).find(p => p.id === id) || null;
}

export async function whoAmI(req: Request): Promise<Me | null> {
  const c = cookieMap(req);
  if (!c.ys) return null;
  const r = await sql`SELECT s.person, s.device, s.token_hash, s.last_seen, p.name, p.role, p.sort, p.code_hash IS NOT NULL AS has_code
    FROM y_sessions s JOIN y_people p ON p.fam = s.fam AND p.id = s.person
    LEFT JOIN y_devices d ON d.id_hash = s.device
    WHERE s.token_hash = ${sha(c.ys)} AND s.fam = ${FAM} AND (d.id_hash IS NULL OR d.revoked IS NULL)`;
  if (!r.length) return null;
  const x = r[0];
  if (Date.now() - new Date(x.last_seen).getTime() > 3600e3) {
    sql`UPDATE y_sessions SET last_seen = now() WHERE token_hash = ${x.token_hash}`.catch(() => {});
    if (x.device) sql`UPDATE y_devices SET last_seen = now() WHERE id_hash = ${x.device}`.catch(() => {});
  }
  return { id: x.person, name: x.name, role: x.role, sort: x.sort, hasCode: !!x.has_code, session: x.token_hash, device: x.device };
}

/* A known device is one that has been signed in on before and not signed out from Dad mode. */
export async function knownDevice(req: Request): Promise<string | null> {
  const c = cookieMap(req);
  if (!c.yd) return null;
  const h = sha(c.yd);
  const r = await sql`SELECT id_hash FROM y_devices WHERE id_hash = ${h} AND fam = ${FAM} AND revoked IS NULL`;
  return r.length ? h : null;
}

function deviceLabel(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  const kind = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet") : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows computer" : "Device";
  return kind;
}

/* Starts a session and makes sure this phone is a known device. Returns Set-Cookie headers. */
export async function startSession(req: Request, personId: string): Promise<string[]> {
  const cookies: string[] = [];
  let dev = await knownDevice(req);
  if (!dev) {
    const raw = token(24);
    dev = sha(raw);
    await sql`INSERT INTO y_devices (id_hash, fam, label, person) VALUES (${dev}, ${FAM}, ${deviceLabel(req)}, ${personId})`;
    cookies.push(setCookie("yd", raw));
  } else {
    await sql`UPDATE y_devices SET person = ${personId}, last_seen = now() WHERE id_hash = ${dev}`;
  }
  const t = token(32);
  await sql`INSERT INTO y_sessions (token_hash, fam, person, device) VALUES (${sha(t)}, ${FAM}, ${personId}, ${dev})`;
  cookies.push(setCookie("ys", t));
  return cookies;
}

export async function endSession(me: Me) {
  await sql`DELETE FROM y_sessions WHERE token_hash = ${me.session}`;
}

/* ---------- wrong-guess limits ---------- */
async function lockedFor(k: string): Promise<number> {
  const r = await sql`SELECT locked_until FROM y_attempts WHERE k = ${k}`;
  if (!r.length || !r[0].locked_until) return 0;
  const left = new Date(r[0].locked_until).getTime() - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}
async function fail(k: string, max: number, lockSecs: number) {
  const r = await sql`INSERT INTO y_attempts (k, fails, updated) VALUES (${k}, 1, now())
    ON CONFLICT (k) DO UPDATE SET fails = CASE WHEN y_attempts.updated < now() - interval '1 hour' THEN 1 ELSE y_attempts.fails + 1 END, updated = now()
    RETURNING fails`;
  const n = Number(r[0].fails);
  if (n >= max) await sql`UPDATE y_attempts SET locked_until = now() + make_interval(secs => ${lockSecs}), fails = 0 WHERE k = ${k}`;
  return max - n;
}
const clearFails = (k: string) => sql`DELETE FROM y_attempts WHERE k = ${k}`;

export function ipOf(req: Request, server: any) {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",").pop()!.trim();
  try { return server?.requestIP(req)?.address || "?"; } catch { return "?"; }
}

export type CodeResult = { ok: true; person: Person } | { ok: false; error: string; wait?: number; left?: number };

/* Kids sign in on known devices by tapping their picture. Parents can sign in anywhere with their code. */
export async function checkCode(personId: string | null, code: string, ip: string, device: string | null): Promise<CodeResult> {
  const all = await people();
  const candidates = personId ? all.filter(p => p.id === personId) : all.filter(p => p.role === "parent");
  if (!candidates.length) return { ok: false, error: "not_found" };
  const parent = candidates[0].role === "parent";
  if (!parent && !device) return { ok: false, error: "unknown_device" };
  const lockKeys = parent ? [`ip:${ip}:parent`, `parent:${FAM}`] : [`dev:${device}:${personId}`];
  for (const k of lockKeys) { const w = await lockedFor(k); if (w) return { ok: false, error: "locked", wait: w }; }
  if (!/^\d{4,6}$/.test(code)) return { ok: false, error: "bad_code" };
  const rows = await sql`SELECT id, code_hash FROM y_people WHERE fam = ${FAM} AND id IN ${sql(candidates.map(c => c.id))} AND code_hash IS NOT NULL`;
  if (!rows.length) return { ok: false, error: "no_code" };
  for (const r of rows) {
    if (await Bun.password.verify(code, r.code_hash)) {
      for (const k of lockKeys) await clearFails(k);
      return { ok: true, person: all.find(p => p.id === r.id)! };
    }
  }
  let left = 5;
  if (parent) { left = await fail(lockKeys[0], 5, 15 * 60); await fail(lockKeys[1], 12, 60 * 60); }
  else left = await fail(lockKeys[0], 5, 5 * 60);
  return { ok: false, error: "wrong", left: Math.max(0, left) };
}

export async function setCode(personId: string, code: string | null) {
  const hash = code ? await Bun.password.hash(code, { algorithm: "bcrypt", cost: 10 }) : null;
  await sql`UPDATE y_people SET code_hash = ${hash}, code_set = ${code ? new Date() : null} WHERE fam = ${FAM} AND id = ${personId}`;
}

/* ---------- Add a phone ---------- */
export async function makePairCode(personId: string, minutes = 10) {
  await sql`DELETE FROM y_pairing WHERE expires < now() - interval '1 day'`;
  await sql`UPDATE y_pairing SET expires = now() WHERE fam = ${FAM} AND person = ${personId} AND used IS NULL AND expires > now()`;
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, b => PAIR_ALPHABET[b % PAIR_ALPHABET.length]).join("");
  await sql`INSERT INTO y_pairing (code, fam, person, expires) VALUES (${code}, ${FAM}, ${personId}, now() + make_interval(mins => ${Math.max(1, Math.min(24 * 60, Math.round(minutes)))}))`;
  return code;
}

export async function claimPairCode(raw: string, ip: string): Promise<{ ok: true; person: string } | { ok: false; error: string; wait?: number }> {
  const k = `ip:${ip}:pair`, all = `pair:${FAM}`;
  for (const key of [k, all]) { const w = await lockedFor(key); if (w) return { ok: false, error: "locked", wait: w }; }
  const code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) return { ok: false, error: "bad_code" };
  const r = await sql`UPDATE y_pairing SET used = now() WHERE code = ${code} AND fam = ${FAM} AND used IS NULL AND expires > now() RETURNING person`;
  if (!r.length) { await fail(k, 8, 15 * 60); await fail(all, 40, 15 * 60); return { ok: false, error: "wrong" }; }
  await clearFails(k);
  return { ok: true, person: r[0].person };
}

export async function devicesList() {
  const r = await sql`SELECT d.id_hash, d.label, d.person, d.created, d.last_seen,
      (SELECT count(*) FROM y_sessions s WHERE s.device = d.id_hash) AS sessions
    FROM y_devices d WHERE d.fam = ${FAM} AND d.revoked IS NULL ORDER BY d.last_seen DESC`;
  return r.map((x: any) => ({ id: x.id_hash.slice(0, 16), label: x.label, person: x.person, created: x.created, lastSeen: x.last_seen, signedIn: Number(x.sessions) > 0 }));
}

/* Signs a phone out and forgets it, so it needs a new "Add a phone" code. */
export async function forgetDevice(shortId: string) {
  if (!/^[0-9a-f]{16}$/.test(shortId)) return false;
  const r = await sql`UPDATE y_devices SET revoked = now() WHERE fam = ${FAM} AND left(id_hash, 16) = ${shortId} AND revoked IS NULL RETURNING id_hash`;
  for (const x of r) { await sql`DELETE FROM y_sessions WHERE device = ${x.id_hash}`; await sql`DELETE FROM y_push WHERE device = ${x.id_hash}`; }
  return r.length > 0;
}

export async function setupNeeded() {
  const r = await sql`SELECT count(*) AS n FROM y_people WHERE fam = ${FAM} AND role = 'parent' AND code_hash IS NOT NULL`;
  return Number(r[0].n) === 0;
}

export async function setupToken() {
  return process.env.SETUP_TOKEN || (await meta("setup_token"));
}
export async function ensureSetupToken() {
  if (process.env.SETUP_TOKEN) return;
  if (!(await meta("setup_token"))) await setMeta("setup_token", token(18));
}
