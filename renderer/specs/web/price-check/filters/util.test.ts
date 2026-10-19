import { roundRoll } from "@/web/price-check/filters/util";
import { describe, expect, it } from "vitest";

describe("roundRoll", () => {
  it.each([
    0.29, 0.57, 0.58, 1.13, 1.14, 1.15, 1.16, 2.01, 2.03, 2.05, 2.07, 2.26,
    2.28,
  ])(
    "%#. keeps %s, whose product with 100 is just below a whole number",
    (value) => {
      expect(roundRoll(value, true)).toBe(value);
      expect(roundRoll(-value, true)).toBe(-value);
    },
  );

  it("keeps every two-decimal value below 2.3", () => {
    const changed: string[] = [];
    for (let hundredths = 1; hundredths < 230; hundredths++) {
      const text = (hundredths / 100).toFixed(2);
      if (roundRoll(Number(text), true) !== Number(text)) changed.push(text);
    }

    expect(changed).toEqual([]);
  });

  it.each([
    [1.159, true, 1.15],
    [-1.159, true, -1.15],
    [0.009, true, 0],
    [2.39, true, 2.3],
    [9.99, true, 9.9],
    [12.7, true, 12],
    [1.15, false, 1],
    [-7.8, false, -7],
  ])("%#. cuts %s with dp %s to %s", (value, dp, expected) => {
    expect(roundRoll(value, dp)).toBe(expected);
  });
});
