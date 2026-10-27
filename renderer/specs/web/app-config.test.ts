import { afterEach, describe, expect, it, vi } from "vitest";

// PriceTrend.vue imports vue3-apexcharts, which reads window when it loads; no test draws a chart
vi.mock("vue3-apexcharts", () => ({ default: {} }));

type ConfigModule = typeof import("@/web/Config");

const actual = await vi.importActual<ConfigModule>("@/web/Config");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppConfig", () => {
  it("throws when the config is read before it loads", () => {
    expect(() => actual.AppConfig()).toThrow(
      "The config was read before it loaded",
    );
  });

  it("returns the loaded config, and the first widget of a type", () => {
    vi.stubGlobal("document", { documentElement: { style: {} } });
    actual.updateConfig(actual.defaultConfig());

    expect(actual.AppConfig().configVersion).toBe(
      actual.defaultConfig().configVersion,
    );
    expect(actual.AppConfig("price-check")?.wmType).toBe("price-check");
    expect(actual.AppConfig("no-such-widget")).toBeUndefined();
  });
});
