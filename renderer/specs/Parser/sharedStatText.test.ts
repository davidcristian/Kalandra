import { init, STAT_BY_MATCH_STR } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { ModifierType } from "@/parser/modifiers";
import { setupTests } from "@specs/vitest.setup";
import { beforeEach, describe, expect, it } from "vitest";
import {
  KeystoneRuneLine,
  KeystoneUniqueLine,
  RandomKeystoneLine,
  TestItem,
} from "./items";

const RANDOM_KEYSTONE = "#(Ancestral Bond-Zealot's Oath)";

function statsOfType(expected: TestItem, type: ModifierType) {
  const item = parseClipboard(expected.rawText)._unsafeUnwrap();
  return {
    stats: item.newMods
      .filter((mod) => mod.info.type === type)
      .flatMap((mod) => mod.stats),
    unknown: item.unknownModifiers,
  };
}

beforeEach(async () => {
  setupTests();
  await init("en");
});

describe("stat lookup by a text that stats share", () => {
  it("returns every stat with the text, in the order of the data", () => {
    expect(
      STAT_BY_MATCH_STR("Iron Reflexes").map(({ stat }) => stat.ref),
    ).toEqual([RANDOM_KEYSTONE, "Iron Reflexes"]);
  });

  it("returns the one stat whose advanced text it is", () => {
    const matches = STAT_BY_MATCH_STR(
      "Iron Reflexes(Ancestral Bond-Zealot's Oath)",
    );

    expect(matches.map(({ stat }) => stat.ref)).toEqual([RANDOM_KEYSTONE]);
    expect(matches[0].matcher.value).toBe(21);
  });

  it("returns nothing for a text no stat has", () => {
    expect(STAT_BY_MATCH_STR("Iron Reflexes and more")).toEqual([]);
  });
});

describe("parsing a line whose text several stats share", () => {
  it("picks the stat with a rune id for a rune line", () => {
    const { stats, unknown } = statsOfType(
      KeystoneRuneLine,
      ModifierType.Augment,
    );

    expect(stats.map(({ stat }) => stat.ref)).toEqual(["Iron Reflexes"]);
    expect(stats[0].stat.trade.ids?.rune).toEqual(["rune.stat_326965591"]);
    expect(unknown).toEqual([]);
  });

  it("picks the stat without an advanced text for a line that has none", () => {
    const { stats } = statsOfType(KeystoneUniqueLine, ModifierType.Explicit);

    const last = stats[stats.length - 1];
    expect(last.stat.ref).toBe("Eldritch Battery");
    expect(last.stat.trade.ids?.explicit).toEqual(["explicit.stat_2262736444"]);
  });

  it("picks the random keystone stat for its advanced text", () => {
    const { stats } = statsOfType(RandomKeystoneLine, ModifierType.Explicit);

    const last = stats[stats.length - 1];
    expect(last.stat.ref).toBe(RANDOM_KEYSTONE);
    expect(last.roll?.option).toBe(9);
  });
});
