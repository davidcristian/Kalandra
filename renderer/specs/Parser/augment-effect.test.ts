import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestItem } from "@specs/helper";
import { BaseType, init, ITEM_BY_REF } from "@/assets/data";
import { ItemCategory } from "@/parser/meta";
import { ParsedModifier } from "@/parser/advanced-mod-desc";
import { ModifierType } from "@/parser/modifiers";
import { parseStatsFromMod } from "@/parser/Parser";
import { buildEditorItems } from "@/parser/augment-builder";

function augment(refName: string): BaseType {
  const found = ITEM_BY_REF("ITEM", refName)?.at(0);
  if (!found) throw new Error(`No augment ${refName} in the item data`);
  return found;
}

function effect(refName: string, category: ItemCategory): string {
  return buildEditorItems([augment(refName)], category)[0].displayString;
}

const SCALED_IN_OWN_LINE: Array<[string, ItemCategory, string[]]> = [
  [
    "Idol of the Pharisee",
    ItemCategory.Staff,
    [
      "Gain 2% of Damage as Extra Physical Damage per ten percent missing Mana",
      "-30% increased maximum Mana",
    ],
  ],
  [
    "Idol of the Pharisee",
    ItemCategory.Wand,
    [
      "Gain 2% of Damage as Extra Physical Damage per ten percent missing Mana",
      "-30% increased maximum Mana",
    ],
  ],
  [
    "Legacy of Erian's Cobble",
    ItemCategory.Helmet,
    [
      "30 to maximum Life",
      "10 to maximum Mana",
      "10% increased Rarity of Items found",
      "10% increased Critical Hit Chance",
      "10 to all Attributes",
      "5% to all Elemental Resistances",
      "3 Life Regeneration per second",
    ],
  ],
  [
    "Legacy of Hoghunt",
    ItemCategory.TwoHandedMace,
    ["5% to Critical Hit Chance", "Maim on Critical Hit"],
  ],
];

describe("augment effect text in the item editor", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each(SCALED_IN_OWN_LINE)(
    "writes each line of %s on a %s with the value scaled for that line",
    (refName, category, lines) => {
      expect(effect(refName, category)).toBe(lines.join("\n"));
    },
  );

  it.each(SCALED_IN_OWN_LINE)(
    "adds every line of %s on a %s as a stat when it is picked",
    (refName, category) => {
      const item = createTestItem();
      const modifier: ParsedModifier = {
        info: { type: ModifierType.AddedAugment, tags: [] },
        stats: [],
      };

      parseStatsFromMod(
        effect(refName, category).split("\n"),
        item,
        modifier,
        augment(refName),
      );

      expect(item.unknownModifiers).toEqual([]);
      expect(modifier.stats.map((stat) => stat.stat.ref)).toEqual(
        (augment(refName).augment ?? [])
          .filter((line) => line.categories.includes(category))
          .map((line) => line.string),
      );
    },
  );

  it("takes the values in order when every line holds the same values", () => {
    expect(effect("Idol of the Pharisee", ItemCategory.Sceptre)).toBe(
      [
        "Minions deal 60% increased Damage with Command Skills",
        "-30% increased Mana Cost Efficiency of Command Skills",
      ].join("\n"),
    );
    expect(effect("Legacy of Ezomyte Peak", ItemCategory.Helmet)).toBe(
      ["15% increased Area of Effect", "Unwavering Stance"].join("\n"),
    );
  });
});
