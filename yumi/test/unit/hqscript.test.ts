import { describe, expect, test } from "bun:test";
import { hqWidgetScript } from "../../src/hqscript";
import { runScript, tableRows } from "../scriptable";

const KEY = "k".repeat(43);
const script = hqWidgetScript({ origin: "https://yumi.example", key: KEY, name: "Bradley", made: "2026-10-24T03:00:00Z" });
const SUMMARY = {
  ok: true, name: "Bradley", at: "2026-10-24T03:00:00Z", today: "2026-10-24", month: "October",
  tasks: {
    open: 12, now: 2, next: 6, later: 4, doneToday: 1,
    top: [
      { id: "r-price", title: "Pick the Runnit founding price", pri: "now", project: "runnit", projectLabel: "Runnit" },
      { id: "e-send", title: "Send Celebrity Ink their studio page", pri: "now", project: "runnit", projectLabel: "Runnit" },
      { id: "q-crew", title: "Book the girls in for haircuts", pri: "next", project: "crew", projectLabel: "Gibbons Crew" },
      { id: "m-card", title: "Cancel the unused Canva seat", pri: "next", project: "money", projectLabel: "Money & admin" },
      { id: "s-test", title: "Test the SOFTR kit", pri: "next", project: "softr", projectLabel: "SOFTR" },
    ],
  },
  money: { out: 125, in: 1450, net: 1325, top: { id: "kids", label: "Kids", amount: 60 } },
  subs: { running: 10, monthly: 212.5, failing: 1, soon: [{ id: "claude", name: "Claude Pro", amount: 30, renews: "2026-10-30", inDays: 6 }] },
  kids: [{ name: "Lilly", stars: 42 }, { name: "Skylah", stars: 37 }],
};
const CITY_INK = `// Runnit widget for City Ink. Made in Runnit > Settings > iPhone widget.\nconst DATA = "https://cityink.example/api/widget/abc123";\n`;

function server(opts: { down?: boolean; off?: boolean } = {}) {
  const posts: any[] = [];
  const fetcher = async (url: string, init: any) => {
    if (opts.down) throw new Error("The Internet connection appears to be offline.");
    if (url.startsWith("https://cityink.example/")) return { status: 200, json: { waiting: 2, draftsReady: 1 } };
    if (!url.startsWith("https://yumi.example/api/hq/w/" + KEY)) return { status: 404, json: { ok: false } };
    if (opts.off) return { status: 404, json: { ok: false, error: "not_found" } };
    const rest = url.slice(("https://yumi.example/api/hq/w/" + KEY).length);
    if (init.method === "POST") { posts.push({ path: rest, body: JSON.parse(init.body) }); return { status: 200, json: { ok: true } }; }
    return { status: 200, json: rest === "?all=1" ? { ...SUMMARY, tasks: { ...SUMMARY.tasks, all: SUMMARY.tasks.top } } : SUMMARY };
  };
  return { fetcher, posts };
}
const pickup = { title: "School pickup", startDate: new Date(Date.now() + 2 * 3600e3), endDate: new Date(Date.now() + 2.5 * 3600e3), isAllDay: false };

describe("the iPhone widget script", () => {
  test("medium: the top three to-dos, each a tap to tick off, then the buttons", async () => {
    const s = server();
    const r = await runScript(script, { family: "medium", fetcher: s.fetcher, events: [pickup], icloudDocs: { "Runnit.js": CITY_INK } });
    expect(r.widget).not.toBeNull();
    expect(r.drawn.texts).toContain("BRAD HQ");
    expect(r.drawn.texts).toContain("Pick the Runnit founding price");
    expect(r.drawn.texts).toContain("Book the girls in for haircuts");
    expect(r.drawn.texts).not.toContain("Cancel the unused Canva seat");
    expect(r.drawn.texts).toContain("School pickup");
    expect(r.drawn.texts).toContain("$125 out");
    expect(r.drawn.texts).toContain("City Ink 2 waiting");
    expect(r.drawn.urls).toContain("scriptable:///run/Brad%20HQ?do=done&id=r-price&t=Pick%20the%20Runnit%20founding%20price");
    for (const d of ["dump", "focus", "list"]) expect(r.drawn.urls).toContain("scriptable:///run/Brad%20HQ?do=" + d);
    expect(r.drawn.texts.join(" ")).not.toMatch(/undefined|NaN|null/);
  });
  test("small, large and the three lock-screen sizes all draw", async () => {
    const s = server();
    const small = await runScript(script, { family: "small", fetcher: s.fetcher });
    expect(small.drawn.texts).toContain("2");
    expect(small.drawn.texts).toContain("Pick the Runnit founding price");
    const large = await runScript(script, { family: "large", fetcher: s.fetcher, events: [pickup], icloudDocs: { "Runnit.js": CITY_INK } });
    for (const t of ["Test the SOFTR kit", "$1,450 in", "Subs $212.5/mo", "Lilly 42★  ·  Skylah 37★", "City Ink · 2 waiting · 1 replies ready", "Renews soon: Claude Pro $30"]) expect(large.drawn.texts).toContain(t);
    const circ = await runScript(script, { family: "accessoryCircular", fetcher: s.fetcher });
    expect(circ.drawn.texts).toEqual(["2", "now"]);
    const rect = await runScript(script, { family: "accessoryRectangular", fetcher: s.fetcher });
    expect(rect.drawn.texts).toEqual(["✕ HQ · 12 to do · 2 now", "Pick the Runnit founding price"]);
    const inline = await runScript(script, { family: "accessoryInline", fetcher: s.fetcher });
    expect(inline.drawn.texts).toEqual(["✕ 2 now · Pick the Runnit founding price"]);
    for (const x of [small, large, circ, rect, inline]) expect(x.drawn.texts.join(" ")).not.toMatch(/undefined|NaN/);
  });
  test("offline it shows the last copy and says so; with nothing saved it says it can't reach Yumi", async () => {
    const ok = await runScript(script, { family: "medium", fetcher: server().fetcher });
    const cached = await runScript(script, { family: "medium", fetcher: server({ down: true }).fetcher, files: Object.fromEntries(ok.files) });
    expect(cached.drawn.texts.some(t => t.startsWith("offline · "))).toBe(true);
    expect(cached.drawn.texts).toContain("Pick the Runnit founding price");
    const none = await runScript(script, { family: "medium", fetcher: server({ down: true }).fetcher });
    expect(none.drawn.texts).toContain("Can't reach Yumi");
  });
  test("a turned-off key says so, even with an old copy saved", async () => {
    const ok = await runScript(script, { family: "medium", fetcher: server().fetcher });
    const off = await runScript(script, { family: "medium", fetcher: server({ off: true }).fetcher, files: Object.fromEntries(ok.files) });
    expect(off.drawn.texts).toContain("Turned off in Yumi");
    expect(off.drawn.texts).not.toContain("Pick the Runnit founding price");
  });
  test("Dump asks for a few words and adds it with the priority picked", async () => {
    const s = server();
    const r = await runScript(script, { inWidget: false, query: { do: "dump" }, fetcher: s.fetcher, alerts: [{ index: 1, text: "Ring the accountant" }] });
    expect(r.shownAlerts[0].title).toBe("Brain dump");
    expect(s.posts).toEqual([{ path: "/task", body: { title: "Ring the accountant", pri: "now", by: "widget" } }]);
    expect(r.tables.length).toBe(1);
    const cancel = server();
    await runScript(script, { inWidget: false, query: { do: "dump" }, fetcher: cancel.fetcher, alerts: [{ index: -1, text: "nope" }] });
    expect(cancel.posts).toEqual([]);
  });
  test("tapping a to-do asks first, then ticks it off", async () => {
    const s = server();
    const r = await runScript(script, { inWidget: false, query: { do: "done", id: "r-price", t: "Pick the Runnit founding price" }, fetcher: s.fetcher, alerts: [{ index: 0 }] });
    expect(r.shownAlerts[0]).toMatchObject({ title: "Done?", message: "Pick the Runnit founding price" });
    expect(s.posts).toEqual([{ path: "/done", body: { id: "r-price" } }]);
    const no = server();
    await runScript(script, { inWidget: false, query: { do: "done", id: "r-price" }, fetcher: no.fetcher, alerts: [{ index: -1 }] });
    expect(no.posts).toEqual([]);
  });
  test("25 starts a timer that buzzes in 25 minutes", async () => {
    const before = Date.now();
    const r = await runScript(script, { inWidget: false, query: { do: "focus" }, fetcher: server().fetcher });
    expect(r.scheduled.length).toBe(1);
    const at = +r.scheduled[0].at - before;
    expect(at).toBeGreaterThan(24.9 * 60e3);
    expect(at).toBeLessThan(25.2 * 60e3);
    expect(r.shownAlerts[0].title).toBe("Focus block started");
  });
  test("the full list in Scriptable: grouped Now, Next, Later, and a tap ticks one off", async () => {
    const s = server();
    const r = await runScript(script, { inWidget: false, fetcher: s.fetcher, alerts: [{ index: 0 }] });
    const rows = tableRows(r.tables[0]);
    const titles = rows.map((x: any) => x.title);
    expect(titles[0]).toBe("BRAD HQ");
    expect(titles).toContain("NOW · 2");
    expect(titles).toContain("NEXT · 3");
    expect(titles.indexOf("NOW · 2")).toBeLessThan(titles.indexOf("○  Pick the Runnit founding price"));
    expect(titles).toContain("October: $125 out · $1,450 in");
    const row = rows.find((x: any) => x.title === "○  Book the girls in for haircuts");
    await row.row.onSelect();
    expect(s.posts).toEqual([{ path: "/done", body: { id: "q-crew" } }]);
  });
  test("the key is in the address and nowhere else, and odd names are safe", async () => {
    expect(script.split(KEY).length).toBe(2);
    const odd = hqWidgetScript({ origin: "https://yumi.example", key: KEY, name: 'Dad "the boss"\n', made: "2026-10-24T03:00:00Z" });
    const r = await runScript(odd, { family: "small", fetcher: server().fetcher });
    expect(r.drawn.texts[1]).toBe('DAD HQ');
  });
});
