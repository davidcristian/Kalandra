# A stat without a trade id for its modifier type makes a filter without a trade id

**Status:** open
**Area:** parser
**Origin:** [renderer/src/parser/stat-translations.ts](../../../../renderer/src/parser/stat-translations.ts)
**Verified:** 2026-10-19

`tryParseTranslation()` in `stat-translations.ts` accepts a stat from `stats.ndjson` only when its
`trade.ids` has a key for the modifier type, except a stat whose ref starts with `Grants Skill`.
When no stat matches, `tryTradeStatTranslation()` builds one from the trade site's stat list, with
the ids the list has for that text. For a rune line it requires a `rune` id. For every other type it
accepts the stat without an id for that type. The trade site has no `crafted` category, so a
crafted line that reaches the fallback never has one.

`calculatedStatToFilter()` in `web/price-check/filters/create-stat-filters.ts` sets
`tradeId: stat.trade.ids[type]`, which is `undefined` for such a stat. `FilterModifier.vue` reads
`props.filter.tradeId.length`, and `createTradeRequest()` in `trade/pathofexile-trade.ts` reads
`stat.tradeId[0]`. `initUiModFilters()` maps a fractured, desecrated or crafted stat to its explicit
id, but for an item that can still be modified it adds the stat again under its own type.

Done looks like: a rule for each modifier type that says which trade ids a fallback stat or a
`Grants Skill` stat needs, such as the explicit id for the types the filters map to explicit; a
stat that has none goes to `unknownModifiers`, or its filter is hidden; and parser and filter tests
for an implicit and a crafted line in that case.

## History

- 2026-10-19: Found while the rune line fallback was fixed. The code paths above are from reading
  the code; no test or in-game check has shown the filter error yet.
