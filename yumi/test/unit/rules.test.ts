import { describe, expect, test } from "bun:test";
import { readPath, canRead, checkWrite } from "../../src/rules";

const kids = new Set(["ana", "bea"]);
const me = (id: string, role: "parent" | "kid") => ({ me: { id, role, name: id, hasCode: true, sort: 0, session: "s", device: null } as any, kids });
const dad = me("pa", "parent"), ana = me("ana", "kid"), bea = me("bea", "kid");

describe("who reads what", () => {
  test("a girl never receives her sister's room", () => {
    expect(readPath(ana, "kids/bea/log/1")).toBe("no");
    expect(readPath(ana, "kids/bea/journal/1")).toBe("no");
    expect(readPath(ana, "kids/ana/log/1")).toBe("yes");
  });
  test("journal pages reach a parent only when shared", () => {
    expect(readPath(dad, "kids/ana/journal/1")).toBe("cond");
    expect(canRead(dad, "kids/ana/journal/1", { body: "x", shared: false })).toBe(false);
    expect(canRead(dad, "kids/ana/journal/1", { body: "x", shared: true })).toBe(true);
    expect(canRead(ana, "kids/ana/journal/1", { body: "x" })).toBe(true);
  });
  test("parent-only areas stay parent-only", () => {
    expect(readPath(ana, "inbox/1")).toBe("no");
    expect(readPath(ana, "dad/money/1")).toBe("no");
    expect(canRead(ana, "notes/1", { priv: true })).toBe(false);
    expect(canRead(ana, "notes/1", { priv: false })).toBe(true);
  });
});

describe("who writes what", () => {
  test("stars only move through the server's rules", () => {
    expect(checkWrite(ana, { path: "kids/ana/log/x", set: { type: "star", n: 50 } }, null).ok).toBe(false);
    expect(checkWrite(dad, { path: "kids/ana/log/x", set: { type: "star", n: 1 } }, null).ok).toBe(false);
    expect(checkWrite(ana, { path: "pub/ana", set: { stars: 99 } }, null).ok).toBe(false);
    expect(checkWrite(ana, { path: "taskDone/t@once@ana", set: {} }, null).ok).toBe(false);
  });
  test("only she can write her journal, and Dad can't", () => {
    expect(checkWrite(ana, { path: "kids/ana/journal/p", set: { body: "hi" } }, null).ok).toBe(true);
    expect(checkWrite(bea, { path: "kids/ana/journal/p", set: { body: "hi" } }, null).ok).toBe(false);
    expect(checkWrite(dad, { path: "kids/ana/journal/p", set: { body: "hi" } }, null).ok).toBe(false);
  });
  test("my week picks are hers alone", () => {
    expect(checkWrite(ana, { path: "kids/ana/week/2026-10-16", set: { place: "dad" } }, null).ok).toBe(true);
    expect(checkWrite(dad, { path: "kids/ana/week/2026-10-16", set: { place: "mum" } }, null).ok).toBe(false);
    expect(checkWrite(ana, { path: "kids/ana/week/not-a-date", set: { place: "dad" } }, null).ok).toBe(false);
  });
  test("kids can't give themselves job stars or post as someone else", () => {
    const r = checkWrite(ana, { path: "tasks/t1", set: { t: "Tidy", stars: 5 } }, null);
    expect(r.ok && (r as any).data.stars).toBe(0);
    expect(checkWrite(ana, { path: "feed/f1", set: { kid: "bea", text: "hi" } }, null).ok).toBe(false);
    expect(checkWrite(ana, { path: "feed/f1", set: { kid: "ana", text: "hi" } }, null).ok).toBe(true);
  });
  test("a girl can only change her own look", () => {
    expect(checkWrite(ana, { path: "people/ana", merge: { buddy: "luna" } }, { name: "Ana" }).ok).toBe(true);
    expect(checkWrite(ana, { path: "people/ana", merge: { role: "parent" } }, { name: "Ana" }).ok).toBe(false);
    expect(checkWrite(ana, { path: "people/bea", merge: { buddy: "luna" } }, { name: "Bea" }).ok).toBe(false);
  });
  test("a diary is read and written by its writer only", () => {
    const mum = me("ma", "parent");
    expect(readPath(dad, "diary/pa/n1")).toBe("yes");
    expect(readPath(ana, "diary/pa/n1")).toBe("no");
    expect(readPath(mum, "diary/pa/n1")).toBe("no");
    expect(checkWrite(dad, { path: "diary/pa/n1", set: { text: "Big day" } }, null).ok).toBe(true);
    expect(checkWrite(mum, { path: "diary/pa/n1", set: { text: "x" } }, null).ok).toBe(false);
    expect(checkWrite(ana, { path: "diary/pa/n1", del: true }, { text: "Big day" }).ok).toBe(false);
    expect(checkWrite(dad, { path: "diary/pa/sub/n1", set: { text: "x" } }, null).ok).toBe(false);
  });
  test("game progress: everyone sees it, only you move yours", () => {
    expect(readPath(bea, "play/ana/katseye")).toBe("yes");
    expect(checkWrite(ana, { path: "play/ana/katseye", set: { found: {} } }, null).ok).toBe(true);
    expect(checkWrite(bea, { path: "play/ana/katseye", set: { found: {} } }, null).ok).toBe(false);
    expect(checkWrite(dad, { path: "play/ana/katseye", set: { found: {} } }, null).ok).toBe(false);
  });
  test("an HQ is its owner's alone: not the girls, not another parent", () => {
    const mum = me("ma", "parent");
    expect(readPath(dad, "hq/pa/tasks/t1")).toBe("yes");
    expect(readPath(mum, "hq/pa/tasks/t1")).toBe("no");
    expect(readPath(ana, "hq/pa/txns/x")).toBe("no");
    expect(readPath(ana, "hq/ana/tasks/t1")).toBe("no");
    expect(checkWrite(dad, { path: "hq/pa/tasks/t1", set: { title: "Pick the price", pri: "now" } }, null).ok).toBe(true);
    expect(checkWrite(mum, { path: "hq/pa/tasks/t1", set: { title: "x" } }, null).ok).toBe(false);
    expect(checkWrite(ana, { path: "hq/ana/tasks/t1", set: { title: "x" } }, null).ok).toBe(false);
    expect(checkWrite(dad, { path: "hq/pa/secrets/t1", set: { title: "x" } }, null).ok).toBe(false);
    expect(checkWrite(dad, { path: "hq/pa/tasks/sub/t1", set: { title: "x" } }, null).ok).toBe(false);
  });
  test("HQ to-dos need a title and a real priority; money needs an amount", () => {
    expect(checkWrite(dad, { path: "hq/pa/tasks/t1", set: { title: "  " } }, null).ok).toBe(false);
    const r = checkWrite(dad, { path: "hq/pa/tasks/t1", set: { title: "Call the bank", pri: "urgent!!", done: "yes" } }, null) as any;
    expect(r.ok && r.data.pri).toBe("next");
    expect(r.data.done).toBe(false);
    expect(checkWrite(dad, { path: "hq/pa/txns/x", set: { note: "Coles" } }, null).ok).toBe(false);
    expect(checkWrite(dad, { path: "hq/pa/txns/x", set: { note: "Coles", amount: -42.5, date: "2026-10-24" } }, null).ok).toBe(true);
  });
  test("her friends: she and a parent can change them, her sister can't even see them", () => {
    expect(readPath(ana, "kids/ana/friends/f1")).toBe("yes");
    expect(readPath(dad, "kids/ana/friends/f1")).toBe("yes");
    expect(readPath(bea, "kids/ana/friends/f1")).toBe("no");
    expect(checkWrite(ana, { path: "kids/ana/friends/f1", set: { name: "Mia", e: "🦄" } }, null).ok).toBe(true);
    expect(checkWrite(dad, { path: "kids/ana/friends/f1", set: { name: "Mia" } }, null).ok).toBe(true);
    expect(checkWrite(bea, { path: "kids/ana/friends/f1", set: { name: "Mia" } }, null).ok).toBe(false);
    expect(checkWrite(ana, { path: "kids/ana/friends/f1", set: { name: "   " } }, null).ok).toBe(false);
  });
  test("settings and houses are a parent's call", () => {
    expect(checkWrite(ana, { path: "stays/2026-10-16", set: { home: "mum" } }, null).ok).toBe(false);
    expect(checkWrite(dad, { path: "stays/2026-10-16", set: { home: "mum" } }, null).ok).toBe(true);
  });
});
