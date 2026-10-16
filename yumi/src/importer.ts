import { gunzipSync } from "bun";
import { sql, FAM, insertDocIfMissing, meta, setMeta, getDoc } from "./db";
import { sha } from "./auth";

/* One-time move of the family's data.
   The data never goes in GitHub: it arrives as a private Railway variable (YUMI_IMPORT, split into
   YUMI_IMPORT_2, _3... if long), gzipped JSON in base64. Each import runs once (by its hash) and
   only fills empty spots, so it can't overwrite anything the family has changed since.
   Delete the variables once the app shows everything. */

type Payload = {
  family?: { name?: string };
  people?: { id: string; name: string; role: "parent" | "kid"; sort?: number; profile?: any }[];
  docs?: Record<string, any>;
  art?: Record<string, string>;
};

function readVar(): string | null {
  const parts: string[] = [];
  const first = process.env.YUMI_IMPORT;
  if (!first) return null;
  parts.push(first);
  for (let i = 2; i < 100; i++) { const v = process.env["YUMI_IMPORT_" + i]; if (!v) break; parts.push(v); }
  const all = parts.join("");
  return all.trimStart().startsWith("{") ? all : all.replace(/\s+/g, "");
}

/* Plain JSON or gzipped base64 JSON. */
const decode = (raw: string) => raw.trimStart().startsWith("{") ? raw : new TextDecoder().decode(gunzipSync(Buffer.from(raw.replace(/\s+/g, ""), "base64")));

/* A short fingerprint per collection, logged after an import so it can be checked against the source. */
const canon = (v: any): string => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]"
  : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v);
function fingerprints(docs: Record<string, any>) {
  const groups: Record<string, string[]> = {};
  for (const path of Object.keys(docs).sort()) {
    const g = path.split("/").slice(0, -1).join("/");
    (groups[g] ||= []).push(JSON.stringify(path) + ":" + canon(docs[path]));
  }
  return Object.entries(groups).map(([g, rows]) => `${g}=${sha(rows.join("\n")).slice(0, 8)}`).join(" ");
}

/* Reads a payload sent straight to the server (gzipped JSON in base64, or plain JSON). */
export async function importFromBody(raw: string, log = console.log) {
  const text = decode(raw);
  const hash = sha(text).slice(0, 16);
  if (await meta("import:" + hash)) return { hash, already: true };
  await applyPayload(JSON.parse(text), log);
  await setMeta("import:" + hash, new Date().toISOString());
  await mergeCrewStars(log);
  return { hash, already: false };
}

export async function runImport(log = console.log) {
  const raw = readVar();
  if (raw) {
    const hash = sha(raw).slice(0, 16);
    if (await meta("import:" + hash)) log(`import ${hash}: already done`);
    else {
      let p: Payload;
      try { p = JSON.parse(decode(raw)); }
      catch (e) { log("import: could not read YUMI_IMPORT", String(e)); return; }
      await applyPayload(p, log);
      await setMeta("import:" + hash, new Date().toISOString());
      log(`import ${hash}: done`);
    }
  }
  await mergeCrewStars(log);
}

export async function applyPayload(p: Payload, log = console.log) {
  if (p.family?.name) await sql`INSERT INTO y_family (id, name) VALUES (${FAM}, ${p.family.name}) ON CONFLICT (id) DO NOTHING`;
  let people = 0, docs = 0, art = 0;
  for (const [i, x] of (p.people || []).entries()) {
    if (!/^[a-z0-9_-]{1,30}$/.test(x.id) || !["parent", "kid"].includes(x.role)) continue;
    const r = await sql`INSERT INTO y_people (fam, id, name, role, sort) VALUES (${FAM}, ${x.id}, ${x.name}, ${x.role}, ${x.sort ?? i}) ON CONFLICT (fam, id) DO NOTHING RETURNING id`;
    people += r.length;
    if (x.profile) await insertDocIfMissing("people/" + x.id, { name: x.name, role: x.role, ...x.profile });
  }
  for (const [path, data] of Object.entries(p.docs || {})) if (await insertDocIfMissing(path, data)) docs++;
  for (const [k, uri] of Object.entries(p.art || {})) {
    const m = /^data:(image\/(?:webp|png|jpeg));base64,(.+)$/.exec(uri);
    if (!m || !/^[a-z0-9_-]{1,40}$/.test(k)) continue;
    await sql`INSERT INTO y_art (fam, k, mime, bytes) VALUES (${FAM}, ${k}, ${m[1]}, ${Buffer.from(m[2], "base64")}) ON CONFLICT (fam, k) DO NOTHING`;
    art++;
  }
  log(`import: ${people} people, ${docs} records, ${art} pictures added`);
  log(`import check: ${fingerprints(p.docs || {})}`);
}

/* Crew Stars (the earlier Railway app) kept its own star log in this same database.
   Copy anything it has that Yumi doesn't, matched by id, so no star is lost. */
async function mergeCrewStars(log = console.log) {
  if (await meta("crewstars:merged")) return;
  const t = await sql`SELECT to_regclass('public.star_log') AS t`;
  if (!t[0].t) return;
  const kids = (await sql`SELECT id FROM y_people WHERE fam = ${FAM} AND role = 'kid'`).map((x: any) => x.id);
  if (!kids.length) return;
  const rows = await sql`SELECT id, kid, type, n, reason, at FROM star_log`;
  let added = 0;
  for (const r of rows) {
    if (!kids.includes(r.kid) || !["star", "strike"].includes(r.type)) continue;
    const id = String(r.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    if (!id) continue;
    const path = `kids/${r.kid}/log/${id}`;
    if (await getDoc(path)) continue;
    const data: any = { type: r.type, reason: r.reason || "", at: new Date(r.at).toISOString(), from: "crew-stars" };
    if (r.type === "star") data.n = Number(r.n) || 1;
    if (await insertDocIfMissing(path, data, "crew-stars")) added++;
  }
  await setMeta("crewstars:merged", JSON.stringify({ at: new Date().toISOString(), rows: rows.length, added }));
  log(`crew-stars: ${rows.length} rows checked, ${added} added`);
}
