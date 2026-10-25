import { describe, expect, it } from "vitest";
import {
  calcBaseSafeZone,
  getExpPenalty,
  getOverIdeal,
  outsideTestData,
} from "@/web/leveling/xp-formula";

/** Returns the multiplier as the widget shows it, such as "93.5". */
function shownExp(playerLevel: number, areaLevel: number) {
  return getExpPenalty(playerLevel, areaLevel).toFixed(1);
}

describe("the safe zone", () => {
  it("is 3 levels, and 1 more for each 16 levels of the player", () => {
    expect([1, 15, 16, 31, 32, 100].map(calcBaseSafeZone)).toEqual([
      3, 3, 4, 4, 5, 9,
    ]);
  });
});

describe("the experience multiplier", () => {
  it("is 100% from the player's level up to the safe zone above it", () => {
    expect([shownExp(14, 14), shownExp(14, 17), shownExp(16, 20)]).toEqual([
      "100.0",
      "100.0",
      "100.0",
    ]);
  });

  it("drops for an area one level past the safe zone", () => {
    expect(shownExp(14, 18)).toBe("93.5");
    expect(shownExp(15, 19)).toBe("93.9");
  });

  it("drops for any area below the player's level, without a safe zone", () => {
    expect(shownExp(14, 13)).toBe("93.5");
    expect(shownExp(50, 40)).toBe("8.4");
  });

  it("is never below 1%", () => {
    expect(shownExp(1, 10)).toBe("2.8");
    expect(getExpPenalty(1, 30)).toBe(1);
    expect(getExpPenalty(1, 100)).toBe(1);
  });
});

describe("Over", () => {
  it("is 3 at level 14 in a level 14 area and 0 in a level 17 area, as the page shows", () => {
    expect([14, 17, 18].map((area) => getOverIdeal(14, area))).toEqual([
      3, 0, -1,
    ]);
  });

  it("adds each level the area is below the player", () => {
    expect(getOverIdeal(20, 10)).toBe(14);
  });

  it("is below 0 exactly where an area at or above the player's level costs experience", () => {
    for (let player = 1; player <= 100; player++) {
      for (let area = player; area <= player + 15; area++) {
        expect([player, area, getOverIdeal(player, area) < 0]).toEqual([
          player,
          area,
          getExpPenalty(player, area) < 100,
        ]);
      }
    }
  });
});

describe("the star after Exp", () => {
  it("marks an area above level 70 and a player at level 95 or higher", () => {
    expect(outsideTestData(94, 70)).toBe(false);
    expect(outsideTestData(94, 71)).toBe(true);
    expect(outsideTestData(95, 1)).toBe(true);
  });
});
