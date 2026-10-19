# The rate limiter and the league code have no tests

**Status:** open
**Area:** trade
**Origin:** [renderer/src/web/price-check/trade/RateLimiter.ts](../../../../renderer/src/web/price-check/trade/RateLimiter.ts)
**Verified:** 2026-10-19

The official trade site limits how many requests a client sends and blocks a client that exceeds
the limits ([ADR-0005](../../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)). Of the code
that keeps Kalandra under them, only `adjustRateLimits` in
`renderer/src/web/price-check/trade/common.ts` has a spec, in
`renderer/specs/web/price-check/trade/rate-limits.test.ts`. The timing in `RateLimiter.ts` and
`preventQueueCreation` have no test. Nor do `renderer/src/web/background/Leagues.ts`,
`TradeData.ts` and `renderer/src/web/price-check/price-prediction/poeprices.ts`, and no file in
`renderer/src/` has an in-source test.

Done looks like: specs for `RateLimiter` timing with fake timers, for the `Retry after` error of
`preventQueueCreation`, and for `load()` in `Leagues.ts` with a saved league list, including the
league it selects when the saved one is gone. Break the limiter and watch a spec fail. The
`poeprices.ts` part depends on [018](018-price-prediction-setting.md).

## History

- 2026-10-18: Found while the renderer price check module doc was written.
- 2026-10-19: `adjustRateLimits` got its spec with the fix that skips a rate limit rule whose
  headers it cannot read.
