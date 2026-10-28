import { describe, expect, it } from "vitest";
import { TradeResponseError } from "@/web/price-check/trade/trade-response";
import { RateLimiter } from "@/web/price-check/trade/RateLimiter";
import {
  readListing,
  readSearch,
  reindexedIds,
} from "@/web/stash-prices/stash-listings";
import { threeHourSearchCount } from "@/web/stash-prices/stash-requests";
import { clampBudget, clampInterval } from "@/web/stash-prices/reader-settings";
import { SAVED, type SavedResult } from "./fake-trade-site";

describe("readSearch", () => {
  it("returns the query id, the listing ids and the total", () => {
    const data = { id: "q1", result: ["a", "b"], total: 150, inexact: false };

    expect(readSearch(data, 200)).toEqual({
      queryId: "q1",
      ids: ["a", "b"],
      total: 150,
    });
  });

  it.each([
    ["no query id", { result: [], total: 0 }],
    ["an id that is not text", { id: "q1", result: [1], total: 1 }],
    ["no total", { id: "q1", result: [] }],
    ["a list", []],
  ])("throws a TradeResponseError for a result with %s", (_, data) => {
    expect(() => readSearch(data, 200)).toThrow(TradeResponseError);
  });
});

describe("readListing", () => {
  it("reads a saved fetch result without a name as an empty name", () => {
    const listing = readListing(structuredClone(SAVED[0]));

    expect(listing).toMatchObject({
      name: "",
      typeLine: "Collector's Corsair Cap of Curvation",
      stashName: "9",
      x: 2,
      y: 2,
      w: 2,
      h: 2,
    });
  });

  it.each([
    [
      "no stash",
      (r: SavedResult) => Reflect.deleteProperty(r.listing, "stash"),
    ],
    ["no item id", (r: SavedResult) => Reflect.deleteProperty(r.item, "id")],
    ["a negative x", (r: SavedResult) => (r.listing.stash.x = -1)],
    ["a width that is not a number", (r: SavedResult) => (r.item.w = "2")],
    ["no item", (r: SavedResult) => Reflect.deleteProperty(r, "item")],
  ])("returns undefined for a result with %s", (_, change) => {
    const result = structuredClone(SAVED[0]);
    change(result);

    expect(readListing(result)).toBeUndefined();
  });

  it("returns undefined for a null result, which the site sends for a listing that is gone", () => {
    expect(readListing(null)).toBeUndefined();
  });
});

describe("reindexedIds", () => {
  it("returns an id the new result lists before an id it followed", () => {
    expect(reindexedIds(["a", "b", "c"], ["c", "a", "b"])).toEqual(["c"]);
    expect(reindexedIds(["a", "b", "c", "d"], ["b", "c", "d", "a"])).toEqual([
      "d",
      "c",
      "b",
    ]);
  });

  it("returns nothing for new ids above the old ones, or ids that left the result", () => {
    expect(reindexedIds(["a", "b", "c"], ["x", "y", "a", "c"])).toEqual([]);
    expect(reindexedIds([], ["a", "b"])).toEqual([]);
  });
});

describe("threeHourSearchCount", () => {
  it("returns the hits of the limiter with the longest window, once it is 3 hours", () => {
    const short = new RateLimiter(8, 12);
    const long = new RateLimiter(600, 10802);
    long.addHits(250);
    short.addHits(3);

    expect(threeHourSearchCount([short, long])).toBe(250);
    expect(threeHourSearchCount([short])).toBeUndefined();
    expect(threeHourSearchCount([])).toBeUndefined();
  });
});

describe("the interval and budget settings", () => {
  it("checks at most every 5 minutes, and uses 10 for a value that is not a number", () => {
    expect([1, 5, 12.4, Number.NaN].map(clampInterval)).toEqual([5, 5, 12, 10]);
  });

  it("keeps the budget between 0 and 600, and uses 400 for a value that is not a number", () => {
    expect([-5, 0, 250.6, 900, Number.NaN].map(clampBudget)).toEqual([
      0, 0, 251, 600, 400,
    ]);
  });
});
