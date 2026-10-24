import { describe, expect, test } from "bun:test";
import { openTasks, monthSummary, subsSummary, perMonth } from "../../public/js/hqmath.js";

describe("HQ sums", () => {
  test("to-dos come Now, Next, Later, then by rank, done ones left out", () => {
    const list = openTasks([
      { title: "b later", pri: "later", rank: 1 }, { title: "a next 2", pri: "next", rank: 2 }, { title: "done", pri: "now", done: true },
      { title: "c now", pri: "now", rank: 9 }, { title: "a next 1", pri: "next", rank: 1 }, { title: "no pri", rank: 0 },
    ]);
    expect(list.map(t => t.title)).toEqual(["c now", "no pri", "a next 1", "a next 2", "b later"]);
  });
  test("a month counts your own money, not a partner's or the in-between kinds", () => {
    const s = monthSummary([
      { date: "2026-10-02", amount: -50, cat: "groceries" }, { date: "2026-10-03", amount: -20, cat: "eatingout" },
      { date: "2026-10-03", amount: -30, cat: "groceries", who: "me" }, { date: "2026-10-04", amount: -99, cat: "kids", who: "partner" },
      { date: "2026-10-05", amount: 400, cat: "income" }, { date: "2026-10-06", amount: -60, cat: "transfer" },
      { date: "2026-10-06", amount: -10, cat: "settle" }, { date: "2026-09-30", amount: -1000, cat: "bills" },
    ], "2026-10");
    expect(s).toEqual({ out: 100, in: 400, net: 300, top: { id: "groceries", label: "Groceries", amount: 80 } });
  });
  test("subscriptions: what's running per month, failing cards, and what renews in a fortnight", () => {
    const s = subsSummary([
      { id: "a", name: "Claude", amount: 30, cycle: "month", status: "active", renews: "2026-10-30" },
      { id: "b", name: "iCloud", amount: 120, cycle: "year", status: "active", renews: "2027-01-01" },
      { id: "c", name: "Gym", amount: 15, cycle: "week", status: "expiring", renews: "2026-10-25" },
      { id: "d", name: "Old", amount: 50, cycle: "month", status: "cancelled", renews: "2026-10-26" },
      { id: "e", name: "Kept?", amount: 9, cycle: "month", status: "active", decision: "cancelled", renews: "2026-10-26" },
      { id: "f", name: "Failing", amount: 5, cycle: "month", status: "payment_failing" },
    ], "2026-10-24");
    expect(s.running).toBe(3);
    expect(s.monthly).toBe(Math.round((30 + 10 + 15 * 52 / 12) * 100) / 100);
    expect(s.failing).toBe(1);
    expect(s.soon.map(x => [x.name, x.inDays])).toEqual([["Gym", 1], ["Claude", 6]]);
    expect(perMonth({ amount: 1, cycle: "usage" })).toBe(0);
  });
});
