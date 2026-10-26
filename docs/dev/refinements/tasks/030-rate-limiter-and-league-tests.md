# The price prediction code has no tests

**Status:** done 2026-10-26
**Area:** trade
**Origin:** [renderer/src/web/price-check/trade/RateLimiter.ts](../../../../renderer/src/web/price-check/trade/RateLimiter.ts)
**Verified:** 2026-10-26

`renderer/src/web/price-check/price-prediction/poeprices.ts` has no test. No file in
`renderer/src/` has an in-source test. The rate limiter that keeps Kalandra under the trade site's
limits ([ADR-0005](../../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)) has its specs in
`renderer/specs/web/price-check/trade/RateLimiter.test.ts` and `rate-limits.test.ts`.

Done looks like: a spec for `poeprices.ts`, which depends on [018](018-price-prediction-setting.md).

## History

- 2026-10-18: Found while the renderer price check module doc was written.
- 2026-10-19: `adjustRateLimits` got its spec with the fix that skips a rate limit rule whose
  headers it cannot read.
- 2026-10-19: `RateLimiter.ts` and `preventQueueCreation` got their specs with the fix that holds
  requests for the restriction time the trade site reports, so the title no longer names the rate
  limiter.
- 2026-10-19: `TradeData.ts` got its spec, `renderer/specs/web/trade-data.test.ts`, with the fix
  that stops a replaced load from ending the loading state, so the title no longer names the trade
  data.
- 2026-10-20: A test of a league list load that gets a web page came with the fix that names the
  status of a trade site response that is not data.
- 2026-10-26: `Leagues.ts` got its spec, `renderer/specs/web/leagues.test.ts`, with the change that
  removes its check for Path of Exile 1 Ruthless leagues, so the title no longer names the leagues.
- 2026-10-26: Done. The maintainer chose to remove the price prediction
  ([018](018-price-prediction-setting.md)), and `poeprices.ts` went with it, so no code this task
  names is left without a spec.
