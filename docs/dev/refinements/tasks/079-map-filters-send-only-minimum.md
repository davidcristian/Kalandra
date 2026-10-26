# The map property filters send only their minimum to the trade site

**Status:** done 2026-10-27
**Area:** trade
**Origin:** [renderer/src/web/price-check/trade/pathofexile-trade.ts](../../../../renderer/src/web/price-check/trade/pathofexile-trade.ts)
**Verified:** 2026-10-27

`createTradeRequest` in `pathofexile-trade.ts` sends a `.min` and a `.max` for most property
filters, such as `item.physical_dps`, but only the `.min` for the map filters: `item.map_revives`,
`item.map_pack_size`, `item.map_magic_monsters`, `item.map_rare_monsters`, `item.map_drop_chance`,
`item.map_item_rarity` and `item.map_gold`. A maximum that the user sets on one of them is not in
the search.

Done looks like: each of these cases also sets its `.max` key under `map_filters`, the way the
equipment filters do, and a test checks that a maximum is in the query.

## History

- 2026-10-22: Filed when the comment that asked for these maximums was removed from
  `pathofexile-trade.ts`.
- 2026-10-27: fix(trade): send the maximum of the map property filters. The seven cases became
  one, which looks up each filter's key under `map_filters` and sets its `.min` and `.max`.
