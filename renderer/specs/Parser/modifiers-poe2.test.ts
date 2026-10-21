import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestItem } from "@specs/helper";
import { init } from "@/assets/data";
import { ItemCategory } from "@/parser/meta";
import { ParsedItem, ItemRarity } from "@/parser/ParsedItem";
import { parseModifiersPoe2 } from "@/parser/Parser";

function rareItem(category: ItemCategory) {
  const item = createTestItem();
  item.rarity = ItemRarity.Rare;
  item.category = category;
  return item;
}

function modifiers(item: ParsedItem) {
  return item.newMods.map((mod) => ({
    type: mod.info.type,
    stats: mod.stats.map((stat) => stat.stat.ref),
  }));
}

describe("parseModifiersPoe2", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    ["+12% to Fire Resistance (added rune)", "added-rune"],
    ["+12% to Fire Resistance (rune)", "rune"],
    ["+12% to Fire Resistance (enchant)", "enchant"],
    ["+12% to Fire Resistance (scourge)", "scourge"],
  ])("reads %s as one modifier of type %s", (line, type) => {
    const item = rareItem(ItemCategory.BodyArmour);

    expect(parseModifiersPoe2([line], item)).toBe("SECTION_PARSED");
    expect(modifiers(item)).toEqual([
      { type, stats: ["#% to Fire Resistance"] },
    ]);
  });

  it("reads a granted skill line as a skill modifier", () => {
    const item = rareItem(ItemCategory.Wand);

    expect(
      parseModifiersPoe2(["Grants Skill: Level 20 Chaos Bolt"], item),
    ).toBe("SECTION_PARSED");
    expect(modifiers(item).map((mod) => mod.type)).toEqual(["skill"]);
  });

  it("reads every line of a section with a tag as one modifier", () => {
    const item = rareItem(ItemCategory.BodyArmour);

    parseModifiersPoe2(
      ["+12% to Fire Resistance (rune)", "+10% to Cold Resistance (rune)"],
      item,
    );

    expect(modifiers(item)).toEqual([
      {
        type: "rune",
        stats: ["#% to Fire Resistance", "#% to Cold Resistance"],
      },
    ]);
  });

  it("reads each line of a section without a tag as its own modifier", () => {
    const item = rareItem(ItemCategory.BodyArmour);

    expect(
      parseModifiersPoe2(
        ["+12% to Fire Resistance", "+10% to Cold Resistance"],
        item,
      ),
    ).toBe("SECTION_PARSED");
    expect(modifiers(item)).toEqual([
      { type: "explicit", stats: ["#% to Fire Resistance"] },
      { type: "explicit", stats: ["#% to Cold Resistance"] },
    ]);
  });

  it("reads a line without a tag on a relic as a sanctum modifier", () => {
    const item = rareItem(ItemCategory.Relic);

    parseModifiersPoe2(["+12% to Fire Resistance"], item);

    expect(modifiers(item).map((mod) => mod.type)).toEqual(["sanctum"]);
  });

  it("keeps a line that matches no stat as unknown text", () => {
    const item = rareItem(ItemCategory.BodyArmour);

    expect(
      parseModifiersPoe2(["Matches no stat at all (added rune)"], item),
    ).toBe("SECTION_PARSED");
    expect(modifiers(item)).toEqual([{ type: "added-rune", stats: [] }]);
    expect(item.unknownModifiers).toEqual([
      { text: "Matches no stat at all", type: "added-rune" },
    ]);
  });

  it("skips an empty section", () => {
    const item = rareItem(ItemCategory.BodyArmour);

    expect(parseModifiersPoe2([], item)).toBe("SECTION_SKIPPED");
    expect(item.newMods).toEqual([]);
  });

  it("skips an item without a rarity", () => {
    const item = rareItem(ItemCategory.BodyArmour);
    item.rarity = undefined;

    expect(parseModifiersPoe2(["+12% to Fire Resistance"], item)).toBe(
      "PARSER_SKIPPED",
    );
    expect(item.newMods).toEqual([]);
  });
});
