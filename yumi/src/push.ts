import { sql, FAM, meta, setMeta } from "./db";

/* Lock-screen notifications (Web Push, RFC 8030/8291/8292), with no extra packages.
   - The server's VAPID key pair is made once and kept in y_meta.
   - Each phone that turns notifications on sends its subscription; it's stored against the person
     signed in on that phone and removed when that phone signs out.
   - Messages are encrypted for each phone (aes128gcm), so the push service can't read them.
   - Only the big push services are allowed as endpoints, so the server can't be pointed elsewhere. */

export type PushMsg = { title: string; body?: string; tag?: string; url?: string };

const te = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
const unb64u = (s: string) => new Uint8Array(Buffer.from(String(s || ""), "base64url"));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0; for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

const PUSH_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

let vapid: { pub: string; key: CryptoKey } | null = null;

export async function initPush() {
  let jwk = await meta("vapid");
  if (!jwk) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    jwk = JSON.stringify(await crypto.subtle.exportKey("jwk", kp.privateKey));
    await setMeta("vapid", jwk);
  }
  const j = JSON.parse(jwk);
  const key = await crypto.subtle.importKey("jwk", j, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  vapid = { pub: b64u(concat(new Uint8Array([4]), unb64u(j.x), unb64u(j.y))), key };
}
export const vapidPublic = () => vapid?.pub || null;

export function endpointOk(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    if (process.env.PUSH_TEST_HOST && u.host === process.env.PUSH_TEST_HOST) return true;
    return u.protocol === "https:" && PUSH_HOSTS.test(u.hostname);
  } catch { return false; }
}

const SUBJECT = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "mailto:yumi@example.com";
const jwts = new Map<string, { t: string; until: number }>();
async function vapidJwt(aud: string) {
  const c = jwts.get(aud);
  if (c && c.until > Date.now()) return c.t;
  const enc = (o: any) => b64u(te.encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapid!.key, te.encode(unsigned));
  const t = `${unsigned}.${b64u(sig)}`;
  jwts.set(aud, { t, until: Date.now() + 6 * 3600e3 });
  return t;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

/* RFC 8291: one aes128gcm record, keyed from an ECDH with the phone's key and its auth secret. */
export async function encrypt(payload: Uint8Array, p256dh: string, authSecret: string, fixed?: { keys: CryptoKeyPair; salt: Uint8Array }) {
  const ua = unb64u(p256dh), auth = unb64u(authSecret);
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const eph = fixed?.keys || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const as = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, secret, concat(te.encode("WebPush: info\0"), ua, as), 32);
  const salt = fixed?.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const head = new Uint8Array(21 + as.length);
  head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = as.length; head.set(as, 21);
  return concat(head, ct);
}

export async function subscribe(person: string, device: string | null, sub: any) {
  const endpoint = sub?.endpoint, p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
  if (!endpointOk(endpoint)) return false;
  const k = unb64u(p256dh), a = unb64u(auth);
  if (k.length !== 65 || k[0] !== 4 || a.length !== 16) return false;
  await sql`INSERT INTO y_push (endpoint, fam, person, device, p256dh, auth) VALUES (${endpoint}, ${FAM}, ${person}, ${device}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint) DO UPDATE SET fam = EXCLUDED.fam, person = EXCLUDED.person, device = EXCLUDED.device, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, fails = 0`;
  return true;
}
export const unsubscribe = (person: string, endpoint: string) => sql`DELETE FROM y_push WHERE fam = ${FAM} AND person = ${person} AND endpoint = ${endpoint}`;
export const forgetDevicePush = (device: string) => sql`DELETE FROM y_push WHERE device = ${device}`;
export async function hasPush(person: string) {
  const r = await sql`SELECT 1 FROM y_push WHERE fam = ${FAM} AND person = ${person} LIMIT 1`;
  return r.length > 0;
}

/* Sends to every phone of these people. Never throws: a notification is a nice extra. */
export async function notify(people: string[], msg: PushMsg) {
  try {
    if (!vapid || !people.length) return 0;
    const subs = await sql`SELECT endpoint, p256dh, auth FROM y_push WHERE fam = ${FAM} AND person IN ${sql([...new Set(people)])}`;
    const data = te.encode(JSON.stringify({ title: msg.title.slice(0, 80), body: (msg.body || "").slice(0, 180), tag: msg.tag || "", url: msg.url || "/" }));
    let sent = 0;
    await Promise.all(subs.map(async (s: any) => {
      try {
        const aud = new URL(s.endpoint).origin;
        const r = await fetch(s.endpoint, {
          method: "POST",
          headers: { TTL: "86400", Urgency: "high", "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", Authorization: `vapid t=${await vapidJwt(aud)}, k=${vapid!.pub}` },
          body: await encrypt(data, s.p256dh, s.auth),
          signal: AbortSignal.timeout(10_000),
        });
        if (r.status === 404 || r.status === 410) await sql`DELETE FROM y_push WHERE endpoint = ${s.endpoint}`;
        else if (!r.ok) {
          console.log(`push ${new URL(s.endpoint).hostname}: ${r.status} ${(await r.text().catch(() => "")).slice(0, 120)}`);
          await sql`UPDATE y_push SET fails = fails + 1 WHERE endpoint = ${s.endpoint}`;
          await sql`DELETE FROM y_push WHERE endpoint = ${s.endpoint} AND fails >= 20`;
        } else { sent++; await sql`UPDATE y_push SET fails = 0, last_ok = now() WHERE endpoint = ${s.endpoint}`; }
      } catch (e) { console.log("push failed", String(e).slice(0, 120)); }
    }));
    return sent;
  } catch (e) { console.error("notify", e); return 0; }
}
