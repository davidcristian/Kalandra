import { beforeEach, describe, expect, it, vi } from "vitest";
import { ItemFilters } from "@/web/price-check/filters/interfaces";
import { ParsedItem } from "@/parser";
import { useTradeApi } from "@/web/price-check/trade/trade-api";
import {
  createTradeRequest,
  PricingResult,
  requestResults,
  requestTradeResultList,
} from "@/web/price-check/trade/pathofexile-trade";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { settle } from "./held-requests";

vi.mock("@/web/price-check/trade/pathofexile-trade", () => {
  return {
    createTradeRequest: vi.fn(),
    requestTradeResultList: vi.fn(),
    requestResults: vi.fn(),
  };
});

describe("useTradeApi", () => {
  let composableResult: ReturnType<typeof useTradeApi>;

  beforeEach(async () => {
    setupTests();
    await init("en");
    composableResult = useTradeApi();
    vi.clearAllMocks();
  });

  it("initializes error and results as empty", () => {
    expect(composableResult.error.value).toBeNull();
    expect(composableResult.searchResult.value).toBeNull();
  });

  it("when trade request throws, error is set", async () => {
    vi.mocked(createTradeRequest).mockImplementation(() => {
      throw new Error("test");
    });

    expect(composableResult.error.value).toBeNull();
    await composableResult.search({} as ItemFilters, [], {} as ParsedItem);
    expect(composableResult.error.value).toBe("test");
    expect(createTradeRequest).toHaveBeenCalled();
  });

  it.each([
    [1, 1],
    [10, 1],
    [11, 2],
    [20, 2],
    [21, 3],
  ])(
    "%#. when result list has %i result(s), requestResults is called %i time(s)",
    async (resultCount, expectedCalls) => {
      vi.mocked(createTradeRequest).mockReturnValue(
        {} as ReturnType<typeof createTradeRequest>,
      );
      vi.mocked(requestTradeResultList).mockResolvedValue({
        id: "test",
        result: Array.from({ length: resultCount }, (_, i) => `test-${i}`),
        total: resultCount,
        inexact: false,
      });
      vi.mocked(requestResults).mockResolvedValue([
        {} as unknown as PricingResult,
      ]);

      expect(composableResult.error.value).toBeNull();
      await composableResult.search(
        { trade: { league: "test" } } as ItemFilters,
        [],
        {} as ParsedItem,
      );
      expect(composableResult.error.value).toBeNull();
      expect(requestResults).toHaveBeenCalledTimes(expectedCalls);
    },
  );

  it("keeps the newer search's state when an older search fails later", async () => {
    const olderListings = Promise.withResolvers<PricingResult[]>();
    vi.mocked(createTradeRequest).mockReturnValue(
      {} as ReturnType<typeof createTradeRequest>,
    );
    vi.mocked(requestTradeResultList).mockImplementation(
      async (_body, league) => ({
        id: league,
        result: [`${league}-listing`],
        total: 1,
      }),
    );
    vi.mocked(requestResults).mockImplementation(async (queryId, ids) =>
      queryId === "older" ? olderListings.promise : ids.map(listing),
    );

    const older = composableResult.search(
      { trade: { league: "older" } } as ItemFilters,
      [],
      {} as ParsedItem,
    );
    await settle();
    await composableResult.search(
      { trade: { league: "newer" } } as ItemFilters,
      [],
      {} as ParsedItem,
    );
    olderListings.reject(new Error("Rate limit exceeded"));
    await older;

    expect(composableResult.error.value).toBeNull();
    expect(composableResult.searchResult.value?.id).toBe("newer");
    expect(composableResult.groupedResults.value.map((res) => res.id)).toEqual([
      "newer-listing",
    ]);
  });
});

function listing(id: string): PricingResult {
  return {
    id,
    relativeDate: "",
    priceAmount: 1,
    priceCurrency: "exalted",
    isMine: false,
    hasNote: true,
    isInstantBuyout: false,
    accountName: id,
    accountStatus: "online",
    ign: id,
  };
}
