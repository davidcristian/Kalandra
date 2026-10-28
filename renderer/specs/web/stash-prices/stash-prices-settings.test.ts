import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSSRApp, type ComponentPublicInstance } from "vue";
import { renderToString } from "vue/server-renderer";
import { present } from "@specs/present";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import { AppConfig, type Config } from "@/web/Config";
import { init } from "@/web/i18n";
import { requireWidget } from "@/web/settings/utils";
import SettingsStashPrices from "@/web/stash-prices/settings-stash-prices.vue";
import {
  stashPricesDefault,
  type StashPricesWidget,
} from "@/web/stash-prices/widget";

type Page = ComponentPublicInstance & {
  enabled: boolean;
  intervalMinutes: number | string;
  searchBudget: number | string;
};

let plugin: Awaited<ReturnType<typeof init>>;

beforeAll(async () => {
  setupTests();
  vi.stubGlobal("document", { documentElement: { lang: "" } });
  plugin = await init("en");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function configWith(accountName: string): Config {
  setupTests({
    accountName,
    widgets: [priceCheckWidgetMock(), { ...stashPricesDefault(), wmId: 3 }],
  });
  return AppConfig();
}

function stashPricesOf(config: Config): StashPricesWidget {
  return requireWidget<StashPricesWidget>("stash-prices", config);
}

/** Renders the Stash prices page of `config`, and returns its HTML and the page component. */
async function renderPage(config: Config) {
  let page: Page | undefined;
  // Vitest's node environment compiles .vue files for server rendering, so only renderToString runs them
  const app = createSSRApp(SettingsStashPrices, { config }).use(plugin);
  app.mixin({
    created(this: ComponentPublicInstance) {
      if ("searchBudget" in this) page = this as Page;
    },
  });
  const html = await renderToString(app);
  return { html, page: present(page) };
}

describe("the Stash prices settings page", () => {
  it("adds the widget's button to the main button bar while the reading is on", async () => {
    const config = configWith("Seller05#0005");
    const { page } = await renderPage(config);

    page.enabled = true;
    expect(stashPricesOf(config)).toMatchObject({
      enabled: true,
      wmFlags: ["invisible-on-blur"],
    });

    stashPricesOf(config).wmWants = "show";
    page.enabled = false;
    expect(stashPricesOf(config)).toMatchObject({
      enabled: false,
      wmWants: "hide",
      wmFlags: ["invisible-on-blur", "menu::skip"],
    });
  });

  it("keeps the interval at 5 minutes or more and the budget between 0 and 600", async () => {
    const config = configWith("Seller05#0005");
    const { page } = await renderPage(config);

    page.intervalMinutes = 2;
    page.searchBudget = 700;
    expect(stashPricesOf(config)).toMatchObject({
      intervalMinutes: 5,
      searchBudget: 600,
    });

    // An emptied number field gives an empty text
    page.intervalMinutes = "";
    page.searchBudget = -3;
    expect(stashPricesOf(config)).toMatchObject({
      intervalMinutes: 10,
      searchBudget: 0,
    });
  });

  it("names the tab in the steps that set it up", async () => {
    const config = configWith("Seller05#0005");
    stashPricesOf(config).tabName = "dump";

    const { html } = await renderPage(config);

    expect(html).toContain("make a premium stash tab public and name it dump.");
    expect(html).not.toContain("The account name on the Price check page");
  });

  it("says that the tab is not read without an account name", async () => {
    const { html } = await renderPage(configWith(" "));

    expect(html).toContain(
      "The account name on the Price check page is empty, so the tab is not read.",
    );
  });
});
