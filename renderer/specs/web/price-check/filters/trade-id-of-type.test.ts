import { beforeAll, describe, expect, it } from "vitest";
import { init, StatBetter, type Stat } from "@/assets/data";
import { ItemRarity, type ParsedItem } from "@/parser/ParsedItem";
import { ModifierType, type StatCalculated } from "@/parser/modifiers";
import type { ParsedStat } from "@/parser/stat-translations";
import {
  createExactStatFilters,
  initUiModFilters,
} from "@/web/price-check/filters/create-stat-filters";
import {
  FilterTag,
  type StatFilter,
} from "@/web/price-check/filters/interfaces";
import { createTestItem } from "@specs/helper";
import { setupTests } from "@specs/vitest.setup";

const OPTS = {
  searchStatRange: 10,
  defaultAllSelected: false,
  valuableSelected: false,
};

// Real lines: the crafted suffix of the Obliterator Bow and the implicit of the crossbow in specs/Parser/items.ts
const CRIT = "#% to Critical Hit Chance";
// The trade site's ids for this text in specs/data/stats.json, which has no crafted category
const CRIT_IDS = {
  explicit: ["explicit.stat_518292764"],
  fractured: ["fractured.stat_518292764"],
  desecrated: ["desecrated.stat_518292764"],
};
const BOLT = "Loads an additional bolt";

/** A stat that the parser builds from the trade site's stat list, with the roll of the copied line. */
function tradeSiteStat(
  text: string,
  ids: Record<string, string[]>,
  type: ModifierType,
  value?: number,
): StatCalculated {
  const stat: Stat = {
    ref: text,
    better: StatBetter.PositiveRoll,
    matchers: [{ string: text }],
    trade: { ids },
  };
  const roll =
    value === undefined ? undefined : { value, min: value, max: value };
  const parsed: ParsedStat = {
    stat,
    translation: stat.matchers[0],
    roll: roll && { ...roll, dp: true, unscalable: false },
  };
  return {
    stat,
    type,
    sources: [
      {
        modifier: { info: { type, tags: [] }, stats: [parsed] },
        stat: parsed,
        contributes: roll,
      },
    ],
  };
}

function rareItem(calc: StatCalculated, isCorrupted = false): ParsedItem {
  return {
    ...createTestItem(),
    rarity: ItemRarity.Rare,
    isCorrupted,
    statsByType: [calc],
  };
}

function filtersOf(filters: StatFilter[], ref: string) {
  return filters
    .filter((filter) => filter.statRef === ref)
    .map(({ tag, tradeId }) => ({ tag, tradeId }));
}

beforeAll(async () => {
  setupTests();
  await init("en");
});

describe("a stat without a trade id of its modifier type", () => {
  it("searches a crafted stat by its explicit id only", () => {
    const crafted = tradeSiteStat(CRIT, CRIT_IDS, ModifierType.Crafted, 3.45);

    for (const item of [rareItem(crafted), rareItem(crafted, true)]) {
      expect(filtersOf(initUiModFilters(item, OPTS), CRIT)).toEqual([
        { tag: FilterTag.Explicit, tradeId: CRIT_IDS.explicit },
      ]);
    }
  });

  it("adds the crafted filter of a stat with a crafted id", () => {
    const craftedIds = ["crafted.stat_518292764"];
    const crafted = tradeSiteStat(
      CRIT,
      { ...CRIT_IDS, crafted: craftedIds },
      ModifierType.Crafted,
      3.45,
    );

    expect(filtersOf(initUiModFilters(rareItem(crafted), OPTS), CRIT)).toEqual([
      { tag: FilterTag.Explicit, tradeId: CRIT_IDS.explicit },
      { tag: FilterTag.Crafted, tradeId: craftedIds },
    ]);
  });

  it("makes no exact filter of a crafted stat without a crafted id", () => {
    const crafted = tradeSiteStat(CRIT, CRIT_IDS, ModifierType.Crafted, 3.45);
    const item = rareItem(crafted);

    expect(
      filtersOf(createExactStatFilters(item, item.statsByType, OPTS), CRIT),
    ).toEqual([]);
  });

  it("makes no filter of an implicit stat without an implicit id", () => {
    const implicit = tradeSiteStat(
      BOLT,
      { explicit: ["explicit.stat_1967051901"] },
      ModifierType.Implicit,
    );
    const item = rareItem(implicit);

    expect(filtersOf(initUiModFilters(item, OPTS), BOLT)).toEqual([]);
    expect(
      filtersOf(createExactStatFilters(item, item.statsByType, OPTS), BOLT),
    ).toEqual([]);
  });

  it("makes the filter of an implicit stat with an implicit id", () => {
    const ids = ["implicit.stat_1967051901"];
    const implicit = tradeSiteStat(
      BOLT,
      { implicit: ids },
      ModifierType.Implicit,
    );
    const item = rareItem(implicit);

    expect(filtersOf(initUiModFilters(item, OPTS), BOLT)).toEqual([
      { tag: FilterTag.Implicit, tradeId: ids },
    ]);
    expect(
      filtersOf(createExactStatFilters(item, item.statsByType, OPTS), BOLT),
    ).toEqual([{ tag: FilterTag.Implicit, tradeId: ids }]);
  });
});
