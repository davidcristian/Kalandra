import { beforeEach, describe, expect, it } from "vitest";
import { init } from "@/assets/data";
import { ParsedItem, parseClipboard } from "@/parser";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { createTestCreateOptions } from "@specs/helper";
import { HypnoticKnuckle } from "@specs/Parser/items";
import { setupTests } from "@specs/vitest.setup";

const PHYSICAL = "Adds # to # Physical Damage to Attacks";
const CRIT_BONUS = "#% increased Critical Damage Bonus";
const MANA_ON_KILL = "Gain # Mana per enemy killed";

function parsed(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

function activeStats(item: ParsedItem, valuableSelected: boolean) {
  const { presets, active } = createPresets(item, {
    ...createTestCreateOptions(),
    valuableSelected,
  });
  return presets.find((preset) => preset.id === active)?.stats ?? [];
}

/** The stat refs of the explicit filters the active preset turns on. */
function tickedExplicits(item: ParsedItem, valuableSelected: boolean) {
  return activeStats(item, valuableSelected)
    .filter((filter) => filter.tag === "explicit" && !filter.disabled)
    .map((filter) => filter.statRef);
}

describe("enableValuableFilters", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("turns on the valuable stats of a rare and no other", () => {
    const gloves = parsed(HypnoticKnuckle.rawText);
    const mana = activeStats(gloves, true).find(
      (filter) => filter.statRef === MANA_ON_KILL,
    );

    expect(tickedExplicits(gloves, true)).toEqual([PHYSICAL, CRIT_BONUS]);
    expect(mana?.disabled).toBe(true);
    expect(tickedExplicits(gloves, false)).toEqual([]);
  });

  it("turns on a valuable stat at any tier, and a stat that is not valuable at none", () => {
    const lowCrit = HypnoticKnuckle.rawText.replace(
      '"of Ferocity" (Tier: 1)',
      '"of Ferocity" (Tier: 5)',
    );
    const topMana = HypnoticKnuckle.rawText.replace(
      '"of Consumption" (Tier: 4)',
      '"of Consumption" (Tier: 1)',
    );

    expect(tickedExplicits(parsed(lowCrit), true)).toEqual([
      PHYSICAL,
      CRIT_BONUS,
    ]);
    expect(tickedExplicits(parsed(topMana), true)).toEqual([
      PHYSICAL,
      CRIT_BONUS,
    ]);
  });

  it("leaves the stats of a magic item off", () => {
    const magic = HypnoticKnuckle.rawText
      .replace("Rarity: Rare", "Rarity: Magic")
      .replace(
        "Hypnotic Knuckle\nCultist Gauntlets",
        "Flaring Cultist Gauntlets of Ferocity",
      );

    expect(tickedExplicits(parsed(magic), true)).toEqual([]);
  });

  it("leaves the stats of a veiled rare off", () => {
    const veiled = { ...parsed(HypnoticKnuckle.rawText), isVeiled: true };

    expect(tickedExplicits(veiled, true)).toEqual([]);
  });

  it("leaves a hidden filter off, such as the fractured copy of a valuable stat", () => {
    const fracturedCrit =
      HypnoticKnuckle.rawText.replace(
        "31(30-34)% increased Critical Damage Bonus",
        "31(30-34)% increased Critical Damage Bonus (fractured)",
      ) + "--------\nFractured Item\n";
    const stats = activeStats(parsed(fracturedCrit), true);
    const fractured = stats.filter((filter) => filter.tag === "fractured");

    expect(fractured.map((filter) => filter.statRef)).toEqual([CRIT_BONUS]);
    expect(fractured.map((filter) => filter.hidden)).toEqual([
      "filters.hide_for_crafting",
    ]);
    expect(fractured.map((filter) => filter.disabled)).toEqual([true]);
  });
});
