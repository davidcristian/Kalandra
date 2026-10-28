import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { present } from "@specs/present";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import type { IpcEvent } from "@ipc/types";
import type { ReaderSettings } from "@/web/stash-prices/reader-settings";
import type { ListingPrice } from "@/web/stash-prices/price-item";
import {
  readListing,
  type StashListing,
} from "@/web/stash-prices/stash-listings";
import type { StashPricer } from "@/web/stash-prices/stash-pricer";
import {
  copyOf,
  FakeTradeSite,
  SAVED,
  type SavedResult,
} from "./fake-trade-site";

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

const TAB = "kalandra-price-check";
const PACE = 15_000;
const RETRY = 30_000;
const INTERVAL = 10 * 60_000;
// The value of an Exalted Orb in Divine Orbs in the price file fixture
const EXALTED = 0.001846;

function saved(idStart: string): SavedResult {
  return present(SAVED.find((result) => result.id.startsWith(idStart)));
}

/** A listing of the tab with the item of a saved listing. */
function listing(id: string, from: SavedResult): StashListing {
  return present(readListing(copyOf(from, id, TAB)));
}

const HAMMER = saved("ed1e4577bc");
const MAUL = saved("00d17082eb");
const CROSSBOW = saved("288371ebfb");
const AMULET = saved("4ac2e3ccfc");
const LOGBOOK = saved("ae5ce7896b");
const BELT = saved("79aebac884");

/** A rune stack: the rune socketed in a saved listing, as the item of a listing of its own. */
function runeStack(id: string, size: number, typeLine = "Greater Iron Rune") {
  const staff = structuredClone(saved("2fa2f1ee71"));
  const [rune] = staff.item.socketedItems as Array<Record<string, unknown>>;
  const stack = { name: "Stack Size", values: [[`${size}/10`, 0]], type: 32 };
  const properties = [stack, ...(rune.properties as unknown[]).slice(1)];
  const item = { ...rune, id, stackSize: size, typeLine, baseType: typeLine };
  return listing(id, { ...staff, item: { ...item, properties } });
}

/** Offers of a saved listing from different sellers, the cheapest first, at the prices in Exalted Orbs given. */
function offers(prices: number[], prefix = "offer"): SavedResult[] {
  return prices.map((amount, idx) => {
    const offer = copyOf(HAMMER, `${prefix}-${idx}`, "Shop");
    offer.listing.account = { name: `Offer${idx}#000${idx}`, online: null };
    offer.listing.price = { type: "~b/o", amount, currency: "exalted" };
    return offer;
  });
}

/** The price file fixture with a price for the unique amulet and for a Greater Iron Rune. */
function priceFile(): string {
  const file = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../priceService/tests/fixtures/price_file.json",
      ),
      "utf8",
    ),
  );
  file.itemOverviews.push(
    {
      type: "UniqueAccessories",
      lines: [
        {
          name: "Revered Resin",
          variant: "Amber Amulet",
          primaryValue: 0.5,
          detailsId: "revered-resin",
          sparkline: { totalChange: 0, data: [] },
        },
      ],
    },
    {
      type: "Runes",
      lines: [
        {
          name: "Greater Iron Rune",
          primaryValue: 0.01,
          detailsId: "greater-iron-rune",
          sparkline: { totalChange: 0, data: [] },
        },
      ],
    },
  );
  return JSON.stringify(file);
}

describe("the stash pricer", () => {
  let site: FakeTradeSite;
  let file: string | null;
  let mainLog: string[];
  let app: {
    settings: ReaderSettings;
    listings: StashListing[];
    leagueId: string | undefined;
    priceCheckShown: boolean;
    readerChecking: boolean;
  };
  let pricer: StashPricer;

  beforeEach(async () => {
    vi.useFakeTimers();
    // The rate limiters, the price file and the game data are shared state of their modules, so each test imports new ones
    vi.resetModules();
    setupTests({
      accountName: "Seller05#0005",
      widgets: [
        priceCheckWidgetMock({
          apiLatencySeconds: 2,
          coreCurrency: "exalted",
          collapseListings: "app",
          activateStockFilter: false,
          searchStatRange: 10,
          defaultAllSelected: false,
          suggestedPrice: false,
        }),
      ],
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // The test setup connects the parser to the modules it imported before the reset
    (await import("@/web/parser-settings")).connectParserSettings();
    (await import("@/web/background/TradeData")).connectTradeLists();
    const { init } = await import("@/assets/data");
    await init("en");
    site = new FakeTradeSite();
    file = priceFile();
    const { Host } = await import("@/web/background/IPC");
    const { PRICE_HOST } = await import("@/web/background/price-source");
    vi.mocked(Host.proxy).mockImplementation(async (url, init) => {
      if (!String(url).startsWith(PRICE_HOST)) return site.proxy(url, init);
      return file ? new Response(file) : new Response("", { status: 404 });
    });
    const { usePoeninja } = await import("@/web/background/Prices");
    const poeninja = usePoeninja();
    poeninja.queuePricesFetch();
    await vi.waitFor(() => expect(poeninja.xchgRate.value).toBeDefined());
    mainLog = [];
    vi.mocked(Host.sendEvent).mockImplementation((event: IpcEvent) => {
      if (event.name === "CLIENT->MAIN::log-entry") {
        mainLog.push(`${event.payload.level} ${event.payload.message}`);
      }
    });
    app = {
      settings: {
        enabled: true,
        tabName: TAB,
        intervalMinutes: 10,
        searchBudget: 400,
      },
      listings: [],
      leagueId: "Standard",
      priceCheckShown: false,
      readerChecking: false,
    };
    const { createStashPricer } = await import(
      "@/web/stash-prices/stash-pricer"
    );
    pricer = createStashPricer({
      settings: () => app.settings,
      listings: () => app.listings,
      leagueId: () => app.leagueId,
      accountName: () => "Seller05#0005",
      priceCheckShown: () => app.priceCheckShown,
      readerChecking: () => app.readerChecking,
    });
  });

  afterEach(() => {
    pricer.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Sets the listings of the tab, syncs the pricer and runs the timers for `ms`. */
  async function show(listings: StashListing[], ms = 0) {
    app.listings = listings;
    pricer.sync();
    await vi.advanceTimersByTimeAsync(ms);
  }

  function priceOf(id: string): ListingPrice | undefined {
    return pricer.state.prices.get(id);
  }

  function statuses(): Record<string, string> {
    return Object.fromEntries(
      [...pricer.state.prices].map(([id, price]) => [id, price.status]),
    );
  }

  it("prices a unique and a currency stack from the price file, with no trade request", async () => {
    await show([listing("amulet", AMULET), runeStack("runes", 7)]);

    expect(priceOf("amulet")).toEqual({
      status: "priced",
      value: 0.5,
      low: 0.5,
      high: 0.5,
      reliability: null,
      source: "price-file",
    });
    expect(priceOf("runes")).toMatchObject({ status: "priced", value: 0.07 });
    expect(site.searches).toEqual([]);
    expect(pricer.state).toMatchObject({
      status: "done",
      counts: { listings: 2, done: 2, priced: 2 },
    });
  });

  it("searches a rare with the default filters and its valuable stats, and suggests a price from the 20 cheapest", async () => {
    site.offers = offers([
      10, 11, 12, 13, 14, 15, 16, 17, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
      40, 41, 42, 43,
    ]);

    await show([listing("hammer", HAMMER)]);

    expect(site.searches).toHaveLength(1);
    expect(site.searches[0].url).toBe(
      "www.pathofexile.com/api/trade2/search/Standard",
    );
    const body = JSON.stringify(site.searches[0].body);
    // The Critical Damage Bonus of the hammer is tier 5, which the default filters leave off without the value list
    expect(body).toContain(
      '"id":"explicit.stat_2694482655","value":{"min":12},"disabled":false',
    );
    expect(site.fetches.map((fetch) => fetch.length)).toEqual([10, 10]);
    const price = present(priceOf("hammer"));
    expect(price).toMatchObject({
      status: "priced",
      reliability: "high",
      source: "listings",
    });
    if (price.status !== "priced") throw new Error("Not priced");
    // The cheapest of the 20 is 10 Exalted Orbs, and the 25th percentile of the 20 is 14.75
    expect(price.value).toBeCloseTo(10 * EXALTED);
    expect(price.low).toBeCloseTo(10 * EXALTED);
    expect(price.high).toBeCloseTo(14.75 * EXALTED);
  });

  it("prices the newest listing first and sends at most one search every 15 seconds", async () => {
    site.offers = offers([10, 10, 10, 10, 10, 10, 10, 10]);
    await show([
      listing("a", HAMMER),
      listing("b", MAUL),
      listing("c", CROSSBOW),
    ]);

    expect(site.searches).toHaveLength(1);
    expect(statuses()).toEqual({ a: "priced", b: "queued", c: "queued" });
    expect(pricer.state).toMatchObject({
      status: "waiting",
      nextSearchAt: Date.now() + PACE,
    });

    await vi.advanceTimersByTimeAsync(PACE - 1);
    expect(site.searches).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(statuses()).toEqual({ a: "priced", b: "priced", c: "queued" });
    await vi.advanceTimersByTimeAsync(PACE);
    expect(site.searches).toHaveLength(3);
    expect(pricer.state.status).toBe("done");
  });

  it("marks too few listings, an unreadable item, and an item sold only in bulk that the price file does not price", async () => {
    site.offers = offers([10, 11]);

    await show([
      listing("hammer", HAMMER),
      listing("logbook", LOGBOOK),
      runeStack("runes", 3, "Lesser Iron Rune"),
    ]);

    expect(priceOf("hammer")).toEqual({ status: "too-few" });
    expect(priceOf("logbook")).toEqual({
      status: "cannot-read",
      reason: "stash_prices.unreadable",
    });
    expect(priceOf("runes")).toEqual({
      status: "cannot-read",
      reason: "stash_prices.no_estimate",
    });
    expect(site.searches).toHaveLength(1);
    expect(pricer.state.counts).toMatchObject({
      done: 3,
      tooFew: 1,
      cannotRead: 2,
    });
  });

  it("marks a listing whose filters cannot be built as unreadable, and prices the others", async () => {
    // Without the price check's settings, no filters can be built
    const { AppConfig } = await import("@/web/Config");
    const config = AppConfig();
    const widgets = config.widgets;
    config.widgets = [];

    await show([listing("belt", BELT), listing("amulet", AMULET)]);
    config.widgets = widgets;

    expect(priceOf("belt")).toEqual({
      status: "cannot-read",
      reason: "stash_prices.unreadable",
    });
    expect(priceOf("amulet")).toMatchObject({ status: "priced" });
    expect(site.searches).toEqual([]);
  });

  it.each([
    ["the price check is shown", "price-check-open"],
    ["the reader checks the tab", "reading"],
  ] as const)(
    "sends no search while %s, and tries again 30 seconds later",
    async (_, status) => {
      site.offers = offers([10, 10, 10]);
      if (status === "reading") app.readerChecking = true;
      else app.priceCheckShown = true;

      await show([listing("hammer", HAMMER)]);
      expect(pricer.state).toMatchObject({
        status,
        nextSearchAt: Date.now() + RETRY,
      });

      app.readerChecking = false;
      app.priceCheckShown = false;
      await vi.advanceTimersByTimeAsync(RETRY);
      expect(site.searches).toHaveLength(1);
    },
  );

  it("sends no search while a fetch waits in the limiters, or while a restriction holds the searches", async () => {
    site.offers = offers([10, 10, 10]);
    const common = await import("@/web/price-check/trade/common");
    const [fetchLimiter] = common.RATE_LIMIT_RULES.FETCH;
    void fetchLimiter.wait();
    const queued = fetchLimiter.wait();

    await show([listing("hammer", HAMMER)]);
    expect(pricer.state.status).toBe("busy");

    for (const limiter of common.RATE_LIMIT_RULES.SEARCH) limiter.restrict(60);
    await vi.advanceTimersByTimeAsync(RETRY);
    await queued;
    expect(pricer.state).toMatchObject({
      status: "rate-limited",
      nextSearchAt: Date.now() + RETRY,
    });

    await vi.advanceTimersByTimeAsync(RETRY);
    expect(site.searches).toHaveLength(1);
  });

  it("stops at the budget less the searches the reader needs in 3 hours", async () => {
    site.offers = offers([10, 10, 10]);
    site.searchesIn3Hours = 382;
    await show([listing("a", HAMMER), listing("b", MAUL)], PACE);

    expect(site.searches).toHaveLength(1);
    expect(pricer.state).toMatchObject({
      status: "budget-reached",
      nextSearchAt: Date.now() + INTERVAL,
    });

    app.settings.searchBudget = 401;
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(site.searches).toHaveLength(2);
  });

  it("leaves more searches to a reader that checks every 5 minutes", async () => {
    site.offers = offers([10, 10, 10]);
    site.searchesIn3Hours = 364;
    app.settings.intervalMinutes = 5;

    await show([listing("a", HAMMER), listing("b", MAUL)], PACE);

    expect(site.searches).toHaveLength(1);
    expect(pricer.state.status).toBe("budget-reached");
  });

  it("stops on a trade error, and tries again after the interval, the failed listing after the queued ones", async () => {
    site.offers = offers([10, 10, 10]);
    site.failure = {
      status: 429,
      body: JSON.stringify({
        error: { code: 3, message: "Rate limit exceeded" },
      }),
      headers: { "retry-after": "60" },
    };

    await show([listing("a", HAMMER), listing("b", MAUL)], INTERVAL - 1);
    expect(priceOf("a")).toEqual({
      status: "failed",
      message: "Rate limit exceeded",
    });
    expect(pricer.state).toMatchObject({
      status: "error",
      error: "Rate limit exceeded",
    });
    expect(site.searches).toHaveLength(1);
    expect(mainLog).toEqual([
      "warn [stash-prices] Pricing a listing failed: Rate limit exceeded",
    ]);

    // A new listing during the wait is queued, and waits too
    await show([...app.listings, listing("c", CROSSBOW)]);
    expect(site.searches).toHaveLength(1);
    expect(pricer.state.nextSearchAt).toBe(Date.now() + 1);

    site.failure = null;
    await vi.advanceTimersByTimeAsync(1);
    expect(statuses()).toEqual({ a: "failed", b: "priced", c: "queued" });
    await vi.advanceTimersByTimeAsync(2 * PACE);
    expect(statuses()).toEqual({ a: "priced", b: "priced", c: "priced" });
    expect(pricer.state.error).toBeNull();
  });

  it("puts a listing back when the price check holds its fetches too long, and fetches it later", async () => {
    site.offers = offers(Array.from({ length: 15 }, () => 10));
    await show([listing("a", HAMMER), listing("b", MAUL)]);
    site.offers = offers(
      Array.from({ length: 15 }, () => 10),
      "other",
    );
    site.afterFetch = () => {
      app.priceCheckShown = true;
      site.afterFetch = null;
    };

    await vi.advanceTimersByTimeAsync(PACE + RETRY);
    expect(priceOf("b")).toEqual({ status: "queued" });
    expect(pricer.state.status).toBe("price-check-open");
    expect(site.fetches).toHaveLength(3);

    app.priceCheckShown = false;
    await vi.advanceTimersByTimeAsync(RETRY);
    expect(priceOf("b")).toMatchObject({ status: "priced" });
    // The second search of the listing is an answer of the price check's cache
    expect(site.searches).toHaveLength(2);
    expect(site.fetches).toHaveLength(4);
  });

  it("keeps the price of a listing that stays, forgets those that leave, and queues a new one", async () => {
    site.offers = offers([10, 10, 10]);
    await show([
      listing("a", HAMMER),
      listing("b", CROSSBOW),
      listing("x", AMULET),
    ]);
    expect(statuses()).toEqual({ a: "priced", b: "queued", x: "priced" });

    await show([listing("c", MAUL), listing("a", HAMMER)], PACE);

    expect(statuses()).toEqual({ c: "priced", a: "priced" });
    expect(site.searches).toHaveLength(2);
    expect(pricer.state.status).toBe("done");
  });

  it("stops and forgets every price when it is turned off, also during a search", async () => {
    site.offers = offers([10, 10, 10]);
    site.afterFetch = () => {
      app.settings.enabled = false;
      pricer.sync();
    };

    await show([listing("a", HAMMER)], PACE);

    expect(pricer.state).toMatchObject({
      status: "off",
      counts: { listings: 0 },
    });
    expect(site.fetches).toHaveLength(1);
  });

  it("waits for the league and for the price file", async () => {
    app.leagueId = undefined;
    await show([listing("a", HAMMER)]);
    expect(pricer.state.status).toBe("no-league");

    // A league change loads the price file of the new league, which this one does not have
    file = null;
    const { useLeagues } = await import("@/web/background/Leagues");
    useLeagues().selectedId.value = "Hardcore";
    app.leagueId = "Hardcore";
    await vi.advanceTimersByTimeAsync(RETRY);
    expect(pricer.state.status).toBe("no-prices");
    expect(site.searches).toEqual([]);
  });
});
