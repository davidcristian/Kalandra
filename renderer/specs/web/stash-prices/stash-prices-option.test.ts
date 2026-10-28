import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSSRApp, type ComponentPublicInstance } from "vue";
import { renderToString } from "vue/server-renderer";
import { present } from "@specs/present";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import { AppConfig, type Config } from "@/web/Config";
import { init } from "@/web/i18n";
import type { PriceCheckWidget } from "@/web/overlay/widgets";
import { requireWidget } from "@/web/settings/utils";
import StashPricesOption from "@/web/stash-prices/StashPricesOption.vue";
import {
  stashPricesDefault,
  type StashPricesWidget,
  suggestedPriceModel,
} from "@/web/stash-prices/widget";

type Option = ComponentPublicInstance & { enabled: boolean };

let plugin: Awaited<ReturnType<typeof init>>;

beforeAll(async () => {
  setupTests();
  vi.stubGlobal("document", { documentElement: { lang: "" } });
  plugin = await init("en");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function configWith(suggestedPrice: boolean, stashPrices = true): Config {
  setupTests({
    widgets: [
      priceCheckWidgetMock({ suggestedPrice }),
      ...(stashPrices ? [{ ...stashPricesDefault(), wmId: 3 }] : []),
    ],
  });
  return AppConfig();
}

function stashPricesOf(config: Config): StashPricesWidget {
  return requireWidget<StashPricesWidget>("stash-prices", config);
}

/** Renders the stash prices switch of `config`, and returns its HTML and the component. */
async function renderOption(config: Config) {
  let option: Option | undefined;
  // Vitest's node environment compiles .vue files for server rendering, so only renderToString runs them
  const app = createSSRApp(StashPricesOption, { config }).use(plugin);
  app.mixin({
    created(this: ComponentPublicInstance) {
      if ("enabled" in this) option = this as Option;
    },
  });
  const html = await renderToString(app);
  return { html, option: present(option) };
}

describe("the stash prices switch under the suggested price", () => {
  it("adds the widget's button to the main button bar while stash prices is on", async () => {
    const config = configWith(true);
    const { html, option } = await renderOption(config);

    expect(html).toContain("Price a stash tab in the background");
    expect(html).not.toContain("disabled");
    option.enabled = true;
    expect(stashPricesOf(config)).toMatchObject({
      enabled: true,
      wmFlags: ["invisible-on-blur"],
    });

    stashPricesOf(config).wmWants = "show";
    option.enabled = false;
    expect(stashPricesOf(config)).toMatchObject({
      enabled: false,
      wmWants: "hide",
      wmFlags: ["invisible-on-blur", "menu::skip"],
    });
  });

  it("stays off and cannot be clicked while the suggested price is off", async () => {
    const config = configWith(false);
    const { html, option } = await renderOption(config);

    expect(html).toContain("disabled");
    option.enabled = true;
    expect(stashPricesOf(config)).toMatchObject({
      enabled: false,
      wmFlags: ["invisible-on-blur", "menu::skip"],
    });
  });
});

describe("the suggested price setting", () => {
  it("turns stash prices off when it turns off, and leaves it off when it turns on again", () => {
    const config = configWith(true);
    const suggestedPrice = suggestedPriceModel(() => config);
    expect(suggestedPrice.value).toBe(true);
    stashPricesOf(config).enabled = true;
    stashPricesOf(config).wmFlags = ["invisible-on-blur"];

    suggestedPrice.value = false;
    expect(
      requireWidget<PriceCheckWidget>("price-check", config).suggestedPrice,
    ).toBe(false);
    expect(stashPricesOf(config)).toMatchObject({
      enabled: false,
      wmFlags: ["invisible-on-blur", "menu::skip"],
    });

    suggestedPrice.value = true;
    expect(
      requireWidget<PriceCheckWidget>("price-check", config).suggestedPrice,
    ).toBe(true);
    expect(stashPricesOf(config).enabled).toBe(false);
  });

  it("turns off in a config without the stash prices widget", () => {
    const config = configWith(true, false);
    const suggestedPrice = suggestedPriceModel(() => config);

    suggestedPrice.value = false;

    expect(
      requireWidget<PriceCheckWidget>("price-check", config).suggestedPrice,
    ).toBe(false);
  });
});
