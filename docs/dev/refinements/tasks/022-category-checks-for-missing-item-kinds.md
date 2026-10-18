# Category checks for item kinds the Path of Exile 2 data does not have

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/item-check/WidgetItemCheck.vue](../../../../renderer/src/web/item-check/WidgetItemCheck.vue)
**Verified:** 2026-10-18

The parser sets an item's category from `craftable.category` of its entry in `items.ndjson`, or of
its base item for a unique (`renderer/src/parser/Parser.ts`). The other assignments in `Parser.ts`
set `Currency`, `DivinationCard` and `Gem` from the rarity line, and three categories from help
texts in `parseCategoryByHelpText`. On 2026-10-18 no entry in the `items.ndjson` of any language
has the category `Heist Contract`, `Heist Blueprint`, `Invitation` or `Sanctum Relic`, and seven
have `Relic`. Code still checks the four missing ones:

- `isMapLike` in `WidgetItemCheck.vue` opens Map check for `HeistContract`, `HeistBlueprint` and
  `Invitation`, besides non-unique maps and the `Expedition Logbook`.
- The automatic search condition in `renderer/src/web/price-check/CheckedItem.vue` names
  `HeistBlueprint` and `SanctumRelic`. A relic (`Relic`) gets the automatic search through the
  same condition already, because `CATEGORY_TO_TRADE_ID` in `trade/pathofexile-trade.ts` has no
  entry for `Relic`.
- `create-item-filters.ts`, `create-presets.ts` and `create-stat-filters.ts` in
  `renderer/src/web/price-check/filters/` branch on the same categories.
- `parseHeistBlueprint` in `Parser.ts`, `handleItemPaste` in `PriceCheckWindow.vue`, the
  `SanctumRelic` case of `trends/getDetailsId.ts`, and the `HeistBlueprint`, `HeistContract` and
  `SanctumRelic` entries of `CATEGORY_TO_TRADE_ID` do the same.

`ItemCategory` in `renderer/src/parser/meta.ts` has more values that the data does not have, such
as `HeistTool` and `Claw`. This task covers the four above.

A count of categories in the file, run from the repo root, measures it again:
`python -c "import json,collections;print(collections.Counter(json.loads(l).get('craftable',{}).get('category') for l in open('renderer/public/data/en/items.ndjson',encoding='utf-8') if l.strip()))"`.

Done looks like: a decision on each check. Remove the branches for categories the data does not
have, or keep each one with its reason. [docs/map-check.md](../../../map-check.md) lists the items
that open Map check and changes with the code. [Host task 013](../../host/tasks/013-map-check.md)
checks the items in the game.

## History

- 2026-10-18: Found while docs/map-check.md was rewritten, by comparing the category checks with a
  count of the categories in `items.ndjson`. The same day the check found that relics already get
  the automatic search, so the question of adding `Relic` to the condition was removed.
