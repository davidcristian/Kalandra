import { describe, expect, it } from "vitest";
import { defaultConfigMock, priceCheckWidgetMock } from "@specs/vitest.setup";
import { AppConfig } from "@/web/Config";
import {
  priceCheckConfig,
  suggestedPriceEnabled,
} from "@/web/price-check/price-check-config";

describe("priceCheckConfig", () => {
  it("returns the price check widget of the config", () => {
    defaultConfigMock();
    const widget = AppConfig().widgets.find((w) => w.wmType === "price-check");

    expect(widget).toBeDefined();
    expect(priceCheckConfig()).toBe(widget);
  });

  it("throws when the config has no price check widget", () => {
    defaultConfigMock({ widgets: [] });

    expect(() => priceCheckConfig()).toThrow(
      'The config has no widget of type "price-check"',
    );
  });
});

describe("suggestedPriceEnabled", () => {
  it("follows the setting of the price check widget, whether experimental features are on or off", () => {
    defaultConfigMock({
      enableAlphas: false,
      widgets: [priceCheckWidgetMock({ suggestedPrice: true })],
    });
    expect(suggestedPriceEnabled()).toBe(true);

    defaultConfigMock({
      enableAlphas: true,
      alphas: ["library"],
      widgets: [priceCheckWidgetMock({ suggestedPrice: false })],
    });
    expect(suggestedPriceEnabled()).toBe(false);
  });
});
