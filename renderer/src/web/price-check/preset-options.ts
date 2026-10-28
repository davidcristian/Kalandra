import { AppConfig } from "@/web/Config";
import type { createPresets } from "./filters/create-presets";
import { priceCheckConfig, suggestedPriceEnabled } from "./price-check-config";

export type PresetOptions = Parameters<typeof createPresets>[1];

/** Returns the options of `createPresets` from the price check settings, for the league, currency and listing type given. */
export function presetOptions(
  choice: Pick<PresetOptions, "league" | "currency" | "listingType">,
): PresetOptions {
  const widget = priceCheckConfig();
  const { language, realm, preferredTradeSite } = AppConfig();
  return {
    ...choice,
    collapseListings: widget.collapseListings,
    activateStockFilter: widget.activateStockFilter,
    searchStatRange: widget.searchStatRange,
    // The trade site of these settings takes English item names
    useEn:
      (language === "cmn-Hant" && realm === "pc-ggg") ||
      preferredTradeSite === "www",
    defaultAllSelected: widget.defaultAllSelected,
    valuableSelected: suggestedPriceEnabled(),
  };
}
