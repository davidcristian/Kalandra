import { describe, expect, it } from "vitest";
import { displayRounding } from "@/web/background/Prices";

/** The shown text, with the hair spaces around the point and the slash written as plain spaces. */
function shown(...args: Parameters<typeof displayRounding>) {
  return displayRounding(...args).replaceAll(" ", " ");
}

describe("displayRounding", () => {
  it.each([
    [3.14159, "3 . 1"],
    [3, "3"],
    [9.96, "10"],
    [1234.5, "1235"],
    [123456, "123456"],
  ])("writes %d as %j", (value, text) => {
    expect(shown(value)).toBe(text);
  });

  it.each([
    [0.5, "1 / 2"],
    [0.3, "1 / 3 . 3"],
    [0.99, "1"],
    [0, "0"],
    [2.5, "2 . 5"],
  ])("writes %d as the fraction %j", (value, text) => {
    expect(shown(value, true)).toBe(text);
  });

  it.each([
    [2250, "2250"],
    [2251, "2 . 3k"],
    [12324, "12 . 3k"],
    [1_049_999, "1050k"],
    [1_050_000, "1 . 1m"],
    [2_500_000_000, "2 . 5b"],
    [3_000_000_000_000, "3t"],
    [-12324, "-12 . 3k"],
  ])("shortens %d to %j", (value, text) => {
    expect(shown(value, false, true)).toBe(text);
  });
});
