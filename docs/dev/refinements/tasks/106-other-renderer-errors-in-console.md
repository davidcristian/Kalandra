# Renderer errors other than a failed price file load reach only the browser console

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/background/log-to-main.ts](../../../../renderer/src/web/background/log-to-main.ts)
**Verified:** 2026-10-27

`logToMain()` in `renderer/src/web/background/log-to-main.ts` sends a line to main's log, which
Settings, Debug shows, through the `CLIENT->MAIN::log-entry` event
([ipc.md](../../modules/ipc.md#public-contract)). Only `load()` in
`renderer/src/web/background/Prices.ts` calls it. The other errors the renderer logs still reach
only the browser console, for example:

- `Cannot load the trade leagues:` in `renderer/src/web/background/Leagues.ts`, and the failed
  item and stat list load in `renderer/src/web/background/TradeData.ts`.
- `Skipped a Client.txt line that failed:` in `renderer/src/web/client-log/client-log.ts`.
- The rate limit warnings in `renderer/src/web/price-check/trade/common.ts`.
- `Kalandra cannot start:` in `renderer/src/web/startup.ts`. A start step that fails before
  `Host.init()` in `renderer/src/main.ts` leaves the socket to main unopened, so an event sent then
  stays in the queue of `Host.sendEvent()` and never reaches main.

Done looks like: each error a user needs to report a problem is sent with `logToMain()` with text
that holds no cookie, token or session ID, with a test that reads the event, and the runbook
[in-game-check.md](../../runbooks/in-game-check.md#where-the-logs-are) names each new line.

## History

- 2026-10-27: Filed when the price file error was sent to main's log
  ([013](013-renderer-errors-not-in-debug.md)), which kept the other renderer errors out of scope.
