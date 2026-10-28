import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostConfig, IpcEvent } from "@ipc/types";
import { Host } from "@/web/background/IPC";
import type { Config } from "@/web/Config";
import type { LibraryWidget } from "@/web/library/widget";
import type { PriceCheckWidget, Widget } from "@/web/overlay/widgets";
import { findWidget } from "@/web/settings/utils";
import type { StashPricesWidget } from "@/web/stash-prices/widget";

// PriceTrend.vue imports vue3-apexcharts, which reads window when it loads; no test draws a chart
vi.mock("vue3-apexcharts", () => ({ default: {} }));

type ConfigModule = typeof import("@/web/Config");

const actual = await vi.importActual<ConfigModule>("@/web/Config");

type HostConfigEvent = Extract<
  IpcEvent,
  { name: "CLIENT->MAIN::update-host-config" }
>;

let sent: IpcEvent[];

beforeEach(() => {
  sent = [];
  vi.mocked(Host.sendEvent).mockImplementation((event) => {
    sent.push(event);
  });
  vi.stubGlobal("document", { documentElement: { style: {} } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function widgetOf<T extends Widget>(config: Config, type: string): T {
  const widget = findWidget<T>(type, config);
  if (!widget) throw new Error(`defaultConfig() has no ${type} widget`);
  return widget;
}

/** Sets `config` with the real updateConfig() and returns the HostConfig that pushHostConfig() sends. */
function pushedHostConfig(config: Config): HostConfig {
  actual.updateConfig(config);
  actual.pushHostConfig();
  const events = sent.filter(
    (e): e is HostConfigEvent => e.name === "CLIENT->MAIN::update-host-config",
  );
  expect(events).toHaveLength(1);
  return events[0].payload;
}

describe("the settings that pushHostConfig() sends to main", () => {
  it("sends each one from the config, its price check widget and its library widget", () => {
    const config = actual.defaultConfig();
    config.overlayKey = "Alt + Space";
    config.restoreClipboard = true;
    config.clientLog = "D:\\PoE2\\logs\\Client.txt";
    config.gameConfig = "D:\\Documents\\poe2_production_Config.ini";
    config.stashScroll = false;
    config.logKeys = true;
    config.windowTitle = "Path of Exile 2 (window)";
    config.readClientLog = true;
    config.hideOverlayOnBlur = true;
    config.enableAlphas = true;
    config.alphas = ["library"];
    widgetOf<PriceCheckWidget>(config, "price-check").initialDelay = 120;
    widgetOf<LibraryWidget>(config, "library").libraryOutputPath =
      "D:\\Library";

    expect(pushedHostConfig(config)).toEqual({
      shortcuts: expect.arrayContaining([
        { shortcut: "Alt + Space", action: { type: "toggle-overlay" } },
      ]),
      restoreClipboard: true,
      clientLog: "D:\\PoE2\\logs\\Client.txt",
      gameConfig: "D:\\Documents\\poe2_production_Config.ini",
      stashScroll: false,
      overlayKey: "Alt + Space",
      logKeys: true,
      windowTitle: "Path of Exile 2 (window)",
      readClientLog: true,
      libraryAlpha: true,
      libraryOutputPath: "D:\\Library",
      initialDelay: 120,
      hideOverlayOnBlur: true,
      stashCapture: false,
    } satisfies HostConfig);
  });

  it.each([false, true])(
    "sends the stash prices widget's enabled, %s, as stashCapture",
    (enabled) => {
      const config = actual.defaultConfig();
      widgetOf<StashPricesWidget>(config, "stash-prices").enabled = enabled;

      expect(pushedHostConfig(config).stashCapture).toBe(enabled);
    },
  );

  it.each([
    { enableAlphas: false, alphas: ["library"], libraryAlpha: false },
    { enableAlphas: true, alphas: [], libraryAlpha: false },
    { enableAlphas: true, alphas: ["library"], libraryAlpha: true },
  ] satisfies Array<
    Pick<Config, "enableAlphas" | "alphas"> & { libraryAlpha: boolean }
  >)(
    "sends libraryAlpha $libraryAlpha when enableAlphas is $enableAlphas and alphas is $alphas",
    ({ enableAlphas, alphas, libraryAlpha }) => {
      const config = actual.defaultConfig();
      config.enableAlphas = enableAlphas;
      config.alphas = alphas;

      expect(pushedHostConfig(config).libraryAlpha).toBe(libraryAlpha);
    },
  );
});
