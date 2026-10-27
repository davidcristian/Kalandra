import { present } from "@specs/present";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions, createTestItem } from "@specs/helper";
import { TempleTablet } from "@specs/Parser/items";
import { init, Stat, StatBetter, STATS_ITERATOR } from "@/assets/data";
import { ModifierType, StatCalculated, StatSource } from "@/parser/modifiers";
import { __testExports, filterPseudo } from "@/web/price-check/filters/pseudo";
import { FiltersCreationContext } from "@/web/price-check/filters/create-stat-filters";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { ItemCategory, parseClipboard } from "@/parser";

const keepSource = (_calc: StatCalculated, source: StatSource) => source;

/** A stat with one source for each value, as when several modifiers add to it. */
function statWithSources(
  ref: string,
  values: number[],
  type: ModifierType = ModifierType.Explicit,
): StatCalculated {
  return {
    ...createStatHelper(ref, 0, type),
    sources: values.flatMap(
      (value) => createStatHelper(ref, value, type).sources,
    ),
  };
}

describe("filterPseudoSources", () => {
  it("should do nothing if no stats", () => {
    expect(__testExports.filterPseudoSources([], keepSource)).toHaveLength(0);
  });

  it("should do nothing if no stats have any sources", () => {
    const stats = [
      statWithSources(FireResRef, []),
      statWithSources(ColdResRef, [], ModifierType.Enchant),
    ];

    expect(__testExports.filterPseudoSources(stats, keepSource)).toHaveLength(
      0,
    );
  });

  it("should add every source of every stat that mapFn keeps", () => {
    const stats = [
      statWithSources(FireResRef, [10]),
      statWithSources(ColdResRef, [20]),
      statWithSources(StrengthRef, [30, 40]),
    ];

    const result = __testExports.filterPseudoSources(stats, keepSource);

    expect(result).toEqual(stats.flatMap((calc) => calc.sources));
  });

  it("should add what mapFn returns and drop the sources it rejects", () => {
    const stats = [
      statWithSources(FireResRef, [30]),
      statWithSources(ColdResRef, [10]),
      statWithSources(StrengthRef, [10, 40], ModifierType.Enchant),
    ];

    const result = __testExports.filterPseudoSources(stats, (calc, source) => {
      const value = present(source.contributes).value;
      if (value < 25) return null;
      const multi = calc.type === ModifierType.Enchant ? 2 : 1;
      return {
        ...source,
        contributes: { ...present(source.contributes), value: value * multi },
      };
    });

    expect(result.map((source) => source.contributes?.value)).toEqual([30, 80]);
  });
});

const FireResRef = "#% to Fire Resistance";
const ColdResRef = "#% to Cold Resistance";
const MovementSpeedRef = "#% increased Movement Speed";
const StrengthRef = "# to Strength";
const MaxLifeRef = "# to maximum Life";
const BreachTabletRef = "Adds an Otherworldy Breach to a Map \n# use remaining";

function createStatHelper(
  ref: string,
  value: number = 25,
  type: ModifierType = ModifierType.Explicit,
): StatCalculated {
  const stat: Stat = {
    ref,
    matchers: [],
    better: StatBetter.PositiveRoll,
    trade: {
      inverted: undefined,
      option: undefined,
      ids: {},
    },
  };

  return {
    stat,
    type,
    sources: [
      {
        contributes: {
          value,
          min: value,
          max: value,
        },
        modifier: {
          info: {
            type,
            tags: [],
          },
          stats: [],
        },
        stat: {
          stat,
          translation: {
            string: "",
          },
          roll: {
            unscalable: false,
            dp: false,
            value,
            min: value,
            max: value,
          },
        },
      },
    ],
  };
}

describe("filterPseudo", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setupTests();
    await init("en");
  });

  it("should do nothing if no stats by type", () => {
    const ctx: FiltersCreationContext = {
      item: createTestItem(),
      searchInRange: 0,
      filters: [],
      statsByType: [],
    };

    filterPseudo(ctx);

    expect(ctx.statsByType).toHaveLength(0);
  });

  it("should add pseudo for stat", () => {
    const ctx: FiltersCreationContext = {
      item: createTestItem(),
      searchInRange: 0,
      filters: [],
      statsByType: [createStatHelper(FireResRef)],
    };

    filterPseudo(ctx);

    expect(ctx.statsByType.length).toBe(0);
    expect(ctx.filters.length).toBe(2);
    const totalRes = ctx.filters.find(
      (f) => f.statRef === "#% total Elemental Resistance",
    );
    const fireRes = ctx.filters.find(
      (f) => f.statRef === "#% total to Fire Resistance",
    );

    expect(totalRes).toBeDefined();
    expect(fireRes).toBeDefined();
    expect(totalRes?.disabled).toBe(false);
    expect(fireRes?.disabled).toBe(true);
    expect(totalRes?.roll?.value).toBe(25);
    expect(fireRes?.roll?.value).toBe(25);
  });

  it("should add 2 different pseudos", () => {
    const ctx: FiltersCreationContext = {
      item: createTestItem(),
      searchInRange: 0,
      filters: [],
      statsByType: [
        createStatHelper(FireResRef),
        createStatHelper(MovementSpeedRef),
      ],
    };

    filterPseudo(ctx);

    expect(ctx.statsByType.length).toBe(0);
    expect(ctx.filters.length).toBe(3);
    const totalRes = ctx.filters.find(
      (f) => f.statRef === "#% total Elemental Resistance",
    );
    const fireRes = ctx.filters.find(
      (f) => f.statRef === "#% total to Fire Resistance",
    );
    const movementSpeed = ctx.filters.find(
      (f) => f.statRef === MovementSpeedRef,
    );

    expect(totalRes).toBeDefined();
    expect(fireRes).toBeDefined();
    expect(movementSpeed).toBeDefined();
  });

  it("should merge two of same stats", () => {
    const ctx: FiltersCreationContext = {
      item: createTestItem(),
      searchInRange: 0,
      filters: [],
      statsByType: [createStatHelper(FireResRef), createStatHelper(FireResRef)],
    };

    filterPseudo(ctx);

    expect(ctx.statsByType.length).toBe(0);
    expect(ctx.filters.length).toBe(2);
    const totalRes = ctx.filters.find(
      (f) => f.statRef === "#% total Elemental Resistance",
    );
    const fireRes = ctx.filters.find(
      (f) => f.statRef === "#% total to Fire Resistance",
    );

    expect(totalRes).toBeDefined();
    expect(fireRes).toBeDefined();
    expect(totalRes?.sources).toHaveLength(2);
    expect(totalRes?.roll?.value).toBe(50);
    expect(fireRes?.sources).toHaveLength(2);
    expect(fireRes?.roll?.value).toBe(50);
  });

  it("should join related stats", () => {
    const ctx: FiltersCreationContext = {
      item: createTestItem(),
      searchInRange: 0,
      filters: [],
      statsByType: [
        createStatHelper(MaxLifeRef),
        createStatHelper(StrengthRef),
      ],
    };

    filterPseudo(ctx);

    expect(ctx.statsByType.length).toBe(0);
    expect(ctx.filters.length).toBe(2);
    const maxLife = ctx.filters.find(
      (f) => f.statRef === "+# total maximum Life",
    );
    const str = ctx.filters.find((f) => f.statRef === "+# total to Strength");

    expect(maxLife).toBeDefined();
    expect(str).toBeDefined();
    expect(maxLife?.sources).toHaveLength(2);
    expect(maxLife?.roll?.value).toBe(75);
    expect(str?.sources).toHaveLength(1);
    expect(str?.roll?.value).toBe(25);
  });

  it("should only keep highest ele res", () => {
    const ctx: FiltersCreationContext = {
      item: createTestItem(),
      searchInRange: 0,
      filters: [],
      statsByType: [
        createStatHelper(FireResRef),
        createStatHelper(ColdResRef, 50),
      ],
    };

    filterPseudo(ctx);

    expect(ctx.statsByType.length).toBe(0);
    expect(ctx.filters.length).toBe(2);
    const totalRes = ctx.filters.find(
      (f) => f.statRef === "#% total Elemental Resistance",
    );
    const coldRes = ctx.filters.find(
      (f) => f.statRef === "#% total to Cold Resistance",
    );

    expect(totalRes).toBeDefined();
    expect(coldRes).toBeDefined();
    expect(totalRes?.disabled).toBe(false);
    expect(coldRes?.disabled).toBe(true);
    expect(totalRes?.roll?.value).toBe(75);
    expect(coldRes?.roll?.value).toBe(50);
  });

  it("should add tablet implicits", () => {
    const ctx: FiltersCreationContext = {
      item: createTestItem(),
      searchInRange: 0,
      filters: [],
      statsByType: [
        createStatHelper(BreachTabletRef, 8, ModifierType.Implicit),
      ],
    };

    filterPseudo(ctx);

    expect(ctx.statsByType.length).toBe(0);
    expect(ctx.filters.length).toBe(1);
    const uses = ctx.filters.find((f) => f.statRef === "# uses remaining");

    expect(uses).toBeDefined();
    expect(uses?.disabled).toBe(false);
    expect(uses?.roll?.value).toBe(8);
  });

  it("should add uses remaining for every tablet stat with a use count", () => {
    const refs = [...STATS_ITERATOR("use remaining")]
      .map((stat) => stat.ref)
      .filter((ref) => ref.endsWith("\n# use remaining"));
    const missing = refs.filter((ref) => {
      const ctx: FiltersCreationContext = {
        item: createTestItem(),
        searchInRange: 0,
        filters: [],
        statsByType: [createStatHelper(ref, 5, ModifierType.Implicit)],
      };
      filterPseudo(ctx);
      return !ctx.filters.some(
        (f) => f.statRef === "# uses remaining" && f.roll?.value === 5,
      );
    });

    expect(refs.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("should give a Temple Tablet an enabled uses remaining filter", () => {
    const item = parseClipboard(TempleTablet.rawText)._unsafeUnwrap();
    const { presets, active } = createPresets(item, createTestCreateOptions());
    const stats = present(presets.find((preset) => preset.id === active)).stats;
    const uses = stats.find((f) => f.statRef === "# uses remaining");

    expect(item.category).toBe(ItemCategory.Tablet);
    expect(uses?.disabled).toBe(false);
    expect(uses?.roll?.value).toBe(17);
    expect(uses?.roll?.min).toBe(17);
  });
});
