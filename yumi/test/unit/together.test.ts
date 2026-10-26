import { describe, expect, test } from "bun:test";
import { series, weeks, summary, verdict } from "../../public/js/togethermath.js";
import { readPath, checkWrite } from "../../src/rules";

const kids = new Set(["ana", "bea"]);
const me = (id: string, role: "parent" | "kid") => ({ me: { id, role, name: id, hasCode: true, sort: 0, session: "s", device: null } as any, kids });
const dad = me("pa", "parent"), ana = me("ana", "kid"), bea = me("bea", "kid");

/* Days counted back from 26 Oct 2026: back(0) is the 26th, back(1) the 25th… */
const back = (n: number) => { const d = new Date(2026, 9, 26 - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const docs = (feels: (string | null)[]) => Object.fromEntries(feels.flatMap((f, i) => f ? [[back(i), { feel: f, tags: f === "hard" || f === "awful" ? ["Argument"] : f === "good" ? ["Played together"] : [] }]] : []));

describe("good & hard days: the sums", () => {
  test("a day row per date, oldest first, with blanks where she didn't check in", () => {
    const rows = series(docs(["good", null, "awful", "none"]), back(0), 5);
    expect(rows.map(r => r.day)).toEqual([back(4), back(3), back(2), back(1), back(0)]);
    expect(rows.map(r => r.v)).toEqual([null, null, -2, null, 1]);
    expect(rows[1].none).toBe(true);
  });
  test("weeks are seven-day blocks ending today, averaging only the days she checked in", () => {
    const rows = series(docs(["great", "hard", null, null, null, null, null, "good"]), back(0), 14);
    const w = weeks(rows);
    expect(w.length).toBe(2);
    expect(w[1]).toMatchObject({ from: back(6), to: back(0), n: 2, avg: 0.5 });
    expect(w[0]).toMatchObject({ from: back(13), to: back(7), n: 1, avg: 1 });
  });
  test("one big argument in a month of good days reads as mostly good, not as a reason to split", () => {
    const feels = Array.from({ length: 28 }, (_, i) => (i === 2 ? "awful" : i % 3 === 0 ? "good" : i % 5 === 0 ? "great" : null));
    const s = summary(series(docs(feels), back(0), 28));
    expect(s.hard).toBe(1);
    expect(s.good).toBeGreaterThan(5);
    expect(verdict(s).key).toBe("mostlyGood");
    expect(s.topHard).toEqual([["Argument", 1]]);
  });
  test("a bad week alone is not 'mostly hard': it needs more hard days than good across three weeks", () => {
    const badWeek = ["hard", "awful", "hard", "hard", "awful", "hard", null];
    const s = summary(series(docs(badWeek), back(0), 28));
    expect(s.hard).toBe(6);
    expect(s.weeksSeen).toBe(1);
    expect(verdict(s).key).not.toBe("mostlyHard");
  });
  test("hard days outnumbering good ones for weeks is called what it is", () => {
    const feels = Array.from({ length: 28 }, (_, i) => (i % 2 === 0 ? (i % 6 === 0 ? "good" : "hard") : null));
    const s = summary(series(docs(feels), back(0), 28));
    expect(s.hard).toBeGreaterThan(s.good);
    expect(s.weeksSeen).toBeGreaterThanOrEqual(3);
    const v = verdict(s);
    expect(v.key).toBe("mostlyHard");
    expect(v.dad).toContain("counsellor");
  });
  test("too few check-ins says so instead of guessing", () => {
    expect(verdict(summary(series(docs(["hard", "awful"]), back(0), 28))).key).toBe("start");
  });
  test("the trend compares the last fortnight with the one before", () => {
    const feels = Array.from({ length: 28 }, (_, i) => (i < 14 ? (i % 2 ? "good" : "great") : i % 2 ? "hard" : "okay"));
    expect(summary(series(docs(feels), back(0), 28)).trend).toBe("better");
    const worse = Array.from({ length: 28 }, (_, i) => (i < 14 ? "hard" : "good"));
    const s = summary(series(docs(worse), back(0), 28));
    expect(s.trend).toBe("harder");
    expect(s.hardRun).toBe(14);
  });
  test("'didn't see them' days count as neither good nor hard", () => {
    const s = summary(series(docs(["none", "none", "none", "good"]), back(0), 7));
    expect(s).toMatchObject({ checkins: 1, good: 1, hard: 0, none: 3 });
  });
});

describe("good & hard days: who can see and write", () => {
  test("hers and Dad's to read, never her sister's", () => {
    expect(readPath(ana, "kids/ana/together/2026-10-26")).toBe("yes");
    expect(readPath(dad, "kids/ana/together/2026-10-26")).toBe("yes");
    expect(readPath(bea, "kids/ana/together/2026-10-26")).toBe("no");
  });
  test("only she writes her own check-in, Dad included", () => {
    expect(checkWrite(ana, { path: "kids/ana/together/2026-10-26", set: { feel: "good", tags: ["Laughed a lot"] } }, null).ok).toBe(true);
    expect(checkWrite(dad, { path: "kids/ana/together/2026-10-26", set: { feel: "great" } }, null).ok).toBe(false);
    expect(checkWrite(bea, { path: "kids/ana/together/2026-10-26", set: { feel: "awful" } }, null).ok).toBe(false);
  });
  test("a real date and a real feeling, tidy tags and a short note", () => {
    expect(checkWrite(ana, { path: "kids/ana/together/yesterday", set: { feel: "good" } }, null).ok).toBe(false);
    expect(checkWrite(ana, { path: "kids/ana/together/2026-10-26", set: { feel: "furious" } }, null).ok).toBe(false);
    const r: any = checkWrite(ana, { path: "kids/ana/together/2026-10-26", set: { feel: "hard", tags: ["Argument", 7, "", "x".repeat(50)], note: "y".repeat(500), talk: "yes" } }, null);
    expect(r.ok).toBe(true);
    expect(r.data.tags).toEqual(["Argument", "x".repeat(30)]);
    expect(r.data.note.length).toBe(300);
    expect(r.data.talk).toBe(false);
  });
});
