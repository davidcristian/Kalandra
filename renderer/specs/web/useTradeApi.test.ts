import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ItemFilters } from "@/web/price-check/filters/interfaces";
import { useTradeApi } from "@/web/price-check/trade/trade-api";
import type {
  PricingResult,
  SearchResult,
} from "@/web/price-check/trade/pathofexile-trade";
import { createTestItem } from "@specs/helper";
import { setupTests } from "@specs/vitest.setup";
import { settle } from "./held-requests";

/** The trade site in memory: a saved search for each league, its listings, and fetches held by query id. */
const site = vi.hoisted(() => ({
  searches: new Map<string, SearchResult>(),
  listings: new Map<string, PricingResult>(),
  held: new Map<string, Promise<PricingResult[]>>(),
}));

vi.mock("@/web/price-check/trade/pathofexile-trade", () => ({
  createTradeRequest: () => ({}),
  requestTradeResultList: async (_request: unknown, league: string) => {
    const search = site.searches.get(league);
    if (!search) throw new Error(`No search for ${league}`);
    return search;
  },
  requestResults: async (queryId: string, ids: string[]) =>
    site.held.get(queryId) ?? ids.flatMap((id) => site.listings.get(id) ?? []),
}));

interface SavedListing {
  id: string;
  listing: {
    price: { amount: number; currency: string };
    account: { name: string; lastCharacterName: string };
  };
}

/** The 21 listings of specs/docs/fetchResponses.json; the 8th has the 2nd one's seller and price. */
function savedListings(): PricingResult[] {
  const file = path.resolve(__dirname, "../docs/fetchResponses.json");
  const saved: { result: SavedListing[] } = JSON.parse(
    fs.readFileSync(file, "utf8"),
  );
  return saved.result.map(({ id, listing }) => ({
    ...listingOf(id),
    priceAmount: listing.price.amount,
    priceCurrency: listing.price.currency,
    accountName: listing.account.name,
    ign: listing.account.lastCharacterName,
  }));
}

function oneSellerListings(count: number): PricingResult[] {
  return Array.from({ length: count }, (_, i) => listingOf(`copy-${i}`));
}

function saveSearch(league: string, listings: PricingResult[]) {
  for (const listing of listings) site.listings.set(listing.id, listing);
  site.searches.set(league, {
    id: league,
    result: listings.map((listing) => listing.id),
    total: listings.length,
  });
}

function filtersFor(league: string): ItemFilters {
  return {
    searchExact: {},
    trade: {
      offline: false,
      onlineInLeague: false,
      listingType: "any",
      listed: undefined,
      currency: undefined,
      league,
      collapseListings: "app",
    },
  };
}

describe("useTradeApi", () => {
  let api: ReturnType<typeof useTradeApi>;

  const search = (league: string) =>
    api.search(filtersFor(league), [], createTestItem());
  const rows = () =>
    api.groupedResults.value.map((row) => [row.id, row.listedTimes]);

  beforeEach(() => {
    setupTests();
    site.searches.clear();
    site.listings.clear();
    site.held.clear();
    api = useTradeApi();
  });

  it("initializes error and results as empty", () => {
    expect(api.error.value).toBeNull();
    expect(api.searchResult.value).toBeNull();
  });

  it("sets the error of a search that fails and shows no rows", async () => {
    await search("Standard");

    expect(api.error.value).toBe("No search for Standard");
    expect(api.searchResult.value).toBeNull();
    expect(rows()).toEqual([]);
  });

  it("shows no rows for a search without results", async () => {
    saveSearch("Standard", []);

    await search("Standard");

    expect(api.error.value).toBeNull();
    expect(api.searchResult.value?.total).toBe(0);
    expect(rows()).toEqual([]);
  });

  it("reads the first two pages and groups a seller's listings at one price", async () => {
    const listings = savedListings().slice(0, 20);
    saveSearch("Standard", listings);

    await search("Standard");

    const expected = listings
      .filter((_, i) => i !== 7)
      .map((listing) => [listing.id, listing.id === listings[1].id ? 2 : 1]);
    expect(rows()).toEqual(expected);
  });

  it("stops reading once it has 10 rows with 7 of them listed at most twice", async () => {
    const listings = savedListings();
    saveSearch("Standard", listings);

    await search("Standard");

    expect(rows()).toHaveLength(19);
    expect(rows().map(([id]) => id)).not.toContain(listings[20].id);
  });

  it("reads one more page at a time while the listings make few rows", async () => {
    saveSearch("Standard", oneSellerListings(35));

    await search("Standard");

    expect(rows()).toEqual([["copy-0", 35]]);
  });

  it("reads at most 100 listings", async () => {
    saveSearch("Standard", oneSellerListings(150));

    await search("Standard");

    expect(rows()).toEqual([["copy-0", 100]]);
  });

  it("keeps the newer search's state when an older search fails later", async () => {
    const olderListings = Promise.withResolvers<PricingResult[]>();
    saveSearch("older", [listingOf("older-listing")]);
    saveSearch("newer", [listingOf("newer-listing")]);
    site.held.set("older", olderListings.promise);

    const older = search("older");
    await settle();
    await search("newer");
    olderListings.reject(new Error("Rate limit exceeded"));
    await older;

    expect(api.error.value).toBeNull();
    expect(api.searchResult.value?.id).toBe("newer");
    expect(rows()).toEqual([["newer-listing", 1]]);
  });
});

function listingOf(id: string): PricingResult {
  return {
    id,
    relativeDate: "",
    priceAmount: 1,
    priceCurrency: "exalted",
    isMine: false,
    hasNote: true,
    isInstantBuyout: false,
    accountName: "Seller01#0001",
    accountStatus: "online",
    ign: "Seller01",
  };
}
