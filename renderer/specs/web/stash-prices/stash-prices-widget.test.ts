import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, nextTick } from "vue";
import { renderToString } from "vue/server-renderer";
import { present } from "@specs/present";
import {
  priceCheckWidgetMock,
  setupFetchMock,
  setupTests,
} from "@specs/vitest.setup";
import type { PriceCheckWidget } from "@/web/overlay/widgets";
import type { ListingPrice } from "@/web/stash-prices/price-item";
import { countPrices, type PricerState } from "@/web/stash-prices/pricer-state";
import { readListing } from "@/web/stash-prices/stash-listings";
import type { DetectorState } from "@/web/stash-prices/stash-detector";
import type { ReaderState } from "@/web/stash-prices/stash-reader";
import type * as UseStashReader from "@/web/stash-prices/use-stash-reader";
import {
  stashPricesDefault,
  type StashPricesWidget,
} from "@/web/stash-prices/widget";
import { copyOf, FakeTradeSite, SAVED } from "./fake-trade-site";

// PriceTrend.vue imports vue3-apexcharts, which reads window when it loads; no test draws a chart
vi.mock("vue3-apexcharts", () => ({ default: {} }));

vi.mock("@/web/background/Leagues", async () => {
  const { computed, shallowRef } = await import("vue");
  const selectedId = shallowRef("Standard");
  // Not popular, so no test loads a price file
  const selected = computed(() => ({
    id: selectedId.value,
    realm: "pc-ggg",
    isPopular: false,
  }));
  return { useLeagues: () => ({ selectedId, selected }) };
});

function stashPrices(settings: Partial<StashPricesWidget>): StashPricesWidget {
  return { ...stashPricesDefault(), wmId: 3, ...settings };
}

describe("the stash prices widget", () => {
  let site: FakeTradeSite;
  let useStashReader: typeof UseStashReader.useStashReader;

  /** Sets the test config with the widget's settings and the price check's. */
  function setup(
    settings: Partial<StashPricesWidget>,
    priceCheck: Partial<PriceCheckWidget> = {},
  ) {
    setupTests({
      accountName: "Seller05#0005",
      widgets: [
        priceCheckWidgetMock({ apiLatencySeconds: 2, ...priceCheck }),
        stashPrices(settings),
      ],
    });
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    // The reader and the rate limiters are shared state of their modules, so each test imports new ones
    vi.resetModules();
    site = new FakeTradeSite();
    const { Host } = await import("@/web/background/IPC");
    vi.mocked(Host.proxy).mockImplementation(site.proxy);
    ({ useStashReader } = await import("@/web/stash-prices/use-stash-reader"));
  });

  afterEach(() => {
    useStashReader().stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reads the tab with the widget's settings, the account name and the league", async () => {
    setup({ enabled: true, tabName: "5" });

    await useStashReader().checkNow();

    expect(site.searches.map((search) => search.url)).toEqual([
      "www.pathofexile.com/api/trade2/search/Standard",
    ]);
    expect(JSON.stringify(site.searches[0].body)).toContain(
      '"account":{"input":"Seller05#0005"}',
    );
    expect(useStashReader().state.listings).toHaveLength(3);
  });

  it("prices the listings the reader reads, and stops with the reader", async () => {
    setup({ enabled: true, tabName: "5" });
    const { useStashPricer } = await import(
      "@/web/stash-prices/use-stash-pricer"
    );
    const { state } = useStashPricer();

    await useStashReader().checkNow();
    expect([...state.prices.keys()]).toEqual(
      useStashReader().state.listings.map((listing) => listing.id),
    );

    const { AppConfig } = await import("@/web/Config");
    const { requireWidget } = await import("@/web/settings/utils");
    requireWidget<StashPricesWidget>("stash-prices", AppConfig()).enabled =
      false;
    useStashReader().refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(state).toMatchObject({ status: "off", counts: { listings: 0 } });
  });

  it("sends nothing while the price check widget is shown", async () => {
    setup({ enabled: true }, { wmWants: "show" });

    await useStashReader().checkNow();

    expect(site.searches).toEqual([]);
    expect(useStashReader().state.status).toBe("price-check-open");
  });

  /** Renders the panel in English with the reader, pricer and detector states given, and returns its HTML. */
  async function panelHtml(
    settings: Partial<StashPricesWidget>,
    state: Partial<ReaderState>,
    pricing: Partial<PricerState> = {},
    detection: Partial<DetectorState> = {},
  ): Promise<string> {
    setup({ enabled: true, ...settings });
    setupFetchMock();
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", {
      innerWidth: 1920,
      innerHeight: 1080,
      devicePixelRatio: 1,
      addEventListener: () => {},
    });
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0 Electron" });
    const { init } = await import("@/web/i18n");
    const { default: panel } = await import(
      "@/web/stash-prices/WidgetStashPrices.vue"
    );
    const { useStashPricer } = await import(
      "@/web/stash-prices/use-stash-pricer"
    );
    const app = createSSRApp(panel, { config: stashPrices(settings) });
    app.use(await init("en"));
    app.provide("wm", {});
    Object.assign(useStashReader().state, state);
    // The pricer follows the listings first, then the test sets the state it shows
    await nextTick();
    Object.assign(useStashPricer().state, pricing);
    const { useStashDetector } = await import(
      "@/web/stash-prices/use-stash-detector"
    );
    Object.assign(useStashDetector().state, detection);
    return await renderToString(app);
  }

  /** Renders the panel as `panelHtml()` does, and returns its text lines joined by `|`. */
  async function panelText(
    ...args: Parameters<typeof panelHtml>
  ): Promise<string> {
    return (await panelHtml(...args))
      .replace(/<[^>]*>/g, "\n")
      .replaceAll("&#39;", "'")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" | ");
  }

  it("shows the tab, the count, the checks, the searches and the status", async () => {
    const text = await panelText({}, { status: "waiting" });

    expect(text).toMatch(
      /^Stash tab: kalandra-price-check \| Items in the tab: 0 \| Last check: never \| Next check: .+ \| Searches in the last 3 hours: \? of 400 \| The tab is read\. \| Stash tab not seen\. Capture off: the tab needs items on 3 cells or more\. \| Check now/,
    );
  });

  it("shows the error, the newest 100 of more listings and a budget limited to 600", async () => {
    const text = await panelText(
      { searchBudget: 900 },
      { status: "error", error: "Rate limit exceeded", total: 150, read: 100 },
    );

    expect(text).toContain("of 600");
    expect(text).toContain(
      "Only the newest 100 of your 150 listings without a price are read.",
    );
    expect(text).toContain("The trade site failed: Rate limit exceeded");
  });

  it.each([
    ["no-account", "Set your account name on the Price check page"],
    ["no-league", "Waiting for the league list."],
    ["price-check-open", "Paused while the price check is open."],
    ["busy", "Paused while your own price checks wait"],
    ["budget-reached", "reached the budget."],
    ["rate-limited", "Paused by the trade site's rate limit."],
    ["checking", "Reading the tab."],
  ] as const)("shows why it waits: %s", async (status, shown) => {
    expect(await panelText({}, { status })).toContain(shown);
  });

  /** Listings of the saved items 0 to 3, in the tab, with the prices given. */
  function priced(prices: ListingPrice[]) {
    const listings = prices.map((_, idx) =>
      present(
        readListing(
          copyOf(SAVED[idx], `listing-${idx}`, "kalandra-price-check"),
        ),
      ),
    );
    const map = new Map(prices.map((price, idx) => [`listing-${idx}`, price]));
    return { listings, map };
  }

  it("shows the pricing progress, the next search and the most valuable items first", async () => {
    const { listings, map } = priced([
      {
        status: "priced",
        value: 0.5,
        low: 0.5,
        high: 0.5,
        reliability: null,
        source: "price-file",
      },
      {
        status: "priced",
        value: 2,
        low: 2,
        high: 3,
        reliability: "high",
        source: "listings",
      },
      { status: "too-few" },
      { status: "cannot-read", reason: "stash_prices.unreadable" },
      { status: "queued" },
    ]);

    const text = await panelText(
      {},
      { status: "waiting", listings },
      {
        status: "waiting",
        prices: map,
        counts: countPrices(map),
        nextSearchAt: Date.now() + 12_000,
      },
    );

    // Without a core currency from a price file, the suggested price text writes Divine Orbs
    expect(text).toContain(
      "Priced 4 of 5, next search in 12 s. | Not priced: 1 with too few listings, 1 unreadable, 0 failed. | Most valuable: | Phoenix Brand | ~ 2 div | high reliability | Collector's Corsair Cap of Curvation | ~ 0 . 5 div | estimate",
    );
  });

  it.each([
    ["budget-reached", {}, "less the 18 kept for the checks of the tab."],
    ["pricing", { pricing: "listing-1" }, "Pricing Phoenix Brand."],
    [
      "error",
      { error: "Rate limit exceeded" },
      "Pricing failed: Rate limit exceeded",
    ],
    ["no-prices", {}, "Pricing waits for the price file of the league."],
  ] as const)("shows why pricing waits: %s", async (status, more, shown) => {
    const { listings, map } = priced([
      { status: "queued" },
      { status: "queued" },
    ]);

    const text = await panelText(
      {},
      { status: "waiting", listings },
      { status, prices: map, counts: countPrices(map), ...more },
    );

    expect(text).toContain("Priced 0 of 2.");
    expect(text).toContain(shown);
  });

  it.each([
    [
      { open: true, capture: "running", match: { items: 0.956, cells: 0.981 } },
      "Stash tab seen. Capture: 96% of the item cells and 98% of all cells match.",
    ],
    [
      { capture: "running", match: null },
      "Stash tab not seen. Capture starts.",
    ],
    [
      { capture: "failed", error: "Permission denied" },
      "Stash tab not seen. Capture off: Permission denied. It tries again in 30 seconds.",
    ],
    [
      { open: true, source: "hotkey", capture: "not-windows" },
      "Stash tab shown with the hotkey. Capture off: it works only on Windows, so use the hotkey.",
    ],
    [
      { source: "hotkey", capture: "paused" },
      "Stash tab hidden with the hotkey. Capture paused while the game window is not active.",
    ],
    [
      { open: true, capture: "paused", match: { items: 0.97, cells: 1 } },
      "Stash tab seen. Capture paused while the game window is not active. The last capture: 97% of the item cells and 100% of all cells matched.",
    ],
    [
      { capture: "setting-off" },
      "Capture off: turned off in the settings, so use the hotkey.",
    ],
    [
      { capture: "browser" },
      "Capture off: the page is not in the overlay window.",
    ],
  ] as const)("says whether it sees the tab: %o", async (detection, shown) => {
    const match =
      "match" in detection && detection.match
        ? { ...detection.match, itemCells: 9, quad: false, seen: true }
        : null;

    const text = await panelText(
      {},
      { status: "waiting" },
      {},
      {
        ...detection,
        match,
      },
    );

    expect(text).toContain(shown);
  });

  it("names the grid in pixels of the game window when the pointer is on the line", async () => {
    const html = await panelHtml(
      {},
      { status: "waiting" },
      {},
      { grid: { left: 17, top: 126.5, cell: 52.5 } },
    );

    expect(html).toContain(
      'title="The grid starts at 17, 126.5 with cells of 52.5 pixels of the game window."',
    );
  });
});
