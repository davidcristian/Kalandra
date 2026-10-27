import { ModifierType, StatCalculated } from "@/parser/modifiers";
import { itemIsModifiable, type ParsedItem } from "@/parser";
import { ITEM_BY_REF } from "@/assets/data";
import type { StatFilter } from "../interfaces";

const HARDCODED_HIGH_VALUE_OILS = new Set([
  "Concentrated Liquid Isolation",
  "Potent Liquid Ferocity",
  "Potent Liquid Contempt",
]);

export function decodeOils(calc: StatCalculated): string[] | undefined {
  if (calc.type !== ModifierType.Enchant) return;

  // An amulet anointment
  let oils = calc.sources[0].stat.translation.oils;
  // Otherwise a ring anointment
  if (!oils && calc.stat.anointments) {
    if (calc.stat.anointments.length === 1) {
      oils = calc.stat.anointments[0].oils;
    } else {
      oils = calc.stat.anointments.find(
        (anoint) => anoint.roll === calc.sources[0].stat.roll?.value,
      )?.oils;
    }
  }
  if (!oils) return;

  const known = oils.filter((oil) => ITEM_BY_REF("ITEM", oil) !== undefined);

  return known.length === oils.length ? known : undefined;
}

export function applyAnointmentRules(filters: StatFilter[], item: ParsedItem) {
  const anointment = filters.find((filter) => filter.oils);
  if (!anointment) return;

  if (item.talismanTier) {
    anointment.disabled = false;
  } else if (itemIsModifiable(item)) {
    const oils = anointment.oils ?? [];
    if (!oils.some((oil) => HARDCODED_HIGH_VALUE_OILS.has(oil))) {
      anointment.hidden = "filters.hide_anointment";
      anointment.disabled = true;
    }
  }
}
