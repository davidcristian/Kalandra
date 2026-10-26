import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const DATA_DIR = path.resolve(__dirname, "../../public/data");
const LANGUAGES = ["ru", "cmn-Hant", "ko", "ja", "de", "es", "pt", "fr"];

// The Traditional Chinese file is from older trade data than English:
// docs/dev/refinements/tasks/102-stat-refs-left-after-english-stat-list.md
const CMN_HANT_MISSING = [
  "# to Level of all Grenade Skill Gems",
  "# to Level of all Nova Skill Gems",
  "# to Level of all Strike Skill Gems",
  "# to Level of all Totem Skill Gems",
  "# to Level of all Wind Skill Gems",
  "#% increased Effect of Non-Damaging Ailments on you",
  "#% increased Expedition Explosive Area of Effect in Map",
  "#% increased Expedition Monster Rarity in Map",
  "#% increased Explicit Cold Modifier magnitudes",
  "#% increased Explicit Mana Modifier magnitudes",
  "#% increased Magnitude of Impales inflicted with Spells",
  "#% increased Pin duration",
  "#% increased Skill Speed for each Corrupted Item Equipped",
  "#% to Chaos Resistance for each Corrupted Item Equipped",
  "Banners also grant #% of Life Regenerated per second to affected targets",
  "Bonded: #% increased Magnitude of Bleeding you inflict",
  "Corrupting will always result in change",
  "Expeditions contain 1 Additional Boss encased in ice in Map",
  "Expeditions contain 1 Additional Verisium Sentry in Map",
  "Expeditions contain 1 Vaal Relic in Map",
  "Expeditions contain 1 buried Strongbox in Map",
  "Expeditions have #% Surpassing chance to Duplicate Runic Monsters in Map",
  "Monsters from Verisium Remnants drop #% increased Verisium",
  "The first unearthed Runic Monster will be a Rare Monster in Map",
  "Verisium Remnants have #% chance to add an additional Runic Modifier in Map",
];
const CMN_HANT_EXTRA = [
  "# to Level of all Hazard Skill Gems",
  "# to Level of all Storm Skill Gems",
];

function refs(lang: string): string[] {
  return fs
    .readFileSync(path.join(DATA_DIR, lang, "stats.ndjson"), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => (JSON.parse(line) as { ref: string }).ref);
}

describe("stats.ndjson", () => {
  const english = refs("en");

  it.each(LANGUAGES)("%s has a stat for each English ref", (lang) => {
    const own = new Set(refs(lang));

    expect(english.filter((ref) => !own.has(ref))).toEqual(
      lang === "cmn-Hant" ? CMN_HANT_MISSING : [],
    );
  });

  it.each(LANGUAGES)("%s has no ref that English does not have", (lang) => {
    const englishRefs = new Set(english);

    expect(refs(lang).filter((ref) => !englishRefs.has(ref))).toEqual(
      lang === "cmn-Hant" ? CMN_HANT_EXTRA : [],
    );
  });
});
