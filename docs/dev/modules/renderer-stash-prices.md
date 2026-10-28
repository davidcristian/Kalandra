# renderer/src/web/stash-prices: reading, pricing and marking a stash tab in the background

**Purpose.** The stash prices feature reads one public premium stash tab of the user's account from the official
trade site while Kalandra runs: the user drops items without a price into that tab, the reader keeps a list of them
with their place in the tab, the pricer prices each of them as the price check would, and a layer over the game marks
them while the stash shows the tab ([stash-detection.md](stash-detection.md) finds that). The reader and the pricer
are the only code that sends trade requests without a key press, under the rules of
[ADR-0012](../adr/ADR-0012-background-trade-searches.md). The trade site, the proxy and the rate limiters are in
[renderer-price-check.md](renderer-price-check.md#trade-queries-trade).

## Public contract

### The reader (`stash-reader.ts`)

- `createStashReader(sources)` returns `{ state, refresh, checkNow, stop }`. `sources` gives what the reader reads
  each time it needs it: `settings()` (`ReaderSettings`: `enabled`, `tabName`, `intervalMinutes`, `searchBudget`),
  `accountName()`, `leagueId()` and `priceCheckShown()`.
- `state` is a `shallowReactive` `ReaderState`: `status`, `error` (the message of the last failed check),
  `listings` (the `StashListing`s in the tab, newest first), `total` (the account's listings without a price, from
  the last search), `read` (how many ids that search returned, at most 100), `lastCheckAt` and `nextCheckAt` (times
  in milliseconds, or `null`).
- `status` is `off`, `no-account`, `no-league`, `price-check-open`, `busy` (a request waits in the limiters),
  `budget-reached`, `rate-limited` (a request would wait for the limiters), `checking`, `waiting` (the last check
  worked) or `error`.
- A check, when every condition below holds, sends one search with the body of `stashSearchBody(accountName)` in
  `stash-listings.ts`: the account in `trade_filters.account`, `sale_type` `unpriced` and status `any`, sorted by
  `indexed` descending, posted to `/api/trade2/search/<leagueId>` as the price check posts its searches. It drops
  each fetched id that the result no longer lists, then fetches every id the result lists, 10 per request
  (`/api/trade2/fetch/<ids>?query=<id>`), one request at a time, and keeps each listing whose `listing.stash.name`
  is `tabName`. The search gives no sign that an item moved, within the tab or into it, so each check reads every
  listing's place again, at most 10 requests, and a listing keeps its last place until its request returns. A fetch
  result without a readable id, size or stash place is logged with `console.warn` and left out of the tab.
- `refresh()` applies changed settings: off stops the reader, a changed tab name, account or league empties
  `listings`, stops a running check and checks at once with nothing fetched, and otherwise the next check is at the
  last one plus the interval.
  `checkNow()` checks at once unless a check runs. `stop()` clears the timer, ends the running check and forgets
  every listing.
- `reader-settings.ts`: `clampInterval()` (at least 5 minutes, 10 for a value that is not a number) and
  `clampBudget()` (0 to 600, 400 for a value that is not a number), with the defaults as constants.
- `stash-requests.ts`: `sendSearch()` and `sendFetch()` wait on `RATE_LIMIT_RULES.SEARCH` and `.FETCH` with
  `RateLimiter.waitMulti`, call `adjustRateLimits` with the response headers and read the body with `readTradeData()`.
  `threeHourSearchCount()` returns the stack length of the SEARCH limiter with the longest window, or `undefined` before
  the site sent a window of 3 hours. `holdForFetch()` waits before a background fetch as step 5 of [the order of a
  check](#the-order-of-a-check) says, and returns why it stopped waiting. `readSearch()` throws a `TradeResponseError`
  for a search response without a query id, string ids or a total, and `readListing()` returns `undefined` for a fetch
  result it cannot read.

### The item of a listing (`item-text.ts`, `mod-text.ts`)

- `listingItem(raw)` returns the `ParsedItem` of a fetch result, or a reason: the parser's error key, or
  `UNREADABLE` (`stash_prices.unreadable`). It never throws. `listingItemText(item)` writes the item text that the
  game copies with advanced descriptions, and `listingItem` runs `parseClipboard` on it, so the price check's
  filters read the item as they read a copied one.
- The text has the copied item's sections: the item class, rarity and name lines, the properties, the
  requirements, the sockets (`S` for each augment socket), the item level, the enchant (` (enchant)`) and rune
  (` (rune)`) lines, the implicits, the granted skills, the explicit modifiers, and the unidentified, corrupted,
  mirrored and sanctified lines. Each line start the parser reads is a client string, picked by the site's property
  type (`TradePropType`): the property names of the site, such as `Monster Pack Size`, differ from the game's.
- Each explicit modifier gets a header such as `{ Fractured Prefix Modifier "Cremating" (Tier: 2) }`, from the
  site's tier code (`P2`, `S4`) and its fractured, desecrated or crafted flag, prefixes first. Each roll gets its
  range, as in `111(102-130)`, when a range of its modifier contains it. The site writes two modifiers of one stat
  as one line: the line gets the sum of their ranges in the older format, whose `extended.hashes` name the
  modifiers of each line, and no range in the newer one, whose lines list their modifiers. A header leaves out the
  tier or the name when the language's `MODIFIER_LINE` would not read them back. An unrevealed modifier is its slot's
  header with `Desecrated Prefix` or `Desecrated Suffix`.
- A fetch result without a type line or a rarity, or with lines the converter does not write (`logbookMods`,
  `mutatedMods`), is `UNREADABLE`. The tags of a modifier header are left out, since the site does not send them.

### The pricer (`stash-pricer.ts`, `price-item.ts`, `pricer-state.ts`)

- `createStashPricer(sources)` returns `{ state, sync, stop }`. `sources` gives the reader's `settings()`,
  `listings()`, `leagueId()`, `accountName()`, `priceCheckShown()` and `readerChecking()`. `sync()` follows the
  listings: it queues each new one, forgets each one that left, and starts a run. A listing keeps its price while
  it stays in the tab. `stop()` ends the running search and forgets every price.
- `state` (`PricerState`) holds `status`, `error`, `prices` (a `ListingPrice` by listing id, a new map on each
  change), `counts` (`listings`, `done`, `priced`, `tooFew`, `cannotRead`, `failed`), `pricing` (the listing a
  search prices) and `nextSearchAt`. A `ListingPrice` is `queued`, `pricing`, `priced` (`value`, `low` and `high` in
  Divine Orbs for the whole stack, `reliability` or null, `source` `price-file` or `listings`), `too-few`,
  `cannot-read` (`reason`, an `app_i18n.json` key) or `failed` (`message`).
- `priceWithoutSearch()` in `price-item.ts` prices an item that needs no search: the price check's estimate from
  the price file (`getDetailsId` and `findPriceByQuery`, times the stack size), or `cannot-read` with
  `stash_prices.no_estimate` for an item the price check would search in bulk. `searchPrice()` builds the price
  check's default filters with `createPresets`, `presetOptions()` and the list of valuable stats on, sends
  `createTradeRequest` through `requestTradeResultList`, fetches the 20 cheapest ids with `requestResults` (two
  fetches), and returns `suggestPrice()` of them, or `too-few`.
- `status` is `off`, `no-league`, `no-prices` (the price file is not loaded), `reading` (the reader checks),
  `price-check-open`, `busy`, `budget-reached`, `rate-limited`, `pricing`, `waiting` (for the next search), `done`
  or `error`. `useStashPricer()` in `use-stash-pricer.ts` is the app's one pricer: it reads the widget's config and
  the reader's state, and calls `sync()` whenever the reader's listings change. `OverlayWindow.vue` creates it
  through `useStashHighlights()`.

### The order of a pricing run

1. Off: `stop()`. No queued or failed listing: `done`. After a trade error, nothing until the interval ends. No
   league: `no-league`, and no price file: `no-prices`; both retry after 30 seconds and call `queuePricesFetch()`.
2. Each queued listing is read with `listingItem()` once. An unreadable one is `cannot-read`, and one the price file
   prices or that only a bulk exchange finds is settled with `priceWithoutSearch()`, all without a request.
3. The next listing to search is the newest queued one, then the first failed one. A search starts at least 15
   seconds (`PACE_MS`) after the last one started, and never while another runs.
4. `searchPause()` in `pricer-state.ts` holds the search 30 seconds while the price check is shown, the reader
   checks (`reading`), or a request waits in the SEARCH or FETCH limiters (`busy`), or while a search or a fetch
   would wait in them (`rate-limited`). It holds it for the interval while the 3 hour count is at or above the
   budget less `readerReserve()`: 180 minutes divided by the interval, the searches the reader needs in 3 hours.
5. `holdForFetch()` holds each fetch as the reader's, up to 45 seconds; past that the listing is queued again and
   the next run finds its search in the price check's cache. A trade error, a 429 included, makes the listing
   `failed`, logs each new message once to main's log, and stops pricing for the interval.

### The widget and its panel

- `StashPricesWidget` ([widget.ts](../../../renderer/src/web/stash-prices/widget.ts)) adds `anchor`, `enabled` (false),
  `tabName` (`kalandra-price-check`), `intervalMinutes` (10) and `searchBudget` (400) to `Widget`, and the settings of
  [stash detection](stash-detection.md): `captureEnabled`, `toggleKey` and `gridCorrection`, and of the marks:
  `highlightValuable` and `highlightTrash` (true), `trashThreshold` (1 `chaos`) and `alignmentView` (false), which the
  `< 47` step adds. `stashPricesDefault()` is the widget's `initInstance()`: title `{icon=fa-tags}`, flags
  `invisible-on-blur` and `menu::skip`, at the top left under the main button bar. The `< 45` step adds it to a saved
  config ([config.md](config.md)).
- `useStashReader()` in `use-stash-reader.ts` returns the app's one reader, a `createGlobalState`. Its sources are
  the widget's config through `requireWidget`, `AppConfig().accountName`, `useLeagues().selectedId`, which has a
  league only after the league list loaded, and `priceCheckConfig().wmWants === "show"`. Code that needs the
  listings of the tab reads `useStashReader().state`.
- `WidgetStashPrices.vue` (wmType `stash-prices`, single) is mounted at start like every widget
  ([renderer-widgets.md](renderer-widgets.md)), so the reader runs while the panel is hidden: a watcher calls
  `refresh()` at once and whenever `enabled`, `tabName`, `intervalMinutes`, `searchBudget`, the account name or the
  league changes. The panel, in the `Widget.vue` frame, shows the tab name, the number of listings in the tab, the
  times of the last and the next check, the 3 hour search count of the budget (`?` before the site sent that
  window), "Only the newest N of your M listings without a price are read." when the search returned fewer ids
  than `total`, the text of the status (`stash_prices.status_*` in `app_i18n.json`), the line on whether the stash
  shows the tab ([stash-detection.md](stash-detection.md)), the pricing block, and **Check now**, which calls
  `checkNow()`.
- `PricingPanel.vue`, the pricing block, shows only while the tab has listings: `progressText()` in `pricing-text.ts`
  ("Priced N of M." with the seconds to the next search when `nextSearchAt` is set), the counts of too few listings,
  unreadable and failed, the text of a pricer status that waits or fails (`pricingStatusText()`), and the 8 most
  valuable priced listings: the name, the price as `suggestedPriceText()` writes the suggested price line, and its
  reliability with the colors of `RELIABILITY_TEXT` in `suggested-price.ts`, or "estimate" for the price file.

### The marks over the stash (`highlight-marks.ts`)

- `markKind(price, threshold, toggles)` returns the mark of one listing: `valuable` for a priced listing whose stack
  value is at or above the threshold, `trash` for one below it, each only while its toggle is on; `unpriced` for
  `too-few`, `cannot-read` and `failed`; `pricing` while a search prices it; and none for a queued listing or one the
  pricer has not seen. With no threshold, no listing is trash.
- `thresholdInDivine(threshold, unitPrice)` converts the trash threshold (`amount` and `currency`: `chaos`,
  `exalted` or `div`) to Divine Orbs with the price file's price of a Chaos Orb or an Exalted Orb, and returns null
  when the file has no positive price for it. `clampThresholdAmount()` keeps an amount at 0 or more, 1 for a value
  that is not a number.
- `highlightView(input)` returns what to draw: while the tab is open, each mark on its item's cells (`itemRect()`,
  `grid.left + x * grid.cell` and so on) and the progress bar, as wide as the grid, under it; and the grid's cells
  for the grid alignment view, whether the tab is open or not.

### The layer over the stash (`use-stash-highlights.ts`, `StashHighlights.vue`)

- `useStashHighlights()` is the app's one set of highlights, a `createGlobalState`: `threshold` (the widget's
  `trashThreshold` through `thresholdInDivine()` with `findPriceByQuery({ ns: "ITEM", name })`, computed again after
  each load of the price file and each change of league, since it reads `loadedAt` and `xchgRate`), `view`
  (`highlightView()` of the detector's `open`, `quad` and `grid`, the reader's listings, the pricer's prices and counts,
  and the widget's toggles), and `shown`: the widget is `enabled` and the tab is open or `alignmentView` is on.
- `OverlayWindow.vue` renders `StashHighlights.vue` before the widgets while `shown` holds and the UI is not hidden
  (`Alt` held), and counts it in `isOverlayVisible`. The panel is `invisible-on-blur`, and with `hideOverlayOnBlur` on
  main hides the whole window while the game is active unless the page sends `OVERLAY->MAIN::render-state` with
  `shouldShow` true, so the marks need that. A second widget without `invisible-on-blur` was not used: showing it would
  change `wmWants` on each open and close of the tab, which the next `saveConfig()` writes to `config.json`, and a saved
  `show` would draw the marks at the next start. Calling `useStashHighlights()` there creates the reader, pricer and
  detector before the widget mounts.
- `StashHighlights.vue` covers the overlay with `pointer-events: none`, so it never takes a click. It draws the
  alignment view as one box with a line every `cell`, and each mark on its cells: `valuable` with a yellow border
  and its price as `suggestedPriceText()` writes it, `trash` with a red fill and the `fa-trash` icon, `unpriced`
  with a dashed gray border and `pricing` with a light blue one. The progress bar under the grid is filled by the
  share of the listings done and reads `progressText()` and `pricingStatusText()`, as the pricing block does, and
  grows down when that text wraps. Its text is 0.28 of a normal tab's cell, at least 10 pixels.

### The settings page

`StashPricesOption.vue` is the switch under **Show a suggested price** on the Price check page, since the pricer
prices with the suggested price. Its **Price a stash tab in the background** checkbox calls `setStashPricesEnabled()`
in `widget.ts`, which sets `enabled` and removes `menu::skip` with `enableWidget()`, or adds it and hides the widget
with `disableWidget()`. While the suggested price is off, the checkbox is disabled and its setter keeps `enabled`
false. The page's suggested price checkbox uses `suggestedPriceModel()` from `widget.ts`, which turns stash prices off
when it turns off. Stash prices needs no runtime check of the suggested price, because only these two checkboxes change
either setting.

`settings-stash-prices.vue` is the `stash-prices` page of Settings (`SettingsPage` and `menuPages()` in
`settings/menu.ts`), after Price check in the whole window's menu and alone for the widget's edit button. Its first
line says whether stash prices is on and where the switch is. **Stash tab name** is trimmed, **Check the tab every**
goes through `clampInterval()` and **Search budget for 3 hours** through `clampBudget()` when the field loses focus.
The page lists the steps that set up the tab and warns when the account name on the Price check page is empty.
Settings edits a copy of the config, so the reader sees a change on Save.
Under the reading settings are `DetectionSettings.vue` ([stash-detection.md](stash-detection.md)) and
`HighlightSettings.vue`: **Highlight**, two adjacent buttons with `aria-pressed` that flip `highlightValuable` and
`highlightTrash`, yellow or red while on and gray while off, and **Trash threshold**, an amount through
`clampThresholdAmount()` and a select of Chaos, Exalted and Divine Orb, named from the game data (`ITEM_BY_REF`).

### The order of a check

1. Not `enabled`: `stop()`. No account name: `no-account`. No league in `leagueId()`: `no-league`.
2. The price check shown: `price-check-open`. A request in a SEARCH limiter's queue: `busy`. These four retry after 30
   seconds (`RETRY_MS`).
3. `threeHourSearchCount()` at or above `clampBudget(searchBudget)`, an unknown count being 0: `budget-reached`, and
   the next check after the interval. A budget of 0 sends no search at all.
4. `RateLimiter.estimateTime(1, SEARCH)` above 0, as during a restriction after a 429: `rate-limited`, retry after
   30 seconds. The reader never waits in a limiter's queue.
5. The search, then the fetches. Before each fetch, the price check shown or a FETCH queue holds the check for 30
   seconds, and a full FETCH limiter for its wait. A hold that would end after the interval ends the check with
   its reason and a retry after 30 seconds, and the next check searches again.
6. A trade error, a 429 included, or a request that fails ends the check with `error`, keeps the listings read so
   far and checks again after the interval. Each new error message goes once to main's log with `logToMain()`.

## Invariants

- **Only the reader and the pricer send trade requests without a key press**
  ([ADR-0012](../adr/ADR-0012-background-trade-searches.md)). They use the same limiter sets as the price check and
  no limiter of their own, since the site counts per IP.
- **A check reads at most the newest 100 listings.** The search is not split when `total` is above 100
  ([refinement 115](../refinements/tasks/115-stash-prices-reads-the-newest-100.md)).
- **Trade responses are untrusted.** A malformed search response is an `error`, and a malformed fetch result is
  skipped.

**Dependencies.** `Host.proxy`, `RATE_LIMIT_RULES`, `adjustRateLimits`, `getTradeEndpoint`, `RateLimiter`,
`readTradeData`, `createPresets`, `presetOptions`, `createTradeRequest`, `requestTradeResultList`, `requestResults`,
`suggestPrice` and `usePoeninja` from the price check ([renderer-price-check.md](renderer-price-check.md)),
`parseClipboard` from the parser, `logToMain()`, Vue.

**Tests.** `npx vitest run specs/web/stash-prices` in `renderer/`. `stash-reader.test.ts` drives the reader with fake
timers and `FakeTradeSite` in `fake-trade-site.ts`, which serves searches and fetches from the 21 saved listings of
`specs/docs/fetchResponses.json` with the rate limit headers the site sent on 2026-10-28. It checks the search body, the
fetches of every id at each check, the tab filter, a gone and a returning listing, an item moved into the tab and one
moved within it, an unreadable fetch result, the newest 100 of 150 listings, the interval and its minimum, the budget,
the pauses for the price check and the limiter queue, a restriction during the fetches, the trade errors and their log
lines, and the settings changes.
`stash-prices-widget.test.ts` runs `useStashReader()` on the test config with the fake site, and renders the panel in
English for each status. It also checks that `useStashPricer()` follows the reader's listings and stops with it, and
renders the pricing block: the progress, the next search, the most valuable first, and the text of each pricer status.
`stash-prices-option.test.ts` renders the switch and checks its flags and that it stays off while the suggested price
is off, and that `suggestedPriceModel()` turns stash prices off. `stash-prices-settings.test.ts` renders the settings
page and checks its on and off line, the limits of the number fields, the account name warning, the two highlight
buttons, the threshold's currencies and the alignment view.
`stash-listings.test.ts` checks `readSearch()`, `readListing()`, `threeHourSearchCount()` and the setting limits. `item-text.test.ts` writes and parses the 23 saved listings of `specs/docs/fetchResponses.json` and
`fetchResponses2.json`: the exact text of a magic helmet and of a crossbow with every modifier kind, the tiers, ranges
and summed lines, an unrevealed modifier, a unique, a waystone, a rune from a socket as a currency stack, a barya, a
relic, an unidentified copy and the unreadable cases. `stash-highlights.test.ts` runs `useStashHighlights()` on the test
config: when it shows, the threshold from the price file fixture, then from a copy with the same rate and another Chaos
Orb price, without its Chaos Orb and in Divine Orbs, and renders the layer, with the bar's countdown, and
`OverlayWindow.vue` (with no widgets), whose `render-state` follows the tab.
`highlight-marks.test.ts` checks each mark, the toggles, the threshold in each currency and without a price, and the
view of a normal and a quad tab, open and closed. `stash-pricer.test.ts` drives the pricer with fake timers,
`FakeTradeSite` (whose `offers` are the results of the item searches) and the price file fixture with a unique and a
rune added: the price file estimates, the search body with the valuable stats, the 20 cheapest, the order and the 15
seconds between searches, too few listings, the unreadable and bulk items, each pause, the budget less the reader's
searches, a trade error, a held fetch, the listings that leave and come, and turning it off. No test calls the live
site.
