import { describe, expect, test } from "bun:test";
import { N, KATSEYE_SHEET, KATSEYE_WORDS, makeGrid, locate, lineCells, snap } from "../../public/js/wordsearch.js";

describe("the KATSEYE word search", () => {
  test("the printable is 10 by 10 with every word on it", () => {
    expect(KATSEYE_SHEET.length).toBe(N * N);
    for (const w of KATSEYE_WORDS) expect(locate(KATSEYE_SHEET, w)).not.toBeNull();
    /* Spot checks against the sheet: GAMEBOY runs down the last column, MEGAN across row 2. */
    expect(locate(KATSEYE_SHEET, "GAMEBOY")).toEqual([29, 89]);
    expect(locate(KATSEYE_SHEET, "MEGAN")).toEqual([11, 15]);
  });
  test("every shuffle fits all twelve words", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const g = makeGrid(KATSEYE_WORDS, seed);
      expect(g).not.toBeNull();
      expect(g!.length).toBe(N * N);
      for (const w of KATSEYE_WORDS) expect(locate(g!, w)).not.toBeNull();
    }
  });
  test("the same seed makes the same puzzle on every phone", () => {
    expect(makeGrid(KATSEYE_WORDS, 12345)).toBe(makeGrid(KATSEYE_WORDS, 12345));
    expect(makeGrid(KATSEYE_WORDS, 12345)).not.toBe(makeGrid(KATSEYE_WORDS, 54321));
  });
  test("only straight lines count, and a wobbly drag snaps to one", () => {
    expect(lineCells(11, 15)).toEqual([11, 12, 13, 14, 15]);
    expect(lineCells(0, 99)).toHaveLength(10);
    expect(lineCells(0, 12)).toBeNull();
    expect(snap(0, 21)).toBe(22);   // nearly diagonal becomes diagonal
    expect(snap(0, 3)).toBe(3);     // across stays across
    expect(snap(95, 105 as any)).toBeLessThan(N * N);
  });
});
