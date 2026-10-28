/** Prices one item of the stash tab as the price check does: from the price file, or from the cheapest listings. */

import type { ParsedItem } from "@/parser";
import { usePoeninja } from "@/web/background/Prices";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { presetOptions } from "@/web/price-check/preset-options";
import { apiToSatisfySearch } from "@/web/price-check/trade/common";
import {
  createTradeRequest,
  type PricingResult,
  requestResults,
  requestTradeResultList,
} from "@/web/price-check/trade/pathofexile-trade";
import {
  type Reliability,
  suggestPrice,
} from "@/web/price-check/trade/suggested-price";
import { getDetailsId } from "@/web/price-check/trends/getDetailsId";
import type { PauseReason } from "./stash-requests";

/** The price of one listing of the tab, or why it has none yet. */
export type ListingPrice =
  | { status: "queued" }
  | { status: "pricing" }
  | {
      status: "priced";
      /** In Divine Orbs, for the whole stack. */
      value: number;
      low: number;
      high: number;
      /** Null for a price from the price file, which has no reliability. */
      reliability: Reliability | null;
      source: "price-file" | "listings";
    }
  | { status: "too-few" }
  | { status: "cannot-read"; reason: string }
  | { status: "failed"; message: string };

/** The reason for an item that the price file does not price and that the trade site lists only in bulk. */
export const NO_ESTIMATE = "stash_prices.no_estimate";

// The price check reads the 20 cheapest listings first, two fetches, and its suggested price counts those
const COMPARED = 20;
const FETCH_SIZE = 10;

/** Returns the price check's estimate from the price file, for the whole stack, or undefined when the file has none. */
function fileEstimate(item: ParsedItem): ListingPrice | undefined {
  const query = getDetailsId(item);
  const entry = query && usePoeninja().findPriceByQuery(query);
  if (!entry) return undefined;
  const value = entry.primaryValue * (item.stackSize?.value ?? 1);
  return {
    status: "priced",
    value,
    low: value,
    high: value,
    reliability: null,
    source: "price-file",
  };
}

/** Returns the price check's default filters with its list of valuable stats, or undefined for a bulk exchange item. */
function searchPreset(item: ParsedItem, league: string) {
  const { presets, active } = createPresets(item, {
    ...presetOptions({ league, currency: undefined, listingType: undefined }),
    valuableSelected: true,
  });
  const preset = presets.find((preset) => preset.id === active) ?? presets[0];
  return apiToSatisfySearch(item, preset.stats, preset.filters) === "bulk"
    ? undefined
    : preset;
}

/** Returns the price of an item that needs no search, from the price file or as one it cannot price, else undefined. */
export function priceWithoutSearch(
  item: ParsedItem,
  league: string,
): ListingPrice | undefined {
  const estimate = fileEstimate(item);
  if (estimate || searchPreset(item, league)) return estimate;
  return { status: "cannot-read", reason: NO_ESTIMATE };
}

/** What a search needs from the pricer: where to search, and the wait before each fetch. */
export interface SearchRequest {
  league: string;
  accountName: string;
  holdFetch: () => Promise<PauseReason | "stopped" | null>;
}

/**
 * Searches the item with the price check's default filters and its list of valuable stats, fetches the 20 cheapest
 * listings and suggests a price from them, as the suggested price line does. Returns why it stopped when
 * `holdFetch` holds a fetch, and throws the trade site's errors.
 */
export async function searchPrice(
  item: ParsedItem,
  request: SearchRequest,
): Promise<ListingPrice | PauseReason | "stopped"> {
  const preset = searchPreset(item, request.league);
  if (!preset) return { status: "cannot-read", reason: NO_ESTIMATE };

  const search = await requestTradeResultList(
    createTradeRequest(preset.filters, preset.stats, item),
    request.league,
  );
  const ids = search.result.slice(0, COMPARED);
  const listings: PricingResult[] = [];
  for (let start = 0; start < ids.length; start += FETCH_SIZE) {
    const held = await request.holdFetch();
    if (held) return held;
    listings.push(
      ...(await requestResults(
        search.id,
        ids.slice(start, start + FETCH_SIZE),
        { accountName: request.accountName },
      )),
    );
  }

  const suggested = suggestPrice(listings);
  if (!suggested) return { status: "too-few" };
  return {
    status: "priced",
    value: suggested.price,
    low: suggested.low,
    high: suggested.high,
    reliability: suggested.reliability,
    source: "listings",
  };
}
