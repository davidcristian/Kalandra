import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createI18n, type Composer } from "vue-i18n";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { __testExports } from "@/web/price-check/trade/pathofexile-trade";
import { tooltipLineText } from "@/web/price-check/trade/tooltip-text";

type FetchResult = Parameters<typeof __testExports.parseFetchResult>[0];
type Messages = Parameters<Composer["setLocaleMessage"]>[1];

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, file), "utf8"));
}

function messages(lang: string) {
  return readJson<Messages>(`../../../../public/data/${lang}/app_i18n.json`);
}

/** An i18n instance set up as init() and loadLang() in src/web/i18n.ts do it. */
function createAppI18n(locale: string): Composer {
  const { global } = createI18n<false>({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    fallbackFormat: true,
    fallbackWarn: false,
    missingWarn: false,
    messages: { en: messages("en") },
  });
  if (locale !== "en") global.setLocaleMessage(locale, messages(locale));
  global.locale.value = locale;
  return global;
}

/** The saved Dreaming Quarterstaff listing with its first mod text replaced. */
function savedQuarterstaff(firstMod: string): FetchResult {
  const saved = readJson<{ result: FetchResult[] }>(
    "../../../docs/fetchResponses.json",
  );
  const listing = saved.result.find((result) =>
    result.id.startsWith("2fa2f1ee"),
  )!;
  const [, ...otherMods] = listing.item.explicitMods as string[];
  listing.item.explicitMods = [firstMod, ...otherMods];
  return listing;
}

/** The saved Swiftstalker Coat listing with its unrevealed modifiers replaced. */
function savedUnrevealed(veiledMods: string[]): FetchResult {
  const saved = readJson<FetchResult[]>("../../../docs/fetchResponses2.json");
  const listing = saved.find((result) => result.id.startsWith("95bcbe83"))!;
  listing.item.veiledMods = veiledMods;
  return listing;
}

/** The saved Swiftstalker Coat listing as an unidentified item of the tier. */
function savedUnidentified(tier?: number): FetchResult {
  const listing = savedUnrevealed([]);
  listing.item.identified = false;
  listing.item.unidentifiedTier = tier;
  return listing;
}

describe("tooltipLineText", () => {
  let logged: unknown[];

  beforeEach(() => {
    logged = [];
    const log = (message: unknown) => {
      logged.push(message);
    };
    vi.spyOn(console, "warn").mockImplementation(log);
    vi.spyOn(console, "error").mockImplementation(log);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Hand-written trade site text with characters that the message formatter reads as syntax
  it.each([
    "Allocates {Something}",
    "Grants A | B",
    "50% increased {Thing",
    "Price @ 5",
    "item",
  ])("shows %j as it is, without a log", (text) => {
    expect(tooltipLineText(text, createAppI18n("en"))).toBe(text);
    expect(logged).toEqual([]);
  });

  it.each([
    ["en", "item.physical_dps", "Physical DPS: "],
    ["en", "item.crit", "Critical Hit Chance: "],
    ["en", "item.map_gold", "Gold Found: "],
    ["de", "item.aps", "Angriffe pro Sekunde: "],
  ])("translates a UI text key in %s: %s", (locale, key, text) => {
    expect(tooltipLineText(key, createAppI18n(locale))).toBe(text);
  });

  describe("on a saved listing", () => {
    beforeEach(async () => {
      setupTests();
      await init("en");
    });

    it("shows its properties and its mods", () => {
      const displayItem = __testExports.parseFetchResult(
        savedQuarterstaff("Allocates {Something}"),
      )!;
      const lineText = (line: { text: string }) =>
        tooltipLineText(line.text, createAppI18n("en"));

      expect(displayItem.nameBlock!.map(lineText)).toEqual([
        "Quarterstaff ",
        "Quality: ",
        "Total DPS: ",
        "Physical DPS: ",
        "Critical Hit Chance: ",
        "Attacks per Second: ",
      ]);
      expect(lineText(displayItem.explicitMods![0])).toBe(
        "Allocates {Something}",
      );
      expect(logged).toEqual([]);
    });

    it("names its unrevealed modifiers with the game's text", async () => {
      const listing = savedUnrevealed(["Prefix05", "Suffix02"]);
      const lineTexts = (lang: string) =>
        __testExports
          .parseFetchResult(listing)!
          .veiledMods!.map((line) =>
            tooltipLineText(line.text, createAppI18n(lang)),
          );

      expect(lineTexts("en")).toEqual([
        "Desecrated Prefix",
        "Desecrated Suffix",
      ]);
      await init("de");
      expect(lineTexts("de")).toEqual([
        "Entweihtes Präfix",
        "Entweihtes Suffix",
      ]);
    });

    it("tags an unidentified item with the game's text, with or without its tier", async () => {
      const tagTexts = (lang: string) =>
        [savedUnidentified(4), savedUnidentified()].map((listing) =>
          __testExports
            .parseFetchResult(listing)
            ?.itemTags?.map((tag) =>
              tooltipLineText(tag.text, createAppI18n(lang)),
            ),
        );

      expect(tagTexts("en")).toEqual([
        ["Unidentified (Tier 4)"],
        ["Unidentified"],
      ]);
      await init("de");
      expect(tagTexts("de")).toEqual([
        ["Nicht identifiziert (Level 4)"],
        ["Nicht identifiziert"],
      ]);
    });
  });
});
