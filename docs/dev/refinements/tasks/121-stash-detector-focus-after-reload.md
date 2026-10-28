# After a page reload the stash detector waits for the next focus change

**Status:** done 2026-10-28
**Area:** renderer
**Origin:** [renderer/src/web/stash-prices/use-stash-detector.ts](../../../../renderer/src/web/stash-prices/use-stash-detector.ts)
**Verified:** 2026-10-28

`useStashDetector()` starts with the game window not active and sets it from
`MAIN->OVERLAY::focus-change`, which main sends only when the game window becomes active or inactive
(`handlePoeWindowActiveChange` in `main/src/windowing/OverlayWindow.ts`). After the page reloads
while the game is active, as in a dev run, the capture stays `paused` until the user leaves the game
and returns to it.

Done looks like: the page gets the current focus when it connects, for example from a `focus-change`
that main sends to a client that connects, with a test on each side.

## History

- 2026-10-28: Left for later by the stash detection, whose capture waits for the first focus change.
- 2026-10-28: Done in "fix: send the current focus to each page that connects": `server.ts` sends
  `OverlayWindow.focus` to each new client, and the detector reads `Host.focus`, which keeps the last focus change.
