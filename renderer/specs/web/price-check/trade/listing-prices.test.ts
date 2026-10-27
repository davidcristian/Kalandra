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

/** Two saved listings, one priced in Orbs of Alchemy and one changed to 3 Greater Chaos Orbs. */
function fetchResponse(): string {
  const saved: { result: SavedListing[] } = JSON.parse(
    readFixture("../../../docs/fetchResponses.json"),
  );
  const byId = (prefix: string) =>
    present(saved.result.find((result) => result.id.startsWith(prefix)));
  const alchemy = byId("00d17082eb");
  const greaterChaos = byId("03d4465694");
  greaterChaos.listing.price.currency = "greater-chaos-orb";
  return JSON.stringify({ result: [alchemy, greaterChaos] });
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
    const listings = fetchResponse();
    vi.mocked(Host.proxy).mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith(`${PRICE_HOST}/prices/`)) {
        return new Response(priceFile);
      }
      if (!url.startsWith(FETCH_URL)) throw new Error(`No fake for ${url}`);
      fetches.push(url.slice(FETCH_URL.length));
      return new Response(listings);
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
});
