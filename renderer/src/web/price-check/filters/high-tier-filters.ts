import { ItemCategory, ItemRarity, ParsedItem } from "@/parser";
import { FilterTag, StatFilter } from "./interfaces";

const TIERED_TAGS = new Set([
  FilterTag.Explicit,
  FilterTag.Fractured,
  FilterTag.Desecrated,
]);

/** Turns on each shown explicit stat filter of a rare item that comes from a tier 1 or tier 2 modifier. */
export function enableHighTierFilters(
  filters: StatFilter[],
  item: ParsedItem,
): void {
  // The window marks no tier 1 or tier 2 modifier of a jewel either
  if (
    item.rarity !== ItemRarity.Rare ||
    item.isVeiled ||
    item.category === ItemCategory.Jewel
  ) {
    return;
  }
  for (const filter of filters) {
    if (filter.hidden || !TIERED_TAGS.has(filter.tag)) continue;
    const highTier = filter.sources.some((source) => {
      const tier = source.modifier.info.tier;
      return tier !== undefined && tier <= 2;
    });
    if (highTier) filter.disabled = false;
  }
}
