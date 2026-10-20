# An event the page sends while the events socket reopens is lost

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/background/IPC.ts](../../../../renderer/src/web/background/IPC.ts)
**Verified:** 2026-10-20

`Host.sendEvent()` in `renderer/src/web/background/IPC.ts` calls `send()` on the Sockette socket without checking
its state. After the socket closes, Sockette waits one second and opens a new one. During the wait the browser
drops a message sent to the closed socket without an error. While the new socket connects, `send()` throws an
`InvalidStateError` to the caller. `saveConfig()` in `renderer/src/web/Config.ts` records the config as saved
before it sends it, so a save in either case is lost until the config changes again.

The page also sends an event before `Host.init()` creates the socket in the case that
[002](002-unparsable-config-stops-renderer.md) describes.

Done looks like: `sendEvent()` keeps the events sent while the socket is not open and sends them in order when it
opens, or drops each one with a log line. A test with a fake WebSocket covers a send while the socket is closed and
one while it connects.

## History

- 2026-10-20: Found while the page was changed to clear its copy of main's log when the socket opens again.
