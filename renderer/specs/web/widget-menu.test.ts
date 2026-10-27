import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { createSSRApp, shallowRef } from "vue";
import { renderToString } from "vue/server-renderer";
import { defaultConfigMock, setupFetchMock } from "@specs/vitest.setup";
import { AppConfig, type Config } from "@/web/Config";
import { init } from "@/web/i18n";
import type { WidgetMenu } from "@/web/overlay/widgets";
import { registry } from "@/web/overlay/widget-registry";

// PriceTrend.vue imports vue3-apexcharts, which reads window when it loads; no test draws a chart
vi.mock("vue3-apexcharts", () => ({ default: {} }));

type ConfigModule = typeof import("@/web/Config");

const actual = await vi.importActual<ConfigModule>("@/web/Config");

let plugin: Awaited<ReturnType<typeof init>>;

beforeAll(async () => {
  setupFetchMock();
  vi.stubGlobal("document", { documentElement: { lang: "" } });
  plugin = await init("en");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function upgradedSaved(version: number): Config {
  const file = path.resolve(
    __dirname,
    `../saved-configs/version-${version}.json`,
  );
  return actual.upgradeConfig(JSON.parse(fs.readFileSync(file, "utf8")));
}

/** Renders the main button bar of the config and returns the title or icon of each widget button. */
async function menuButtons(config: Config): Promise<string[]> {
  defaultConfigMock(config);
  const menu = registry.getWidgetComponent("menu");
  if (!menu) throw new Error("No component is registered for the menu");
  const app = createSSRApp(menu, { config: AppConfig<WidgetMenu>("menu") });
  app.use(plugin);
  app.provide("wm", { widgets: shallowRef(AppConfig().widgets) });
  const html = await renderToString(app);
  const buttons = html.matchAll(
    /<button class="[^"]*text-gray-100 p-2[^"]*">(.*?)<\/button>/g,
  );
  return [...buttons].map(
    ([, inner]) =>
      /<i class="(fa-[\w-]+)/.exec(inner)?.[1] ?? inner.replace(/<[^>]*>/g, ""),
  );
}

describe("the main button bar", () => {
  it("has no XP button in a new config, where reading Client.txt is off", async () => {
    const buttons = await menuButtons(actual.defaultConfig());

    expect(buttons).toEqual([
      "fa-cog",
      "fa-search",
      "Map rolling",
      "Dump sorting",
    ]);
  });

  it("has the XP button while reading Client.txt is on", async () => {
    const config = { ...actual.defaultConfig(), readClientLog: true };

    const buttons = await menuButtons(config);

    expect(buttons).toEqual([
      "fa-cog",
      "fa-search",
      "XP",
      "Map rolling",
      "Dump sorting",
    ]);
  });

  it.each([28, 36])(
    "has no XP button in a config upgraded from version %i, where reading Client.txt is off",
    async (version) => {
      const config = upgradedSaved(version);

      const buttons = await menuButtons(config);

      expect(config.widgets.map((w) => w.wmType)).toContain(
        "experience-tracker",
      );
      expect(buttons).not.toContain("XP");
    },
  );
});
