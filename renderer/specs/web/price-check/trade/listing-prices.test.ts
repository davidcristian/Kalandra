import { present } from "@specs/present";
import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { Host } from "@/web/background/IPC";
import { usePoeninja } from "@/web/background/Prices";
import { PRICE_HOST } from "@/web/background/price-source";
import {
  PricingResult,
  requestResults,
} from "@/web/price-check/trade/pathofexile-trade";
import {
  SuggestedPrice,
  suggestedPriceText,
  suggestPrice,
} from "@/web/price-check/trade/suggested-price";

vi.mock("@/web/background/Leagues", async () => {
  const { computed, shallowRef } = await import("vue");
  const selectedId = shallowRef("Standard");
  const selected = computed(() => ({
    id: selectedId.value,
    realm: "pc-ggg",
    isPopular: true,
  }));
  return { useLeagues: () => ({ selectedId, selected }) };
});

interface PriceFile {
  itemOverviews: Array<{
    type: string;
    lines: Array<{ name: string; id?: string; primaryValue: number }>;
  }>;
}

interface SavedListing {
  id: string;
  listing: { price: { amount: number; currency: string } };
}

const FETCH_URL = "www.pathofexile.com/api/trade2/fetch/";

function readFixture(file: string): string {
  return fs.readFileSync(path.resolve(__dirname, file), "utf-8");
}

/** The price file fixture with a Greater Chaos Orb line, written in the key order of its Chaos Orb line. */
function priceFileWithGreaterChaosOrb(): string {
  const file: PriceFile = JSON.parse(
    readFixture("../../../../../priceService/tests/fixtures/price_file.json"),
  );
  const currency = present(
    file.itemOverviews.find((list) => list.type === "Currency"),
  );
  const chaos = present(currency.lines.find((line) => line.id === "chaos"));
  currency.lines.push({
    ...chaos,
    name: "Greater Chaos Orb",
    primaryValue: 0.05,
    id: "greater-chaos-orb",
  });
  return JSON.stringify(file);
}

/** The 21 saved listings, with the one priced in 3 Exalted Orbs changed to 3 Greater Chaos Orbs. */
function savedListings(): SavedListing[] {
  const saved: { result: SavedListing[] } = JSON.parse(
    readFixture("../../../docs/fetchResponses.json"),
  );
  const greaterChaos = present(
    saved.result.find((result) => result.id.startsWith("03d4465694")),
  );
  greaterChaos.listing.price.currency = "greater-chaos-orb";
  return saved.result;
}

/** The fetch response for the listings whose ids start with the requested ones. */
function fetchResponse(listings: SavedListing[], request: string): string {
  const ids = request.split("?")[0].split(",");
  return JSON.stringify({
    result: ids.map((id) =>
      present(listings.find((listing) => listing.id.startsWith(id))),
    ),
  });
}

function prices(results: PricingResult[]) {
  return results.map((result) => ({
    amount: result.priceAmount,
    currency: result.priceCurrency,
    value: result.normalizedPrice,
    valueCurrency: result.normalizedPriceCurrency?.id,
  }));
}

describe("requestResults prices", () => {
  let fetches: string[];

  beforeEach(async () => {
    setupTests({
      widgets: [priceCheckWidgetMock({ coreCurrency: "exalted" })],
    });
    await init("en");
    fetches = [];
    const priceFile = priceFileWithGreaterChaosOrb();
    const listings = savedListings();
    vi.mocked(Host.proxy).mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith(`${PRICE_HOST}/prices/`)) {
        return new Response(priceFile);
      }
      if (!url.startsWith(FETCH_URL)) throw new Error(`No fake for ${url}`);
      const request = url.slice(FETCH_URL.length);
      fetches.push(request);
      return new Response(fetchResponse(listings, request));
    });
    const poeninja = usePoeninja();
    poeninja.queuePricesFetch();
    await vi.waitFor(() =>
      expect(
        poeninja.findPriceByQuery({ ns: "ITEM", name: "Greater Chaos Orb" }),
      ).not.toBeNull(),
    );
  });

  it("values a Greater Chaos Orb price by its trade tag, fresh and from the cache", async () => {
    const ids = ["00d17082eb", "03d4465694"];

    const fresh = await requestResults("query", ids, { accountName: "" });
    const cached = await requestResults("query", ids, { accountName: "" });

    expect(fetches).toEqual(["00d17082eb,03d4465694?query=query"]);
    const expected = [
      {
        amount: 1,
        currency: "alch",
        value: "1 . 5",
        valueCurrency: "exalted",
      },
      {
        amount: 3,
        currency: "G. chaos",
        value: "81",
        valueCurrency: "exalted",
      },
    ];
    expect(prices(fresh)).toEqual(expected);
    expect(prices(cached)).toEqual(expected);
  });

  it("values the saved listings in Divine Orbs and suggests a price from them", async () => {
    const ids = savedListings().map((listing) => listing.id);

    const results = await requestResults("query", ids, { accountName: "" });

    const byId = (prefix: string) =>
      present(results.find((result) => result.id.startsWith(prefix)));
    expect(byId("00d17082eb").priceDivines).toBe(0.002835);
    expect(byId("03d4465694").priceDivines).toBeCloseTo(0.15);
    expect(byId("2fa2f1ee71").priceDivines).toBe(3);
    expect(byId("65c7c4e8e6").priceDivines).toBeUndefined();
    expect(suggestPrice(results)).toEqual({
      price: 0.001846,
      low: 0.001846,
      high: 0.002835,
      reliability: "medium",
      sellers: 14,
      leftOut: 0,
    });
  });

  it("writes the suggested price in Exalted Orbs, or in Divine Orbs when the whole range is above one", () => {
    const suggested = (price: number, low: number, high: number) => {
      const value: SuggestedPrice = {
        price,
        low,
        high,
        reliability: "low",
        sellers: 2,
        leftOut: 0,
      };
      return suggestedPriceText(value);
    };

    expect(suggested(0.01, 0.005, 0.02)).toEqual({
      price: "5 . 4 ex",
      range: "2 . 7 ~ 11 ex",
    });
    expect(suggested(3, 2, 4)).toEqual({ price: "3 div", range: "2 ~ 4 div" });
    expect(suggested(1.2, 0.5, 2)).toEqual({
      price: "650 ex",
      range: "271 ~ 1083 ex",
    });
  });
});
