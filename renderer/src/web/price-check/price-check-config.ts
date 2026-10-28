import { AppConfig } from "@/web/Config";
import type { PriceCheckWidget } from "@/web/overlay/widgets";
import { requireWidget } from "@/web/settings/utils";

/** Returns the config of the price check widget, and throws when the config has none. */
export function priceCheckConfig(): PriceCheckWidget {
  return requireWidget<PriceCheckWidget>("price-check", AppConfig());
}

/** Returns true when the suggested price is on in Settings, Price check. */
export function suggestedPriceEnabled(): boolean {
  return priceCheckConfig().suggestedPrice;
}
