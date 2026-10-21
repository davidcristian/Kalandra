import { __testExports, parseClipboard } from "@/parser/Parser";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { RareMap, RareMapFakeAllProps, TestItem } from "./items";
import { init } from "@/assets/data";
import { ParsedItem } from "@/parser/ParsedItem";
import { createTestItem } from "@specs/helper";

function waystoneFields(item: ParsedItem) {
  return {
    mapTier: item.mapTier,
    mapRevives: item.mapRevives,
    mapPackSize: item.mapPackSize,
    mapMagicMonsters: item.mapMagicMonsters,
    mapRareMonsters: item.mapRareMonsters,
    mapDropChance: item.mapDropChance,
    mapItemRarity: item.mapItemRarity,
    mapMonsterRarity: item.mapMonsterRarity,
    mapEffectiveness: item.mapEffectiveness,
  };
}

function itemWithMapTier(tier: number | undefined): ParsedItem {
  const item = createTestItem();
  return { ...item, info: { ...item.info, map: { tier } } };
}

describe("parseWaystone", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    ["RareMap", RareMap],
    ["RareMapFakeAllProps", RareMapFakeAllProps],
  ])(
    "reads the tier from the item data and each property line of %s",
    (_name: string, testItem: TestItem) => {
      const item = parseClipboard(testItem.rawText)._unsafeUnwrap();

      expect(waystoneFields(item)).toEqual(waystoneFields(testItem));
    },
  );

  it("skips a section that does not start with the revives line", () => {
    const item = itemWithMapTier(14);
    const sections = __testExports.itemTextToSections(RareMap.rawText);

    expect(__testExports.parseWaystone(sections[2], item)).toBe(
      "SECTION_SKIPPED",
    );
    expect(item.mapTier).toBeUndefined();
  });

  it("skips the properties of an item whose data has no map tier", () => {
    const item = itemWithMapTier(undefined);
    const sections = __testExports.itemTextToSections(RareMap.rawText);

    expect(__testExports.parseWaystone(sections[1], item)).toBe(
      "SECTION_SKIPPED",
    );
    expect(item.mapRevives).toBeUndefined();
  });
});
