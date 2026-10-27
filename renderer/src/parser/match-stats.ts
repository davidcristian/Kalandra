import { CLIENT_STRINGS_REF as _$REF } from "@/assets/data";
import type { Stat, StatMatch } from "@/assets/data";
import {
  hasTradeIdOfType,
  ModifierType,
  SEARCHED_AS_EXPLICIT,
} from "./modifiers";

/**
 * Returns whether the trade ids can search a line of this modifier type: they have an id of the type, or the
 * explicit id for a type that the filters search as explicit. A trade site stat or a granted skill needs one.
 */
export function idsFitType(
  ids: Stat["trade"]["ids"],
  modType: ModifierType,
): boolean {
  const type =
    modType === ModifierType.AddedAugment ? ModifierType.Augment : modType;
  return (
    ids != null &&
    (type in ids ||
      (SEARCHED_AS_EXPLICIT.has(type) && ModifierType.Explicit in ids))
  );
}

/**
 * Returns whether a line of this modifier type can be the stat: it has a trade id of the type, or it grants a skill
 * and has no trade ids or ids that `idsFitType` accepts.
 */
export function statFitsModifier(stat: Stat, modType: ModifierType): boolean {
  if (hasTradeIdOfType(stat, modType)) return true;
  if (!stat.ref.startsWith(_$REF.GRANTS_SKILL)) return false;
  // The data has no trade ids for the skill that every buckler, shield or spear grants, which the parser leaves out
  return stat.trade.ids == null || idsFitType(stat.trade.ids, modType);
}

/**
 * Picks the stat of a line among the stats that share its text: one the modifier type fits, then one with no other
 * advanced text, because the game writes that text in the advanced copy the app makes. Else the first in the data.
 */
export function statMatchForLine(
  matches: StatMatch[],
  text: string,
  modType: ModifierType,
): StatMatch | undefined {
  const fitting = matches.filter(({ stat }) => statFitsModifier(stat, modType));
  const pool = fitting.length ? fitting : matches;
  return (
    pool.find(
      ({ matcher }) =>
        matcher.advanced === undefined || matcher.advanced === text,
    ) ?? pool[0]
  );
}
