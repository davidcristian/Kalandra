import type { Config } from "@/web/Config";

/**
 * Returns whether the app offers Craft of Exile for the language: English only, because Craft of Exile imports the
 * copied item text and no import of text in another language has been checked.
 */
export function offersCraftOfExile(language: Config["language"]): boolean {
  return language === "en";
}
