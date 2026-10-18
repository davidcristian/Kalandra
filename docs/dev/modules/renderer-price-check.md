# renderer/src/web/price-check: filters, trade queries and price estimates

**Purpose.** The price check widget shows a parsed item, turns it into search filters for the official trade site,
sends the search and lists the cheapest offers, and shows an estimate from Kalandra's price file. The trade site is
the Path of Exile trade website on one of the official hosts in `PROXY_HOSTS` (`main/src/proxy.ts`), with its API
under `/api/trade2/`. The price file is the hourly JSON file that `priceService/` builds from poe.ninja for each
league ([price-service.md](price-service.md)). This doc also covers the background modules the window reads:
`web/background/Prices.ts`, `price-source.ts` and `Leagues.ts`. Every request below to another host goes through
`Host.proxy("<host>/<path>")`, which fetches `/proxy/<host>/<path>` from main ([main.md](main.md)).

## Public contract

### The window

- [PriceCheckWindow.vue](../../../renderer/src/web/price-check/PriceCheckWindow.vue) is the widget: wmType
  `price-check`, one instance, `exclusive` z-order, flags `hide-on-blur` and `menu::skip`
  ([renderer-widgets.md](renderer-widgets.md)). It handles `MAIN->CLIENT::item-text` with target `price-check`.
  It parses the text with `parseClipboard` unless the event has a ready `item`, as the item search widget sends,
  and returns `item.unknown` for a heist contract or a sentinel that is not unique. When the item is valid, it
  calls `queuePricesFetch()`.
- Its two hotkeys are in `initInstance`: `hotkeyHold` plus `hotkey`, `Ctrl` and `D` by default ("Auto-hide
  Mode"), and `hotkeyLocked`, `Ctrl + Alt + D` by default ("Open without auto-hide"). `getConfigForHost()` sends
  both to main as `copy-item` actions with target `price-check`, the second with `focusOverlay: true`
  ([config.md](config.md)). After the auto-hide key the window sends `OVERLAY->MAIN::track-area` with its screen
  area, the hold key and a distance. Main then hides it with `MAIN->OVERLAY::hide-exclusive-widget` when the
  cursor moves farther than that distance with the hold key up. Main gives the overlay focus when the cursor
  moves inside the area with the hold key down, or when the user clicks in the area.
- [CheckedItem.vue](../../../renderer/src/web/price-check/CheckedItem.vue) builds the presets for each item,
  chooses the search API with `apiToSatisfySearch`, and either searches at once or waits for the Search button.
  `apiToSatisfySearch` returns `trade` when a stat filter is enabled. For a divination card or a map with a stack
  size filter, it returns `bulk` when that filter is enabled. Otherwise it returns `bulk` for an item with a
  `tradeTag` and `trade` for the rest. The window searches at once when "Perform an auto search, when pressing"
  is on for the key used (`smartInitialSearch`, `lockedInitialSearch`) and the item is unique, unidentified,
  veiled, a heist blueprint, a sanctum relic, a charm, or of a category not in `CATEGORY_TO_TRADE_ID`.

### Filters (`filters/`)

- `createPresets(item, opts)` in `create-presets.ts` returns the presets and the active one. An unidentified or
  normal item, a non-unique item that is not craftable, and the non-unique categories listed there get one exact
  preset (`filters.preset_exact`). A unique in `PRESET_UNIQUES` gets `createUniquePresets`. Every other item gets
  "Pseudo" (`filters.preset_pseudo`), plus "Base item" (`filters.preset_base_item`) when `hasCraftingValue` is
  true and `likelyFinishedItem` is false.
- `createFilters` (`create-item-filters.ts`) returns the `ItemFilters`: name, base type, rarity, sockets,
  quality, levels, the corrupted and other states, and the `trade` options (league, listing type, currency).
- `initUiModFilters` and `createExactStatFilters` (`create-stat-filters.ts`) return the `StatFilter` list, one
  per stat with its trade ids, roll range and `FilterTag`. `pseudo/` adds filters for the trade site's pseudo
  stats, each the sum of several item stats, such as total fire resistance (`filterPseudo` and its
  `PSEUDO_RULES`), and the item property filters (`filterItemProp`). The types are in `filters/interfaces.ts`.
- `fill-augments.ts` and `item-editor/` apply the item editor's rune, soul core, catalyst and quality changes to
  the item and its filters, through `recalculateItemProperties` from the parser.

### Trade queries (`trade/`)

| File | What it does |
| --- | --- |
| `pathofexile-trade.ts` | `createTradeRequest(filters, stats, item)` builds the search body; `requestTradeResultList(body, leagueId)` posts it to `/api/trade2/search/<league>`; `requestResults(queryId, ids, opts)` gets the listings from `/api/trade2/fetch/<ids>?query=<queryId>` |
| `trade-api.ts` | `useTradeApi()`: one search, then the listings 10 ids per request, the first two requests at once and the rest one by one until the grouped list has 10 rows (`MIN_GROUPED`) with 7 of them listed at most twice (`MIN_NOT_GROUPED`), or until 100 results or all of them are read |
| `pathofexile-bulk.ts`, `bulk-api.ts` | `execBulkSearch` posts one exchange request to `/api/trade2/exchange/<league>` and keeps at most 8 offers per currency; `useBulkApi()` searches once with Divine, Exalted and Chaos Orbs as the payment currencies (without the item's own currency), and searches again for one currency when its tab is selected and the first response did not include it |
| `common.ts` | `RATE_LIMIT_RULES`, `adjustRateLimits`, `preventQueueCreation`, `apiToSatisfySearch`, and `getTradeEndpoint`, which is `poeWebApi()` in `Config.ts`: the trade host for the language and realm settings, or `www.pathofexile.com` when the trade site setting is `www` |
| `RateLimiter.ts` | `RateLimiter(max, window)`: at most `max` requests in `window` seconds; `wait`, `waitMulti(limiters)`, `estimateTime` |
| `Cache.ts` | keeps a search, fetch or exchange result for 300 seconds, keyed by a SHA-1 of the request (`object-hash`); `requestResults` clears its cache when the core currency changes |
| `TradeListing.vue`, `TradeBulk.vue` | the result lists; an error from the trade site is shown with its message |
| `TradeLinks.vue` | the "Trade" button, which opens the same search on the trade site with `window.open`; with "Enable builtin browser" (`builtinBrowser`) on, it opens the built-in browser and a second button opens the search outside |
| `RateLimiterState.vue` | the "Rate limiting" button, which shows each limiter's use and queue (`showRateLimitState`) |

### Other parts

- `price-prediction/poeprices.ts`: `requestPoeprices(item)` sends the item text to `www.poeprices.info/api`, and
  `sendFeedback` posts to `/send_feedback`. The setting "Show price prediction" (`requestPricePrediction`,
  default `false`) exists, but the `<price-prediction>` element in `CheckedItem.vue` is commented out, so the
  window shows no prediction and sends no request to `www.poeprices.info`.
- `trends/` (`PriceTrend.vue`, `getDetailsId.ts`), `related-items/`, `stack-value/`: the estimate, related items
  and stack value read from the price file. `unidentified-resolver/` picks the unique for an unidentified item.
  `fallback/ReloadTradeData.vue` is the "Reload fallback data" button, which loads the trade site's item and stat
  lists again. `settings-price-check.vue` is the widget's settings page.

### Price estimates (`background/Prices.ts`, `background/price-source.ts`)

- `usePoeninja()` is one shared state, named after poe.ninja, where the data in the price file comes from. It
  returns `queuePricesFetch()`, `findPriceByQuery({ ns, name, variant })`, `cachedCurrencyByQuery`,
  `autoCurrency`, `xchgRate`, `xchgRateCurrency`, `availableCoreCurrencies`, `initialLoading`, `ITEM_DROP` and
  the price arithmetic `addPrice`, `subtractPrice` and `comparePrice`. The module also exports
  `displayRounding`, which formats a value for display.
- `load()` fetches `data/namespaceMap.json` from the app's own files and the price file from
  `Host.proxy(priceFileUrl(league.id))`. It runs only for a selected league that is in the league list and not
  private, on realm `pc-ggg`. It loads the file again when the last successful load is over 31 minutes old
  (`UPDATE_INTERVAL_MS`) and `queuePricesFetch()` ran in the last 20 minutes (`INTEREST_SPAN_MS`). The price check
  and each item selected in the item search call `queuePricesFetch()`, and a timer runs the same check every 4
  minutes (`RETRY_INTERVAL_MS`). A change of league or core currency clears the loaded prices and loads the file at
  once.
- `parseXchg`, `splitJsonBlob` and `findInDatabase` search the raw text of the file instead of parsing it
  ([price-service.md](price-service.md#why-the-key-order-is-a-format)). `parseXchg` returns the `core` object, whose
  `rates` hold the price of one Divine Orb in Exalted Orbs and in Chaos Orbs. Every value in the file is in Divine
  Orbs. `autoCurrency` converts a value to the core currency ("Primary base currency:", `coreCurrency`, default
  `exalted`). It keeps the value in Divine Orbs when a single value is above 0.94 Divine Orb or the low end of a
  range is above one.
- `price-source.ts`: `PRICE_HOST` is `kalandra.ashoal.com`, `leagueFileName(leagueId)` returns the league's file
  name ([price-service.md](price-service.md#the-files)), and `priceFileUrl(leagueId)` is
  `kalandra.ashoal.com/prices/<file>`.

### Leagues (`background/Leagues.ts`)

`useLeagues()` returns `load()`, `selectedId` (the `leagueId` setting), `selected` (id, realm and `isPopular`),
`list`, `isLoading` and `error`. `load()` requests `<trade host>/api/trade2/data/leagues`. The overlay window calls
it at start. The "Refresh" button next to the league list in the price check settings and the "Retry" button
under "Failed to load leagues" call it again. A league whose id contains `Ruthless` or ends in `(PL<number>)`
counts as private, so `isPopular` is false and no price file is read. When the saved league is not in the list and
is not private, `load()` selects the third league when the list has more than two, otherwise the first.

## Invariants

- **Every search, fetch and exchange request waits on its limiter set** (AGENTS.md, and the reasons in
  [ADR-0005](../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)). The request calls
  `RateLimiter.waitMulti(RATE_LIMIT_RULES.<SET>)` before it is sent and `adjustRateLimits(set, response.headers)`
  after. Each set starts as one request per 5 seconds; the headers `x-rate-limit-rules`, `x-rate-limit-<rule>` and
  `x-rate-limit-<rule>-state` replace it with the server's rules, each window longer by `apiLatencySeconds`
  ("Extra time to prevent spurious Rate limiting", default 2). Before a search or an exchange request,
  `preventQueueCreation` throws `Retry after <n> seconds` when the sets' current use would delay it by 1.5
  seconds or more. A new trade site request uses one of these sets or adds a new one.
- **Three trade site requests do not use the sets**: the league list (`/api/trade2/data/leagues`), and the item
  and stat lists in `web/background/TradeData.ts` (`/api/trade2/data/items` and `/data/stats` on
  `www.pathofexile.com`). The league list loads at start, on Refresh and on Retry. The two lists load with the
  game data, on "Reload fallback data", and from a 30 minute timer at most every 2 hours when they were used in
  the last hour.
- **Prices come only from the price file** ([ADR-0006](../adr/ADR-0006-own-price-service.md)). No code here
  requests poe.ninja. `findPriceByQuery` builds a link to the item's poe.ninja page, which the price trend opens
  with `window.open` when the user clicks it.
- **The price file's key order and file names are shared with `priceService/`**: see
  [why the key order is a format](price-service.md#why-the-key-order-is-a-format) and
  [the files](price-service.md#the-files).
- **Trade responses are untrusted.** A trade site `error` is thrown as an `Error` and shown in the result list. A
  listing that `parseFetchResult` cannot read is logged and kept without its item tooltip.
- **`pathofexile-trade.ts` is 2103 lines** (2026-10-18,
  `wc -l renderer/src/web/price-check/trade/pathofexile-trade.ts`). New, separable code goes in a new file and is
  called from it (AGENTS.md, rule 6).

**Dependencies.** The parser ([renderer-parser.md](renderer-parser.md)); the `price-check` widget config
(`PriceCheckWidget` in `overlay/widgets.ts`) and the `leagueId`, `language`, `realm`, `preferredTradeSite` and
`accountName` settings ([config.md](config.md)); the `/proxy` route and `PROXY_HOSTS` in main ([main.md](main.md));
the price file ([price-service.md](price-service.md)); `renderer/public/data/namespaceMap.json`. Libraries:
neverthrow, `object-hash`, `luxon`, `@vueuse/core`.

**Tests.** `npx vitest run` in `renderer/`, after `npm run make-index-files`. `specs/web/price-check/filters/`
covers item filters, stat filters, the missing fractured rules and the pseudo stats.
`specs/web/price-check/trade/pathofexile-trade.test.ts` parses saved listings from `specs/docs/fetchResponses.json`.
`specs/web/useTradeApi.test.ts` drives `useTradeApi` with `pathofexile-trade.ts` replaced by mocks.
`specs/web/prices.test.ts` reads the price service's fixtures. No test calls a live site. `RateLimiter.ts`,
`common.ts`, `Leagues.ts`, `TradeData.ts` and `poeprices.ts` have no test file of their own.
