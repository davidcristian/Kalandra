import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import type { IpcEvent } from "@ipc/types";
import type * as Common from "@/web/price-check/trade/common";
import type * as Reader from "@/web/stash-prices/stash-reader";
import type { ReaderSettings } from "@/web/stash-prices/reader-settings";
import type { StashListing } from "@/web/stash-prices/stash-listings";
import { copyOf, FakeTradeSite, SAVED } from "./fake-trade-site";

// In the saved listings, the tab named "5" holds three items and "1 Alchem" two
const TAB = "5";
const IN_TAB = SAVED.filter((saved) => saved.listing.stash.name === TAB).map(
  (saved) => saved.id,
);
const IN_ALCHEM = SAVED.filter(
  (saved) => saved.listing.stash.name === "1 Alchem",
).map((saved) => saved.id);
const INTERVAL = 10 * 60_000;
const RETRY = 30_000;

function ids(listings: StashListing[]): string[] {
  return listings.map((listing) => listing.id);
}

describe("the stash tab reader", () => {
  let site: FakeTradeSite;
  let common: typeof Common;
  let app: {
    settings: ReaderSettings;
    accountName: string;
    leagueId: string | undefined;
    priceCheckShown: boolean;
  };
  let reader: Reader.StashReader;
  let mainLog: string[];

  beforeEach(async () => {
    vi.useFakeTimers();
    // The rate limiters are shared state of their module, so each test imports new ones
    vi.resetModules();
    setupTests({ widgets: [priceCheckWidgetMock({ apiLatencySeconds: 2 })] });
    site = new FakeTradeSite();
    const { Host } = await import("@/web/background/IPC");
    vi.mocked(Host.proxy).mockImplementation(site.proxy);
    mainLog = [];
    vi.mocked(Host.sendEvent).mockImplementation((event: IpcEvent) => {
      if (event.name === "CLIENT->MAIN::log-entry") {
        mainLog.push(`${event.payload.level} ${event.payload.message}`);
      }
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    common = await import("@/web/price-check/trade/common");
    const { createStashReader } = await import(
      "@/web/stash-prices/stash-reader"
    );
    app = {
      settings: {
        enabled: true,
        tabName: TAB,
        intervalMinutes: 10,
        searchBudget: 400,
      },
      accountName: " Seller05#0005 ",
      leagueId: "Standard",
      priceCheckShown: false,
    };
    reader = createStashReader({
      settings: () => app.settings,
      accountName: () => app.accountName,
      leagueId: () => app.leagueId,
      priceCheckShown: () => app.priceCheckShown,
    });
  });

  afterEach(() => {
    reader.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Clicks Check now and runs the timers for `ms` before it waits for the check to end. */
  async function checkNow(ms = 0) {
    const done = reader.checkNow();
    await vi.advanceTimersByTimeAsync(ms);
    await done;
  }

  it("searches the account's listings without a price, newest first", async () => {
    await checkNow();

    expect(site.searches).toEqual([
      {
        url: "www.pathofexile.com/api/trade2/search/Standard",
        method: "POST",
        body: {
          query: {
            status: { option: "any" },
            filters: {
              trade_filters: {
                filters: {
                  account: { input: "Seller05#0005" },
                  sale_type: { option: "unpriced" },
                },
              },
            },
          },
          sort: { indexed: "desc" },
        },
      },
    ]);
  });

  it("fetches the ids 10 at a time and keeps the listings of the tab, in the order of the search", async () => {
    await checkNow();

    expect(site.fetches.map((fetch) => fetch.length)).toEqual([10, 10, 1]);
    expect(site.fetches.flat()).toEqual(SAVED.map((saved) => saved.id));
    expect(ids(reader.state.listings)).toEqual(IN_TAB);
    const [first] = reader.state.listings;
    expect({ ...first, raw: undefined }).toEqual({
      id: IN_TAB[0],
      itemId: IN_TAB[0],
      name: "Hate Core",
      typeLine: "Cannonade Crossbow",
      baseType: "Cannonade Crossbow",
      rarity: "Rare",
      stashName: TAB,
      x: 0,
      y: 2,
      w: 2,
      h: 4,
      indexed: "2025-12-29T21:58:28Z",
      raw: undefined,
    });
    expect(first.raw).toEqual(SAVED.find((saved) => saved.id === IN_TAB[0]));
    expect(reader.state).toMatchObject({
      status: "waiting",
      error: null,
      total: 21,
      read: 21,
      lastCheckAt: Date.now(),
      nextCheckAt: Date.now() + INTERVAL,
    });
  });

  it("checks again after the interval and fetches only the ids it has not fetched before", async () => {
    await checkNow();
    site.listings.unshift(
      copyOf(SAVED[0], "new-in-tab", TAB),
      copyOf(SAVED[1], "new-elsewhere", "other"),
    );
    site.fetches = [];

    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(site.searches).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(site.searches).toHaveLength(2);
    expect(site.fetches).toEqual([["new-in-tab", "new-elsewhere"]]);
    expect(ids(reader.state.listings)).toEqual(["new-in-tab", ...IN_TAB]);
  });

  it("checks at most every 5 minutes, whatever the interval says", async () => {
    app.settings.intervalMinutes = 1;
    await checkNow();

    await vi.advanceTimersByTimeAsync(5 * 60_000 - 1);
    expect(site.searches).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(site.searches).toHaveLength(2);
  });

  it("drops a listing that left the search result, and fetches it again when it comes back", async () => {
    await checkNow();
    const index = site.listings.findIndex((saved) => saved.id === IN_TAB[1]);
    const [sold] = site.listings.splice(index, 1);

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(ids(reader.state.listings)).toEqual([IN_TAB[0], IN_TAB[2]]);

    site.listings.unshift(sold);
    site.fetches = [];
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(site.fetches).toEqual([[sold.id]]);
    expect(ids(reader.state.listings)).toEqual([sold.id, IN_TAB[0], IN_TAB[2]]);
  });

  it("fetches a listing again when the search lists it before listings it followed, as after a move into the tab", async () => {
    await checkNow();
    const moved = site.listings[5];
    moved.listing.stash.name = TAB;
    site.listings = [moved, ...site.listings.filter((s) => s !== moved)];
    site.fetches = [];

    await vi.advanceTimersByTimeAsync(INTERVAL);

    expect(site.fetches).toEqual([[moved.id]]);
    expect(ids(reader.state.listings)).toEqual([moved.id, ...IN_TAB]);
  });

  it("keeps a fetch result it cannot read out of the tab, logs it, and does not fetch it again", async () => {
    const broken = site.listings.find((saved) => saved.id === IN_TAB[1]);
    if (broken) broken.listing.stash = { name: TAB, x: -1, y: 0 };

    await checkNow();
    expect(ids(reader.state.listings)).toEqual([IN_TAB[0], IN_TAB[2]]);
    expect(console.warn).toHaveBeenCalledWith(
      "[stash-prices] The fetch response has no readable listing for:",
      IN_TAB[1],
    );

    site.fetches = [];
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(site.searches).toHaveLength(2);
    expect(site.fetches).toEqual([]);
  });

  it("reads only the newest 100 listings when the account has more, and counts all of them", async () => {
    site.listings = Array.from({ length: 150 }, (_, idx) =>
      copyOf(SAVED[idx % SAVED.length], `listing-${idx}`, idx % 2 ? TAB : "x"),
    );

    // The account limit allows 6 fetches in 6 seconds, so the reader waits between them
    await checkNow(20_000);

    expect(reader.state).toMatchObject({ total: 150, read: 100 });
    expect(site.fetches).toHaveLength(10);
    expect(site.fetches.flat()).toEqual(
      site.listings.slice(0, 100).map((saved) => saved.id),
    );
    expect(reader.state.listings).toHaveLength(50);
    expect(reader.state.status).toBe("waiting");
  });

  it("sends no search while the 3 hour search count is at the budget, and checks again after the interval", async () => {
    site.searchesIn3Hours = 400;
    await checkNow();
    expect(site.searches).toHaveLength(1);

    await checkNow();
    expect(site.searches).toHaveLength(1);
    expect(reader.state.status).toBe("budget-reached");
    expect(reader.state.nextCheckAt).toBe(Date.now() + INTERVAL);

    app.settings.searchBudget = 401;
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(site.searches).toHaveLength(2);
  });

  it("sends no search with a budget of 0, before the site has sent its 3 hour window", async () => {
    app.settings.searchBudget = 0;

    await checkNow();

    expect(site.searches).toEqual([]);
    expect(reader.state.status).toBe("budget-reached");
  });

  it("waits while the price check is open, and checks 30 seconds after it closes", async () => {
    app.priceCheckShown = true;

    await checkNow();
    expect(site.searches).toEqual([]);
    expect(reader.state.status).toBe("price-check-open");
    expect(reader.state.nextCheckAt).toBe(Date.now() + RETRY);

    app.priceCheckShown = false;
    await vi.advanceTimersByTimeAsync(RETRY);
    expect(site.searches).toHaveLength(1);
    expect(reader.state.status).toBe("waiting");
  });

  it("holds its fetches while the price check is open and goes on without a new search", async () => {
    site.afterFetch = () => {
      app.priceCheckShown = true;
      site.afterFetch = null;
    };

    const done = reader.checkNow();
    await vi.advanceTimersByTimeAsync(RETRY - 1);
    expect(reader.state.status).toBe("price-check-open");
    expect(site.fetches).toHaveLength(1);

    app.priceCheckShown = false;
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(site.fetches).toHaveLength(3);
    expect(site.searches).toHaveLength(1);
    expect(ids(reader.state.listings)).toEqual(IN_TAB);
  });

  it("ends a check that the price check holds for longer than the interval, and searches again after it closes", async () => {
    site.afterFetch = () => {
      app.priceCheckShown = true;
    };

    await checkNow(INTERVAL);
    expect(reader.state.status).toBe("price-check-open");
    expect(site.fetches).toHaveLength(1);

    site.afterFetch = null;
    app.priceCheckShown = false;
    await vi.advanceTimersByTimeAsync(RETRY);
    expect(site.searches).toHaveLength(2);
    expect(site.fetches).toHaveLength(3);
    expect(ids(reader.state.listings)).toEqual(IN_TAB);
  });

  it("waits while a search waits in the limiters, as a price check search does", async () => {
    const [limiter] = common.RATE_LIMIT_RULES.SEARCH;
    void limiter.wait();
    const queued = limiter.wait();

    await checkNow();
    expect(site.searches).toEqual([]);
    expect(reader.state.status).toBe("busy");

    await vi.advanceTimersByTimeAsync(RETRY);
    await queued;
    expect(site.searches).toHaveLength(1);
  });

  it("ends a check whose fetches the limiters restrict for longer than the interval", async () => {
    await checkNow();
    site.listings.unshift(
      ...Array.from({ length: 11 }, (_, idx) =>
        copyOf(SAVED[0], `new-${idx}`, TAB),
      ),
    );
    site.fetches = [];
    // The limiters that the first check's responses set stay, so their restriction stays too
    site.afterFetch = () => {
      site.afterFetch = null;
      for (const limiter of common.RATE_LIMIT_RULES.FETCH)
        limiter.restrict(3600);
    };

    await checkNow();

    expect(site.fetches).toHaveLength(1);
    expect(reader.state.status).toBe("rate-limited");
    expect(reader.state.nextCheckAt).toBe(Date.now() + RETRY);
  });

  it("ends the check with the trade site's error, and sends no search while the limiters are restricted", async () => {
    site.failure = {
      status: 429,
      body: JSON.stringify({
        error: { code: 3, message: "Rate limit exceeded" },
      }),
      headers: { "retry-after": "60" },
    };

    await checkNow();
    expect(reader.state).toMatchObject({
      status: "error",
      error: "Rate limit exceeded",
      lastCheckAt: Date.now(),
      nextCheckAt: Date.now() + INTERVAL,
    });
    expect(mainLog).toEqual([
      "warn [stash-prices] The stash tab check failed: Rate limit exceeded",
    ]);

    site.failure = null;
    await checkNow();
    expect(site.searches).toHaveLength(1);
    expect(reader.state.status).toBe("rate-limited");
  });

  it("sends a repeated error to main's log once, and again after a check that worked", async () => {
    site.failure = { status: 503, body: "<html></html>" };

    await checkNow();
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(site.searches).toHaveLength(2);
    expect(mainLog).toHaveLength(1);

    site.failure = null;
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(reader.state.status).toBe("waiting");
    site.failure = { status: 503, body: "<html></html>" };
    site.listings.unshift(copyOf(SAVED[0], "new", TAB));
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(mainLog).toHaveLength(2);
    expect(reader.state.error).toMatch(/status 503/);
  });

  it("ends the check with a fetch error and keeps the listings it read", async () => {
    site.afterFetch = () => {
      if (site.fetches.length === 2) {
        site.failure = { status: 503, body: "<html></html>" };
      }
    };

    await checkNow();

    expect(reader.state.status).toBe("error");
    expect(site.fetches).toHaveLength(2);
    expect(ids(reader.state.listings)).toEqual([IN_TAB[0]]);
  });

  it.each([
    ["no-account", () => (app.accountName = " ")],
    ["no-league", () => (app.leagueId = undefined)],
  ])(
    "sends nothing and shows %s without its setting",
    async (status, unset) => {
      unset();

      await checkNow();

      expect(site.searches).toEqual([]);
      expect(reader.state.status).toBe(status);
      expect(reader.state.nextCheckAt).toBe(Date.now() + RETRY);
    },
  );

  it("stops, forgets the listings and sends nothing more when turned off", async () => {
    await checkNow();
    app.settings.enabled = false;

    reader.refresh();
    await vi.advanceTimersByTimeAsync(2 * INTERVAL);
    await reader.checkNow();

    expect(site.searches).toHaveLength(1);
    expect(reader.state).toMatchObject({
      status: "off",
      listings: [],
      total: null,
      lastCheckAt: null,
      nextCheckAt: null,
    });
  });

  it("checks at once when turned on, and keeps the next check of an unchanged tab", async () => {
    reader.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(site.searches).toHaveLength(1);

    reader.refresh();
    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(site.searches).toHaveLength(1);
    expect(reader.state.nextCheckAt).toBe(Date.now() + 1);
  });

  it("reads the new tab at once after the tab name changes, even during a check", async () => {
    await checkNow();
    site.afterFetch = () => {
      site.afterFetch = null;
      app.settings.tabName = "1 Alchem";
      reader.refresh();
    };
    site.listings.unshift(copyOf(SAVED[0], "new", TAB));

    // A timer of 0 ms set while the fake clock runs timers waits 1 ms
    await vi.advanceTimersByTimeAsync(INTERVAL);
    await vi.advanceTimersByTimeAsync(1);

    expect(site.searches).toHaveLength(3);
    expect(ids(reader.state.listings)).toEqual(IN_ALCHEM);
    expect(reader.state.status).toBe("waiting");
  });

  it("forgets the listings of the old account at once when the account name changes", async () => {
    await checkNow();
    expect(reader.state.listings).toHaveLength(3);
    app.accountName = "";

    reader.refresh();
    expect(reader.state).toMatchObject({ listings: [], total: null, read: 0 });
    await vi.advanceTimersByTimeAsync(0);

    expect(reader.state.status).toBe("no-account");
    expect(site.searches).toHaveLength(1);
  });

  it("keeps one check when Check now or a refresh comes during it", async () => {
    site.afterFetch = () => {
      void reader.checkNow();
      reader.refresh();
    };

    await checkNow();

    expect(site.searches).toHaveLength(1);
    expect(site.fetches).toHaveLength(3);
  });

  it("changes nothing after a check that was stopped while it fetched", async () => {
    site.afterFetch = () => {
      reader.stop();
    };

    await checkNow();

    expect(site.fetches).toHaveLength(1);
    expect(reader.state).toMatchObject({ status: "off", listings: [] });
  });
});
