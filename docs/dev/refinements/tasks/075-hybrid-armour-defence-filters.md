# Hybrid armour bases start with every defence filter enabled

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/price-check/filters/pseudo/item-property.ts](../../../../renderer/src/web/price-check/filters/pseudo/item-property.ts)
**Verified:** 2026-10-21

`armourProps()` in `item-property.ts` starts the Armour, Evasion Rating and Energy Shield filters
enabled on every base. Awakened PoE Trade disabled all three on a base with more than one of them,
because Path of Exile players rarely price a hybrid base by its defences, and those who do look at
one of them. Exiled Exchange 2 enabled all three for Path of Exile 2 and left open whether players
price hybrid bases by each defence. The test cases of `starts every defence filter enabled` in
`renderer/specs/web/price-check/filters/pseudo/item-property.test.ts` assert the current defaults.

Done looks like: the maintainer decides whether a hybrid base starts with its defence filters
disabled. If it does, `armourProps()` sets `disabled` from the number of defences on the item, and
the cases of the two hybrid items in that test change with it.

## History

- 2026-10-21: Filed when the check that always returned true was removed from `armourProps()`.
