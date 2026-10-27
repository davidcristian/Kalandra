import { setParserSettings } from "@/parser/settings";
import { AppConfig } from "./Config";
import { priceCheckConfig } from "@/web/price-check/price-check-config";

/** Makes the parser read the language and the saved augments from the current config at each use. */
export function connectParserSettings() {
  setParserSettings({
    get language() {
      return AppConfig().language;
    },
    get savedAugments() {
      return priceCheckConfig().savedAugments;
    },
  });
}
