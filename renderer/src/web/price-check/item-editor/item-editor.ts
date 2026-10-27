import { BaseType, CATALYST_TO_TAG, CATALYST_TYPES } from "@/assets/data";
import { cachePerDataLoad } from "@/assets/data/loads";
import { ItemRarity, ParsedItem } from "@/parser";
import type { EditorItem } from "@/parser/ParsedItem";
import { recalculateItemProperties } from "@/parser/calc-base";
import { ARMOUR, ItemCategory, ItemEditorType, WEAPON } from "@/parser/meta";
import { sumStatsByModType } from "@/parser/modifiers";
import type { DbQuery } from "@/web/background/Prices";

export function getItemEditorType(item: ParsedItem): ItemEditorType {
  if (!item.category) return ItemEditorType.None;

  if (item.rarity === ItemRarity.Unique) return ItemEditorType.None;

  if (
    item.category === ItemCategory.Ring ||
    item.category === ItemCategory.Amulet ||
    item.category === ItemCategory.Jewel
  ) {
    return ItemEditorType.Catalyst;
  } else if (WEAPON.has(item.category) || ARMOUR.has(item.category)) {
    return ItemEditorType.Augment;
  } else {
    return ItemEditorType.None;
  }
}

/** Returns the catalysts for an item of the category, built once for each load of the item data. */
export const categoryCatalysts = cachePerDataLoad(
  (category: ItemCategory): EditorItem[] =>
    (category === ItemCategory.Jewel
      ? CATALYST_TYPES.Refined
      : CATALYST_TYPES.Normal
    ).map((catalyst) => ({
      name: catalyst.name,
      refName: catalyst.refName,
      icon: catalyst.icon,
      displayString: CATALYST_TO_TAG[catalyst.tags[1]].join(", "),
      stats: [],
      baseItem: catalyst,
    })),
);

/** Returns the modifiers that have a tag of the catalyst, each once even when several of its tags match. */
function catalysedMods(item: ParsedItem, qualityType: string) {
  const tags = new Set(CATALYST_TO_TAG[qualityType]);
  return item.newMods.filter((mod) => mod.info.tags.some((t) => tags.has(t)));
}

export function applyCatalyst(
  item: ParsedItem,
  catalyst: BaseType,
  quality: number,
) {
  const oldItem = JSON.parse(JSON.stringify(item)) as ParsedItem;

  if (item.qualityType) {
    if (!item.qualityType.endsWith("_catalyst")) {
      throw new Error("Invalid quality type");
    }
    const oldQuality = item.quality ?? 0;
    for (const mod of catalysedMods(item, item.qualityType)) {
      mod.info.rollIncr = (mod.info.rollIncr ?? 0) - oldQuality;
      mod.info.addedIncr = undefined;
    }
  }

  item.quality = quality;
  item.qualityType = catalyst.tags[1];
  for (const mod of catalysedMods(item, item.qualityType)) {
    mod.info.rollIncr = (mod.info.rollIncr ?? 0) + quality;
    mod.info.addedIncr = true;
  }

  item.statsByType = sumStatsByModType(item.newMods);
  recalculateItemProperties(item, oldItem);
}

/**
 * Returns the price in divines of `amount` catalysts, or undefined when the price file has none.
 */
export function catalystCost(
  catalyst: BaseType,
  amount: number,
  findPrice: (query: DbQuery) => { primaryValue: number } | null,
): number | undefined {
  // The price file holds the English names from poe.ninja.
  const price = findPrice({ ns: "ITEM", name: catalyst.refName });
  return price ? price.primaryValue * amount : undefined;
}

export enum AugmentSaveType {
  Class = "class",
  CasterWeapon = "casterWeapon",
  MartialWeapon = "martialWeapon",
  Sceptre = "spectre",
  Armour = "armour",
  All = "all",
}

/** Returns the `savedAugments` key that the augment editor saves a set under, which `getSavedAugments` reads. */
export function augmentSaveKey(
  saveType: AugmentSaveType,
  category: ItemCategory | undefined,
): string {
  switch (saveType) {
    case AugmentSaveType.CasterWeapon:
    case AugmentSaveType.MartialWeapon:
    case AugmentSaveType.Armour:
    case AugmentSaveType.All:
      return saveType;
    default:
      return category ?? "Unknown";
  }
}
