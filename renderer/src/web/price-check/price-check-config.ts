import { AppConfig } from "@/web/Config";
import type { PriceCheckWidget } from "@/web/overlay/widgets";
import { requireWidget } from "@/web/settings/utils";

/** Returns the config of the price check widget, and throws when the config has none. */
export function priceCheckConfig(): PriceCheckWidget {
  return requireWidget<PriceCheckWidget>("price-check", AppConfig());
}

/** Returns true when the experimental suggested price is on in Settings, General. */
export function suggestedPriceEnabled(): boolean {
  const config = AppConfig();
  return config.enableAlphas && config.alphas.includes("suggested-price");
}
