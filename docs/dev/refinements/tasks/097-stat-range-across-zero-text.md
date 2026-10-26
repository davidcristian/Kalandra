# A stat whose roll range crosses zero always gets the text without negate

**Status:** open
**Area:** parser
**Origin:** [renderer/src/parser/modifiers.ts](../../../../renderer/src/parser/modifiers.ts)
**Verified:** 2026-10-26

`translateStatWithRoll()` in `renderer/src/parser/modifiers.ts` picks the matcher of a stat whose
text the price check filters and Map check show. When no matcher has the roll's exact value, it
picks by the sign of the roll: the matcher with `negate` for a negative roll and the one without
for a positive roll. When the roll's `min` and `max` have different signs, as for a stat whose
sources add up values of both signs, it always picks the matcher without `negate`. It does not read
the stat's `better` field, which is `StatBetter.NegativeRoll` for a stat whose lower value is the
better one. `calculatedStatToFilter()` in
`renderer/src/web/price-check/filters/create-stat-filters.ts` fills the filter's min and max from
`better`, then negates and swaps them when the matcher has `negate`, so the choice changes the
filter as well as the text.

Done looks like: a parser case with real copied item text whose stat has such a range, and then
either a change that picks the matcher with `negate` for a stat whose lower value is better, with
a test of the price check filter it makes, or a decision in this file that the choice stays.

## History

- 2026-10-26: Filed from a TODO comment in `translateStatWithRoll()` that said a lower value is
  better for some stats.
