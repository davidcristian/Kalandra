# renderer/src/web/price-check: filters, trade queries and price estimates

**Purpose.** The price check widget shows a parsed item, turns it into search filters for the official trade site,
sends the search and lists the cheapest offers, and shows an estimate from Kalandra's price file. The trade site is
the Path of Exile trade website on one of the official hosts in `PROXY_HOSTS` (`main/src/proxy.ts`), with its API
under `/api/trade2/`. The price file is the hourly JSON file that `priceService/` builds from poe.ninja for each
league ([price-service.md](price-service.md)). This doc also covers the background modules the window reads:
`web/background/Prices.ts`, `price-source.ts` and `Leagues.ts`. Every request below to another host goes through
`Host.proxy("<host>/<path>")`, which fetches `/proxy/<host>/<path>` from main with the `x-kalandra-proxy` header
that the route needs ([main.md](main.md)).

## Public contract

### The window

- [PriceCheckWindow.vue](../../../renderer/src/web/price-check/PriceCheckWindow.vue) is the widget: wmType
  `price-check`, one instance, `exclusive` z-order, flags `hide-on-blur` and `menu::skip`
  ([renderer-widgets.md](renderer-widgets.md)). It handles `MAIN->CLIENT::item-text` with target `price-check`.
  It parses the text with `parseClipboard` unless the event has a ready `item`, as the item search widget sends.
  When the item is valid, it calls `queuePricesFetch()`.
- Its two hotkeys are in `initInstance`: `hotkeyHold` plus `hotkey`, `Ctrl` and `D` by default ("Auto-hide
  Mode"), and `hotkeyLocked`, `Ctrl + Alt + D` by default ("Open without auto-hide"). `shortcutActions()` sends
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
  veiled, a charm, or of a category not in `CATEGORY_TO_TRADE_ID`, such as a relic.
  Its first watcher on the item builds the presets and the next one searches with them, so it needs Vue to run
  the watchers of a component in the order they are defined. Vue 3.2.38 to 3.3.6 did not
  ([vuejs/core#7576](https://github.com/vuejs/core/issues/7576)).
  Before a search, it shows a tip that `createTipSchedule()` in `help/tips.ts` picks: with every item at
  **Always**, after 7, 20, 50 or 100 items without one at the other settings, and none at **Never**.
  `specs/web/tips.test.ts` checks it.

### Filters (`filters/`)

- `createPresets(item, opts)` in `create-presets.ts` returns the presets and the active one. An unidentified or
  normal item, a non-unique item that is not craftable, the non-unique categories listed there and a currency item
  with a trial count (`item.trials.numberOfTrials`) get one exact preset (`filters.preset_exact`). A unique in
  `PRESET_UNIQUES` gets `createUniquePresets`. Every other item gets "Pseudo" (`filters.preset_pseudo`), plus
  "Base item" (`filters.preset_base_item`) when `hasCraftingValue` is true and `likelyFinishedItem` is false.
  `hasCraftingValue` (`filters/common.ts`) skips the item level test for a category whose `maxUsefulItemLevel`
  is 1: tablets, jewels and waystones.
- `createFilters` (`create-item-filters.ts`) returns the `ItemFilters`: name, base type, rarity, sockets,
  quality, levels, the corrupted and other states, and the `trade` options (league, listing type, currency).
  A unique's base type comes from the item data through `uniqueBaseTradeName` in `filters/common.ts`, or is
  the copied base type text when the item data does not have that base.
- `initUiModFilters` and `createExactStatFilters` (`create-stat-filters.ts`) return the `StatFilter` list, one
  per stat with its trade ids, roll range and `FilterTag`. The tag starts as the one `FILTER_TAG_BY_MODIFIER_TYPE`
  in `interfaces.ts` gives the stat's modifier type. The range is the `searchStatRange` setting ("Fill stat
  values") as a percentage of the value, or of a unique's roll range. `createExactStatFilters` and the Mageblood
  preset take at most 2, and 0 for a tablet. `calculatedStatToFilter` takes 0 for the Charm Slots stat, a magic
  item that `itemIsModifiable` returns false for, and a unique's stat at its best roll. `pseudo/` adds filters
  for the trade site's pseudo stats, each the sum of several item stats, such as total fire resistance
  (`filterPseudo` and its `PSEUDO_RULES`), and the item property filters (`filterItemProp`). The types are in
  `filters/interfaces.ts`.
- `text-keys.ts` builds the `app_i18n.json` key that names a modifier type (`item.mod_added_rune`) or a trade
  category (`item_category.weapon_bow`). `FilterModifier.vue` names a tag by `filters.tag_<tag>`, and a stat
  filter's tag can be any `ModifierType`.
- The item editor applies its changes in `item-editor/`: `useAugment` from the parser's `augment-builder.ts` puts a
  rune or soul core in a socket, and `applyCatalyst` in `item-editor.ts` applies a catalyst and its quality. Both
  change the item and recompute its properties through `recalculateItemProperties` from the parser. The parser also
  calls `useAugment` to fill an item's empty sockets with the saved augments. `augmentSaveKey` in `item-editor.ts`
  returns the key in the price check's `savedAugments` that the editor saves a set under: the item category,
  `casterWeapon`, `martialWeapon`, `armour` or `all`, the keys `getSavedAugments` reads. The editor's lists come from
  `categoryAugments` in `augment.ts` and `categoryCatalysts` in `item-editor.ts`, which build each category's list
  once per game data load, so they switch to the new language after a language change.

### Trade queries (`trade/`)

| File | What it does |
| --- | --- |
| `pathofexile-trade.ts` | `createTradeRequest(filters, stats, item)` builds the search body without changing the filters; `requestTradeResultList(body, leagueId)` posts it to `/api/trade2/search/<league>`; `requestResults(queryId, ids, opts)` gets the listings from `/api/trade2/fetch/<ids>?query=<queryId>`, values each price by its currency's trade tag, and returns a short label such as `G. chaos` for a greater or perfect orb (`CONVERT_CURRENCY`) without changing the cached listing |
| `prop-set.ts` | `propSet(object, path, value)` sets the value at a dot path, such as `misc_filters.filters.corrupted.option`. Its types accept only a path of the object's type and a value of that path's type, so `createTradeRequest` sets only the filters that its `TradeRequest` type declares |
| `trade-api.ts` | `useTradeApi()`: one search, then the listings 10 ids per request, the first two requests at once and the rest one by one until the grouped list has 10 rows (`MIN_GROUPED`) with 7 of them listed at most twice (`MIN_NOT_GROUPED`), or until 100 results or all of them are read |
| `pathofexile-bulk.ts`, `bulk-api.ts` | `execBulkSearch` posts one exchange request to `/api/trade2/exchange/<league>` and keeps at most 8 offers per currency; `useBulkApi()` searches once with Divine, Exalted and Chaos Orbs as the payment currencies (without the item's own currency). A tab's `load()` searches again for its currency when the first response did not include it. Its total is then subtracted from the estimated total of the Divine Orb tab (of the Exalted Orb tab when the Divine Orb tab loads), if that tab has a result. `useShownRows(result, selected, ready)` returns the 8 rows of the selected tab once the results show, and calls its `load()` after the window updates |
| `common.ts` | `RATE_LIMIT_RULES`, `adjustRateLimits`, `preventQueueCreation`, `apiToSatisfySearch`, `searchListingType` and `exchangeListingType`, which return the status each request sends for a listing type the other offers, and `getTradeEndpoint`, which is `poeWebApi()` in `Config.ts`: the trade host for the language and realm settings, or `www.pathofexile.com` when the trade site setting is `www` |
| `RateLimiter.ts` | `RateLimiter(max, window)`: at most `max` requests in `window` seconds; `wait`, `waitMulti(limiters)`, `estimateTime`, `restrict(seconds)`, which holds every request for that time, and `addHits(count)`, which counts requests the server reports without waiting. `waitMulti` logs a warning for a limiter destroyed after its wait, which does not count the request |
| `Cache.ts` | keeps a search, fetch or exchange result for 300 seconds (`CACHE_TTL`) from its last write, keyed by a SHA-1 of the request (`object-hash`); `requestResults` clears its cache and the pending deletions when the core currency changes |
| `TradeListing.vue`, `TradeBulk.vue` | the result lists; an error from the trade site is shown with its message and a "Browser" button, which always opens the search in the built-in browser, since the trade requests use that browser's cookies |
| `listing-markers.ts` | `listingMarkers(listing, showSeller)`: the "You", "in demand" and "Gone" markers of a listing, shown after its listed time, or after its seller when "Show seller" is set |
| `TradeLinks.vue` | the "Trade" button, which opens the same search on the trade site with `window.open`; with "Enable builtin browser" (`builtinBrowser`) on, it opens the built-in browser and a second button opens the search outside |
| `RateLimiterState.vue` | the "Rate limiting" button, which shows each limiter's use and queue (`showRateLimitState`) |

### Other parts

- `trends/` (`PriceTrend.vue`, `getDetailsId.ts`, `trade-volume.ts`), `related-items/`, `stack-value/`: the
  estimate, related items and stack value read from the price file. `getDetailsId` returns the item's query for the
  price file, with a unique's base item as `variant` ([price-service.md](price-service.md#the-price-file-format)).
  For a normal, magic or rare weapon, armour piece, accessory or quiver it returns the base type
  (`isValuableBasetype`, `forBasetype`), which no category in `namespaceMap.json` holds, so the window shows no
  estimate for it ([refinement 062](../refinements/tasks/062-base-item-estimate.md)).
  `tradeVolume` in `trade-volume.ts` formats the currency exchange volume per hour, and divides the volume by the
  price, both in Divine Orbs, for items per hour.
  `buildRelatedItems` in `related-items/related-items.ts` lists the `item-drop.json` group that contains the
  item, and leaves out each ref that the item data does not contain, such as an item from a newer game patch.
  A ref is `<namespace>::<refName>` from the English `items.ndjson`, and a unique adds ` // <base item>`.
  The source of the groups is `item-drop.jsonc`, the same list with `//#region` comment lines. A change is made
  there and copied to `item-drop.json`, the file the app loads, without the comments. `specs/data/itemDrop.test.ts`
  checks that the two files hold the same groups and that the item data contains every ref in them. It also
  checks that each group has a non-empty `query` list and an `items` list of refs, and that no ref is in the
  `query` of two groups, since the panel shows only the first group whose `query` has the item.
  `unidentified-resolver/` picks the unique for an unidentified item.
  `fallback/ReloadTradeData.vue` is the "Reload fallback data" button, which loads the trade site's item and stat
  lists again and shows how many of their entries are new. The lists are English, so they help only an English
  item ([renderer-parser.md](renderer-parser.md#the-game-data)). `settings-price-check.vue` is the widget's
  settings page.

### Price estimates (`background/Prices.ts`, `background/price-source.ts`)

- `usePoeninja()` is one shared state, named after poe.ninja, where the data in the price file comes from. It
  returns `queuePricesFetch()`, `findPriceByQuery({ ns, name, variant })`, `cachedCurrencyByQuery`,
  `autoCurrency`, `xchgRate`, `xchgRateCurrency`, `availableCoreCurrencies`, `initialLoading`, `ITEM_DROP` and
  the price arithmetic `addPrice`, `subtractPrice` and `comparePrice`. The module also exports
  `displayRounding`, which formats a value for display.
- The price file holds poe.ninja's English names, so a caller passes an item's `refName` to `findPriceByQuery`,
  never its `name`, which is in the app language. The item editor's catalyst price uses `catalystCost` in
  `item-editor/item-editor.ts`.
- `load()` fetches `data/namespaceMap.json` from the app's own files and the price file from
  `Host.proxy(priceFileUrl(league.id))`. It runs only for a selected league that is in the league list and not
  private, on realm `pc-ggg`. It loads the file again when the last successful load is over 31 minutes old
  (`UPDATE_INTERVAL_MS`) and `queuePricesFetch()` ran in the last 20 minutes (`INTEREST_SPAN_MS`). The price check
  and each item selected in the item search call `queuePricesFetch()`, and a timer runs the same check every 4
  minutes (`RETRY_INTERVAL_MS`). A change of league or core currency clears the loaded prices and the converted
  prices that `cachedCurrencyByQuery` keeps for trade listings, and loads the file at once. A load that starts while
  another runs aborts it, and only the newest load clears the loading state that `initialLoading()` reads.
- `parseXchg`, `splitJsonBlob` and `findInDatabase` search the raw text of the file instead of parsing it
  ([price-service.md](price-service.md#why-the-key-order-is-a-format)). `parseXchg` returns the `core` object, whose
  `rates` hold the price of one Divine Orb in Exalted Orbs and in Chaos Orbs. Every value in the file is in Divine
  Orbs. `load` sets `xchgRate` to the rate of the core currency ("Primary base currency:", `coreCurrency`, default
  `exalted`), or to the Exalted Orb rate when the core currency's rate is below 5. `xchgRateCurrency` is the
  currency of that rate, and `autoCurrency` converts a value with `xchgRate` and labels it with that currency. It
  keeps the value in Divine Orbs when a single value is above 0.94 Divine Orb or the low end of a range is above one.
- `price-source.ts`: `PRICE_HOST` is `kalandra.ashoal.com`, `leagueFileName(leagueId)` returns the league's file
  name ([price-service.md](price-service.md#the-files)), and `priceFileUrl(leagueId)` is
  `kalandra.ashoal.com/prices/<file>`.

### Leagues (`background/Leagues.ts`)

`useLeagues()` returns `load()`, `selectedId` (the `leagueId` setting), `selected` (id, realm and `isPopular`),
`list`, `isLoading` and `error`. `load()` requests `<trade host>/api/trade2/data/leagues`. The overlay window calls
it at start. The "Refresh" button next to the league list in the price check settings and the "Retry" button
under "Failed to load leagues" call it again. A league whose id ends in `(PL<number>)` counts as private.
`isPopular` is true for a listed league that is not private, and no price file is read for any other. When the saved
league is not in the list and is not private, `load()` selects the third league when the list has more than two,
otherwise the first. A failed load is logged with `console.warn` and its message kept in `error`.

## Invariants

- **Every search, fetch and exchange request waits on its limiter set** (AGENTS.md, and the reasons in
  [ADR-0005](../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)). The request calls
  `RateLimiter.waitMulti(RATE_LIMIT_RULES.<SET>)` before it is sent and `adjustRateLimits(set, response.headers)`
  after. Each set starts as one request per 5 seconds; the headers `x-rate-limit-rules`, `x-rate-limit-<rule>` and
  `x-rate-limit-<rule>-state` replace it with the server's rules, each window longer by `apiLatencySeconds`
  ("Extra time to prevent spurious Rate limiting", default 2). A rule whose two headers are missing, or that does
  not give a limit above 0, a window and a hit count for each entry, is skipped with a `console.warn`. The set then
  keeps its current limiters beside the rules it could read. The third field of a `-state` entry is the seconds left
  of a restriction, and `Retry-After` gives them for every limiter in the set. `RateLimiter.restrict` holds every
  request on the limiter until they are over, and `estimateTime` counts them. A `Retry-After` that is not a number
  of seconds is logged and ignored. Before a search or an exchange request,
  `preventQueueCreation` throws `Retry after <n> seconds` when the sets' current use would delay it by 1.5
  seconds or more. A new trade site request uses one of these sets or adds a new one.
- **Three trade site requests do not use the sets**: the league list (`/api/trade2/data/leagues`), and the item
  and stat lists in `web/background/TradeData.ts` (`/api/trade2/data/items` and `/data/stats` on
  `www.pathofexile.com`). The league list loads at start, on Refresh and on Retry. The two lists load with the
  game data, on "Reload fallback data", and from a 30 minute timer at most every 2 hours when they were used in
  the last hour. A response with an empty item or stat list keeps the loaded lists, and the timer tries again at its
  next run.
- **Prices come only from the price file** ([ADR-0006](../adr/ADR-0006-own-price-service.md)). No code here
  requests poe.ninja. `findPriceByQuery` builds a link to the item's poe.ninja page, which the price trend opens
  with `window.open` when the user clicks it.
- **The price file's key order and file names are shared with `priceService/`**: see
  [why the key order is a format](price-service.md#why-the-key-order-is-a-format) and
  [the files](price-service.md#the-files).
- **Trade responses are untrusted.** `readTradeData()` in `trade/trade-response.ts` reads the search, fetch,
  exchange, league, item and stat list responses. A body that is not a JSON object, such as the web page the site
  sends while it is down or checks for bots, a trade site `error` and any other failed status each throw a
  `TradeResponseError` with the HTTP status in `status`. Its message names the status, or is the site's own message
  for an `error`, and the result lists show it. A listing that `parseFetchResult` cannot read is logged and kept
  without its item tooltip. The item tooltip passes only a key of the English `app_i18n.json` to `t()`
  (`tooltipLineText` in `trade/tooltip-text.ts`), so the message formatter never reads trade site text. Its tags,
  `Unidentified (Tier 2)` from `ITEM_UNIDENTIFIED` and `TIER`, `Corrupted`, `Mirrored` and `Sanctified`, and its
  unrevealed modifiers (`VEILED_PREFIX`, `VEILED_SUFFIX`) show the game's client strings.
- **Only the newest search sets the result and the error.** `useTradeApi` and `useBulkApi` number each search. A
  search that a newer one replaced, and a currency tab that it loads later, change neither the shown result nor its
  error when they end.
- **`pathofexile-trade.ts` is 1923 lines** (2026-10-27,
  `wc -l renderer/src/web/price-check/trade/pathofexile-trade.ts`). New, separable code goes in a new file and is
  called from it (AGENTS.md, rule 6).

**Dependencies.** The parser ([renderer-parser.md](renderer-parser.md)); the `price-check` widget config
(`PriceCheckWidget` in `overlay/widgets.ts`) and the `leagueId`, `language`, `realm`, `preferredTradeSite` and
`accountName` settings ([config.md](config.md)); the `/proxy` route and `PROXY_HOSTS` in main ([main.md](main.md));
the price file ([price-service.md](price-service.md)); `renderer/public/data/namespaceMap.json`. Libraries:
neverthrow, `object-hash`, `luxon`, `@vueuse/core`.

**Tests.** `npx vitest run` in `renderer/`, after `npm run make-index-files`. `specs/web/price-check/filters/`
covers the unidentified filters of `createFilters`, the ascendancy points of trials, which items get the base item
tab, the missing fractured rules, the pseudo stats and the rounding of rolls in `filters/util.ts`.
`stat-filter-rolls.test.ts` there runs `createPresets` on real copied items and checks the search range of rare and
unique rolls, the fixed stats of a unique, negated stats and the values that the trade search sends for them.
`text-keys.test.ts` there checks that the English `app_i18n.json` names each modifier type,
filter tag and trade category. `shown-filters.test.ts` there checks that turning each filter button on or off
changes the body of `createTradeRequest`, so `createFilters` returns no filter that the search does not send.
`null-trade-ids.test.ts` there makes the stat filters of the stats whose trade ids are `null` in `stats.ndjson`.
`mageblood.test.ts` there makes the Mageblood preset of `create-unique-filters.ts` for belts with one to four
Legacy kinds, once from a reactive item whose stats must stay unchanged. It checks the Duplicates filter, the
count of Legacy rolls that `createTradeRequest` sends, and that its "and" group has each Legacy kind once.
`pseudo/anointments.test.ts` there names the oils of a real anointed amulet from the oil names in `stats.ndjson`,
names none for an unknown oil, and checks when its anointment filter is left out of the search.
`gem-filters.test.ts` there makes the filters and the search of a real skill gem and of three uncut gems.
`specs/web/price-check/item-editor/` checks which editor `getItemEditorType` opens for real copied items, the
catalyst quality, the catalyst price, the augment tabs and the lists after a language change.
`specs/web/price-check/trade/pathofexile-trade.test.ts` parses saved listings from `specs/docs/fetchResponses.json`
into their titles, name blocks, tags and affix tiers, and gets a listing it cannot read from a fake trade site,
and `listing-prices.test.ts` beside it gets saved listings from a fake trade site and values them with the price
file fixture. Saved listings name their sellers `Seller01#0001` and up, and their `hideout_token` values are fake.
`specs/web/useTradeApi.test.ts` drives `useTradeApi` with `pathofexile-trade.ts` replaced by a fake trade site that
returns the saved listings, and checks the grouped rows and how many listings it reads.
`specs/web/useBulkApi.test.ts` drives `useBulkApi` and `useShownRows` with a fake `execBulkSearch` that answers when
the test says.
`bulk-search.test.ts` in `specs/web/price-check/trade/` runs `execBulkSearch` on hand-written exchange responses
and checks the order and the totals per currency, the seller states and the cache.
`bulk-error-browser.test.ts` there checks that the Browser button of `TradeBulk.vue` opens the built-in browser.
`property-filters.test.ts` there turns on the item property filters of real items and checks the trade site
filters that `createTradeRequest` sends for them, with a maximum the user sets, and the elements an elemental damage
filter leaves out.
`specs/web/prices.test.ts` reads the price service's fixtures, a file without rates, a namespace map of another
schema version and an overview type that the map does not list, and `specs/web/prices-load.test.ts` loads the price
file from a fake host. `specs/web/display-rounding.test.ts` writes prices as `displayRounding` shows them.
`specs/web/trade-data.test.ts` loads the trade site's item and stat lists from a fake site with fake timers.
`specs/web/host-proxy.test.ts` checks the URL and header `Host.proxy` sends, and that it takes only a string path.
`specs/web/price-check/trade/rate-limits.test.ts` reads hand-written rate limit headers into limiter sets with
`adjustRateLimits`, and `RateLimiter.test.ts` beside it checks the limiter's timing, restrictions and destroy with
fake timers. `listing-markers.test.ts` there checks which column shows a listing's markers, and `trade-response.test.ts`
reads hand-written responses with `readTradeData` and answers each trade site request with a web page.
`listing-properties.test.ts` there reads a listing's item level, quality and gem level by property type, and
`prop-set.test.ts` checks the paths `propSet` accepts with `expectTypeOf`, which `tsc` checks.
`artificial-slowdown.test.ts` there checks with fake timers when a result list stops waiting after a reset.
`specs/web/watch-order.test.ts` mounts a component with a fake renderer and checks that Vue runs its watchers in
the order they are defined. No test calls a live site. `specs/web/leagues.test.ts` loads leagues from a fake trade
site and checks the league `load()` selects and `isPopular`.
