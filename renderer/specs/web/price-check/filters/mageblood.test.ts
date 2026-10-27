import { present } from "@specs/present";
import { beforeEach, describe, expect, it } from "vitest";
import { reactive } from "vue";
import { setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions } from "@specs/helper";
import { UniqueItem } from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import type { StatFilter } from "@/web/price-check/filters/interfaces";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { createUniquePresets } from "@/web/price-check/filters/create-unique-filters";
import { createTradeRequest } from "@/web/price-check/trade/pathofexile-trade";

const LEGACY = "explicit.stat_264262054";
const OPTION = { Topaz: 14, Gold: 5, Jade: 7, Ruby: 9 };
type Kind = keyof typeof OPTION;
/** The option of each "Legacy of #" line in stats.ndjson. */
const ALL_OPTIONS = [5, 7, 9, 14, 2, 11, 3, 4, 6, 13, 1, 10, 12, 8];

/** A Mageblood in the game's advanced copy format, with one "Legacy of" line per entry. */
function mageblood(legacies: Kind[]): string {
  return [
    "Item Class: Belts",
    "Rarity: Unique",
    "Mageblood",
    "Utility Belt",
    "--------",
    "Item Level: 82",
    "--------",
    "{ Implicit Modifier }",
    "20% of Flask Recovery applied Instantly",
    "{ Implicit Modifier — Charm }", // dashcheck: allow, the game's item text
    "Has 3(1-3) Charm Slots",
    "--------",
    ...legacies.flatMap((kind) => [
      "{ Unique Modifier }",
      `Legacy of ${kind}(Amethyst-Topaz) — Unscalable Value`, // dashcheck: allow, the game's item text
    ]),
    "{ Unique Modifier }",
    "All Mage's Legacies have 40(25-50)% increased effect per duplicate Mage's Legacy you have",
    "",
  ].join("\n");
}

function presetOf(legacies: Kind[]) {
  const item = parseClipboard(mageblood(legacies))._unsafeUnwrap();
  const { presets, active } = createPresets(item, createTestCreateOptions());
  return { item, presets, active, stats: presets[0].stats };
}

function legacyFilter(stats: StatFilter[], kind: Kind) {
  return present(stats.find((stat) => stat.option?.value === OPTION[kind]));
}

function duplicatesFilter(stats: StatFilter[]) {
  return present(stats.find((stat) => stat.tradeId[0] === "item.duplicates"));
}

/** The stat groups of the search, after `change` edits the stat filters as the user would. */
function search(legacies: Kind[], change?: (stats: StatFilter[]) => void) {
  const { item, presets, stats } = presetOf(legacies);
  change?.(stats);
  return createTradeRequest(presets[0].filters, stats, item).query.stats;
}

function legacyIds(kinds: Kind[]) {
  return kinds.map((kind) => `${LEGACY}|${OPTION[kind]}`);
}

/** The id and value of each Legacy filter in the "and" group of a search. */
function andLegacies(stats: ReturnType<typeof search>) {
  return stats[0].filters
    .filter((filter) => filter.id.startsWith(LEGACY))
    .map((filter) => [filter.id, filter.value]);
}

describe("the price check of a Mageblood", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("makes one exact preset with a filter per Legacy kind and the duplicates", () => {
    const { presets, active, stats } = presetOf([
      "Topaz",
      "Topaz",
      "Gold",
      "Topaz",
    ]);

    expect(active).toBe("filters.preset_exact");
    expect(presets.map((preset) => preset.id)).toEqual([active]);
    expect(
      stats.map((stat) => [stat.statRef, stat.option?.value, stat.disabled]),
    ).toEqual([
      ["#% of Flask Recovery applied Instantly", undefined, true],
      ["Has # Charm Slot", undefined, false],
      [
        "All Mage's Legacies have #% increased effect per duplicate Mage's Legacy you have",
        undefined,
        false,
      ],
      ["Duplicates: #", undefined, false],
      ["Legacy of #", OPTION.Topaz, false],
      ["Legacy of #", OPTION.Gold, false],
    ]);
    const duplicates = duplicatesFilter(stats);
    expect(duplicates.hidden).toBeUndefined();
    expect(duplicates.roll).toMatchObject({
      value: 2,
      min: 2,
      bounds: { min: 0, max: 3 },
    });
    expect(legacyFilter(stats, "Topaz").roll).toBeUndefined();
    expect(legacyFilter(stats, "Gold").roll).toBeUndefined();
  });

  it("makes the preset of a reactive item and leaves the item's stats unchanged", () => {
    const item = reactive(
      parseClipboard(
        mageblood(["Topaz", "Gold", "Topaz", "Jade"]),
      )._unsafeUnwrap(),
    );
    const before = JSON.stringify(item.statsByType);

    const [preset] = createPresets(item, createTestCreateOptions()).presets;

    expect(JSON.stringify(item.statsByType)).toBe(before);
    expect(legacyFilter(preset.stats, "Topaz").sources).toEqual([
      expect.objectContaining({
        contributes: { value: 0, min: 0, max: 0, option: OPTION.Topaz },
      }),
    ]);
  });

  it("searches each kind and counts four rolls for two kinds with two duplicates", () => {
    const [and, count] = search(["Topaz", "Topaz", "Gold", "Topaz"]);

    expect(and.filters.map((filter) => filter.id)).toEqual(
      expect.arrayContaining(legacyIds(["Topaz", "Gold"])),
    );
    expect(count.type).toBe("count");
    expect(count.value).toEqual({ min: 4 });
    expect(count.filters.map((filter) => [filter.id, filter.value])).toEqual([
      [`${LEGACY}|14`, { min: 1 }],
      [`${LEGACY}|14`, { min: 2 }],
      [`${LEGACY}|14`, { min: 3 }],
      [`${LEGACY}|5`, { min: 1 }],
      [`${LEGACY}|5`, { min: 2 }],
      [`${LEGACY}|5`, { min: 3 }],
    ]);
  });

  it("counts seven rolls for three kinds with one duplicate", () => {
    const [, count] = search(["Topaz", "Gold", "Topaz", "Jade"]);

    expect(count.value).toEqual({ min: 7 });
    expect(count.filters.map((filter) => [filter.id, filter.value])).toEqual(
      legacyIds(["Topaz", "Gold", "Jade"]).flatMap((id) => [
        [id, { min: 1 }],
        [id, { min: 2 }],
        [id, { max: 2 }],
      ]),
    );
  });

  it("searches four of one kind when the belt has no other kind", () => {
    const stats = search(["Topaz", "Topaz", "Topaz", "Topaz"]);

    expect(stats).toHaveLength(1);
    expect(stats[0].filters).toContainEqual({
      id: `${LEGACY}|14`,
      value: { min: 4 },
      disabled: false,
    });
  });

  it("searches four different kinds without a count", () => {
    const stats = search(["Topaz", "Gold", "Jade", "Ruby"]);

    expect(stats).toHaveLength(1);
    const legacies = stats[0].filters.filter((filter) =>
      filter.id.startsWith(LEGACY),
    );
    expect(new Set(legacies.map((filter) => filter.id))).toEqual(
      new Set(legacyIds(["Topaz", "Gold", "Jade", "Ruby"])),
    );
    expect(legacies.every((filter) => !filter.value?.min)).toBe(true);
  });

  it.each<[Kind[], Array<[Kind, object]>]>([
    [
      ["Topaz", "Topaz", "Gold", "Topaz"],
      [
        ["Topaz", {}],
        ["Gold", {}],
      ],
    ],
    [
      ["Topaz", "Gold", "Topaz", "Jade"],
      [
        ["Topaz", {}],
        ["Gold", {}],
        ["Jade", {}],
      ],
    ],
    [
      ["Topaz", "Gold", "Jade", "Ruby"],
      [
        ["Topaz", {}],
        ["Gold", {}],
        ["Jade", {}],
        ["Ruby", {}],
      ],
    ],
    [["Topaz", "Topaz", "Topaz", "Topaz"], [["Topaz", { min: 4 }]]],
  ])("sends each Legacy kind of %j once in the and group", (belt, sent) => {
    expect(andLegacies(search(belt))).toEqual(
      sent.map(([kind, value]) => [legacyIds([kind])[0], value]),
    );
  });

  it("leaves out the duplicates when the Duplicates filter is off", () => {
    const stats = search(["Topaz", "Topaz", "Gold", "Topaz"], (filters) => {
      const duplicates = duplicatesFilter(filters);
      present(duplicates.roll).min = 3;
      duplicates.disabled = true;
    });

    expect(stats).toHaveLength(1);
    expect(stats[0].filters.map((filter) => filter.id)).not.toContain(
      "item.duplicates",
    );
    expect(andLegacies(stats)).toEqual([
      [`${LEGACY}|14`, {}],
      [`${LEGACY}|5`, {}],
    ]);
  });

  it("searches any kind twice for one checked kind and one duplicate", () => {
    const [, count] = search(["Topaz", "Gold", "Topaz", "Jade"], (filters) => {
      legacyFilter(filters, "Gold").disabled = true;
      legacyFilter(filters, "Jade").disabled = true;
    });

    expect(count.value).toEqual({ min: 1 });
    expect(count.filters).toEqual(
      ALL_OPTIONS.map((option) => ({
        id: `${LEGACY}|${option}`,
        value: { min: 2 },
      })),
    );
  });

  it("searches any kind once for one checked kind and two duplicates", () => {
    const [, count] = search(["Topaz", "Topaz", "Gold", "Topaz"], (filters) => {
      legacyFilter(filters, "Gold").disabled = true;
    });

    expect(count.value).toEqual({ min: 1 });
    expect(count.filters).toEqual(
      ALL_OPTIONS.map((option) => ({
        id: `${LEGACY}|${option}`,
        value: { min: 1 },
      })),
    );
  });

  it("fails a search whose duplicates and checked kinds add up to more than four", () => {
    expect(() =>
      search(["Topaz", "Gold", "Topaz", "Jade"], (filters) => {
        present(duplicatesFilter(filters).roll).min = 2;
      }),
    ).toThrow("not valid Mageblood, reduce duplicates or unselect a Legacy");
  });

  it("fails a search with the Duplicates filter for another item", () => {
    const { presets, stats } = presetOf(["Topaz", "Gold", "Jade", "Ruby"]);
    const other = parseClipboard(UniqueItem.rawText)._unsafeUnwrap();

    expect(() => createTradeRequest(presets[0].filters, stats, other)).toThrow(
      "Duplicates filter applied to non-mageblood",
    );
  });

  it("makes no unique presets for a unique without them", () => {
    const other = parseClipboard(UniqueItem.rawText)._unsafeUnwrap();

    expect(() => createUniquePresets(other, createTestCreateOptions())).toThrow(
      "item doesn't have unique presets",
    );
  });
});
