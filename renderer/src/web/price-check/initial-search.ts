import { ParsedItem } from "@/parser";
import { CATEGORY_TO_TRADE_ID } from "./trade/pathofexile-trade";

/** Returns true when an automatic price check searches the trade site without waiting for the Search button. */
export function searchesAtOnce(item: ParsedItem): boolean {
  return (
    item.rarity !== undefined ||
    item.category === undefined ||
    !CATEGORY_TO_TRADE_ID.has(item.category)
  );
}
