# The trade site's league and item lists name no Hardcore league and no trade tag

**Status:** open
**Area:** trade
**Origin:** [renderer/src/web/background/Leagues.ts](../../../../renderer/src/web/background/Leagues.ts)
**Verified:** 2026-10-26

Two choices in the renderer read a list from the official trade site that lacks a field they need.

- **The default league.** When the saved league is not in the list and is not a private league,
  `load()` in `renderer/src/web/background/Leagues.ts` selects the third league of
  `/api/trade2/data/leagues` (`TMP_CHALLENGE = 2`), or the first when the list has two or fewer.
  So it expects the list to start with Standard and Hardcore. Each entry has only an `id` and a
  `text`, so the code cannot check which league is Hardcore.
- **An item that `items.ndjson` lacks.** `TRADE_ITEM_BY_REF` in
  `renderer/src/assets/data/index.ts` builds the item from `/api/trade2/data/items`, which has no
  exchange id, so the item gets no `tradeTag`. For a currency item, `searchListingType()` in
  `renderer/src/web/price-check/trade/common.ts` then returns `trade`, so the price check searches
  listings instead of the bulk exchange. The price from the price file does not need the tag.

Done looks like: the default league is chosen by a field that marks Hardcore leagues, or the
expected order is written down as the reason for the index; and a currency item the data lacks
either gets its tag from the exchange list, `/api/trade2/data/static`, or keeps the listing search
with its reason in this file. A test covers each choice with a saved response. A request to the
live site needs the maintainer's go-ahead ([AGENTS.md](../../../../AGENTS.md#safety)).

## History

- 2026-10-26: Filed from two TODO comments. The one in `load()` named `/api/leagues?realm=poe2` as
  a list that marks Hardcore leagues, once it serves Path of Exile 2; no agent has checked that.
  The one in `TRADE_ITEM_BY_REF` asked whether a currency item without its tag works well enough.
