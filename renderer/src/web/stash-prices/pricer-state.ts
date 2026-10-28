/** The state of the stash pricer, and the rules for when it may send a search. */

import { RATE_LIMIT_RULES } from "@/web/price-check/trade/common";
import type { ListingPrice } from "./price-item";
import {
  clampBudget,
  clampInterval,
  type ReaderSettings,
} from "./reader-settings";
import {
  hasQueue,
  type PauseReason,
  threeHourSearchCount,
  waitTime,
} from "./stash-requests";

const THREE_HOURS_MINUTES = 180;

export type PricerStatus =
  | "off"
  | "no-league"
  | "no-prices"
  | "reading"
  | PauseReason
  | "budget-reached"
  | "pricing"
  | "waiting"
  | "done"
  | "error";

export interface PriceCounts {
  listings: number;
  /** Listings with a price, with too few listings to price them, or whose item cannot be read. */
  done: number;
  priced: number;
  tooFew: number;
  cannotRead: number;
  failed: number;
}

export interface PricerState {
  status: PricerStatus;
  error: string | null;
  /** The price of each listing in the tab, by listing id. */
  prices: ReadonlyMap<string, ListingPrice>;
  counts: PriceCounts;
  /** The id of the listing that a search prices now, or null. */
  pricing: string | null;
  nextSearchAt: number | null;
}

/** Returns the searches the reader may need in 3 hours, one per interval, which pricing leaves for it. */
export function readerReserve(settings: ReaderSettings): number {
  return Math.ceil(
    THREE_HOURS_MINUTES / clampInterval(settings.intervalMinutes),
  );
}

export function countPrices(
  prices: ReadonlyMap<string, ListingPrice>,
): PriceCounts {
  const counts = {
    listings: prices.size,
    done: 0,
    priced: 0,
    tooFew: 0,
    cannotRead: 0,
    failed: 0,
  };
  for (const price of prices.values()) {
    if (price.status === "priced") counts.priced++;
    else if (price.status === "too-few") counts.tooFew++;
    else if (price.status === "cannot-read") counts.cannotRead++;
    else if (price.status === "failed") counts.failed++;
  }
  counts.done = counts.priced + counts.tooFew + counts.cannotRead;
  return counts;
}

/**
 * Returns why a pricing search must wait now, or null when it may go: the price check is shown, the reader checks
 * the tab, a request waits in the limiters, the 3 hour count reached the budget less the reader's searches, or a
 * search or fetch would wait in the limiters.
 */
export function searchPause(
  settings: ReaderSettings,
  priceCheckShown: boolean,
  readerChecking: boolean,
): PricerStatus | null {
  if (priceCheckShown) return "price-check-open";
  if (readerChecking) return "reading";
  if (hasQueue(RATE_LIMIT_RULES.SEARCH) || hasQueue(RATE_LIMIT_RULES.FETCH)) {
    return "busy";
  }
  const budget = clampBudget(settings.searchBudget) - readerReserve(settings);
  if ((threeHourSearchCount() ?? 0) >= budget) return "budget-reached";
  if (
    waitTime(RATE_LIMIT_RULES.SEARCH) > 0 ||
    waitTime(RATE_LIMIT_RULES.FETCH) > 0
  ) {
    return "rate-limited";
  }
  return null;
}
