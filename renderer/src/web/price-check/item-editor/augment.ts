import { AugmentGroup, BaseType, GROUPED_AUGMENTS } from "@/assets/data";
import { cachePerDataLoad } from "@/assets/data/loads";
import { ItemCategory } from "@/parser";
import { buildEditorItems } from "@/parser/augment-builder";
import { EditorItem } from "@/parser/ParsedItem";

export function getCategoryGroups(
  augments: AugmentGroup<BaseType>,
  category: ItemCategory,
): AugmentGroup<EditorItem> {
  return {
    Rune: {
      Lesser: buildEditorItems(augments.Rune.Lesser, category),
      Normal: buildEditorItems(augments.Rune.Normal, category),
      Greater: buildEditorItems(augments.Rune.Greater, category),
      Perfect: buildEditorItems(augments.Rune.Perfect, category),
      Other: buildEditorItems(augments.Rune.Other, category),
    },
    SoulCore: {
      Normal: buildEditorItems(augments.SoulCore.Normal, category),
      Special: buildEditorItems(augments.SoulCore.Special, category),
    },
    Idol: buildEditorItems(augments.Idol, category),
    Legacy: buildEditorItems(augments.Legacy, category),
    Other: buildEditorItems(augments.Other, category),
  };
}

/** Returns the augments that fit the category, built once for each load of the item data. */
export const categoryAugments = cachePerDataLoad((category: ItemCategory) =>
  getCategoryGroups(GROUPED_AUGMENTS, category),
);
