import { ItemCategory } from "@/parser/meta";
import { ItemRarity, ParsedItem } from "@/parser/ParsedItem";
import {
  areaLevelByAscendancyPoints,
  ascendancyPointsByAreaLevel,
  createFilters,
} from "@/web/price-check/filters/create-item-filters";
import { describe, expect, it } from "vitest";
import { createTestCreateOptions, createTestItem } from "@specs/helper";

describe("unidentified item tests", () => {
  it("should not have unid filter if identified", () => {
    const item: ParsedItem = {
      ...createTestItem(),
      isUnidentified: false,
    };

    const res = createFilters(item, createTestCreateOptions());

    expect(res.unidentified).toBeUndefined();
  });

  it("should have unid filter if unidentified", () => {
    const item: ParsedItem = {
      ...createTestItem(),
      isUnidentified: true,
    };

    const res = createFilters(item, createTestCreateOptions());

    expect(res.unidentified).toBeTruthy();
    expect(res.unidentifiedTier).toBeUndefined();
  });

  it("should have unid tier filter if unidentified is tiered", () => {
    const item: ParsedItem = {
      ...createTestItem(),
      isUnidentified: true,
      unidentifiedTier: 4,
    };

    const res = createFilters(item, createTestCreateOptions());

    expect(res.unidentified).toBeUndefined();
    expect(res.unidentifiedTier).toBeTruthy();
    expect(res.unidentifiedTier!.value).toBe(4);
  });

  it.each([
    [ItemRarity.Magic, true],
    [ItemRarity.Rare, true],
    [ItemRarity.Unique, false],
  ])(
    "Should be enabled by default only on uniques, rarity %s",
    (rarity, disabled) => {
      const item: ParsedItem = {
        ...createTestItem(),
        isUnidentified: true,
        rarity,
      };

      const res = createFilters(item, createTestCreateOptions());

      expect(res.unidentified?.disabled).toBe(disabled);
    },
  );

  it.each([
    [2, true],
    [3, true],
    [4, true],
    [5, false],
  ])("Should be enabled by default only on T5, tier %d", (tier, disabled) => {
    const item: ParsedItem = {
      ...createTestItem(),
      isUnidentified: true,
      unidentifiedTier: tier,
    };

    const res = createFilters(item, createTestCreateOptions());

    expect(res.unidentifiedTier!.value).toBe(tier);
    expect(res.unidentifiedTier!.disabled).toBe(disabled);
  });
});

describe("Ascendancy Points calcs", () => {
  it.each([
    ["Inscribed Ultimatum", 1, 1],
    ["Inscribed Ultimatum", 23, 1],
    ["Inscribed Ultimatum", 34, 1],
    ["Inscribed Ultimatum", 42, 1],
    ["Inscribed Ultimatum", 48, 1],
    ["Inscribed Ultimatum", 55, 1],
    ["Inscribed Ultimatum", 70, 2],
    ["Inscribed Ultimatum", 78, 3],
    ["Inscribed Ultimatum", 80, 3],
    ["Inscribed Ultimatum", 100, 3],
    ["Djinn Barya", 1, 1],
    ["Djinn Barya", 23, 1],
    ["Djinn Barya", 34, 1],
    ["Djinn Barya", 42, 1],
    ["Djinn Barya", 48, 2],
    ["Djinn Barya", 55, 2],
    ["Djinn Barya", 70, 3],
    ["Djinn Barya", 78, 4],
    ["Djinn Barya", 80, 4],
    ["Djinn Barya", 100, 4],
  ])(
    "#. Should return correct points for %s area level %d",
    (refName, areaLevel, expected) => {
      const res = ascendancyPointsByAreaLevel(refName, areaLevel);

      expect(res).toBe(expected);
    },
  );

  it.each([
    ["Inscribed Ultimatum", 0, 1],
    ["Inscribed Ultimatum", 1, 1],
    ["Inscribed Ultimatum", 2, 60],
    ["Inscribed Ultimatum", 3, 75],
    ["Inscribed Ultimatum", 4, 75],
    ["Inscribed Ultimatum", 5, 75],
    ["Djinn Barya", 0, 1],
    ["Djinn Barya", 1, 1],
    ["Djinn Barya", 2, 45],
    ["Djinn Barya", 3, 60],
    ["Djinn Barya", 4, 75],
    ["Djinn Barya", 5, 75],
  ])(
    "#. Should return correct area level for %s points %d",
    (refName, points, expected) => {
      const res = areaLevelByAscendancyPoints(refName, points);

      expect(res).toBe(expected);
    },
  );
});

describe("filters of a value the item text did not have", () => {
  it("leave out the level of a gem without a level", () => {
    const gem: ParsedItem = { ...createTestItem(), category: ItemCategory.Gem };

    expect(createFilters(gem, createTestCreateOptions()).gemLevel).toBe(
      undefined,
    );
    expect(
      createFilters({ ...gem, gemLevel: 20 }, createTestCreateOptions())
        .gemLevel,
    ).toEqual({ value: 20, disabled: false });
  });

  it("leave out the tier of a map without a tier", () => {
    const map: ParsedItem = { ...createTestItem(), category: ItemCategory.Map };

    expect(createFilters(map, createTestCreateOptions()).mapTier).toBe(
      undefined,
    );
    expect(
      createFilters({ ...map, mapTier: 15 }, createTestCreateOptions()).mapTier,
    ).toEqual({ value: 15, disabled: false });
  });
});
