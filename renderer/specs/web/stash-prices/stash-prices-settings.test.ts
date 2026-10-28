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

type Detection = ComponentPublicInstance & {
  captureEnabled: boolean;
  toggleKey: string | null;
  gridUnit: "px" | "%";
  gridLeft: number | string;
  gridTop: number | string;
  gridCell: number | string;
  alignmentView: boolean;
};

type Highlights = ComponentPublicInstance & {
  toggles: Array<{ key: string; model: { value: boolean } }>;
  amount: number | string;
  currency: "chaos" | "exalted" | "div";
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
  let detection: Detection | undefined;
  let highlights: Highlights | undefined;
  // Vitest's node environment compiles .vue files for server rendering, so only renderToString runs them
  const app = createSSRApp(SettingsStashPrices, { config }).use(plugin);
  app.mixin({
    created(this: ComponentPublicInstance) {
      if ("searchBudget" in this) page = this as Page;
      if ("gridLeft" in this) detection = this as Detection;
      if ("toggles" in this) highlights = this as Highlights;
    },
  });
  const html = await renderToString(app);
  return {
    html,
    page: present(page),
    detection: present(detection),
    highlights: present(highlights),
  };
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

  it("sets the capture, the hotkey and the grid correction, each correction from -1000 to 1000", async () => {
    const config = configWith("Seller05#0005");
    const { html, detection } = await renderPage(config);

    expect(html).toContain("Find the open tab in the game window (Windows)");
    detection.captureEnabled = false;
    detection.toggleKey = "Alt + S";
    detection.gridUnit = "%";
    detection.gridLeft = 1.5;
    detection.gridTop = -2000;
    // An emptied number field gives an empty text
    detection.gridCell = "";
    expect(stashPricesOf(config)).toMatchObject({
      captureEnabled: false,
      toggleKey: "Alt + S",
      gridCorrection: { unit: "%", left: 1.5, top: -1000, cell: 0 },
    });
  });

  it("turns each highlight on and off, and sets the trash threshold at 0 or more", async () => {
    const config = configWith("Seller05#0005");
    const { html, highlights } = await renderPage(config);

    expect(html).toContain("Highlight");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html).toContain("Chaos Orb");
    expect(html).toContain("Exalted Orb");
    expect(html).toContain("Divine Orb");
    const [valuable, trash] = highlights.toggles;
    valuable.model.value = false;
    highlights.amount = -2;
    highlights.currency = "div";
    expect(stashPricesOf(config)).toMatchObject({
      highlightValuable: false,
      highlightTrash: true,
      trashThreshold: { amount: 0, currency: "div" },
    });

    trash.model.value = false;
    // An emptied number field gives an empty text
    highlights.amount = "";
    expect(stashPricesOf(config)).toMatchObject({
      highlightValuable: false,
      highlightTrash: false,
      trashThreshold: { amount: 1, currency: "div" },
    });
    highlights.amount = 2.5;
    expect(stashPricesOf(config).trashThreshold.amount).toBe(2.5);
  });

  it("turns the grid alignment view on next to the grid correction", async () => {
    const config = configWith("Seller05#0005");
    const { html, detection } = await renderPage(config);

    expect(html).toMatch(/Cell size[\s\S]*Grid alignment view/);
    detection.alignmentView = true;
    expect(stashPricesOf(config).alignmentView).toBe(true);
  });
});
