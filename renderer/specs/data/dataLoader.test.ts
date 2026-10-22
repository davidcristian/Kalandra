import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "../vitest.setup";
import { init, STAT_BY_REF } from "@/assets/data";

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
