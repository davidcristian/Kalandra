/** The text of the pricer's status, shared by the widget's pricing block and the progress bar over the stash. */

import type { PricerState, PricerStatus } from "./pricer-state";
import type { StashListing } from "./stash-listings";

// A run that waits for its next search or has nothing left has no status line, only the progress
const STATUS_TEXT: Partial<Record<PricerStatus, string>> = {
  "no-league": "stash_prices.pricing_no_league",
  "no-prices": "stash_prices.pricing_no_prices",
  "reading": "stash_prices.pricing_reading",
  "price-check-open": "stash_prices.pricing_price_check_open",
  "busy": "stash_prices.pricing_busy",
  "budget-reached": "stash_prices.pricing_budget_reached",
  "rate-limited": "stash_prices.pricing_rate_limited",
  "pricing": "stash_prices.pricing_item",
  "error": "stash_prices.pricing_error",
};

export type Translate = (
  key: string,
  values: Record<string, unknown>,
) => string;

/** Returns the name of each listing by its id: the item's name, or its type line for an item without one. */
export function listingNames(
  listings: readonly StashListing[],
): Map<string, string> {
  return new Map(
    listings.map((listing) => [listing.id, listing.name || listing.typeLine]),
  );
}

/** Returns the line that says why pricing waits or which item it prices, or null when the status has no line. */
export function pricingStatusText(
  state: Pick<PricerState, "status" | "error" | "pricing">,
  names: ReadonlyMap<string, string>,
  reserve: number,
  t: Translate,
): string | null {
  const key = STATUS_TEXT[state.status];
  if (!key) return null;
  return t(key, {
    error: state.error ?? "",
    name: names.get(state.pricing ?? "") ?? "",
    reserve,
  });
}
