import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, nextTick, reactive } from "vue";
import { renderToString } from "vue/server-renderer";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import type { ListingPrice } from "@/web/stash-prices/price-item";
import { countPrices, type PricerState } from "@/web/stash-prices/pricer-state";
import type { DetectorState } from "@/web/stash-prices/stash-detector";
import type * as UseStashHighlights from "@/web/stash-prices/use-stash-highlights";
import {
  stashPricesDefault,
  type StashPricesWidget,
} from "@/web/stash-prices/widget";
import { placed } from "./fake-capture";

// OverlayWindow.vue renders each widget of the config, which a test of the layer leaves out
vi.mock("@/web/overlay/widget-registry", () => ({
  registry: { getWidgetComponent: () => ({ render: () => null }) },
}));

vi.mock("@/web/background/Leagues", async () => {
  const { computed, shallowRef } = await import("vue");
  const selectedId = shallowRef("Standard");
  const selected = computed(() => ({
    id: selectedId.value,
    realm: "pc-ggg",
    isPopular: true,
  }));
  const load = async () => {};
  return { useLeagues: () => ({ selectedId, selected, load }) };
});

const GRID = { left: 17, top: 126.5, cell: 52.5 };

/** The price file fixture of priceService/tests, without its Chaos Orb when `chaos` is false. */
function priceFile(chaos = true): string {
  const file = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../priceService/tests/fixtures/price_file.json",
      ),
      "utf8",
    ),
  );
  if (!chaos) {
    for (const overview of file.itemOverviews) {
      overview.lines = overview.lines.filter(
        (line: { name: string }) => line.name !== "Chaos Orb",
      );
    }
  }
  return JSON.stringify(file);
}

function priced(value: number): ListingPrice {
  return {
    status: "priced",
    value,
    low: value / 2,
    high: value * 2,
    reliability: "high",
    source: "listings",
  };
}

describe("the highlights over the stash", () => {
  let file: string | null;
  let useStashHighlights: typeof UseStashHighlights.useStashHighlights;

  beforeEach(async () => {
    vi.useFakeTimers();
    // The reader, the pricer, the detector and the price file are shared state of their modules
    vi.resetModules();
    file = null;
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", {
      innerWidth: 1920,
      innerHeight: 1080,
      devicePixelRatio: 1,
      addEventListener: () => {},
    });
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0 Electron" });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { Host } = await import("@/web/background/IPC");
    const { PRICE_HOST } = await import("@/web/background/price-source");
    vi.mocked(Host.proxy).mockImplementation(async (url) => {
      if (String(url).startsWith(PRICE_HOST) && file) return new Response(file);
      return new Response("", { status: 404 });
    });
    ({ useStashHighlights } = await import(
      "@/web/stash-prices/use-stash-highlights"
    ));
  });

  afterEach(async () => {
    const { useStashReader } = await import(
      "@/web/stash-prices/use-stash-reader"
    );
    useStashReader().stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Sets the test config with the widget's settings, and the tab's listings, prices and detection. */
  async function setup(
    settings: Partial<StashPricesWidget>,
    items: Array<[x: number, y: number, w: number, h: number, ListingPrice]>,
    detection: Partial<DetectorState> = {},
    pricing: Partial<PricerState> = {},
  ) {
    setupTests({
      widgets: [
        priceCheckWidgetMock(),
        // Reactive, as the app's config is, so that a test can change a setting
        reactive({
          ...stashPricesDefault(),
          wmId: 3,
          enabled: true,
          ...settings,
        }),
      ],
    });
    const highlights = useStashHighlights();
    const { useStashReader } = await import(
      "@/web/stash-prices/use-stash-reader"
    );
    const { useStashPricer } = await import(
      "@/web/stash-prices/use-stash-pricer"
    );
    const { useStashDetector } = await import(
      "@/web/stash-prices/use-stash-detector"
    );
    const listings = items.map(([x, y, w, h]) => placed({ x, y, w, h }));
    const prices = new Map(
      items.map(([x, y, , , price]) => [`item-${x}-${y}`, price]),
    );
    Object.assign(useStashReader().state, { listings });
    // The pricer and the detector follow the listings first, then the test sets the state they show
    await nextTick();
    Object.assign(useStashPricer().state, {
      prices,
      counts: countPrices(prices),
      status: "waiting",
      ...pricing,
    });
    Object.assign(useStashDetector().state, {
      open: true,
      source: "hotkey",
      quad: false,
      grid: GRID,
      ...detection,
    });
    return highlights;
  }

  /** Loads the price file into the app's prices. */
  async function loadPrices(contents: string) {
    file = contents;
    const { usePoeninja } = await import("@/web/background/Prices");
    const poeninja = usePoeninja();
    poeninja.queuePricesFetch();
    await vi.waitFor(() => expect(poeninja.xchgRate.value).toBeDefined());
  }

  it("shows the layer only while stash prices is on and the tab is open or the grid alignment view is on", async () => {
    const { shown } = await setup({}, [[0, 0, 1, 1, priced(2)]]);
    expect(shown.value).toBe(true);

    const { useStashDetector } = await import(
      "@/web/stash-prices/use-stash-detector"
    );
    useStashDetector().state.open = false;
    expect(shown.value).toBe(false);

    const { AppConfig } = await import("@/web/Config");
    const widget = AppConfig("stash-prices") as StashPricesWidget;
    widget.alignmentView = true;
    expect(shown.value).toBe(true);

    widget.enabled = false;
    expect(shown.value).toBe(false);
  });

  it.each([
    [{ amount: 1, currency: "chaos" }, 0.1173],
    [{ amount: 2, currency: "exalted" }, 0.003692],
  ] as const)(
    "converts the threshold %o with the price file",
    async (trashThreshold, divine) => {
      const { threshold } = await setup({ trashThreshold }, []);
      expect(threshold.value).toBeNull();

      await loadPrices(priceFile());

      expect(threshold.value).toBeCloseTo(divine, 9);
    },
  );

  it("needs no price file for a threshold in Divine Orbs", async () => {
    const { threshold } = await setup(
      { trashThreshold: { amount: 0.5, currency: "div" } },
      [],
    );

    expect(threshold.value).toBe(0.5);
  });

  it("marks no item trash when the price file has no Chaos Orb price", async () => {
    const { threshold, view } = await setup({}, [
      [0, 0, 1, 1, priced(2)],
      [1, 0, 1, 1, priced(0.001)],
    ]);

    await loadPrices(priceFile(false));

    expect(threshold.value).toBeNull();
    expect(view.value.marks.map((mark) => mark.kind)).toEqual([
      "valuable",
      "valuable",
    ]);
  });

  it("marks the items by the threshold from the price file and the toggles", async () => {
    const { view } = await setup({ highlightValuable: false }, [
      [0, 0, 1, 1, priced(2)],
      [1, 0, 1, 1, priced(0.1)],
    ]);
    await loadPrices(priceFile());

    expect(view.value.marks.map((mark) => [mark.id, mark.kind])).toEqual([
      ["item-1-0", "trash"],
    ]);
  });

  /** Renders the layer in English and returns its HTML. */
  async function layerHtml(): Promise<string> {
    const { init } = await import("@/web/i18n");
    const { default: layer } = await import(
      "@/web/stash-prices/StashHighlights.vue"
    );
    const app = createSSRApp(layer);
    app.use(await init("en"));
    return await renderToString(app);
  }

  it("draws the price on a valuable item, a trash icon on a trash item and the progress bar with the status", async () => {
    await setup(
      {},
      [
        [0, 0, 1, 1, priced(4)],
        [3, 2, 2, 3, priced(0.0001)],
        [5, 5, 1, 1, { status: "too-few" }],
        [6, 6, 1, 1, { status: "queued" }],
      ],
      {},
      { status: "rate-limited" },
    );
    await loadPrices(priceFile());

    const html = await layerHtml();

    expect(html).toContain("left:17px;top:126.5px;width:52.5px;height:52.5px;");
    expect(html).toMatch(/>4 div</);
    expect(html).toContain(
      "left:174.5px;top:231.5px;width:105px;height:157.5px;",
    );
    expect(html).toContain('class="fas fa-trash"');
    expect(html).toContain(
      "Priced 3 of 4. Pricing paused by the trade site&#39;s rate limit.",
    );
    expect(html).toContain("width:75.0%");
    expect(html).not.toContain("background-size");
  });

  it("draws the cells of a quad tab with the grid alignment view and no mark while the tab is closed", async () => {
    await setup({ alignmentView: true }, [[0, 0, 1, 1, priced(2)]], {
      open: false,
      quad: true,
      grid: { ...GRID, cell: 26.25 },
    });

    const html = await layerHtml();

    expect(html).toContain(
      "left:17px;top:126.5px;width:630px;height:630px;background-size:26.25px 26.25px;",
    );
    expect(html).not.toContain("div<");
    expect(html).not.toContain("Priced");
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    "keeps the overlay window shown while the game is active when the tab is open: %s",
    async (open, shouldShow) => {
      vi.stubGlobal("document", {
        documentElement: { lang: "" },
        addEventListener: () => {},
      });
      const { Host } = await import("@/web/background/IPC");
      Object.defineProperty(Host, "isElectron", {
        value: true,
        configurable: true,
      });
      const sent: unknown[] = [];
      vi.mocked(Host.sendEvent).mockImplementation((event) => {
        if (event.name === "OVERLAY->MAIN::render-state") {
          sent.push(event.payload);
        }
      });
      await setup({}, [[0, 0, 1, 1, priced(4)]], { open });
      const { init } = await import("@/web/i18n");
      const { default: overlay } = await import(
        "@/web/overlay/OverlayWindow.vue"
      );
      const app = createSSRApp(overlay);
      app.use(await init("en"));

      const html = await renderToString(app);

      expect(sent).toEqual([{ shouldShow }]);
      expect(html.includes(">4 div<")).toBe(open);
    },
  );
});
