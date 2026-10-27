import { present } from "@specs/present";
import { beforeAll, describe, expect, it } from "vitest";
import { init, STAT_BY_REF } from "@/assets/data";
import { ItemRarity, type ParsedItem } from "@/parser/ParsedItem";
import { ModifierType, type StatCalculated } from "@/parser/modifiers";
import {
  calculatedStatToFilter,
  initUiModFilters,
} from "@/web/price-check/filters/create-stat-filters";
import type { StatFilter } from "@/web/price-check/filters/interfaces";
import { createTestItem, makeCalcStat } from "@specs/helper";
import { setupTests } from "@specs/vitest.setup";

// stats.ndjson has null trade ids for the skill of every buckler and for each logbook faction
const REFS = ["Grants Skill: Parry", "Has Logbook Faction: Knights of the Sun"];
const TYPES = [ModifierType.Explicit, ModifierType.Crafted];
const OPTS = {
  searchStatRange: 10,
  defaultAllSelected: true,
  valuableSelected: false,
};

function withEmptyIds(calc: StatCalculated): StatCalculated {
  const copy = structuredClone(calc);
  copy.stat.trade.ids = {};
  return copy;
}

function rareItem(calc: StatCalculated): ParsedItem {
  return { ...createTestItem(), rarity: ItemRarity.Rare, statsByType: [calc] };
}

function expectSameFilters(actual: StatFilter[], expected: StatFilter[]) {
  expect(actual).toEqual(
    expected.map((filter, i) => ({ ...filter, sources: actual[i].sources })),
  );
}

beforeAll(async () => {
  setupTests();
  await init("en");
});

describe("a stat whose trade ids are null in the data", () => {
  it.each(REFS)("is the data line of %s", (ref) => {
    expect(present(STAT_BY_REF(ref)).trade.ids).toBeNull();
  });

  it.each(REFS)("makes the filter of a stat with no ids: %s", (ref) => {
    for (const type of TYPES) {
      const calc = makeCalcStat(ref, 1, type);
      const item = rareItem(calc);

      expectSameFilters(
        [calculatedStatToFilter(calc, 10, item)],
        [calculatedStatToFilter(withEmptyIds(calc), 10, item)],
      );
    }
  });

  it.each(REFS)("makes the item filters of a stat with no ids: %s", (ref) => {
    for (const type of TYPES) {
      const calc = makeCalcStat(ref, 1, type);

      expectSameFilters(
        initUiModFilters(rareItem(calc), OPTS),
        initUiModFilters(rareItem(withEmptyIds(calc)), OPTS),
      );
    }
  });
});
