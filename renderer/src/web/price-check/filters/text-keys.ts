import type { ModifierType } from "@/parser/modifiers";

/** Returns the key of the UI text that names a modifier type, such as item.mod_added_rune. */
export function modTypeKey(type: ModifierType): string {
  return `item.mod_${type.replaceAll("-", "_")}`;
}

/** Returns the key of the UI text that names a trade site category, such as item_category.weapon_bow. */
export function tradeCategoryKey(tradeId: string): string {
  return `item_category.${tradeId.replaceAll(".", "_")}`;
}
