# The base percentile trade id and its texts remain without a filter

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/price-check/filters/interfaces.ts](../../../../renderer/src/web/price-check/filters/interfaces.ts)
**Verified:** 2026-10-27

The parser no longer computes a base percentile, and no code makes a stat filter with the internal
trade id `item.base_percentile`. The id is still the first entry of `INTERNAL_TRADE_IDS` in
`filters/interfaces.ts`, and the `app_i18n.json` of each of the nine languages still has its text
`item.base_percentile`. `FilterModifierItemIsElemental.vue` reads entries 12 to 15 of that list by
index, so removing the first entry moves the four ids it reads.

Done looks like: the id and its nine texts removed, and `FilterModifierItemIsElemental.vue` reading
its four ids by name, with a test of the filter it shows for each of them.

## History

- 2026-10-27: Found when the parser stopped writing `basePercentile`
  ([082](082-checks-for-item-names-the-data-lacks.md)).
