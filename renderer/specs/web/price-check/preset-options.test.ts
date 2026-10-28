import { describe, expect, it } from "vitest";
import { defaultConfigMock, priceCheckWidgetMock } from "@specs/vitest.setup";
import type { Config } from "@/web/Config";
import { presetOptions } from "@/web/price-check/preset-options";

const CHOICE = {
  league: "Standard",
  currency: "divine",
  listingType: "online",
} as const;

function optionsWith(config: Partial<Config>) {
  defaultConfigMock({
    widgets: [
      priceCheckWidgetMock({
        collapseListings: "api",
        activateStockFilter: true,
        searchStatRange: 15,
        defaultAllSelected: true,
        suggestedPrice: true,
      }),
    ],
    ...config,
  });
  return presetOptions(CHOICE);
}

describe("presetOptions", () => {
  it("returns the price check settings with the league, currency and listing type given", () => {
    expect(optionsWith({})).toEqual({
      ...CHOICE,
      collapseListings: "api",
      activateStockFilter: true,
      searchStatRange: 15,
      useEn: false,
      defaultAllSelected: true,
      valuableSelected: true,
    });
  });

  it.each([
    [{ language: "cmn-Hant", realm: "pc-ggg" }, true],
    [{ language: "cmn-Hant", realm: "pc-garena" }, false],
    [{ language: "de", preferredTradeSite: "www" }, true],
    [{ language: "de", preferredTradeSite: "default" }, false],
  ] as const)("searches English names with %o: %s", (config, useEn) => {
    expect(optionsWith(config).useEn).toBe(useEn);
  });

  it("turns on the valuable stat filters only with the suggested price", () => {
    defaultConfigMock({
      widgets: [priceCheckWidgetMock({ suggestedPrice: false })],
    });

    expect(presetOptions(CHOICE).valuableSelected).toBe(false);
  });
});
