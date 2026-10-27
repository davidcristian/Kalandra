# The price check looks up a base item price that the price file never has

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/price-check/trends/getDetailsId.ts](../../../../renderer/src/web/price-check/trends/getDetailsId.ts)
**Verified:** 2026-10-27

For a normal, magic or rare weapon, armour piece, ring, amulet, belt or quiver, `isValuableBasetype()`
in `getDetailsId.ts` is true, and `getDetailsId()` returns the query of `forBasetype()`: namespace
`ITEM` and the base type's `refName`. No category in `renderer/public/data/namespaceMap.json` holds
base types, so `splitJsonBlob()` in `web/background/Prices.ts` keeps no line for them and
`findPriceByQuery()` returns `null`. `PriceTrend.vue` then shows nothing for the item, and its
`isValuableBasetype` branches and the `trade_result.base_item` label ("Base item") never render.

Done looks like: a decision for the maintainer. Either the price service writes a base type category,
if poe.ninja has one for Path of Exile 2, which changes the price file
([ADR-0006](../../adr/ADR-0006-own-price-service.md)), and the price check page describes the
estimate; or `forBasetype()` and the `PriceTrend.vue` branches are removed, with a test that a rare
weapon gets no base item query.

## History

- 2026-10-19: Found while the price check page was compared with the code. The page said these items
  show the price of their base item; it now says they have no estimate.
- 2026-10-27: The maintainer chose to remove `forBasetype()` and the base item branches of
  `PriceTrend.vue`. Checked again: none of the 23 categories in `namespaceMap.json` holds base
  types.
