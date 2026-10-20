import { init, type Stat, type StatMatch } from "@/assets/data";
import { statFitsModifier, statMatchForLine } from "@/parser/match-stats";
import { ModifierType } from "@/parser/modifiers";
import { setupTests } from "@specs/vitest.setup";
import { beforeAll, describe, expect, it } from "vitest";

const LINE = "Iron Reflexes";

function match(
  ref: string,
  ids: Stat["trade"]["ids"],
  advanced?: string,
): StatMatch {
  const matcher = { string: LINE, advanced };
  const stat = { ref, better: 1, matchers: [matcher], trade: { ids } };
  return { stat, matcher };
}

const RANDOM_KEYSTONE = match(
  "#(Keystone)",
  { explicit: ["explicit.stat_1"] },
  "Iron Reflexes(A-Z)",
);
const KEYSTONE = match("Iron Reflexes", {
  explicit: ["explicit.stat_2"],
  rune: ["rune.stat_2"],
});
const EXPLICIT_ONLY = match("Explicit", { explicit: ["explicit.stat_3"] });
const RUNE_WITH_ADVANCED = match(
  "Rune",
  { rune: ["rune.stat_4"] },
  "Iron Reflexes(A-Z)",
);
const SANCTUM_A = match("Has Crystal Shard", { sanctum: ["sanctum.stat_5"] });
const SANCTUM_B = match("Has Glass Shard", { sanctum: ["sanctum.stat_6"] });
const SKILL = match("Grants Skill: Level # Parry", {});

beforeAll(async () => {
  setupTests();
  await init("en");
});

describe("statMatchForLine", () => {
  it("picks the stat with a trade id of the modifier type", () => {
    const matches = [EXPLICIT_ONLY, RUNE_WITH_ADVANCED];

    expect(statMatchForLine(matches, LINE, ModifierType.Augment)).toBe(
      RUNE_WITH_ADVANCED,
    );
    expect(statMatchForLine(matches, LINE, ModifierType.AddedAugment)).toBe(
      RUNE_WITH_ADVANCED,
    );
    expect(statMatchForLine(matches, LINE, ModifierType.Explicit)).toBe(
      EXPLICIT_ONLY,
    );
  });

  it("picks a stat with no other advanced text when the type fits both", () => {
    expect(
      statMatchForLine(
        [RANDOM_KEYSTONE, KEYSTONE],
        LINE,
        ModifierType.Explicit,
      ),
    ).toBe(KEYSTONE);
  });

  it("keeps the first stat in the data when the line does not tell them apart", () => {
    expect(
      statMatchForLine([SANCTUM_A, SANCTUM_B], LINE, ModifierType.Sanctum),
    ).toBe(SANCTUM_A);
  });

  it("returns the first stat when no stat has an id of the modifier type", () => {
    expect(
      statMatchForLine([SANCTUM_A, SANCTUM_B], LINE, ModifierType.Enchant),
    ).toBe(SANCTUM_A);
    expect(statMatchForLine([], LINE, ModifierType.Explicit)).toBe(undefined);
  });
});

describe("statFitsModifier", () => {
  it("accepts a stat with an id of the type, or one that grants a skill", () => {
    expect(statFitsModifier(KEYSTONE.stat, ModifierType.Augment)).toBe(true);
    expect(statFitsModifier(KEYSTONE.stat, ModifierType.AddedAugment)).toBe(
      true,
    );
    expect(statFitsModifier(EXPLICIT_ONLY.stat, ModifierType.Augment)).toBe(
      false,
    );
    expect(statFitsModifier(SKILL.stat, ModifierType.Skill)).toBe(true);
  });
});
