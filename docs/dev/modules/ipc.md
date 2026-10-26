# ipc/: the types both processes share

**Purpose.** `ipc/` holds the TypeScript types and key tables that main and the renderer both import, so both
ends of every message are checked against one definition ([ADR-0004](../adr/ADR-0004-process-boundary.md)). It
has no `package.json` or `tsconfig.json` of its own. main imports it by relative path (`../../ipc/types`), the
renderer through the `@ipc/*` alias in `renderer/tsconfig.json` and `renderer/vite.config.mts`, and each process's
type check covers the files it imports. The routes that move the messages are in
[architecture.md](../architecture.md#the-boundary-between-the-processes), and the code on each end is in
[main.md](main.md) and `renderer/src/web/background/IPC.ts`.

## Public contract

`types.ts`:

- `IpcEvent` is the union of every message. Each member is `{ name, payload }`, built from the file's private
  `Event<TName, TPayload>` interface, with `payload: undefined` when there is none. `IpcEventPayload<Name>` is the
  payload type for a name. In main, `onEventAnyClient()` and `sendEventTo()` in `server.ts` take only these; in the
  renderer, `Host.sendEvent()`, `Host.onEvent()` and `Host.selfDispatch()` do. `selfDispatch()` delivers an event to
  the page's own listeners: every incoming message goes through it, and `WidgetMenu.vue`, `WidgetItemSearch.vue`
  and `ReloadTradeData.vue` use it to hand the price check an item without main.
- A name is `<direction>::<action>`. The four directions are in
  [architecture.md](../architecture.md#the-boundary-between-the-processes). Every message, with its payload fields,
  the code that sends it and the code that handles it:

| Event | Payload | Sent by | Handled by |
| --- | --- | --- | --- |
| `CLIENT->MAIN::save-config` | `contents` | `saveConfig()` in `Config.ts` | `ConfigStore` |
| `CLIENT->MAIN::update-host-config` | `HostConfig` | `pushHostConfig()` in `Config.ts` | `main.ts` |
| `CLIENT->MAIN::used-recently` | `isOverlay` | `OverlayWindow.vue`, on mount and on focus; `server.ts`, for the one client left after a close | `server.ts` (the last active client), `OverlayWindow` |
| `CLIENT->MAIN::user-action` | `action`: `check-for-update`, `update-and-restart` or `quit`; or `stash-search` with `text` | `about.vue`, `SettingsWindow.vue`, `WidgetStashSearch.vue`, `hotkeyable-actions.ts` | `AppUpdater`, `AppTray`, `Shortcuts` |
| `CLIENT->MAIN::write-data` | `action`: `log-item` with `text`; `session` with `start: true`, `name` and `header`, or `start: false`; `client-log-event` with `data` | `WidgetLibrary.vue` (through `library/session.ts`), `SingleItemSession.vue`, `client-log.ts` | `FileWriter` |
| `MAIN->CLIENT::item-text` | `target`, `clipboard`, `item?`, `position`, `focusOverlay` | `Shortcuts` (`copy-item`), to the last active client | `PriceCheckWindow.vue`, `WidgetItemCheck.vue`, `hotkeyable-actions.ts`, `SingleItemSession.vue` |
| `MAIN->CLIENT::widget-action` | `target` | `Shortcuts` (`trigger-event`) | `WidgetTimer.vue` |
| `MAIN->CLIENT::config-changed` | `contents` | `ConfigStore` | `initConfig()` in `Config.ts`, `OverlayWindow.vue` |
| `MAIN->CLIENT::log-entry` | `message` | `Logger.write()`; `server.ts` sends the history, the last 1000 entries, to a new client | `Host` (`Host.logs`, the last 1000 lines, cleared when the socket opens) |
| `MAIN->CLIENT::updater-state` | `UpdateInfo` | `AppUpdater`; `server.ts` sends the current state to a new client | `Host` (`Host.updateInfo`) |
| `MAIN->CLIENT::game-log` | `lines` | `GameLogWatcher` | `OverlayWindow.vue` |
| `MAIN->CLIENT::library-session` | `sessionName`, `result`: `started`, `invalid-name` or `failed` | `FileWriter`, after each `session` start | `library/session.ts` |
| `MAIN->CLIENT::unregistered-hotkeys` | `hotkeys`, each a `shortcut` and a `reason`: `unknown-key`, `game-key` or `taken` | `Shortcuts`, after each `update-host-config`, which every page sends when it loads, and when the keys another program holds change | `Host` (`Host.unregisteredHotkeys`) |
| `MAIN->OVERLAY::overlay-attached` | none | `OverlayWindow` | `LoadingAnimation.vue` |
| `MAIN->OVERLAY::focus-change` | `game`, `overlay` | `OverlayWindow` | `OverlayWindow.vue` |
| `MAIN->OVERLAY::visibility` | `isVisible` | `OverlayVisibility` | `OverlayWindow.vue` |
| `MAIN->OVERLAY::hide-exclusive-widget` | none | `WidgetAreaTracker` | `PriceCheckWindow.vue` |
| `OVERLAY->MAIN::focus-game` | none | `OverlayWindow.vue`, `PriceCheckWindow.vue` | `OverlayWindow.assertGameActive()` |
| `OVERLAY->MAIN::render-state` | `shouldShow` | `OverlayWindow.vue` | `OverlayWindow` |
| `OVERLAY->MAIN::track-area` | `holdKey`, `closeThreshold`, `from`, `area`, `dpr` | `PriceCheckWindow.vue` | `WidgetAreaTracker` |

Every `MAIN->CLIENT::` and `MAIN->OVERLAY::` message not marked otherwise is sent to every client.

- `HostConfig` holds the settings main reads. `getConfigForHost()` in `renderer/src/web/Config.ts` builds it, and
  the `CLIENT->MAIN::update-host-config` handler in `main/src/main.ts` passes each field on:

| Field | Built from | Used by |
| --- | --- | --- |
| `shortcuts` | every hotkey in the config, as the `ShortcutAction`s of `shortcutActions()` in `shortcut-actions.ts` | `Shortcuts.updateActions()` |
| `restoreClipboard`, `stashScroll`, `logKeys` | the setting of the same name | `Shortcuts.updateActions()` |
| `initialDelay` | the price check widget's `initialDelay` | `Shortcuts.updateDelay()`, the first clipboard poll |
| `overlayKey`, `windowTitle`, `hideOverlayOnBlur` | the setting of the same name | `OverlayWindow.updateOpts()`; `overlayKey` also `AppTray` |
| `clientLog`, `readClientLog` | `clientLog` (`null` for the default path), `readClientLog` | `GameLogWatcher.restart()` |
| `gameConfig` | `gameConfig` (`null` for the default path) | `GameConfig.readConfig()` |
| `libraryAlpha` | `enableAlphas` with `library` in `alphas` | `FileWriter.restart()` |
| `libraryOutputPath` | the library widget's `libraryOutputPath` | `FileWriter.restart()` |

- `ShortcutAction` is one hotkey and what it does. `shortcut` is key names joined by ` + `, with the modifiers first
  in the order `Ctrl`, `Shift`, `Alt` (`hotkeyToString()`), such as `Ctrl + Alt + D`. With `keepModKeys`, main
  releases only the key that is not a modifier after the press, so a held modifier stays down. The `action` types:

| `type` | Fields | What main does | Built from |
| --- | --- | --- | --- |
| `copy-item` | `target`, `focusOverlay?` | presses the copy keys and sends `item-text` with `target` | the price check (`price-check`), the item check widget (`item-check`, `open-wiki`, `open-craft-of-exile`, `open-poedb`, `search-similar`, `search-same-priced`), the library (`log-item`) |
| `trigger-event` | `target` | broadcasts `widget-action` with `target` | `stopwatch-start-stop:<wmId>` and `stopwatch-reset:<wmId>` per stopwatch |
| `stash-search` | `text` | types `text` into the stash search | the stash search widget's entries, when its hotkeys are on |
| `toggle-overlay` | none | moves the focus between the overlay and the game | `overlayKey` |
| `paste-in-chat` | `text`, `send` | types a chat command | each entry in `commands` with a hotkey |
| `test-only` | none | nothing: `updateActions()` adds one for the copy keys, and its reserved-key filter removes it again | |

- `UpdateInfo` is the updater's state, by `state`: `initial`, `checking-for-update`, `update-available` (with
  `version` and `noDownloadReason`: `not-supported`, `disabled-by-flag` or `null`), `update-downloaded` (with
  `version`), and `update-not-available` or `error` (with `checkedAt`).
- `HostState` is the body of `GET /config`: `contents` (the text of `config.json`, or `null`), `configProblem`,
  `version` and `updater`.
- `ClientLogEvent` is the union of the entries the renderer's client log parser (`renderer/src/web/client-log/`)
  makes from `Client.txt` lines. Each has `ts`, `ms` and `type`: `GeneralLogEvent` (`log`, `game-start`),
  `LoadZoneEvent`, `LevelUpEvent`, `GameVersionEvent`, `AltTabEvent`, `NpcEvent`, `PlayerDeathEvent`,
  `PassiveTreeEvent`, `PermanentBonusEvent`, `SkillPointEvent`, `MapNavEvent` and `AfkEvent`. Every entry but
  `log` goes to main in `write-data`. While `libraryAlpha` is on, `FileWriter` writes each one as a JSON line of
  `client-log.ndjson`, whose format the user page [client-log-parser.md](../../client-log-parser.md) documents.

`KeyToCode.ts`:

- `KeyToCode` maps a key name to its numeric key code (`Backspace` is 8, `Enter` is 13), and `CodeToKey` is the
  reverse, which `GameConfig` uses to read the key codes in the game's config file. `KeyToElectron` maps a key name
  to Electron's accelerator name. `hotkeyToString(keys, ctrl, shift, alt)` writes a hotkey string,
  `mergeTwoHotkeys(a, b)` joins two of them (main adds the advanced description key to `Ctrl + C` with it), and
  `isModKey(key)` is true for `Ctrl`, `Shift` and `Alt`. `HotkeyInput.vue` in the renderer records a hotkey with
  `KeyToCode` and `hotkeyToString()`.

`library.ts`:

- `IpcLibrarySession` is the `MAIN->CLIENT::library-session` member of `IpcEvent`, and `LibrarySessionWrite` the
  `session` action of `CLIENT->MAIN::write-data`, both kept out of `types.ts` because that file is over the line
  limit. `LibrarySessionFailure` is the `result` of `IpcLibrarySession` when no session starts.

`hotkeys.ts`:

- `IpcUnregisteredHotkeys` is the `MAIN->CLIENT::unregistered-hotkeys` member of `IpcEvent`, kept out of `types.ts`
  for the same reason. Each `UnregisteredHotkey` is a hotkey of the saved config that main did not register, with its
  `HotkeyFailure`: `unknown-key` (a key name without an accelerator), `game-key` (a key the game uses) or `taken` (a
  key another program holds, found when the game window becomes active). A hotkey that two actions share is not
  listed, since the Settings window finds those in the config it edits.

`config-problem.ts`:

- `ConfigProblem` is the `configProblem` of `HostState`, kept out of `types.ts` for the same reason. It says why
  `contents` is `null` although `config.json` exists: reason `unreadable` with the `file` path and the read error's
  `message`, or reason `not-json` with the `file` path and the `backup` path main moved the file to.

## Invariants

- Every message is a member of `IpcEvent`. The send and listen functions on both ends take only its names and
  payloads, so `tsc` fails on an unknown name or a wrong payload. A new message starts as a new union member, then
  gets its sender and its handler ([AGENTS.md](../../../AGENTS.md#architecture-rules)).
- The name states the direction. In a page outside Electron, `Host.onEvent()` does not listen for a `MAIN->OVERLAY::`
  message and `Host.sendEvent()` does not send an `OVERLAY->MAIN::` message, so a browser tab never acts on focus,
  visibility or area tracking. `server.ts` also ignores and logs an `OVERLAY->MAIN::` message from a client whose
  WebSocket upgrade request has no `Electron` in its User-Agent, so a browser tab cannot move the focus to the game
  or show the overlay window.
- Every page handles `MAIN->CLIENT::game-log` and sends the same `client-log-event` entries, so `server.ts` passes
  on those of one client only: the newest overlay window, or the last active client when no overlay window is
  connected (`clientLogWriter()` in `main/src/client-log-writer.ts`).
- Sockette in `IPC.ts` opens the socket again one second after it closes with a code other than 1000, 1001 or
  1005, and main treats the reopened socket as a new client and the last active one. The page sends nothing again:
  main keeps the `HostConfig` for its whole run, and a main that starts again opens a new page, which sends its own.
  The page clears `Host.logs` when the socket opens, so the history main sends to the new client replaces the
  page's copy rather than repeating it.
- A message crosses as JSON text, so a payload holds only values that survive `JSON.stringify()`. `item` in
  `item-text` is set only through `selfDispatch()`, which does not serialize, to pass an already parsed item.
- Neither end checks a payload. `server.ts` ignores and logs a message that is not JSON, has no string `name` or
  names an event main has no handler for, and logs a handler that throws; `IPC.ts` passes the untyped result of
  `JSON.parse()` to `selfDispatch()`. main serves the renderer files it was packaged with, so both ends come from
  one build.
- A new `HostConfig` field is set in `getConfigForHost()` and in the expected payload of
  `renderer/specs/web/host-config.test.ts`, whose types make `tsc` fail until it is, and is read in the `main.ts`
  handler. A setting main needs follows the hard rule as well ([config.md](config.md)).
- Saved configs store hotkeys as `hotkeyToString()` writes them, so renaming a key in these tables changes what a
  saved hotkey means.
- A change to a `ClientLogEvent` member changes `client-log.ndjson`, so it updates
  [client-log-parser.md](../../client-log-parser.md) in the same commit.

**Dependencies.** None: `KeyToCode.ts`, `library.ts`, `hotkeys.ts` and `config-problem.ts` import nothing, and
`types.ts` imports only `library.ts`, `hotkeys.ts` and `config-problem.ts`. main imports them in `server.ts`,
`AppUpdater.ts`, `Shortcuts.ts`, `registrable-actions.ts`, `GameConfig.ts`, `FileWriter.ts` and `ConfigStore.ts`;
the renderer in `IPC.ts`, `Config.ts`, `client-log/`, `LoadingAnimation.vue`, `HotkeyInput.vue`, `settings/hotkey-conflicts.ts` and `library/session.ts`.

**Tests.** `main/specs/key-names.test.ts` checks the functions of `KeyToCode.ts` and that its tables agree, and
`renderer/specs/web/client-log.test.ts` checks the `ClientLogEvent` values the parser makes. The type checks are `npm
run build` in `main/` and `npm run check-types` in `renderer/`, and a change under `ipc/` runs both pre-commit type
check hooks. No hook runs ESLint or Prettier on `ipc/`, locally or in CI.
