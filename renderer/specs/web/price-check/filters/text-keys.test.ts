import { describe, expect, it } from "vitest";
import { ModifierType } from "@/parser/modifiers";
import { FilterTag } from "@/web/price-check/filters/interfaces";
import {
  modTypeKey,
  tradeCategoryKey,
} from "@/web/price-check/filters/text-keys";
import { CATEGORY_TO_TRADE_ID } from "@/web/price-check/trade/pathofexile-trade";
import { readMessages } from "../../app-i18n";

describe("the UI text keys built from item values", () => {
  const english = readMessages("en");
  const undefinedKeys = (keys: string[]) =>
    keys.filter((key) => !english.has(key));

  it("name each modifier type with a text of the English file", () => {
    expect(modTypeKey(ModifierType.AddedAugment)).toBe("item.mod_added_rune");
    const keys = Object.values(ModifierType).map(modTypeKey);
    expect(undefinedKeys(keys)).toEqual([]);
  });

  it("name each trade site category with a text of the English file", () => {
    expect(tradeCategoryKey("weapon.bow")).toBe("item_category.weapon_bow");
    const keys = [...CATEGORY_TO_TRADE_ID.values()].map(tradeCategoryKey);
    expect(undefinedKeys(keys)).toEqual([]);
  });

  it("have a category text only for a trade site category that the search sends", () => {
    // item_category.prop is the label that names the category
    const used = new Set([
      "item_category.prop",
      ...[...CATEGORY_TO_TRADE_ID.values()].map(tradeCategoryKey),
    ]);
    const unused = [...english.keys()].filter(
      (key) => key.startsWith("item_category.") && !used.has(key),
    );
    expect(unused).toEqual([]);
  });

  it("name each filter tag with a text of the English file", () => {
    // FilterModifier.vue builds this key, and a stat filter's tag can be any modifier type
    const tags: string[] = [
      ...Object.values(FilterTag),
      ...Object.values(ModifierType),
    ].filter((tag) => tag !== FilterTag.Property);
    const keys = tags.map((tag) => `filters.tag_${tag.replace("-", "_")}`);
    expect(undefinedKeys(keys)).toEqual([]);
  });
});
