# ADR-0005: Other hosts only through the proxy list, trade searches through the rate limiters

**Status:** Accepted (2026-10-27)

## Context

The renderer is a page served by the main process ([ADR-0004](ADR-0004-process-boundary.md)), and it needs data from
other hosts: the official trade sites and the price files at `kalandra.ashoal.com`
([ADR-0006](ADR-0006-own-price-service.md)). The official trade site limits how many requests a client sends in a
time window and announces those limits in response headers. [AGENTS.md](../../../AGENTS.md) records that it bans
clients that exceed them.

## Decision

**1. The renderer reaches another host only through `/proxy`.** `Host.proxy` in
`renderer/src/web/background/IPC.ts` requests `/proxy/<host>/<path>` from the main process, and `HttpProxy` in
`main/src/proxy.ts` sends it on to `https://<host>/<path>`. Every `fetch` the renderer code sends to another host
goes this way: the league list (`Leagues.ts`), the trade stat and item data (`TradeData.ts`), trade searches,
exchanges and fetches (`pathofexile-trade.ts`, `pathofexile-bulk.ts`) and the price file (`Prices.ts`). The item
icons are the exception, described under Consequences. Reason: network access to other hosts belongs to the main
process ([ADR-0004](ADR-0004-process-boundary.md)).

**2. `HttpProxy` forwards only to the hosts in `PROXY_HOSTS`.** A request for any other host is closed with no response.
Before forwarding, it removes the `sec-*`, `host`, `origin`, `content-length`, `cookie` and `x-kalandra-proxy` request
headers and sends Electron's `app.userAgentFallback` as the User-Agent. Each entry also marks whether the host is an
official trade site: only those get the default session's cookies, which hold the sign-in of the built-in browser, and
no `set-cookie` of any host reaches the page. Reason: the list in one file is the full set of hosts the renderer code
sends requests to, apart from the item icons, so a new host appears in the diff. The auto updater is separate:
`electron-updater` in `main` checks the GitHub releases itself.

**3. Adding a host is a reviewed change to that list.** `poe.ninja` is not in it: the app reads prices from Kalandra's
own price service instead ([ADR-0006](ADR-0006-own-price-service.md)). `www.poeprices.info` was removed from it on
2026-10-26: the site predicts prices for Path of Exile 1 items, nothing shows that it supports Path of Exile 2, and the
app has no price prediction. Reason: each host on the list receives requests from every running copy of the app.

**4. Every trade search, exchange and fetch waits on its rate limiter set.** `RATE_LIMIT_RULES` in
`renderer/src/web/price-check/trade/common.ts` holds three sets, `SEARCH`, `EXCHANGE` and `FETCH`, each starting with
one `RateLimiter(1, 5)`: one request per 5 seconds. A request to `/api/trade2/search`, `/api/trade2/exchange` or
`/api/trade2/fetch` waits on its set with `RateLimiter.waitMulti`. After the response, `adjustRateLimits` replaces
the set with the rules the server sends in its `x-rate-limit-rules`, `x-rate-limit-<rule>` and
`x-rate-limit-<rule>-state` headers, and adds the price check setting `apiLatencySeconds` (default 2) to each window.
Reason: the client then stays inside the limits the server enforces, including requests the server counted that the
client did not.

**5. A search or exchange that would wait in a queue fails instead.** `preventQueueCreation` throws
`Retry after N seconds` when the wait would be 1.5 seconds or more. Reason: the user sees how long to wait, and price
checks do not wait in a queue for the limiter.

**6. The league, stat and item list requests use no rate limiter.** `load()` in
`renderer/src/web/background/Leagues.ts` requests `/api/trade2/data/leagues`, and `load()` in
`renderer/src/web/background/TradeData.ts` requests `/api/trade2/data/stats` and `/api/trade2/data/items` together.
They go out only at these times:

- The league list: when the overlay window starts, and on each click of Refresh in the price check settings or of
  Retry under "Failed to load leagues". A call while a league list load runs returns without a request.
- The stat and item lists: at start and on each change of the Language setting, from `loadTradeData()` in
  `renderer/src/assets/data/index.ts`, and on each click of "Reload fallback data", which the price check hides while
  a load runs. A timer also calls `load()` every 30 minutes (`RETRY_INTERVAL_MS`). It loads only when the last
  successful load is at least 2 hours old (`UPDATE_INTERVAL_MS`) and the parser looked up an item or a stat in the
  lists in the last hour (`INTEREST_SPAN_MS`). The timer therefore sends nothing for 2 hours after a successful load,
  and one stat and one item request every 30 minutes at most after a failed one.

Reason: after start, without a click or a setting change, the app sends at most two of these requests in 30
minutes, far fewer than the one request per 5 seconds that each limiter set allows before the server sends its
rules. A click starts one load and no second one while it runs, so the rest of the rate is the speed of the user's
own clicks.

## Consequences

- Search, exchange and fetch results are cached for 300 seconds (`CACHE_TTL` in
  `renderer/src/web/price-check/trade/Cache.ts`), so the same query repeated within that time sends no new request.
- A change that sends the league, stat or item list requests more often than decision 6 lists updates that decision
  or makes the requests wait on a limiter set.
- The built-in browser (a `<webview>`) and links the user opens in the system browser load pages directly. They do
  not go through `/proxy`.
- The item icons load directly from `web.poecdn.com`, the game's image server, outside `/proxy` and `PROXY_HOSTS`. The
  `icon` addresses in `items.ndjson` and in trade listings go into the `src` of `<img>` tags, such as the one in
  `renderer/src/web/ui/UiItemImg.vue`, so every running copy of the app requests them from that host.
- No test calls a live site. Tests use saved responses such as `renderer/specs/docs/fetchResponses.json`
  ([AGENTS.md](../../../AGENTS.md), What every change must pass).

## Alternatives rejected

- **Letting the renderer call other hosts with `fetch`.** The page would need each host to allow its origin, and
  the set of hosts the app contacts would no longer be one list in `main`.
- **A fixed client limit without the server's headers.** The server states its rules for each endpoint in its
  response headers, and `adjustRateLimits` follows what they state; a fixed limit would not.
- **A limiter set for the league, stat and item list requests.** In a set shared with searches or fetches, a price
  check would wait behind a list load, and decision 6 already limits these requests to a few known times.

## Related

- [Price check module](../modules/renderer-price-check.md): the trade queries that use these limiters.
- [Main process module](../modules/main.md): `HttpProxy` and the server it listens on.
- [ADR-0004](ADR-0004-process-boundary.md): the `/proxy` route as part of the process boundary.
- [ADR-0006](ADR-0006-own-price-service.md): the price service host on the list.
- [ADR-0012](ADR-0012-background-trade-searches.md): the one feature that sends trade searches without a key press.
