import type { Me } from "./auth";

/* Who can read and write what. The server sends each phone only what its person may read,
   so a girl's phone never even receives her sister's room, and nobody but the writer receives a
   journal page unless she has shared it. */

export type Read = "yes" | "no" | "cond";

type Ctx = { me: Me; kids: Set<string> };

const isParent = (c: Ctx) => c.me.role === "parent";

/* A parent's own HQ (to-dos, money, subscriptions), at hq/<person>/<collection>/<id>. */
export const HQ_COLS = new Set(["tasks", "txns", "subs", "rules", "settings"]);
const PRIS = new Set(["now", "next", "later"]);
const TOGETHER_FEELS = new Set(["great", "good", "okay", "hard", "awful", "none"]);

/* Field limits for anything a kid writes. Parents get the same limits; it keeps rows small. */
const MAX_DOC_BYTES = 12000;

export function readPath(c: Ctx, path: string): Read {
  const p = path.split("/");
  switch (p[0]) {
    case "settings": case "people": case "feed": case "comments": case "events": case "stays":
    case "tasks": case "taskDone": case "album": case "pub": case "play":
      return "yes";
    /* A diary is its writer's alone: not the girls, not another parent, not a backup made by anyone else. */
    case "diary": return p[1] === c.me.id ? "yes" : "no";
    /* So is an HQ: not the girls, and not another parent either, since it holds work and money. */
    case "hq": return p[1] === c.me.id && isParent(c) ? "yes" : "no";
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

const KID_PROFILE_FIELDS = new Set(["buddy", "theme", "accent", "journalTitle", "journalColor", "journalStickers", "seenPrincipal", "seenIntro", "remind"]);

export type WriteOp = { path: string; set?: any; merge?: any; del?: boolean };
export type Check = { ok: true; data?: any } | { ok: false; why: string };

const ok = (data?: any): Check => ({ ok: true, data });
const no = (why: string): Check => ({ ok: false, why });

export function clean(v: any, depth = 0): any {
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
    case "diary":
      if (p.length !== 3 || p[1] !== me) return no("diary_is_private");
      if (next) next.text = String(next.text || "").slice(0, 4000);
      return ok(op.del ? undefined : stamp(next));
    case "hq":
      if (!parent || p.length !== 4 || p[1] !== me || !HQ_COLS.has(p[2])) return no("hq_is_private");
      if (next && p[2] === "tasks") {
        next.title = String(next.title || "").slice(0, 300);
        if (!next.title.trim()) return no("needs_a_title");
        if (!PRIS.has(next.pri)) next.pri = "next";
        next.done = next.done === true;
      }
      if (next && p[2] === "txns" && !Number.isFinite(next.amount)) return no("needs_an_amount");
      return ok(op.del ? undefined : stamp(next));
    /* Game progress: everyone can see how far the others got, only you can move your own. */
    case "play":
      if (p.length !== 3 || p[1] !== me) return no("not_yours");
      return ok(op.del ? undefined : stamp(next));
    case "taskDone": case "pub":
      return no("use_actions");
    case "kids": {
      const k = p[1], col = p[2];
      if (!c.kids.has(k) || p.length !== 4) return no("bad_path");
      const own = me === k;
      switch (col) {
        case "routine": case "plans": case "wishlist":
          return own || parent ? ok(op.del ? undefined : stamp(next)) : no("not_yours");
        /* Her friends: she and a parent can add or change them; her sister never even receives them. */
        case "friends":
          if (!own && !parent) return no("not_yours");
          if (next) { next.name = String(next.name || "").trim().slice(0, 40); if (!next.name) return no("needs_a_name"); }
          return ok(op.del ? undefined : stamp(next));
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
        /* Good & hard days: her own words about a day, so only she writes them. Dad reads; her sister can't. */
        case "together":
          if (!own) return no("only_she_checks_in");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(p[3])) return no("bad_date");
          if (next) {
            if (!TOGETHER_FEELS.has(next.feel)) return no("bad_feel");
            next.tags = Array.isArray(next.tags) ? next.tags.filter((t: any) => typeof t === "string" && t.trim()).map((t: string) => t.slice(0, 30)).slice(0, 8) : [];
            next.note = String(next.note || "").slice(0, 300);
            next.talk = next.talk === true;
          }
          return ok(op.del ? undefined : stamp(next));
        default:
          return no("use_actions");
      }
    }
  }
  return no("bad_path");
}
