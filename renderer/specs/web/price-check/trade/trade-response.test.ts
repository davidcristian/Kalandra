import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestFilters, createTestItemWithInfo } from "@specs/helper";
import { setupTests } from "@specs/vitest.setup";
import { Host } from "@/web/background/IPC";
import { useLeagues } from "@/web/background/Leagues";
import { useTradeData } from "@/web/background/TradeData";
import { execBulkSearch } from "@/web/price-check/trade/pathofexile-bulk";
import {
  requestResults,
  requestTradeResultList,
} from "@/web/price-check/trade/pathofexile-trade";
import {
  readTradeData,
  TradeResponseError,
} from "@/web/price-check/trade/trade-response";

const BOT_CHECK_PAGE =
  '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body></body></html>';

const webPage = (status: number) =>
  new Response(BOT_CHECK_PAGE, {
    status,
    headers: { "content-type": "text/html; charset=UTF-8" },
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("readTradeData", () => {
  it("returns the data of a JSON response", async () => {
    expect(await readTradeData(json({ result: ["a"] }))).toEqual({
      result: ["a"],
    });
  });

  it("names the status when the site sends a web page", async () => {
    const reading = readTradeData(webPage(503));

    await expect(reading).rejects.toBeInstanceOf(TradeResponseError);
    await expect(reading).rejects.toThrow(
      "The trade site sent a web page instead of data (status 503)",
    );
  });

  it.each([
    ["an empty body", ""],
    ["JSON that is not an object", "null"],
  ])("names the status for %s", async (_, body) => {
    await expect(
      readTradeData(new Response(body, { status: 200 })),
    ).rejects.toThrow("instead of data (status 200)");
  });

  it("throws the site's own error, such as a rate limit, with the status", async () => {
    const reading = readTradeData(
      json({ error: { code: 3, message: "Rate limit exceeded" } }, 429),
    );

    await expect(reading).rejects.toThrow("Rate limit exceeded");
    await expect(reading).rejects.toHaveProperty("status", 429);
  });

  it("names the status of a failed response without an error of the site", async () => {
    await expect(readTradeData(json({}, 500))).rejects.toThrow(
      "The trade site request failed (status 500)",
    );
  });
});

describe("a trade site request answered with a web page", () => {
  let warnings: unknown[][];

  beforeEach(() => {
    setupTests();
    vi.mocked(Host.proxy).mockImplementation(async () => webPage(503));
    warnings = [];
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails a search with the status", async () => {
    const body: Parameters<typeof requestTradeResultList>[0] = {
      query: { status: { option: "online" }, stats: [], filters: {} },
      sort: { price: "asc" },
    };

    await expect(requestTradeResultList(body, "Standard")).rejects.toThrow(
      "(status 503)",
    );
  });

  it("fails a fetch of listings with the status", async () => {
    await expect(
      requestResults("query", ["id"], { accountName: "" }),
    ).rejects.toThrow("(status 503)");
  });

  it("fails an exchange search with the status", async () => {
    const item = createTestItemWithInfo({ tradeTag: "divine" });
    const filters = createTestFilters({ listingType: "online" });

    await expect(
      execBulkSearch(item, filters, ["exalted"], { accountName: "" }),
    ).rejects.toThrow("(status 503)");
  });

  it("keeps the status as the league list error and logs it", async () => {
    const leagues = useLeagues();

    await leagues.load();

    expect(leagues.error.value).toContain("(status 503)");
    expect(warnings).toHaveLength(1);
  });

  it("keeps the status as the trade data error", async () => {
    const tradeData = useTradeData();

    await tradeData.load(true);

    expect(tradeData.error.value).toContain("(status 503)");
  });
});
