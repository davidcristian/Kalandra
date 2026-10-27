import { beforeEach, describe, expect, it } from "vitest";
import { init } from "@/assets/data";
import { ParsedItem, parseClipboard } from "@/parser";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { createTestCreateOptions } from "@specs/helper";
import { FracturedItem, HypnoticKnuckle, RareJewel } from "@specs/Parser/items";
import { setupTests } from "@specs/vitest.setup";

const PHYSICAL = "Adds # to # Physical Damage to Attacks";
const CRIT_BONUS = "#% increased Critical Damage Bonus";
const MANA_ON_KILL = "Gain # Mana per enemy killed";

function parsed(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

function activeStats(item: ParsedItem, highTierSelected: boolean) {
  const { presets, active } = createPresets(item, {
    ...createTestCreateOptions(),
    highTierSelected,
  });
  return presets.find((preset) => preset.id === active)?.stats ?? [];
}

/** The stat refs of the explicit filters the active preset turns on. */
function tickedExplicits(item: ParsedItem, highTierSelected: boolean) {
  return activeStats(item, highTierSelected)
    .filter((filter) => filter.tag === "explicit" && !filter.disabled)
    .map((filter) => filter.statRef);
}

describe("enableHighTierFilters", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("turns on the tier 1 and 2 explicit stats of a rare, not a tier 4 one", () => {
    const gloves = parsed(HypnoticKnuckle.rawText);

    const mana = activeStats(gloves, true).find(
      (filter) => filter.statRef === MANA_ON_KILL,
    );

    expect(tickedExplicits(gloves, true)).toEqual([PHYSICAL, CRIT_BONUS]);
    expect(mana?.disabled).toBe(true);
    expect(tickedExplicits(gloves, false)).toEqual([]);
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

  it("leaves the stats of a jewel off, whose tiers the window does not mark", () => {
    const jewel = RareJewel.rawText.replace(
      '"of Warmth" (Tier: 3)',
      '"of Warmth" (Tier: 1)',
    );

    expect(tickedExplicits(parsed(jewel), true)).toEqual([]);
  });

  it("leaves a hidden filter off, such as the fractured copy of a stat", () => {
    const stats = activeStats(parsed(FracturedItem.rawText), true);
    const fractured = stats.filter((filter) => filter.tag === "fractured");

    expect(fractured.map((filter) => filter.hidden)).toEqual([
      "filters.hide_for_crafting",
    ]);
    expect(fractured.map((filter) => filter.disabled)).toEqual([true]);
  });
});
