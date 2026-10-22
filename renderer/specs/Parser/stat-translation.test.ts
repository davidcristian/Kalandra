import { ModifierType } from "@/parser/modifiers";
import { __testExports } from "@/parser/stat-translations";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatBetter, type Stat, type StatMatch } from "@/assets/data";

/** The stat table and the trade site's stat list, in memory, keyed by their text. */
const lists = vi.hoisted(() => {
  const stats: Stat[] = [];
  return { stats, tradeIds: new Map<string, Record<string, string[]>>() };
});

vi.mock("@/assets/data", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  STAT_BY_MATCH_STR: (text: string): StatMatch[] =>
    lists.stats.flatMap((stat) => {
      const matcher = stat.matchers.find(
        (m) => m.string === text || m.advanced === text,
      );
      return matcher ? [{ stat, matcher }] : [];
    }),
  TRADE_STAT_BY_MATCH_STR: (text: string) => lists.tradeIds.get(text),
}));

const PHYS_TEXT = "#% increased Physical Damage";
const PHYS_LINE = "180(170-190)% increased Physical Damage";
const PHYS_IDS = {
  explicit: ["explicit.stat_1509134228"],
  fractured: ["fractured.stat_1509134228"],
  enchant: ["enchant.stat_1509134228"],
  rune: ["rune.stat_1509134228"],
  desecrated: ["desecrated.stat_1509134228"],
};
const PHYS_DAMAGE_STAT: Stat = {
  ref: PHYS_TEXT,
  better: StatBetter.PositiveRoll,
  matchers: [
    { string: PHYS_TEXT },
    { string: "#% reduced Physical Damage", negate: true },
    { string: "No Physical Damage", value: -100 },
  ],
  trade: { ids: PHYS_IDS },
};

const ENFEEBLE_LINE = "Players are Cursed with Enfeeble";
const ENFEEBLE_IDS = { explicit: ["explicit.stat_4103440490"] };
const EXACT_MATCH_STAT: Stat = {
  ref: ENFEEBLE_LINE,
  better: StatBetter.PositiveRoll,
  matchers: [{ string: ENFEEBLE_LINE }],
  trade: { ids: ENFEEBLE_IDS },
};

const RADIUS_LINE = "Upgrades Radius to Large";
const OPTION_STAT: Stat = {
  ref: "Upgrades Radius to #",
  better: StatBetter.PositiveRoll,
  matchers: [
    { string: RADIUS_LINE, value: 2 },
    { string: "Upgrades Radius to Medium", value: 1 },
  ],
  trade: {
    ids: {
      explicit: ["explicit.stat_3891355829"],
      fractured: ["fractured.stat_3891355829"],
      desecrated: ["desecrated.stat_3891355829"],
    },
    option: true,
  },
};

function parse(string: string, type = ModifierType.Explicit) {
  return __testExports.tryParseTranslation(
    { string, unscalable: false },
    type,
    undefined,
  );
}

describe("tryParseTranslation", () => {
  beforeEach(() => {
    lists.stats.length = 0;
    lists.tradeIds.clear();
  });

  it("returns undefined when neither list has the line", () => {
    lists.stats.push(EXACT_MATCH_STAT);
    lists.tradeIds.set(ENFEEBLE_LINE, ENFEEBLE_IDS);

    expect(parse(PHYS_LINE)).toBeUndefined();
  });

  it("parses the roll and its range from a stat table line", () => {
    lists.stats.push(PHYS_DAMAGE_STAT);

    const result = parse(PHYS_LINE);

    expect(result?.stat).toBe(PHYS_DAMAGE_STAT);
    expect(result?.translation).toBe(PHYS_DAMAGE_STAT.matchers[0]);
    expect(result?.roll).toEqual({
      unscalable: false,
      dp: false,
      value: 180,
      min: 170,
      max: 190,
    });
  });

  it("prefers the stat table to the trade stat list", () => {
    lists.stats.push(PHYS_DAMAGE_STAT);
    lists.tradeIds.set(PHYS_TEXT, PHYS_IDS);

    expect(parse(PHYS_LINE)?.stat).toBe(PHYS_DAMAGE_STAT);
  });

  it("builds a stat from the trade ids when the stat table lacks the line", () => {
    lists.tradeIds.set(PHYS_TEXT, PHYS_IDS);

    const result = parse(PHYS_LINE);

    expect(result?.stat).toEqual({
      ref: PHYS_TEXT,
      better: StatBetter.PositiveRoll,
      matchers: [{ string: PHYS_TEXT }],
      trade: { ids: PHYS_IDS },
    });
    expect(result?.translation).toEqual({ string: PHYS_TEXT });
    expect(result?.roll).toMatchObject({ value: 180, min: 170, max: 190 });
  });

  it("marks a roll above its range as legacy and widens the range", () => {
    lists.stats.push(PHYS_DAMAGE_STAT);

    const result = parse("220(170-190)% increased Physical Damage");

    expect(result?.stat).toBe(PHYS_DAMAGE_STAT);
    expect(result?.roll).toMatchObject({
      value: 220,
      min: 170,
      max: 220,
      legacy: true,
    });
  });

  it("returns the stat table's stat of a line without numbers and no roll", () => {
    lists.stats.push(EXACT_MATCH_STAT);
    lists.tradeIds.set(ENFEEBLE_LINE, ENFEEBLE_IDS);

    const result = parse(ENFEEBLE_LINE);

    expect(result?.stat).toBe(EXACT_MATCH_STAT);
    expect(result?.translation).toBe(EXACT_MATCH_STAT.matchers[0]);
    expect(result?.roll).toBeUndefined();
  });

  it("builds a stat without a roll from the trade ids of a line without numbers", () => {
    lists.tradeIds.set(ENFEEBLE_LINE, ENFEEBLE_IDS);

    const result = parse(ENFEEBLE_LINE);

    expect(result?.stat.ref).toBe(ENFEEBLE_LINE);
    expect(result?.stat.trade.ids).toEqual(ENFEEBLE_IDS);
    expect(result?.roll).toBeUndefined();
  });

  it("reads the option value of a stat table line as its roll", () => {
    lists.stats.push(OPTION_STAT);
    lists.tradeIds.set(RADIUS_LINE, { explicit: ["explicit.stat_3891355829"] });

    const result = parse(RADIUS_LINE);

    expect(result?.stat).toBe(OPTION_STAT);
    expect(result?.translation).toBe(OPTION_STAT.matchers[0]);
    expect(result?.roll).toMatchObject({
      value: 2,
      min: 2,
      max: 2,
      option: 2,
    });
  });

  it("keeps the option in the trade id of a trade stat line", () => {
    const ids = { explicit: ["explicit.stat_3891355829|2"] };
    lists.tradeIds.set(RADIUS_LINE, ids);

    const result = parse(RADIUS_LINE);

    expect(result?.stat.ref).toBe(RADIUS_LINE);
    expect(result?.stat.trade.ids).toEqual(ids);
    expect(result?.roll).toBeUndefined();
  });

  it("should not use a trade stat without a rune id for a rune line", () => {
    lists.tradeIds.set(ENFEEBLE_LINE, ENFEEBLE_IDS);

    expect(parse(ENFEEBLE_LINE, ModifierType.Augment)).toBeUndefined();
  });

  it("should use a trade stat with a rune id for an added rune line", () => {
    lists.tradeIds.set(PHYS_TEXT, PHYS_IDS);

    const result = parse(
      "36% increased Physical Damage",
      ModifierType.AddedAugment,
    );

    expect(result?.stat.trade.ids?.rune).toEqual(PHYS_IDS.rune);
    expect(result?.roll?.value).toBe(36);
  });
});
