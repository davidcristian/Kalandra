# The trade site's item and stat lists match only English item text

**Status:** open
**Area:** parser
**Origin:** [renderer/src/web/background/TradeData.ts](../../../../renderer/src/web/background/TradeData.ts)
**Verified:** 2026-10-22

`loadStatData()` and `loadItemData()` in `TradeData.ts` request `www.pathofexile.com` in every app
language, so the item names and stat texts they load are English. `TRADE_STAT_BY_MATCH_STR` in
`assets/data/index.ts` looks up the stat text of the copied item, which is in the game language, and
`TRADE_ITEM_BY_REF` looks up its name. For an item in another language neither finds anything, so a
stat that `stats.ndjson` does not have yet goes to `unknownModifiers` ("Not recognized modifier"),
an item that `items.ndjson` does not have fails with `item.unknown`, and "Reload fallback data" does
not help. The stat tests in `specs/Parser/stat-translation.test.ts` read in-memory lists of English
stat texts, so no test reads a stat that is not English.

Done looks like: the stat list loads from the trade site of the app language, whatever the Preferred
trade site setting, while the trade queries keep the item names they need; or a decision that the
fallback stays English only. The first needs a host for Traditional Chinese on the international
realm, which `poeWebApi()` in `web/Config.ts` sends to `www.pathofexile.com`, the Korean host question
in [055](055-dataparser-korean-host.md), and the request limits in
[043](043-trade-list-requests-without-limiter.md). A test loads a stat list from a fake site in
another language and parses an item with a stat that only that list has.

## History

- 2026-10-19: Found while the parser doc was compared with `TradeData.ts`, whose comment called the
  stat list translated. The comment and the docs now say the lists are English.
- 2026-10-22: Checked again when the stat tests moved from `vi.fn` lookups to in-memory lists.
