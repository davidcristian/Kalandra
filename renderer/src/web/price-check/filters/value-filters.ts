import { stat } from "@/assets/data";
import { ItemRarity, ParsedItem } from "@/parser";
import { FilterTag, StatFilter } from "./interfaces";

const EXPLICIT_TAGS = new Set([
  FilterTag.Explicit,
  FilterTag.Fractured,
  FilterTag.Desecrated,
]);

// The stats that set most of a rare item's price, at any tier
const VALUABLE_STATS = new Set([
  stat("# to Level of all Skills"),
  stat("# to Level of all Attack Skills"),
  stat("# to Level of all Spell Skills"),
  stat("# to Level of all Melee Skills"),
  stat("# to Level of all Projectile Skills"),
  stat("# to Level of all Minion Skills"),
  stat("# to Level of all Elemental Skills"),
  stat("# to Level of all Fire Skills"),
  stat("# to Level of all Cold Skills"),
  stat("# to Level of all Lightning Skills"),
  stat("# to Level of all Chaos Skills"),
  stat("# to Level of all Fire Spell Skills"),
  stat("# to Level of all Cold Spell Skills"),
  stat("# to Level of all Lightning Spell Skills"),
  stat("# to Level of all Chaos Spell Skills"),
  stat("# to Level of all Physical Spell Skills"),
  stat("#% increased Critical Damage Bonus"),
  stat("#% to Critical Damage Bonus"),
  stat("#% increased Critical Damage Bonus for Attack Damage"),
  stat("#% increased Critical Spell Damage Bonus"),
  stat("#% increased Critical Hit Chance"),
  stat("#% to Critical Hit Chance"),
  stat("#% increased Critical Hit Chance for Attacks"),
  stat("#% increased Critical Hit Chance for Spells"),
  stat("#% increased Spell Damage"),
  stat("#% increased Elemental Damage"),
  stat("#% increased Fire Damage"),
  stat("#% increased Cold Damage"),
  stat("#% increased Lightning Damage"),
  stat("#% increased Chaos Damage"),
  stat("#% increased Elemental Damage with Attacks"),
  stat("Adds # to # Physical Damage to Attacks"),
  stat("Adds # to # Fire damage to Attacks"),
  stat("Adds # to # Cold damage to Attacks"),
  stat("Adds # to # Lightning damage to Attacks"),
  stat("Adds # to # Chaos Damage to Attacks"),
  stat("#% increased Attack Speed"),
  stat("#% increased Cast Speed"),
  stat("# to Spirit"),
  stat("#% increased Rarity of Items found"),
]);

/** Turns on each shown filter of a rare item's stats that set most of its price. */
export function enableValuableFilters(
  filters: StatFilter[],
  item: ParsedItem,
): void {
  if (item.rarity !== ItemRarity.Rare || item.isVeiled) return;
  for (const filter of filters) {
    if (
      !filter.hidden &&
      EXPLICIT_TAGS.has(filter.tag) &&
      VALUABLE_STATS.has(filter.statRef)
    ) {
      filter.disabled = false;
    }
  }
}
