# A config.json that is not valid JSON stops the renderer from starting

**Status:** open
**Area:** config
**Origin:** [renderer/src/web/Config.ts](../../../../renderer/src/web/Config.ts)
**Verified:** 2026-10-22

When `JSON.parse` fails on the contents of `config.json`, the `catch` block in `initConfig()` applies
`defaultConfig()` and calls `saveConfig({ isTemporary: true })`. That save is meant to make main
write the defaults to `config.json.tmp` and leave the broken file for the user to inspect
(`ConfigStore.save()` in `main/src/host-files/ConfigStore.ts`).

The save runs before the WebSocket to main exists. `renderer/src/main.ts` awaits `initConfig()`
before `Host.init()`, and `HostTransport` in `renderer/src/web/background/IPC.ts` assigns
`this.socket` only in `init()`. `sendEvent()` calls `this.socket.send()` with no check, so it
throws a `TypeError` and `initConfig()` rejects. The Vue app never mounts. A browser tab shows
`Kalandra cannot start` with the `TypeError` (`startApp()` in `renderer/src/web/startup.ts`), and the
overlay stays empty, because main attaches it to the game only after `CLIENT->MAIN::update-host-config`.

Done looks like: the temporary save is sent after the socket opens, and a test that starts from
contents that do not parse checks that the app mounts with the defaults and that one
`CLIENT->MAIN::save-config` event with `isTemporary: true` is sent.

## History

- 2026-10-18: Found while the config module doc was written, by reading the start order in
  `renderer/src/main.ts` and `IPC.ts`. Not reproduced in a running app.
- 2026-10-20: A failed start now shows its error in place of the app, so the text no longer says the
  page shows no message. The save still fails.
- 2026-10-22: The commented-out `dialog.showErrorBox` after the `return` of the `catch` block was
  deleted. Its message described the case in [004](004-older-version-uses-newer-config.md).
