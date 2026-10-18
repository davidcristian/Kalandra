# Renderer errors such as a missing price file do not reach Settings, Debug

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/background/Prices.ts](../../../../renderer/src/web/background/Prices.ts)
**Verified:** 2026-10-18

Settings, Debug shows main's log: the history that `Logger` in `main/src/RemoteLogger.ts` keeps and
sends in `MAIN->CLIENT::log-entry` events. No `IpcEvent` in `ipc/types.ts` sends a log line the
other way, so errors in the renderer reach only the browser console.

One example: when the price file for the selected league is missing, `load()` in
`renderer/src/web/background/Prices.ts` throws `No price file for <league> (<status>)`, and its own
`catch` passes the error to `console.warn`. The price check then shows no estimate, and finding out
why needs the developer tools
([runbooks/in-game-check.md](../../runbooks/in-game-check.md#where-the-logs-are)).

Done looks like: a new member of the `IpcEvent` union that sends a renderer log line to main, its
sender and its handler, as [AGENTS.md](../../../../AGENTS.md#architecture-rules) describes for a new
message, and the price file error sent through it, so that the line shows in Settings, Debug. The
runbook then names that line.

## History

- 2026-10-18: Found while the in-game check runbook was written, by tracing where the price file
  error goes.
