import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import {
  ArmourHighValueRareItem,
  HighDamageRareItem,
  NormalItem,
  NormalShield,
  ReloadSpeedCrossbow,
  RequiresOneAttribute,
} from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { FiltersCreationContext } from "@/web/price-check/filters/create-stat-filters";
import { filterItemProp } from "@/web/price-check/filters/pseudo/item-property";

function itemPropFilters(rawText: string) {
  const item = parseClipboard(rawText)._unsafeUnwrap();
  const ctx: FiltersCreationContext = {
    item,
    searchInRange: 10,
    filters: [],
    statsByType: item.statsByType,
  };
  filterItemProp(ctx);
  return { item, filters: ctx.filters };
}

function reloadTimeFilter(rawText: string) {
  const { item, filters } = itemPropFilters(rawText);
  const filter = filters.find((f) => f.tradeId[0] === "item.reload_time");
  return { item, filter };
}

describe("Reload Time filter", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("counts a Reload Speed roll in the range and the sources", () => {
    const { item, filter } = reloadTimeFilter(ReloadSpeedCrossbow.rawText);

    expect(item.weaponRELOAD).toBe(ReloadSpeedCrossbow.weaponRELOAD);
    expect(filter?.roll?.value).toBe(0.5);
    expect(filter?.sources.map((s) => s.stat.stat.ref).sort()).toEqual([
      "#% increased Attack Speed",
      "#% increased Reload Speed",
    ]);
    expect(filter?.roll?.default).toEqual({ min: 0.52, max: 0.5 });
  });

  it("counts Attack Speed when the crossbow has no Reload Speed roll", () => {
    const { item, filter } = reloadTimeFilter(HighDamageRareItem.rawText);

    expect(item.weaponRELOAD).toBe(HighDamageRareItem.weaponRELOAD);
    expect(filter?.sources.map((s) => s.stat.stat.ref)).toEqual([
      "#% increased Attack Speed",
    ]);
    expect(filter?.roll?.default).toEqual({ min: 0.6, max: 0.61 });
  });
});

describe("Armour, Evasion Rating and Energy Shield filters", () => {
  const DEFENCES = ["item.armour", "item.evasion_rating", "item.energy_shield"];

  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    [
      "Armour and Energy Shield helmet",
      NormalItem,
      ["item.armour", "item.energy_shield"],
    ],
    [
      "Armour and Evasion Rating shield",
      NormalShield,
      ["item.armour", "item.evasion_rating"],
    ],
    ["Armour body armour", ArmourHighValueRareItem, ["item.armour"]],
    ["Energy Shield boots", RequiresOneAttribute, ["item.energy_shield"]],
  ])(
    "starts every defence filter enabled on the %s",
    (_, testItem, expected) => {
      const { filters } = itemPropFilters(testItem.rawText);
      const defences = filters.filter((f) => DEFENCES.includes(f.tradeId[0]));

      expect(defences.map((f) => f.tradeId[0])).toEqual(expected);
      expect(defences.map((f) => f.disabled)).toEqual(
        expected.map(() => false),
      );
    },
  );
});
