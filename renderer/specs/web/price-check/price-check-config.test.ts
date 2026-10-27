import { describe, expect, it } from "vitest";
import { defaultConfigMock } from "@specs/vitest.setup";
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
  it("is on only with experimental features and the suggested price both on", () => {
    defaultConfigMock({ enableAlphas: true, alphas: ["suggested-price"] });
    expect(suggestedPriceEnabled()).toBe(true);

    defaultConfigMock({ enableAlphas: false, alphas: ["suggested-price"] });
    expect(suggestedPriceEnabled()).toBe(false);

    defaultConfigMock({ enableAlphas: true, alphas: ["library"] });
    expect(suggestedPriceEnabled()).toBe(false);
  });
});
