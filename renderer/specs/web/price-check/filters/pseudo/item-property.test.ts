import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { HighDamageRareItem, ReloadSpeedCrossbow } from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { FiltersCreationContext } from "@/web/price-check/filters/create-stat-filters";
import { filterItemProp } from "@/web/price-check/filters/pseudo/item-property";

function reloadTimeFilter(rawText: string) {
  const item = parseClipboard(rawText)._unsafeUnwrap();
  const ctx: FiltersCreationContext = {
    item,
    searchInRange: 10,
    filters: [],
    statsByType: item.statsByType,
  };
  filterItemProp(ctx);
  const filter = ctx.filters.find((f) => f.tradeId[0] === "item.reload_time");
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
    expect(filter?.roll?.goodness).toBeCloseTo(0.863, 3);
  });

  it("counts Attack Speed when the crossbow has no Reload Speed roll", () => {
    const { item, filter } = reloadTimeFilter(HighDamageRareItem.rawText);

    expect(item.weaponRELOAD).toBe(HighDamageRareItem.weaponRELOAD);
    expect(filter?.sources.map((s) => s.stat.stat.ref)).toEqual([
      "#% increased Attack Speed",
    ]);
    expect(filter?.roll?.goodness).toBe(1);
  });
});
