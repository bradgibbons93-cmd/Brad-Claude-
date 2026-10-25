import { describe, expect, test } from "bun:test";
import { winner, yumiMove, setRandom } from "../../public/js/xo.js";

const B = (s: string) => [...s].map(c => (c === "." ? "" : c));
describe("noughts and crosses", () => {
  test("a line wins, a full board with no line is a draw", () => {
    expect(winner(B("XXX......"))?.who).toBe("X");
    expect(winner(B("O...O...O"))?.line).toEqual([0, 4, 8]);
    expect(winner(B("XOXXOOOXX"))?.who).toBe("draw");
    expect(winner(B("XO......."))).toBeNull();
  });
  test("Yumi always takes a win when it's there, on either level", () => {
    for (const level of ["easy", "tricky"]) for (let r = 0; r < 20; r++) {
      setRandom(n => r % n);
      expect(yumiMove(B("OO.XX...."), level)).toBe(2);
    }
  });
  test("on Tricky Yumi always blocks", () => {
    for (let r = 0; r < 20; r++) { setRandom(n => (r * 7) % n); expect(yumiMove(B("XX..O...."), "tricky")).toBe(2); }
  });
  test("on Easy she can still win: Yumi sometimes misses a block", () => {
    const seen = new Set<number>();
    for (let r = 0; r < 100; r++) { setRandom(n => (r * 13 + 5) % n); seen.add(yumiMove(B("XX..O...."), "easy")); }
    expect(seen.has(2)).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });
  test("Yumi only ever picks an empty square, and gives up on a full board", () => {
    for (let r = 0; r < 50; r++) { setRandom(n => (r * 3) % n); const b = B("XO.OX.X.."), i = yumiMove(b, r % 2 ? "easy" : "tricky"); expect(b[i]).toBe(""); }
    expect(yumiMove(B("XOXXOOOXX"), "tricky")).toBe(-1);
  });
});
