# renderer/src/web/stash-prices: reading a stash tab in the background

**Purpose.** The stash prices feature reads one public premium stash tab of the user's account from the official
trade site while Kalandra runs: the user drops items without a price into that tab, and the reader keeps a list of
them with their place in the tab. It is the only code that sends trade requests without a key press, under the rules
of [ADR-0012](../adr/ADR-0012-background-trade-searches.md). The trade site, the proxy and the rate limiters are in
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
  each fetched id that the result no longer lists, and each id that `reindexedIds()` returns: one the result lists
  before an id it followed in the last result, which the site indexed again, as after a move between tabs. It then
  fetches the ids it has not fetched, 10 per request (`/api/trade2/fetch/<ids>?query=<id>`), one request at a time,
  and keeps each listing whose `listing.stash.name` is `tabName`. A fetch result without a readable id, size or
  stash place is logged with `console.warn` and not fetched again while the search lists it.
- `refresh()` applies changed settings: off stops the reader, a changed tab name, account or league stops a running
  check and checks at once with nothing fetched, and otherwise the next check is at the last one plus the interval.
  `checkNow()` checks at once unless a check runs. `stop()` clears the timer, ends the running check and forgets
  every listing.
- `reader-settings.ts`: `clampInterval()` (at least 5 minutes, 10 for a value that is not a number) and
  `clampBudget()` (0 to 600, 400 for a value that is not a number), with the defaults as constants.
- `stash-requests.ts`: `sendSearch()` and `sendFetch()` wait on `RATE_LIMIT_RULES.SEARCH` and `.FETCH` with
  `RateLimiter.waitMulti`, call `adjustRateLimits` with the response headers and read the body with
  `readTradeData()`. `threeHourSearchCount()` returns the stack length of the SEARCH limiter with the longest
  window, or `undefined` before the site sent a window of 3 hours. `readSearch()` throws a `TradeResponseError` for
  a search response without a query id, string ids or a total, and `readListing()` returns `undefined` for a fetch
  result it cannot read.

### The widget and its panel

- `StashPricesWidget` ([widget.ts](../../../renderer/src/web/stash-prices/widget.ts)) adds `anchor`, `enabled`
  (false), `tabName` (`kalandra-price-check`), `intervalMinutes` (10) and `searchBudget` (400) to `Widget`.
  `stashPricesDefault()` is the widget's `initInstance()`: title `{icon=fa-tags}`, flags `invisible-on-blur` and
  `menu::skip`, at the top left under the main button bar. The `< 45` step adds it to a saved config
  ([config.md](config.md)).
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
  than `total`, the text of the status (`stash_prices.status_*` in `app_i18n.json`), and **Check now**, which calls
  `checkNow()`.

### The settings page

`settings-stash-prices.vue` is the `stash-prices` page of Settings (`SettingsPage` and `menuPages()` in
`settings/menu.ts`), after Price check in the whole window's menu and alone for the widget's edit button. Its
**Read the tab in the background** checkbox calls `setStashPricesEnabled()` in `widget.ts`, which sets `enabled` and
removes `menu::skip` with `enableWidget()`, or adds it and hides the widget with `disableWidget()`. **Stash tab
name** is trimmed, **Check the tab every** goes through `clampInterval()` and **Search budget for 3 hours** through
`clampBudget()` when the field loses focus. The page lists the steps that set up the tab and warns when the account
name on the Price check page is empty. Settings edits a copy of the config, so the reader sees a change on Save.

### The order of a check

1. Not `enabled`: `stop()`. No account name: `no-account`. No league in `leagueId()`: `no-league`.
2. The price check shown: `price-check-open`. A request in a SEARCH limiter's queue: `busy`. Both retry after 30
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

- **Only this reader sends trade requests without a key press** ([ADR-0012](../adr/ADR-0012-background-trade-searches.md)).
  It uses the same limiter sets as the price check and no limiter of its own, since the site counts per IP.
- **A check reads at most the newest 100 listings.** The search is not split when `total` is above 100
  ([refinement 115](../refinements/tasks/115-stash-prices-reads-the-newest-100.md)).
- **Trade responses are untrusted.** A malformed search response is an `error`, and a malformed fetch result is
  skipped.

**Dependencies.** `Host.proxy`, `RATE_LIMIT_RULES`, `adjustRateLimits`, `getTradeEndpoint`, `RateLimiter` and
`readTradeData` from the price check ([renderer-price-check.md](renderer-price-check.md)), `logToMain()`, Vue.

**Tests.** `npx vitest run specs/web/stash-prices` in `renderer/`. `stash-reader.test.ts` drives the reader with
fake timers and `FakeTradeSite` in `fake-trade-site.ts`, which answers searches and fetches from the 21 saved
listings of `specs/docs/fetchResponses.json` with the rate limit headers the site sent on 2026-10-28. It checks the
search body, the fetches of new ids only, the tab filter, a gone and a returning listing, a listing moved into the
tab, an unreadable fetch result, the newest 100 of 150 listings, the interval and its minimum, the budget, the
pauses for the price check and the limiter queue, a restriction during the fetches, the trade errors and their log
lines, and the settings changes. `stash-prices-widget.test.ts` runs `useStashReader()` on the test config with the
fake site, and renders the panel in English for each status. `stash-prices-settings.test.ts` renders the settings
page and checks the checkbox's flags, the limits of the two number fields and the account name warning. `stash-listings.test.ts` checks `readSearch()`, `readListing()`,
`reindexedIds()`, `threeHourSearchCount()` and the setting limits. No test calls the live site.
