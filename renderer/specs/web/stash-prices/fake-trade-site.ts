import fs from "fs";
import path from "path";

/** A saved fetch result, with the fields the tests change. */
export interface SavedResult {
  id: string;
  item: Record<string, unknown> & { id: string };
  listing: Record<string, unknown> & {
    stash: { name: string; x: number; y: number };
  };
}

/** The 21 saved listings of specs/docs/fetchResponses.json, each with its stash tab and item id. */
export const SAVED: SavedResult[] = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../docs/fetchResponses.json"),
    "utf8",
  ),
).result;

/** Returns a copy of a saved listing with another id, in the tab `tab`. */
export function copyOf(
  saved: SavedResult,
  id: string,
  tab: string,
): SavedResult {
  const copy = structuredClone(saved);
  copy.id = id;
  copy.item.id = id;
  copy.listing.stash.name = tab;
  return copy;
}

const SEARCH = "www.pathofexile.com/api/trade2/search/";
const FETCH = "www.pathofexile.com/api/trade2/fetch/";

// The rules the trade site sent with a search and a fetch on 2026-10-28
const SEARCH_LIMITS = "8:10:60,15:60:120,60:300:1800,600:10800:3600";
const FETCH_LIMITS = "12:4:60,16:12:60,100:300:300,1000:10800:1800";

function headers(
  ip: string,
  ipState: string,
  account: string,
  accountState: string,
) {
  return {
    "x-rate-limit-rules": "Ip,Account",
    "x-rate-limit-ip": ip,
    "x-rate-limit-ip-state": ipState,
    "x-rate-limit-account": account,
    "x-rate-limit-account-state": accountState,
  };
}

interface Answer {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

/**
 * Answers the searches and fetches of the reader from `listings`, the account's listings without a price, newest
 * first. A search returns the first 100 ids, as the trade site does.
 */
export class FakeTradeSite {
  listings: SavedResult[] = SAVED.map((saved) => structuredClone(saved));
  searches: Array<{ url: string; method?: string; body: unknown }> = [];
  fetches: string[][] = [];
  /** The searches the site reports in its 3 hour window after a search. */
  searchesIn3Hours = 1;
  /** An answer the site sends instead of data, such as an error. */
  failure: Answer | null = null;
  /** Runs after each fetch, before the reader reads the response. */
  afterFetch: (() => void) | null = null;

  proxy = async (hostAndPath: string, init?: RequestInit) => {
    if (hostAndPath.startsWith(SEARCH)) {
      this.searches.push({
        url: hostAndPath,
        method: init?.method,
        body: JSON.parse(String(init?.body)),
      });
      if (this.failure) return this.answer(this.failure);
      const ids = this.listings.map((listing) => listing.id);
      return this.answer({
        status: 200,
        body: JSON.stringify({
          id: `query-${this.searches.length}`,
          result: ids.slice(0, 100),
          total: ids.length,
        }),
        headers: headers(
          SEARCH_LIMITS,
          `1:10:0,1:60:0,1:300:0,${this.searchesIn3Hours}:10800:0`,
          "3:5:60",
          "1:5:0",
        ),
      });
    }
    if (hostAndPath.startsWith(FETCH)) {
      const ids = hostAndPath.slice(FETCH.length).split("?")[0].split(",");
      this.fetches.push(ids);
      this.afterFetch?.();
      if (this.failure) return this.answer(this.failure);
      const result = ids.map(
        (id) => this.listings.find((listing) => listing.id === id) ?? null,
      );
      return this.answer({
        status: 200,
        body: JSON.stringify({ result }),
        headers: headers(
          FETCH_LIMITS,
          "1:4:0,1:12:0,1:300:0,1:10800:0",
          "6:4:10",
          "1:4:0",
        ),
      });
    }
    throw new Error(`The fake trade site has no answer for ${hostAndPath}`);
  };

  private answer({ status, body, headers }: Answer) {
    return new Response(body, { status, headers });
  }
}
