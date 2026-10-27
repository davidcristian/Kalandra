import {
  ItemCategory,
  itemIsModifiable,
  ItemRarity,
  ParsedItem,
} from "@/parser";
import { EXPLICIT_MOD_TYPES, ModifierType } from "@/parser/modifiers";
import { ITEM_BY_REF } from "@/assets/data";

/** Returns the trade name of a unique's base type, or `base` when the item data lacks it. */
export function uniqueBaseTradeName(base: string, useEn: boolean): string {
  const info = ITEM_BY_REF("ITEM", base)?.[0];
  if (!info) return base;
  return useEn ? info.refName : info.name;
}

export function maxUsefulItemLevel(category: ItemCategory | undefined) {
  const itemLevelCaps: Partial<Record<ItemCategory, number>> = {
    [ItemCategory.Wand]: 81,
    [ItemCategory.Staff]: 81,
    [ItemCategory.Relic]: 80,
    [ItemCategory.Tablet]: 1,
    [ItemCategory.Jewel]: 1,
    [ItemCategory.Map]: 1,
  };

  const maxUsefulItemLevel = category ? (itemLevelCaps[category] ?? 82) : 82;
  return maxUsefulItemLevel;
}

export function likelyFinishedItem(item: ParsedItem) {
  return (
    item.rarity === ItemRarity.Unique ||
    item.statsByType.some((calc) => calc.type === ModifierType.Crafted) ||
    // Quality of exactly 20 marks a finished item: items drop with less, and a base with more
    // sells for crafting
    (item.quality === 20 && !item.qualityType) ||
    !itemIsModifiable(item)
  );
}

export function hasCraftingValue(item: ParsedItem) {
  // A cap of 1 marks a category whose item level does not matter.
  const itemLevelCap = maxUsefulItemLevel(item.category);
  return (
    itemIsModifiable(item) &&
    (item.isSynthesised ||
      item.isFractured ||
      item.influences.length ||
      (item.category === ItemCategory.Jewel &&
        item.rarity === ItemRarity.Magic) ||
      (itemLevelCap !== 1 && (item.itemLevel ?? 0) >= itemLevelCap - 15) ||
      (item.augmentSockets &&
        item.augmentSockets.current > item.augmentSockets.normal) ||
      (item.quality && item.quality > 20))
  );
}

export function explicitModifierCount(item: ParsedItem) {
  const randomMods = item.newMods.filter((mod) =>
    EXPLICIT_MOD_TYPES.has(mod.info.type),
  );
  if (randomMods.length === 0) {
    return { prefixes: 0, suffixes: 0, total: 0 };
  }

  const prefixes = randomMods.filter(
    (mod) => mod.info.generation === "prefix",
  ).length;
  const suffixes = randomMods.filter(
    (mod) => mod.info.generation === "suffix",
  ).length;

  return {
    prefixes,
    suffixes,
    total: prefixes + suffixes,
  };
}
