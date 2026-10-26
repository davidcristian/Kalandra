import { describe, expect, it } from "vitest";
import type { Config } from "@/web/Config";
import { tradeHost } from "@/web/trade-host";

describe("tradeHost", () => {
  it.each<[Config["language"], string]>([
    ["en", "www.pathofexile.com"],
    ["ru", "ru.pathofexile.com"],
    ["cmn-Hant", "www.pathofexile.com"],
    ["ko", "poe.kakaogames.com"],
    ["ja", "jp.pathofexile.com"],
    ["de", "de.pathofexile.com"],
    ["es", "es.pathofexile.com"],
    ["pt", "br.pathofexile.com"],
    ["fr", "fr.pathofexile.com"],
  ])("returns the %s trade site on the international realm", (lang, host) => {
    expect(tradeHost(lang, "pc-ggg")).toBe(host);
  });

  it("returns the Taiwanese site for Traditional Chinese on pc-garena", () => {
    expect(tradeHost("cmn-Hant", "pc-garena")).toBe("pathofexile.tw");
  });

  it("returns the language's site for other languages on pc-garena", () => {
    expect(tradeHost("ru", "pc-garena")).toBe("ru.pathofexile.com");
  });
});
