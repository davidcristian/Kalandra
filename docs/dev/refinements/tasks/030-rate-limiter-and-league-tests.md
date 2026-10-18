# The rate limiter and the league code have no tests

**Status:** open
**Area:** trade
**Origin:** [renderer/src/web/price-check/trade/RateLimiter.ts](../../../../renderer/src/web/price-check/trade/RateLimiter.ts)
**Verified:** 2026-10-18

The official trade site limits how many requests a client sends and blocks a client that exceeds
the limits ([ADR-0005](../../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)). The code that
keeps Kalandra under them has no test: `RateLimiter.ts`, and `adjustRateLimits` and
`preventQueueCreation` in `renderer/src/web/price-check/trade/common.ts`. Nor do
`renderer/src/web/background/Leagues.ts`, `TradeData.ts` and
`renderer/src/web/price-check/price-prediction/poeprices.ts`. A search of `renderer/specs/` for
each name finds nothing, and no file in `renderer/src/` has an in-source test.

`adjustRateLimits` reads the `x-rate-limit-rules`, `x-rate-limit-<rule>` and
`x-rate-limit-<rule>-state` response headers, so it can be tested with saved headers and no request
to the site ([AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass), rule 5).

Done looks like: specs for `RateLimiter` timing with fake timers, for `adjustRateLimits` with saved
headers, for the `Retry after` error of `preventQueueCreation`, and for `load()` in `Leagues.ts`
with a saved league list, including the league it selects when the saved one is gone. Break the
limiter and watch a spec fail. The `poeprices.ts` part depends on
[018](018-price-prediction-setting.md).

## History

- 2026-10-18: Found while the renderer price check module doc was written.
