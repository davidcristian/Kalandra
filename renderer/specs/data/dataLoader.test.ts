import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "../vitest.setup";
import {
  __testExports,
  AugmentLineData,
  BaseType,
  init,
  STAT_BY_REF,
} from "@/assets/data";
import { ItemCategory } from "@/parser";

function rune(refName: string, augment?: AugmentLineData[]): BaseType {
  return {
    name: `${refName} name`,
    refName,
    namespace: "ITEM",
    icon: `${refName}.png`,
    tags: [],
    augment,
  };
}

const ARMOUR_LINE: AugmentLineData = {
  categories: [ItemCategory.BodyArmour],
  string: "+#% to Fire Resistance",
  values: [12],
  tradeId: ["rune.stat_3372524247", "rune.stat_other"],
};
const WEAPON_LINE: AugmentLineData = {
  categories: [ItemCategory.OneHandedMace],
  string: "Adds # to # Fire Damage",
  values: [4, 6],
  tradeId: ["rune.stat_709508406"],
};
const UNTRADED_LINE: AugmentLineData = {
  categories: [ItemCategory.Shield],
  string: "+# to Armour",
  values: [5],
};

describe("augmentsToLookup", () => {
  it("lists each trade stat of a rune under its ref name, in file order", () => {
    const lookup = __testExports.augmentsToLookup([
      rune("Desert Rune", [ARMOUR_LINE, UNTRADED_LINE, WEAPON_LINE]),
      rune("Iron Rune", [UNTRADED_LINE]),
      rune("Plain Item"),
    ]);

    expect(lookup).toEqual({
      "Desert Rune": [
        {
          augment: "Desert Rune name",
          refName: "Desert Rune",
          baseStat: "+#% to Fire Resistance",
          values: [12],
          id: "rune.stat_3372524247",
          categories: [ItemCategory.BodyArmour],
          icon: "Desert Rune.png",
        },
        {
          augment: "Desert Rune name",
          refName: "Desert Rune",
          baseStat: "Adds # to # Fire Damage",
          values: [4, 6],
          id: "rune.stat_709508406",
          categories: [ItemCategory.OneHandedMace],
          icon: "Desert Rune.png",
        },
      ],
    });
  });

  it("returns an empty lookup for no runes", () => {
    expect(__testExports.augmentsToLookup([])).toEqual({});
  });
});

describe("STAT_BY_REF on the English data", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    "Adds # to # Physical Damage",
    "Adds # to # Lightning Damage",
    "#% to Fire Resistance",
    "Knockback direction is reversed",
    "Regenerate # Life per second per Maximum Energy Shield",
    "Increases and Reductions to Minion Attack Speed also affect you",
    "Notable Passive Skills in Radius also grant Projectiles have #% chance for an additional Projectile when Forking",
    "Every Rage also grants #% increased Armour",
    "Recover #% of maximum Life for each Endurance Charge consumed",
    "#% increased Freeze Buildup",
    "Has Purple Smoke",
    "On Corruption, Item gains two Enchantments",
  ])("finds the stat %s", (ref) => {
    expect(STAT_BY_REF(ref)?.ref).toBe(ref);
  });
});
