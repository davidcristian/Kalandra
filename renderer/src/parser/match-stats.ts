import { CLIENT_STRINGS_REF as _$REF } from "@/assets/data";
import type { Stat, StatMatch } from "@/assets/data";
import { ModifierType } from "./modifiers";

/** Returns whether a line of this modifier type can be the stat: it has a trade id of the type, or grants a skill. */
export function statFitsModifier(stat: Stat, modType: ModifierType): boolean {
  const type =
    modType === ModifierType.AddedAugment ? ModifierType.Augment : modType;
  return (
    (stat.trade.ids != null && type in stat.trade.ids) ||
    stat.ref.startsWith(_$REF.GRANTS_SKILL)
  );
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
