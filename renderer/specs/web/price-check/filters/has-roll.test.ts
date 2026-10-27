import { describe, expect, it } from "vitest";
import {
  FilterTag,
  hasRoll,
  type StatFilter,
} from "@/web/price-check/filters/interfaces";

function filter(roll?: StatFilter["roll"]): StatFilter {
  return {
    tradeId: ["explicit.stat_1"],
    statRef: "# to maximum Life",
    text: "+# to maximum Life",
    tag: FilterTag.Explicit,
    sources: [],
    roll,
    disabled: false,
  };
}

describe("hasRoll", () => {
  it("returns true for a filter with a roll", () => {
    const withRoll = filter({
      value: 50,
      min: 45,
      max: undefined,
      default: { min: 45, max: 55 },
      dp: false,
      isNegated: false,
    });

    expect(hasRoll(withRoll)).toBe(true);
  });

  it("returns false for a filter without a roll", () => {
    expect(hasRoll(filter())).toBe(false);
  });
});
