import { ModifierType, StatCalculated } from "@/parser/modifiers";
import { itemIsModifiable, type ParsedItem } from "@/parser";
import { ITEM_BY_REF } from "@/assets/data";
import type { StatFilter } from "../interfaces";

// The rows of the game's BlightCraftingItems table, for data that lists oils by row index
const EMOTIONS = [
  "Diluted Liquid Ire",
  "Diluted Liquid Guilt",
  "Diluted Liquid Greed",
  "Liquid Paranoia",
  "Liquid Envy",
  "Liquid Disgust",
  "Liquid Despair",
  "Concentrated Liquid Fear",
  "Concentrated Liquid Suffering",
  "Concentrated Liquid Isolation",
  "Potent Liquid Melancholy",
  "Potent Liquid Ferocity",
  "Potent Liquid Contempt",
];

const HARDCODED_HIGH_VALUE_OILS = new Set([
  "Concentrated Liquid Isolation",
  "Potent Liquid Ferocity",
  "Potent Liquid Contempt",
]);

export function decodeOils(calc: StatCalculated): string[] | undefined {
  if (calc.type !== ModifierType.Enchant) return;

  // An amulet anointment
  let encoded = calc.sources[0].stat.translation.oils;
  // Otherwise a ring anointment
  if (!encoded && calc.stat.anointments) {
    if (calc.stat.anointments.length === 1) {
      encoded = calc.stat.anointments[0].oils;
    } else {
      encoded = calc.stat.anointments.find(
        (anoint) => anoint.roll === calc.sources[0].stat.roll?.value,
      )?.oils;
    }
  }
  if (!encoded) return;

  const oils: Array<string | undefined> = Array.isArray(encoded)
    ? encoded
    : encoded.split(",").map((idx) => EMOTIONS[Number(idx)]);
  const known = oils.filter(
    (oil): oil is string =>
      oil !== undefined && ITEM_BY_REF("ITEM", oil) !== undefined,
  );

  return known.length === oils.length ? known : undefined;
}

export function applyAnointmentRules(filters: StatFilter[], item: ParsedItem) {
  const anointment = filters.find((filter) => filter.oils);
  if (!anointment) return;

  if (item.talismanTier) {
    anointment.disabled = false;
  } else if (itemIsModifiable(item)) {
    const oils = anointment.oils!;
    if (!oils.some((oil) => HARDCODED_HIGH_VALUE_OILS.has(oil))) {
      anointment.hidden = "filters.hide_anointment";
      anointment.disabled = true;
    }
  }
}
