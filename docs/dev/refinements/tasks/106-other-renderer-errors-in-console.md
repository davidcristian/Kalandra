# Renderer errors other than a failed price file load reach only the browser console

**Status:** done 2026-10-27
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
- 2026-10-27: Done as "feat(renderer): send trade site and Client.txt errors to main's log". The
  first failed `Client.txt` line of a run is sent without the line, which can hold chat text, and
  each unreadable rate limit rule or `Retry-After` once a run.
- 2026-10-27: `Kalandra cannot start` stays in the console and on the page. In a packaged build
  every error `startApp()` catches comes before `Host.init()`, since Vue logs a component error at
  mount instead of throwing, so the event would wait in the queue forever. Opening the socket from
  the failed page would make it main's last active client, which gets the price check's item.
