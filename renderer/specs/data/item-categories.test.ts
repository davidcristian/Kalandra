import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import type { BaseType } from "@/assets/data";
import { ItemCategory } from "@/parser/meta";

const ITEMS_FILE = path.resolve(__dirname, "../../public/data/en/items.ndjson");

const PATH_OF_EXILE_1 =
  "a Path of Exile 1 category that code still checks, which refinement task 022 covers";

// Each category that no item data entry has, and where the parser gets it instead
const NOT_IN_ITEM_DATA = new Map<ItemCategory, string>([
  [ItemCategory.Unknown, "set when the item data names no category"],
  [ItemCategory.Gem, "set from the rarity line"],
  [ItemCategory.DivinationCard, "set from the rarity line"],
  [ItemCategory.CapturedBeast, "set from the help text"],
  [ItemCategory.MetamorphSample, "set from the help text"],
  [ItemCategory.Voidstone, "set from the help text"],
  [ItemCategory.Claw, "a category of the augment lines in the item data"],
  [ItemCategory.Waystone, "the item data gives a waystone the category Map"],
  [ItemCategory.AbyssJewel, PATH_OF_EXILE_1],
  [ItemCategory.FishingRod, PATH_OF_EXILE_1],
  [ItemCategory.RuneDagger, PATH_OF_EXILE_1],
  [ItemCategory.ClusterJewel, PATH_OF_EXILE_1],
  [ItemCategory.HeistBlueprint, PATH_OF_EXILE_1],
  [ItemCategory.HeistContract, PATH_OF_EXILE_1],
  [ItemCategory.HeistTool, PATH_OF_EXILE_1],
  [ItemCategory.HeistBrooch, PATH_OF_EXILE_1],
  [ItemCategory.HeistGear, PATH_OF_EXILE_1],
  [ItemCategory.HeistCloak, PATH_OF_EXILE_1],
  [ItemCategory.Trinket, PATH_OF_EXILE_1],
  [ItemCategory.Invitation, PATH_OF_EXILE_1],
  [ItemCategory.Sentinel, PATH_OF_EXILE_1],
  [ItemCategory.MemoryLine, PATH_OF_EXILE_1],
  [ItemCategory.SanctumRelic, PATH_OF_EXILE_1],
  [ItemCategory.Tincture, PATH_OF_EXILE_1],
]);

function craftableCategories(): Set<string> {
  const lines = fs.readFileSync(ITEMS_FILE, "utf8").split("\n");
  return new Set(
    lines
      .filter((line) => line.trim() !== "")
      .map((line) => (JSON.parse(line) as BaseType).craftable?.category)
      .filter((category) => category !== undefined),
  );
}

describe("ItemCategory and the craftable categories of en/items.ndjson", () => {
  const inData = craftableCategories();
  const categories: string[] = Object.values(ItemCategory);

  it("has a member for each craftable category of the item data", () => {
    expect([...inData].filter((value) => !categories.includes(value))).toEqual(
      [],
    );
  });

  it("has only members that the item data has, apart from the listed ones", () => {
    const missing = categories.filter((value) => !inData.has(value));

    expect(missing.toSorted()).toEqual([...NOT_IN_ITEM_DATA.keys()].toSorted());
  });
});
