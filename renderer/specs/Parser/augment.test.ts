import { init, Stat, StatBetter } from "@/assets/data";
import { ItemCategory } from "@/parser";
import { ParsedModifier } from "@/parser/advanced-mod-desc";
import { ModifierType, StatCalculated } from "@/parser/modifiers";
import { __testExports } from "@/parser/Parser";
import { ParsedStat } from "@/parser/stat-translations";
import { AppConfig } from "@/web/Config";
import type { PriceCheckWidget } from "@/web/overlay/widgets";
import { createTestItem, makeCalcStat } from "@specs/helper";
import { setupTests } from "@specs/vitest.setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("determineAugments", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("should return correct baseTypes", () => {
    const expectedRef = ["Greater Iron Rune", "Greater Iron Rune"];

    const result = __testExports.determineAugments(
      { info: { type: ModifierType.Augment, tags: [] }, stats: [] },
      [makeCalcStat("#% increased Physical Damage", 36, ModifierType.Augment)],
    );

    expect(result.map((augment) => augment.refName)).toEqual(expectedRef);
  });

  it("Works for one item", () => {
    const expectedRef = ["Lesser Storm Rune"];

    const result = __testExports.determineAugments(
      { info: { type: ModifierType.Augment, tags: [] }, stats: [] },
      [makeCalcStat("#% to Lightning Resistance", 10, ModifierType.Augment)],
    );

    expect(result.map((augment) => augment.refName)).toEqual(expectedRef);
  });

  it("handles range mods correctly", () => {
    const stat: Stat = {
      ref: "Adds # to # Lightning Damage",
      better: StatBetter.PositiveRoll,
      matchers: [
        {
          string: "Adds # to # Lightning Damage",
        },
      ],
      trade: {
        ids: {
          explicit: ["explicit.stat_3336890334"],
          fractured: ["fractured.stat_3336890334"],
          enchant: ["enchant.stat_3336890334"],
          rune: ["rune.stat_3336890334"],
          desecrated: ["desecrated.stat_3336890334"],
          crafted: ["crafted.stat_3336890334"],
        },
      },
    };
    const parsedStat: ParsedStat = {
      stat,
      translation: stat.matchers[0],
      roll: {
        unscalable: false,
        dp: false,
        value: 15.5,
        min: 15.5,
        max: 15.5,
      },
    };
    const mod: ParsedModifier = {
      info: {
        type: ModifierType.Augment,
        tags: [],
      },
      stats: [parsedStat],
    };

    const statCalcs: StatCalculated[] = [
      {
        stat,
        type: ModifierType.Augment,
        sources: [
          {
            modifier: mod,
            stat: parsedStat,
            contributes: {
              value: 15.5,
              min: 15.5,
              max: 15.5,
            },
          },
        ],
      },
    ];
    const result = __testExports.determineAugments(mod, statCalcs);

    expect(result).toHaveLength(1);
    expect(result[0].refName).toEqual("Greater Storm Rune");
  });

  it("works for bonded augments", () => {
    const expectedRef = ["Fox Idol"];

    const result = __testExports.determineAugments(
      { info: { type: ModifierType.Augment, tags: [] }, stats: [] },
      [
        makeCalcStat(
          "Idols socketed in this item gain the benefits of their Bonded modifiers",
          1,
          ModifierType.Augment,
        ),
      ],
    );
    expect(result.map((augment) => augment.refName)).toEqual(expectedRef);
  });

  it("finds no augment for a stat without a rune trade id", () => {
    const result = __testExports.determineAugments(
      { info: { type: ModifierType.Augment, tags: [] }, stats: [] },
      [makeCalcStat("#% increased Light Radius", 15, ModifierType.Augment)],
    );

    expect(result).toEqual([]);
  });
});

describe("BFS", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("should return valid combination", () => {
    const result = __testExports.modifiedBfs(36, [], [14, 16, 18, 20]);

    expect(result).toEqual([18, 18]);
  });

  it.each([
    [40, [14, 16, 18, 20], [20, 20]],
    [20, [14, 16, 18, 20], [20]],
    [19, [14, 16, 18, 20], null],
    [15, [5, 7.5, 10], [7.5, 7.5]],
    [34, [14, 16, 18], [18, 16]],
    [10, [10], [10]],
    [10, [], null],
    [40, [10, 20, 30], [20, 20]],
  ])(
    "%#. should return valid combination for %o and %o",
    (target, options, expected) => {
      const result = __testExports.modifiedBfs(target, [], options);

      expect(result).toEqual(expected);
    },
  );

  // A working combination array that throws once the search adds more values to it than the budget
  function budgetedCombo(budget: number): number[] {
    let added = 0;
    return new Proxy<number[]>([], {
      get(target, key, receiver) {
        if (key === "push" && ++added > budget) {
          throw new Error(`the search added more than ${budget} values`);
        }
        return Reflect.get(target, key, receiver);
      },
    });
  }

  // A full search pushes once for each sequence of 1 to maxValues of the options
  function fullSearchSize(options: number, maxValues: number): number {
    let size = 0;
    for (let length = 1; length <= maxValues; length++) {
      size += options ** length;
    }
    return size;
  }

  it("searches nothing when there are more than 8 options", () => {
    const combo = budgetedCombo(0);
    const result = __testExports.modifiedBfs(100, combo, Array(100).fill(0));

    expect(result).toHaveLength(0);
  });

  it("stops at 7 values when no combination reaches the target", () => {
    const combo = budgetedCombo(fullSearchSize(4, 7));
    const result = __testExports.modifiedBfs(15.5, combo, Array(4).fill(1));

    expect(result).toHaveLength(0);
  });
});

describe("parseAugmentSockets", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("should skip for items without sockets", () => {
    const item = createTestItem();

    const result = __testExports.parseAugmentSockets([], item);
    expect(result).toEqual("PARSER_SKIPPED");
  });

  it.each([
    [["Sockets: S"], 1],
    [["Sockets: S S"], 2],
    [["Sockets: S S S"], 3],
    [["Sockets: S S S S"], 4],
    [["Sockets: S S S S S"], 5],
  ])(
    "%#. should add correct augment socket count(%o -> %o)",
    (lines, expected) => {
      const item = createTestItem();
      item.category = ItemCategory.Gloves;

      const result = __testExports.parseAugmentSockets(lines, item);
      expect(result).toEqual("SECTION_PARSED");
      expect(item.augmentSockets?.normal).toEqual(1);
      expect(item.augmentSockets?.empty).toEqual(0);
      expect(item.augmentSockets?.current).toEqual(expected);
      expect(
        item.augmentSockets?.augments.every((v) => v === null),
      ).toBeTruthy();
      expect(item.augmentSockets?.augments.length).toEqual(expected);
    },
  );

  it("should add sockets on non-socket section", () => {
    const item = createTestItem();
    item.category = ItemCategory.Gloves;

    const result = __testExports.parseAugmentSockets(["text"], item);
    expect(result).toEqual("SECTION_SKIPPED");
    expect(item.augmentSockets?.normal).toEqual(1);
    expect(item.augmentSockets?.empty).toEqual(1);
    expect(item.augmentSockets?.current).toEqual(0);
    expect(item.augmentSockets?.augments.every((v) => v === null)).toBeTruthy();
    expect(item.augmentSockets?.augments.length).toEqual(1);
  });
});

describe("applyAugmentSockets", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("should do nothing on item without sockets", () => {
    const item = createTestItem();

    __testExports.applyAugmentSockets(item);
    expect(item).toEqual(createTestItem());
  });

  it("should set empty on item with no augment stats", () => {
    const item = createTestItem();
    item.category = ItemCategory.Gloves;
    item.augmentSockets = {
      empty: 0,
      current: 2,
      normal: 2,
      augments: [null, null],
    };

    __testExports.applyAugmentSockets(item);
    expect(item.augmentSockets.empty).toEqual(2);
    expect(item.augmentSockets.current).toEqual(2);
    expect(item.augmentSockets.normal).toEqual(2);
    expect(item.augmentSockets.augments.every((v) => v === null)).toBeTruthy();
  });

  it("should apply correct augment to item", () => {
    const item = createTestItem();
    item.category = ItemCategory.Bow;
    item.augmentSockets = {
      empty: 0,
      current: 2,
      normal: 2,
      augments: [null, null],
    };

    const stat = makeCalcStat(
      "#% increased Physical Damage",
      18,
      ModifierType.Augment,
    );
    item.statsByType = [stat];
    item.newMods = [
      {
        info: {
          type: ModifierType.Augment,
          tags: [],
        },
        stats: [stat.sources[0].stat],
      },
    ];

    __testExports.applyAugmentSockets(item);
    expect(item.augmentSockets.empty).toEqual(1);
    expect(item.augmentSockets.current).toEqual(2);
    expect(item.augmentSockets.normal).toEqual(2);
    expect(item.augmentSockets.augments[0]?.refName).toEqual(
      "Greater Iron Rune",
    );
    expect(item.augmentSockets.augments[1]).toBeNull();
  });

  it("should apply multiple different augments to item", () => {
    const item = createTestItem();
    item.category = ItemCategory.Bow;
    item.augmentSockets = {
      empty: 0,
      current: 2,
      normal: 2,
      augments: [null, null],
    };

    const stat1 = makeCalcStat(
      "#% increased Physical Damage",
      18,
      ModifierType.Augment,
    );
    const stat2 = makeCalcStat(
      "Bow Attacks fire # additional Arrows",
      1,
      ModifierType.Augment,
    );
    item.statsByType = [stat1, stat2];
    item.newMods = [
      {
        info: {
          type: ModifierType.Augment,
          tags: [],
        },
        stats: [stat1.sources[0].stat, stat2.sources[0].stat],
      },
    ];

    __testExports.applyAugmentSockets(item);
    expect(item.augmentSockets.empty).toEqual(0);
    expect(item.augmentSockets.current).toEqual(2);
    expect(item.augmentSockets.normal).toEqual(2);
    expect(
      item.augmentSockets.augments.some(
        (i) => i?.refName === "Greater Iron Rune",
      ),
    ).toBeTruthy();
    expect(
      item.augmentSockets.augments.some(
        (i) => i?.refName === "Countess Seske's Rune of Archery",
      ),
    ).toBeTruthy();
  });

  it("should join multiline augments", () => {
    const item = createTestItem();
    item.category = ItemCategory.Staff;
    item.augmentSockets = {
      empty: 0,
      current: 2,
      normal: 2,
      augments: [null, null],
    };

    const stat1 = makeCalcStat(
      "Meta Skills gain #% increased Energy",
      40,
      ModifierType.Augment,
    );
    const stat2 = makeCalcStat(
      "#% increased Spirit",
      -25,
      ModifierType.Augment,
    );
    const stat3 = makeCalcStat(
      "#% increased Mana Regeneration Rate",
      20,
      ModifierType.Augment,
    );
    item.statsByType = [stat1, stat2, stat3];
    item.newMods = [
      {
        info: {
          type: ModifierType.Augment,
          tags: [],
        },
        stats: [
          stat1.sources[0].stat,
          stat2.sources[0].stat,
          stat3.sources[0].stat,
        ],
      },
    ];

    __testExports.applyAugmentSockets(item);
    expect(item.augmentSockets.empty).toEqual(0);
    expect(item.augmentSockets.current).toEqual(2);
    expect(item.augmentSockets.normal).toEqual(2);
    expect(
      item.augmentSockets.augments.some(
        (i) => i?.refName === "Idol of the Martyr",
      ),
    ).toBeTruthy();
    expect(
      item.augmentSockets.augments.some(
        (i) => i?.refName === "Lesser Inspiration Rune",
      ),
    ).toBeTruthy();
  });

  it("should handle bonded mods", () => {
    const item = createTestItem();
    item.category = ItemCategory.BodyArmour;
    item.augmentSockets = {
      empty: 1,
      current: 1,
      normal: 2,
      augments: [null, null],
    };

    const Bonded = makeCalcStat(
      "Bonded: #% to Quality of all Skills",
      5,
      ModifierType.Augment,
    );
    const nonBonded = makeCalcStat(
      "Idols socketed in this item gain the benefits of their Bonded modifiers",
      1,
      ModifierType.Augment,
    );
    item.statsByType = [Bonded, nonBonded];
    item.newMods = [
      {
        info: {
          type: ModifierType.Augment,
          tags: [],
        },
        stats: [Bonded.sources[0].stat, nonBonded.sources[0].stat],
      },
    ];

    __testExports.applyAugmentSockets(item);
    expect(item.augmentSockets.empty).toEqual(1);
    expect(item.augmentSockets.current).toEqual(1);
    expect(item.augmentSockets.normal).toEqual(2);
    expect(item.augmentSockets.augments).toHaveLength(2);
    expect(item.augmentSockets.augments[0]?.refName).toBe("Fox Idol");
    expect(item.augmentSockets.augments[1]).toBeNull();
  });

  it("fills empty sockets with the augments saved for the item's category", () => {
    AppConfig<PriceCheckWidget>("price-check")!.savedAugments = {
      [ItemCategory.Bow]: ["Greater Iron Rune", "Greater Iron Rune"],
    };
    const item = createTestItem();
    item.category = ItemCategory.Bow;
    item.augmentSockets = {
      empty: 0,
      current: 2,
      normal: 2,
      augments: [null, null],
    };

    __testExports.applyAugmentSockets(item);
    expect(
      item.augmentSockets.augments.map((augment) => augment?.refName),
    ).toEqual(["Greater Iron Rune", "Greater Iron Rune"]);
    expect(item.statsByType.map((calc) => calc.type)).toEqual([
      ModifierType.AddedAugment,
    ]);
  });
});
