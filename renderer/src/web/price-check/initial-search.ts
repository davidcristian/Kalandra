import { ItemCategory, ItemRarity, ParsedItem } from "@/parser";
import { CATEGORY_TO_TRADE_ID } from "./trade/pathofexile-trade";

/** Returns true when an automatic price check searches the trade site without waiting for the Search button. */
export function searchesAtOnce(
  item: ParsedItem,
  suggestedPrice: boolean,
): boolean {
  if (item.category === undefined || !CATEGORY_TO_TRADE_ID.has(item.category)) {
    return true;
  }
  if (suggestedPrice) return item.rarity !== undefined;
  return (
    item.rarity === ItemRarity.Unique ||
    item.category === ItemCategory.Charm ||
    item.isUnidentified ||
    item.isVeiled === true
  );
}
