import { statSourcesTotal, translateStatWithRoll } from "@/parser/modifiers";
import { ParsedItem } from "@/parser/ParsedItem";
import { roundRoll } from "../price-check/filters/util";
import { markTarget, type MarkTarget } from "./mark-target";

export interface PreparedStat {
  matcher: string;
  roll?: number;
  type?: string;
  target: Required<MarkTarget>;
}

export function prepareMapStats(item: ParsedItem): PreparedStat[] {
  return item.statsByType.map((calc) => {
    const roll = statSourcesTotal(calc.sources);
    const translation = translateStatWithRoll(calc, roll);
    const matcher = calc.stat.matchers.find(
      (m) => m.string === translation.string,
    );

    const prepared = {
      matcher: translation.string,
      roll: roll && roundRoll(roll.value, translation.dp ?? false),
      type: calc.type,
      target: matcher
        ? markTarget(calc.stat, matcher)
        : { key: { ref: calc.stat.ref }, texts: [] },
    };

    if (translation.negate) {
      if (prepared.roll != null) {
        prepared.roll = -1 * prepared.roll;
      }
    }

    return prepared;
  });
}
