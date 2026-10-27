import { Settings } from "luxon";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions, createTestItem } from "@specs/helper";
import type { ParsedItem } from "@/parser";
import { Host } from "@/web/background/IPC";
import { createFilters } from "@/web/price-check/filters/create-item-filters";
import { execBulkSearch } from "@/web/price-check/trade/pathofexile-bulk";

const EXCHANGE_URL = "www.pathofexile.com/api/trade2/exchange/";
const NOW = "2026-10-25T20:00:00Z";

// Hand-written in the format the trade site sends, with limits high enough that no search waits
const RATE_LIMIT_HEADERS = {
  "content-type": "application/json",
  "x-rate-limit-policy": "trade-exchange-request-limit",
  "x-rate-limit-rules": "Ip",
  "x-rate-limit-ip": "60:1:60",
  "x-rate-limit-ip-state": "1:1:0",
};

interface Offer {
  currency: string;
  /** The amount of `currency` asked for `items` of the checked item. */
  amount: number;
  items?: number;
}

interface Seller {
  name?: string;
  online?: { status?: "afk" } | null;
}

let listingIds = 0;

/** One listing of the exchange response, with an offer for each entry of `offers`. */
function listing(offers: Offer[], seller: Seller = {}) {
  listingIds += 1;
  const id = `listing${listingIds}`;
  return {
    id,
    item: null,
    listing: {
      indexed: "2026-10-25T18:00:00Z",
      account: {
        name: seller.name ?? `Seller${listingIds}#0001`,
        lastCharacterName: `Character${listingIds}`,
        online:
          seller.online === undefined ? { league: "Standard" } : seller.online,
      },
      offers: offers.map((offer) => ({
        exchange: { currency: offer.currency, amount: offer.amount },
        item: { currency: "test", amount: offer.items ?? 1, stock: 40 },
      })),
    },
  };
}

function exchangeResponse(
  listings: Array<ReturnType<typeof listing>>,
  total = listings.length,
) {
  return {
    id: `query${listingIds}`,
    complexity: null,
    total,
    result: Object.fromEntries(listings.map((entry) => [entry.id, entry])),
  };
}

function priced(currency: string, amounts: number[]) {
  return amounts.map((amount) => listing([{ currency, amount }]));
}

/** An item with its own trade tag, so that no test reads the search of another from the cache. */
function itemWithTag(tradeTag: string): ParsedItem {
  const item = createTestItem();
  return { ...item, info: { ...item.info, tradeTag } };
}

describe("execBulkSearch", () => {
  let searches: Array<{ url: string; body: unknown }>;
  let answer: unknown;

  beforeEach(() => {
    setupTests({
      widgets: [priceCheckWidgetMock({ apiLatencySeconds: 2 })],
    });
    // The app sets the date locale of its language, as i18n.ts does
    Settings.defaultLocale = "en";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    searches = [];
    vi.mocked(Host.proxy).mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.startsWith(EXCHANGE_URL)) throw new Error(`No fake for ${url}`);
      searches.push({ url, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(answer), {
        headers: RATE_LIMIT_HEADERS,
      });
    });
  });

  afterEach(() => {
    Settings.defaultLocale = "";
    vi.useRealTimers();
  });

  function search(tradeTag: string, have: string[], accountName = "") {
    const item = itemWithTag(tradeTag);
    const filters = createFilters(item, {
      ...createTestCreateOptions(),
      exact: true,
    });
    return execBulkSearch(item, filters, have, { accountName });
  }

  it("lists the eight lowest prices per item and leaves out listings with several offers", async () => {
    const several = listing([
      { currency: "exalted", amount: 1, items: 100 },
      { currency: "exalted", amount: 2, items: 100 },
    ]);
    const single = priced("exalted", [9, 3, 7, 1, 8, 2, 10, 4, 6, 5]);
    single.push(listing([{ currency: "exalted", amount: 1, items: 2 }]));
    answer = exchangeResponse([several, ...single]);

    const [result] = await search("lowest", ["exalted"]);

    expect(searches).toEqual([
      {
        url: `${EXCHANGE_URL}Standard`,
        body: expect.objectContaining({
          query: expect.objectContaining({
            have: ["exalted"],
            want: ["lowest"],
          }),
        }),
      },
    ]);
    expect(result!.haveTag).toBe("exalted");
    expect(result!.total).toBe(12);
    expect(
      result!.listed.map((entry) => [entry.exchangeAmount, entry.itemAmount]),
    ).toEqual([
      [1, 2],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
    ]);
  });

  it("names the seller, the status and the user's own listing", async () => {
    answer = exchangeResponse([
      listing([{ currency: "exalted", amount: 1 }], { name: "Me#0001" }),
      listing([{ currency: "exalted", amount: 2 }], {
        online: { status: "afk" },
      }),
      listing([{ currency: "exalted", amount: 3 }], { online: null }),
    ]);

    const [result] = await search("seller", ["exalted"], "Me#0001");

    expect(
      result!.listed.map((entry) => [entry.isMine, entry.accountStatus]),
    ).toEqual([
      [true, "online"],
      [false, "afk"],
      [false, "offline"],
    ]);
    expect(result!.listed[0]).toMatchObject({
      accountName: "Me#0001",
      ign: expect.stringMatching(/^Character\d+$/),
      stock: 40,
      relativeDate: "2 hr. ago",
    });
  });

  it("splits a search for two currencies by the currency each offer asks", async () => {
    answer = exchangeResponse(
      [
        ...priced("divine", [3, 1, 2]),
        ...priced("exalted", [9, 8, 7, 6, 5, 4, 3, 2, 1]),
      ],
      40,
    );

    const [divine, exalted] = await search("split", ["divine", "exalted"]);

    expect(divine!.total).toBe(3);
    expect(divine!.listed.map((entry) => entry.exchangeAmount)).toEqual([
      1, 2, 3,
    ]);
    expect(exalted!.total).toBe(37);
    expect(exalted!.listed).toHaveLength(8);
  });

  it("leaves the exalted list out when the first page holds too few of its listings", async () => {
    answer = exchangeResponse(
      [
        ...priced("divine", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        ...priced("exalted", [1, 2]),
      ],
      250,
    );

    const [divine, exalted] = await search("later", ["divine", "exalted"]);

    expect(exalted).toBeNull();
    expect(divine!.total).toBe(248);
  });

  it("reads a repeated search from the cache", async () => {
    answer = exchangeResponse(priced("exalted", [4, 5]));
    const first = await search("cached", ["exalted", "chaos"]);

    const second = await search("cached", ["exalted", "chaos"]);

    expect(searches).toHaveLength(1);
    expect(second).toEqual(first);
  });
});
