import { setParserSettings } from "@/parser/settings";
import { AppConfig } from "./Config";
import type { PriceCheckWidget } from "./overlay/widgets";

/** Makes the parser read the language and the saved augments from the current config at each use. */
export function connectParserSettings() {
  setParserSettings({
    get language() {
      return AppConfig().language;
    },
    get savedAugments() {
      return AppConfig<PriceCheckWidget>("price-check")!.savedAugments;
    },
  });
}
