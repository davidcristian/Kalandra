# The league, stat and item list requests use no rate limiter

**Status:** open
**Area:** trade
**Origin:** [AGENTS.md](../../../../AGENTS.md#architecture-rules)
**Verified:** 2026-10-27

The proxy rule in Architecture rules of AGENTS.md says every search, fetch and exchange request goes through the
`RateLimiter` sets in `renderer/src/web/price-check/trade/common.ts`. Those are the requests in
`pathofexile-trade.ts` and `pathofexile-bulk.ts` that call `RateLimiter.waitMulti`. Three other requests to the
official trade site go through `Host.proxy` with no limiter:

- the league list, `/api/trade2/data/leagues`, in `load()` of `renderer/src/web/background/Leagues.ts`;
- the stat list, `/api/trade2/data/stats`, and the item list, `/api/trade2/data/items`, in `loadStatData()` and
  `loadItemData()` of `renderer/src/web/background/TradeData.ts`.

The trade site rate limits and bans clients that exceed its limits
([ADR-0005](../../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)), so a repeated league or data request counts
against the same account without the app waiting for it.

Done looks like: a decision for the maintainer. Either the three requests wait on a limiter set, with a test
([030](030-rate-limiter-and-league-tests.md)), or the reason they need none is written in ADR-0005.

## History

- 2026-10-18: Found while ADR-0005 and the renderer price check module doc were written, by listing every
  `Host.proxy` call to the trade site. The same day, the AGENTS.md rule was narrowed to the search, fetch and
  exchange requests, which leaves this code question.
- 2026-10-27: The maintainer chose no limiter, with the reason in ADR-0005. The item and stat lists
  load when the app starts or changes language, then at most every 2 hours and only after a price
  check in the last hour. The league list loads when the overlay starts and on each Retry. Left:
  that reason, and `load()` in `Leagues.ts` returns while a load runs, with a test.
