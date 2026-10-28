import { Host } from "@/web/background/IPC";
import {
  adjustRateLimits,
  getTradeEndpoint,
  RATE_LIMIT_RULES,
} from "@/web/price-check/trade/common";
import { RateLimiter } from "@/web/price-check/trade/RateLimiter";
import { readTradeData } from "@/web/price-check/trade/trade-response";
import {
  readListing,
  readSearch,
  stashSearchBody,
  type StashListing,
  type StashSearch,
} from "./stash-listings";

// The trade site's longest search window, 10800 seconds in x-rate-limit-ip, plus apiLatencySeconds
const THREE_HOURS_SECONDS = 3 * 60 * 60;

/** Returns the searches counted in the SEARCH limiter with the longest window, or undefined before the site sent a 3 hour window. */
export function threeHourSearchCount(
  limiters: Iterable<RateLimiter> = RATE_LIMIT_RULES.SEARCH,
): number | undefined {
  let longest: RateLimiter | undefined;
  for (const limiter of limiters) {
    if (!longest || limiter.window > longest.window) longest = limiter;
  }
  return longest && longest.window >= THREE_HOURS_SECONDS
    ? longest.stack.length
    : undefined;
}

/** Returns true when a request waits in one of the limiters, such as a price check search. */
export function hasQueue(limiters: Iterable<RateLimiter>): boolean {
  return Array.from(limiters).some((limiter) => limiter.queue.value > 0);
}

/** Returns the milliseconds one request would wait for the limiters, 0 when it can go now. */
export function waitTime(limiters: Iterable<RateLimiter>): number {
  return RateLimiter.estimateTime(1, limiters);
}

/** Sends the search for the account's listings without a price through the SEARCH limiters. */
export async function sendSearch(
  accountName: string,
  leagueId: string,
): Promise<StashSearch> {
  await RateLimiter.waitMulti(RATE_LIMIT_RULES.SEARCH);
  const response = await Host.proxy(
    `${getTradeEndpoint()}/api/trade2/search/${leagueId}`,
    {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stashSearchBody(accountName)),
    },
  );
  adjustRateLimits(RATE_LIMIT_RULES.SEARCH, response.headers);
  return readSearch(await readTradeData<unknown>(response), response.status);
}

/** Fetches up to 10 listings through the FETCH limiters and returns the readable ones by id. */
export async function sendFetch(
  queryId: string,
  ids: string[],
): Promise<Map<string, StashListing>> {
  await RateLimiter.waitMulti(RATE_LIMIT_RULES.FETCH);
  const response = await Host.proxy(
    `${getTradeEndpoint()}/api/trade2/fetch/${ids.join(",")}?query=${queryId}`,
  );
  adjustRateLimits(RATE_LIMIT_RULES.FETCH, response.headers);
  const data = await readTradeData<{ result?: unknown }>(response);

  const listings = new Map<string, StashListing>();
  const results: unknown[] = Array.isArray(data.result) ? data.result : [];
  for (const result of results) {
    const listing = readListing(result);
    if (listing) listings.set(listing.id, listing);
  }
  const unread = ids.filter((id) => !listings.has(id));
  if (unread.length) {
    console.warn(
      "[stash-prices] The fetch response has no readable listing for:",
      unread.join(", "),
    );
  }
  return listings;
}
