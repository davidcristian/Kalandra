import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, type ComponentPublicInstance } from "vue";
import { renderToString } from "vue/server-renderer";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions, createTestItem } from "@specs/helper";
import { init } from "@/web/i18n";
import { createFilters } from "@/web/price-check/filters/create-item-filters";
import TradeBulk from "@/web/price-check/trade/TradeBulk.vue";

type TradeBulkInstance = InstanceType<typeof TradeBulk>;

const TRADE_TAG = "bulk-error";
const EXCHANGE_PAGE =
  "https://www.pathofexile.com/trade2/exchange/poe2/Standard";

/** The exchange query of a link to the trade site's exchange page. */
function exchangeQuery(link: string) {
  const [page, query] = link.split("?q=");
  return { page, query: JSON.parse(query) };
}

describe("the Browser button of a failed bulk search", () => {
  let builtIn: string[];
  let defaultBrowser: string[];

  beforeEach(() => {
    builtIn = [];
    defaultBrowser = [];
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", {
      open: (url: string) => {
        defaultBrowser.push(url);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Renders TradeBulk.vue with the setting and returns its component instance. */
  async function renderTradeBulk(builtinBrowser: boolean) {
    setupTests({
      widgets: [priceCheckWidgetMock({ builtinBrowser })],
    });
    const item = createTestItem();
    const testItem = { ...item, info: { ...item.info, tradeTag: TRADE_TAG } };
    const filters = createFilters(testItem, {
      ...createTestCreateOptions(),
      exact: true,
    });
    let tradeBulk: TradeBulkInstance | undefined;
    // Vitest's node environment compiles .vue files for server rendering, so only renderToString runs them
    const app = createSSRApp(TradeBulk, { filters, item: testItem });
    app.use(await init("en"));
    app.provide("builtin-browser", (url: string) => {
      builtIn.push(url);
    });
    app.mixin({
      created(this: ComponentPublicInstance) {
        if ("openTradeLink" in this) tradeBulk = this as TradeBulkInstance;
      },
    });
    await renderToString(app);
    if (!tradeBulk) throw new Error("The app rendered no TradeBulk");
    return tradeBulk;
  }

  it.each([false, true])(
    "opens the exchange search in the built-in browser with Enable builtin browser %s",
    async (builtinBrowser) => {
      const tradeBulk = await renderTradeBulk(builtinBrowser);

      tradeBulk.openTradeLink();

      expect(defaultBrowser).toEqual([]);
      expect(builtIn).toHaveLength(1);
      const { page, query } = exchangeQuery(builtIn[0]);
      expect(page).toBe(EXCHANGE_PAGE);
      expect(query.exchange).toMatchObject({
        have: ["mirror"],
        want: [TRADE_TAG],
      });
    },
  );
});
