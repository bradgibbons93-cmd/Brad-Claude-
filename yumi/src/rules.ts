import type { Me } from "./auth";

/* Who can read and write what. The server sends each phone only what its person may read,
   so a girl's phone never even receives her sister's room, and nobody but the writer receives a
   journal page unless she has shared it. */

export type Read = "yes" | "no" | "cond";

type Ctx = { me: Me; kids: Set<string> };

const isParent = (c: Ctx) => c.me.role === "parent";

/* Field limits for anything a kid writes. Parents get the same limits; it keeps rows small. */
const MAX_DOC_BYTES = 12000;

export function readPath(c: Ctx, path: string): Read {
  const p = path.split("/");
  switch (p[0]) {
    case "settings": case "people": case "feed": case "comments": case "events": case "stays":
    case "tasks": case "taskDone": case "album": case "pub":
      return "yes";
    case "notes": return isParent(c) ? "yes" : "cond";
    case "inbox": case "dad": return isParent(c) ? "yes" : "no";
    case "kids": {
      const k = p[1];
      if (!c.kids.has(k)) return "no";
      if (p.length === 2) return "yes";
      const col = p[2];
      if (col === "journal") return c.me.id === k ? "yes" : isParent(c) ? "cond" : "no";
      return c.me.id === k || isParent(c) ? "yes" : "no";
    }
  }
  return "no";
}

export function canRead(c: Ctx, path: string, data: any): boolean {
  const r = readPath(c, path);
  if (r !== "cond") return r === "yes";
  const p = path.split("/");
  if (p[0] === "notes") return !!data && !data.priv;
  if (p[0] === "kids" && p[2] === "journal") return !!data && data.shared === true;
  return false;
}

const KID_PROFILE_FIELDS = new Set(["buddy", "theme", "accent", "journalTitle", "journalColor", "journalStickers", "seenPrincipal", "seenIntro"]);

export type WriteOp = { path: string; set?: any; merge?: any; del?: boolean };
export type Check = { ok: true; data?: any } | { ok: false; why: string };

const ok = (data?: any): Check => ({ ok: true, data });
const no = (why: string): Check => ({ ok: false, why });

function clean(v: any, depth = 0): any {
  if (v === null || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return v.slice(0, 4000);
  if (depth > 4) return null;
  if (Array.isArray(v)) return v.slice(0, 60).map(x => clean(x, depth + 1));
  if (typeof v === "object") {
    const o: any = {};
    for (const [k, x] of Object.entries(v).slice(0, 60)) if (/^[A-Za-z0-9_]{1,40}$/.test(k)) o[k] = clean(x, depth + 1);
    return o;
  }
  return null;
}

/* Decides one write. `old` is the current doc (or null). Returns the data to store. */
export function checkWrite(c: Ctx, op: WriteOp, old: any): Check {
  const p = op.path.split("/");
  const me = c.me.id, parent = isParent(c);
  const next = op.del ? null : clean(op.merge ? { ...(old || {}), ...op.merge } : op.set);
  if (!op.del && (next === null || typeof next !== "object" || Array.isArray(next))) return no("bad_data");
  if (next && JSON.stringify(next).length > MAX_DOC_BYTES) return no("too_big");
  const creating = !old;
  const stamp = (d: any) => (d && creating ? { ...d, at: d.at || new Date().toISOString() } : d);

  switch (p[0]) {
    case "settings": case "stays": case "album":
      return parent && p.length === 2 ? ok(next) : no("parent_only");
    case "people": {
      if (p.length !== 2 || !old) return parent && p.length === 2 && !op.del ? ok(next) : no("parent_only");
      if (parent) return op.del ? no("cannot_delete_person") : ok(next);
      if (p[1] !== me || op.del || !op.merge) return no("own_profile_only");
      for (const k of Object.keys(op.merge)) if (!KID_PROFILE_FIELDS.has(k)) return no("field_" + k);
      return ok(next);
    }
    case "feed": {
      if (p.length !== 2) return no("bad_path");
      if (op.del) return parent || old?.kid === me ? ok() : no("not_yours");
      if (!creating) return no("use_actions");
      if (next.kid !== me) return no("must_be_you");
      delete next.hearts; delete next.dadHeart;
      if (typeof next.text === "string") next.text = next.text.slice(0, 280);
      return ok(stamp(next));
    }
    case "comments": {
      if (p.length !== 2) return no("bad_path");
      if (op.del) return parent || old?.who === me ? ok() : no("not_yours");
      if (!creating) return no("no_edits");
      if (next.who !== me) return no("must_be_you");
      next.text = String(next.text || "").slice(0, 240);
      return ok(stamp(next));
    }
    case "events": case "tasks": {
      if (p.length !== 2) return no("bad_path");
      if (op.del) return parent || old?.by === me ? ok() : no("not_yours");
      if (!creating && !parent && old?.by !== me) return no("not_yours");
      if (creating) next.by = me;
      if (p[0] === "tasks" && !parent) next.stars = creating ? 0 : old?.stars || 0;
      return ok(stamp(next));
    }
    case "notes": case "dad":
      return parent ? ok(op.del ? undefined : stamp(next && { ...next, by: next.by || me })) : no("parent_only");
    case "inbox":
      if (!parent) return no("parent_only");
      if (op.del) return ok();
      if (creating) return no("server_only");
      return ok(next);
    case "taskDone": case "pub":
      return no("use_actions");
    case "kids": {
      const k = p[1], col = p[2];
      if (!c.kids.has(k) || p.length !== 4) return no("bad_path");
      const own = me === k;
      switch (col) {
        case "routine": case "plans": case "wishlist":
          return own || parent ? ok(op.del ? undefined : stamp(next)) : no("not_yours");
        case "journal":
          if (!own) return no("journal_is_private");
          if (next) { next.shared = next.shared === true; next.body = String(next.body || "").slice(0, 4000); }
          return ok(op.del ? undefined : stamp(next));
        case "week":
          if (!own) return no("only_she_picks");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(p[3])) return no("bad_date");
          return ok(op.del ? undefined : stamp(next));
        case "vault":
          return parent ? ok(op.del ? undefined : stamp(next)) : no("parent_only");
        default:
          return no("use_actions");
      }
    }
  }
  return no("bad_path");
}
