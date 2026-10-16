import { SQL } from "bun";

/* One Postgres for everything. Every table is prefixed y_ so it can sit
   next to anything else already in the database. Every row carries a
   family id, so more families can be added later without a new schema. */

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export const sql = new SQL(url);
export const FAM = process.env.YUMI_FAMILY_ID || "main";

export type Doc = { path: string; data: any; seq: number; deleted: boolean; by?: string | null; updated?: string };

export async function migrate() {
  await sql`CREATE SEQUENCE IF NOT EXISTS y_seq`;
  await sql`CREATE TABLE IF NOT EXISTS y_meta (fam text NOT NULL, k text NOT NULL, v text, PRIMARY KEY (fam, k))`;
  await sql`CREATE TABLE IF NOT EXISTS y_family (id text PRIMARY KEY, name text NOT NULL, created timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS y_people (
    fam text NOT NULL, id text NOT NULL, name text NOT NULL, role text NOT NULL,
    code_hash text, code_set timestamptz, sort int NOT NULL DEFAULT 0,
    PRIMARY KEY (fam, id))`;
  await sql`CREATE TABLE IF NOT EXISTS y_devices (
    id_hash text PRIMARY KEY, fam text NOT NULL, label text, person text,
    created timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(), revoked timestamptz)`;
  await sql`CREATE TABLE IF NOT EXISTS y_sessions (
    token_hash text PRIMARY KEY, fam text NOT NULL, person text NOT NULL, device text,
    created timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS y_pairing (
    code text PRIMARY KEY, fam text NOT NULL, person text NOT NULL,
    created timestamptz NOT NULL DEFAULT now(), expires timestamptz NOT NULL, used timestamptz)`;
  await sql`CREATE TABLE IF NOT EXISTS y_attempts (k text PRIMARY KEY, fails int NOT NULL DEFAULT 0, locked_until timestamptz, updated timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS y_docs (
    fam text NOT NULL, path text NOT NULL, parent text NOT NULL, data jsonb,
    seq bigint NOT NULL, deleted boolean NOT NULL DEFAULT false, by_person text,
    updated timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (fam, path))`;
  await sql`CREATE INDEX IF NOT EXISTS y_docs_seq ON y_docs (fam, seq)`;
  await sql`CREATE INDEX IF NOT EXISTS y_docs_parent ON y_docs (fam, parent) WHERE NOT deleted`;
  await sql`CREATE TABLE IF NOT EXISTS y_art (fam text NOT NULL, k text NOT NULL, mime text NOT NULL, bytes bytea NOT NULL, PRIMARY KEY (fam, k))`;
  await sql`CREATE TABLE IF NOT EXISTS y_push (
    endpoint text PRIMARY KEY, fam text NOT NULL, person text NOT NULL, device text, p256dh text NOT NULL, auth text NOT NULL,
    created timestamptz NOT NULL DEFAULT now(), last_ok timestamptz, fails int NOT NULL DEFAULT 0)`;
}

export const parentOf = (path: string) => path.split("/").slice(0, -1).join("/");
export const idOf = (path: string) => path.split("/").pop() || "";

/* Paths are plain ids separated by slashes. Anything else is refused,
   so a path can never be used to reach outside its collection. */
export function validPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length > 200) return false;
  const parts = path.split("/");
  if (parts.length < 2) return false;
  return parts.every(p => /^[A-Za-z0-9_@~.-]{1,80}$/.test(p) && p !== "." && p !== "..");
}

export async function getDoc(path: string): Promise<any | null> {
  const r = await sql`SELECT data FROM y_docs WHERE fam = ${FAM} AND path = ${path} AND NOT deleted`;
  return r.length ? r[0].data : null;
}

export async function listDocs(parent: string): Promise<{ id: string; path: string; data: any }[]> {
  const r = await sql`SELECT path, data FROM y_docs WHERE fam = ${FAM} AND parent = ${parent} AND NOT deleted`;
  return r.map((x: any) => ({ id: idOf(x.path), path: x.path, data: x.data }));
}

/* Writes bump a single sequence so every phone can ask "what changed since N". */
export async function putDoc(path: string, data: any, by: string | null = null, tx: any = sql) {
  const r = await tx`INSERT INTO y_docs (fam, path, parent, data, seq, deleted, by_person, updated)
    VALUES (${FAM}, ${path}, ${parentOf(path)}, ${data}, nextval('y_seq'), false, ${by}, now())
    ON CONFLICT (fam, path) DO UPDATE SET data = EXCLUDED.data, seq = EXCLUDED.seq, deleted = false, by_person = EXCLUDED.by_person, updated = now()
    RETURNING seq`;
  bump();
  return Number(r[0].seq);
}

export async function delDoc(path: string, by: string | null = null, tx: any = sql) {
  const r = await tx`UPDATE y_docs SET deleted = true, data = NULL, seq = nextval('y_seq'), by_person = ${by}, updated = now()
    WHERE fam = ${FAM} AND path = ${path} AND NOT deleted RETURNING seq`;
  if (r.length) bump();
  return r.length ? Number(r[0].seq) : 0;
}

/* Insert only if nothing (live or deleted) is there yet. Used by the import so it never overwrites. */
export async function insertDocIfMissing(path: string, data: any, by: string | null = "import") {
  const r = await sql`INSERT INTO y_docs (fam, path, parent, data, seq, deleted, by_person)
    VALUES (${FAM}, ${path}, ${parentOf(path)}, ${data}, nextval('y_seq'), false, ${by})
    ON CONFLICT (fam, path) DO NOTHING RETURNING seq`;
  return r.length > 0;
}

export async function changesSince(since: number, limit = 1500) {
  const r = await sql`SELECT path, data, seq, deleted FROM y_docs WHERE fam = ${FAM} AND seq > ${since} ORDER BY seq LIMIT ${limit}`;
  return r.map((x: any) => ({ path: x.path, data: x.data, seq: Number(x.seq), deleted: x.deleted })) as Doc[];
}

export async function currentSeq() {
  const r = await sql`SELECT coalesce(max(seq), 0) AS s FROM y_docs WHERE fam = ${FAM}`;
  return Number(r[0].s);
}

export async function meta(k: string): Promise<string | null> {
  const r = await sql`SELECT v FROM y_meta WHERE fam = ${FAM} AND k = ${k}`;
  return r.length ? r[0].v : null;
}
export async function setMeta(k: string, v: string) {
  await sql`INSERT INTO y_meta (fam, k, v) VALUES (${FAM}, ${k}, ${v}) ON CONFLICT (fam, k) DO UPDATE SET v = EXCLUDED.v`;
}

/* Long-poll wake-ups. One server instance, so an in-memory list is enough. */
const waiters = new Set<() => void>();
export function bump() { for (const w of [...waiters]) w(); }
export function waitForChange(ms: number, signal?: AbortSignal) {
  return new Promise<void>(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; waiters.delete(finish); clearTimeout(t); resolve(); };
    const t = setTimeout(finish, ms);
    waiters.add(finish);
    signal?.addEventListener("abort", finish, { once: true });
  });
}
