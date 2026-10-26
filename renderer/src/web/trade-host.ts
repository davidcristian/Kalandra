import type { Config } from "@/web/Config";

/** Returns the trade site host for the game language and realm. */
export function tradeHost(
  language: Config["language"],
  realm: Config["realm"],
): string {
  switch (language) {
    case "en":
      return "www.pathofexile.com";
    case "ru":
      return "ru.pathofexile.com";
    case "cmn-Hant":
      return realm === "pc-garena" ? "pathofexile.tw" : "www.pathofexile.com";
    case "ko":
      return "poe.kakaogames.com";
    case "ja":
      return "jp.pathofexile.com";
    case "de":
      return "de.pathofexile.com";
    case "es":
      return "es.pathofexile.com";
    case "pt":
      return "br.pathofexile.com";
    case "fr":
      return "fr.pathofexile.com";
  }
}
