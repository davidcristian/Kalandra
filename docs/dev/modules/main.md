# main/: the Electron main process

**Purpose.** `main/` is the Electron main process, the only part of Kalandra with operating system access
([ADR-0004](../adr/ADR-0004-process-boundary.md)). It registers the hotkeys, presses keys in the game, reads the
clipboard, places the overlay window over the game window, reads and writes the files under `apt-data`, follows
the game's log, serves the renderer page over HTTP and forwards the page's requests to the outside hosts. The map
of the whole app is [architecture.md](../architecture.md), the messages main exchanges with the renderer are in
[ipc.md](ipc.md), and the config it stores is in [config.md](config.md).

## Public contract

The entry, the server and the app services, in `main/src/`:

- `main.ts`, bundled into `dist/main.js`, takes Electron's single instance lock, turns off hardware acceleration except
  on macOS and turns on Electron's sandbox. It passes the startup to `startWhenReady()` in `startup.ts`, which on macOS
  waits up to 15 seconds for the accessibility permission and quits without it. It then awaits `app.whenReady()`, which
  also resolves when Electron emitted `ready` during that wait, and runs the start function, which creates `Logger`,
  `AppTray`, `GameConfig`, `GameWindow`, `AppUpdater`, `HttpProxy`, `FileWriter` and `GameLogWatcher`, and adds the
  `/uploads/` routes. It creates `OverlayWindow`, `OverlayVisibility` and `Shortcuts` after a timer: 1 second on Linux,
  because the window is black instead of transparent otherwise, and 0 elsewhere. Its `CLIENT->MAIN::update-host-config`
  handler passes each `HostConfig` field to the object that uses it, and logs a failed `GameLogWatcher` restart as
  `error [GameLogWatcher] Cannot restart`. It then starts `uIOhook`, calls `startServer()` and
  loads the page. When `startServer()` rejects, it shows the error box `Kalandra cannot start` and quits, and any other
  failure there logs `error [main] Cannot start the overlay:` with the stack. In development it also installs Vue
  Devtools. `uncaught-errors.ts` logs every uncaught error and unhandled rejection, of any type.
- `server.ts` exports `server` (the `http.Server`), `httpRoutes`, `startServer(appUpdater, logger)`, which adds the
  `/config` route and the `/events` connection handler, listens and returns the address, and `eventPipe`, the
  `ServerEvents` pair of `onEventAnyClient(name, cb)` and `sendEventTo(target, event)`. A class that sends or handles
  messages takes `ServerEvents` in its constructor rather than importing `server.ts`. Every HTTP route listens on
  `httpRoutes`, never on `server`: `server` passes a request on only when `isAllowedRequest()` accepts it, and returns
  403 otherwise. Each response it passes on has the page's `Content-Security-Policy` header from
  `renderer/content-security-policy.ts`. `addFileUploadRoutes()` and `HttpProxy` take `httpRoutes`. The static route
  answers every path the other routes do not, so no request is left without a response. The target `"broadcast"` sends
  to every client, and `"last-active"` to the last active client: the one that connected or sent
  `CLIENT->MAIN::used-recently` last, or the one client left after a close, for which main emits `used-recently` with
  `isOverlay` true for the overlay window, by its User-Agent, and false for a browser. A new client receives the log
  history and the current updater state, which the first update check can change after the page reads `GET /config`. An
  `OVERLAY->MAIN::` message is ignored and logged unless the client's WebSocket upgrade request has `Electron` in its
  User-Agent, as the overlay window's does. A message that is not JSON, has no string `name` or names an event without a
  handler is ignored with a `warn [server]` line, and a handler that throws is logged. It passes on a `client-log-event`
  only from the client `clientLogWriter()` returns, because every page parses the game log and sends the same entries.
  The routes and the policy are in [architecture.md](../architecture.md#the-boundary-between-the-processes).
- `client-log-writer.ts`: `clientLogWriter(clients, isOverlay, lastActive)` returns the newest overlay window, or
  `lastActive` when no overlay window is connected.
- `request-origin.ts`: `isAllowedRequest(headers, isWebSocket)` accepts a `Host` that is `localhost` or an IP
  address, and an `Origin` that matches it with the `http:` scheme; a WebSocket must send `Origin`, plain HTTP may
  leave it out ([ADR-0009](../adr/ADR-0009-local-server-accepts-only-its-own-page.md)).
- `served-file.ts`: `sendFile(res, folder, urlPath)` streams a file for the static route and `GET /uploads/`, and
  returns 404 for a missing file or a path outside the folder, such as one with `..` segments, which Node passes on
  in `req.url` as sent. `resolveInside()` checks the path with the platform's `path` module, or one a test passes.
- `listen-option.ts`: `readListenOption(argv, defaults)` reads `--listen=[host][:port]`, with an IPv6 host in brackets,
  and never throws. For `--listen` without `=`, an unreadable value or a port over 65535 it returns the defaults and an
  `error` text, which `startServer()` writes to the log. `listenWithFallback(server, address, fallback, onFallback)`
  listens on `address`, and after an error such as `EADDRINUSE` or `EADDRNOTAVAIL` passes the error to `onFallback` and
  listens on `fallback`. It resolves the address it listens on, and rejects when `address` is `fallback`.
  `startServer()` passes the defaults as `fallback` and logs the error. `pageUrl(address)` returns the page's address
  for a browser: `localhost` for `127.0.0.1`, `0.0.0.0` and `::`, else the address, an IPv6 one in brackets.
- `proxy.ts`: `HttpProxy` forwards `/proxy/<host>/<path>` for the hosts in `PROXY_HOSTS`: the nine official trade sites
  (`official: true`) and `kalandra.ashoal.com`. `isTradeSiteUrl(url)` returns whether a URL is an
  `https:` address on an official trade site. It returns 403 for a request without the `x-kalandra-proxy` header, which
  `Host.proxy()` sends and a page on another site cannot
  ([ADR-0009](../adr/ADR-0009-local-server-accepts-only-its-own-page.md)). It drops the `sec-*`, `host`, `origin`,
  `content-length`, `cookie` and `x-kalandra-proxy` request headers, sends the request through `net.request` with
  `app.userAgentFallback` as the User-Agent and, only to an official trade site, the session's cookies, which hold the
  sign-in of the built-in browser. It drops `content-encoding` and `set-cookie` from the response. It removes the
  `Partitioned` attribute from every `set-cookie` in the default session, because Cloudflare sets it and `net.request`
  cannot give a partition key. An error logs `error [proxy] <message> (<host>)`.
- `RemoteLogger.ts`: `Logger.write(message)` prefixes the local time, adds the line to `history`, which keeps the last
  1000 entries (`HISTORY_ENTRIES`), and broadcasts `MAIN->CLIENT::log-entry`. `logRejection(logger, source, action)`
  returns a `.catch()` handler that writes `error [<source>] Cannot <action>: <message>`. Callers start a message with
  its level (`info`, `warn`, `error` or `debug`), and most add a `[Component]` tag after it. Only the path lines that
  `GameLogWatcher` writes after its `Found 2 log files` error have no level. The Debug settings page shows the log.
- `renderer-log.ts`: `logRendererEntries(server, logger)`, which `main.ts` calls after it creates the `Logger`, writes
  each `CLIENT->MAIN::log-entry` a page sends as `<level> [renderer] <message>`. `rendererLogLine()` makes the line
  from the unchecked payload ([ipc.md](ipc.md#public-contract)).
- `AppUpdater.ts`: `AppUpdater` wraps electron-updater. Setting `info` broadcasts `MAIN->CLIENT::updater-state`. It
  checks once when it is created, after it reads `--no-updates`, and every 16 hours, so the first check does not wait
  for the page. It handles the `check-for-update` and `update-and-restart` user actions. `noAutoUpdatesReason` is
  `not-supported` for the Windows portable build (`PORTABLE_EXECUTABLE_DIR` is set) and on macOS, whose dmg build has
  no zip file for `MacUpdater`, and otherwise `disabled-by-flag` with `--no-updates`. Automatic download is off
  whenever it is set. The constructor's optional `platform` defaults to `process.platform`, so a test can pass one. An
  `error` event logs `error [AppUpdater] Update failed:` and the first line of the error's message, since the next lines
  are response headers, which can contain cookies. A check that fails without an `error` event logs the same line.
- `AppTray.ts`: `AppTray` shows the tray icon (tooltip `Kalandra v<version>`) and its menu: Settings/League, a message
  box that says to press the overlay key; Open in Browser, which opens `pageUrl` once `main.ts` sets it after the server
  listens; Open config folder (`apt-data`); and Quit. A message box, page or folder that fails to open logs
  `error [AppTray] Cannot ...`.

`shortcuts/`:

- `Shortcuts.ts`: `new Shortcuts(logger, overlay, poeWindow, gameConfig, server)` holds the hotkeys.
  `updateActions(settings)` replaces them with the `shortcuts` field and reads `stashScroll`, `logKeys` and
  `restoreClipboard` by name (`ShortcutSettings`), and `updateDelay(delay)` sets the clipboard's first poll delay.
  Each hotkey is registered with Electron's `globalShortcut` only while the game window is active.
  `registrableActions()` in `registrable-actions.ts` drops,
  with an `error [Shortcuts]` log line, a hotkey with a key name that `KeyToElectron` lacks (`accelerator.ts`), a
  hotkey the game uses ([settings.md](../../settings.md#hotkeys) lists them) and a hotkey given to two actions, except
  that a `toggle-overlay` action keeps it. It broadcasts `MAIN->CLIENT::unregistered-hotkeys` with the first two kinds
  and the hotkeys `globalShortcut` refused, after each `updateActions()` and when `register()` finds other keys taken.
  On a press it releases the hotkey's keys through `uiohook-napi` (all but the modifiers when `keepModKeys` is set)
  and runs the action: `toggle-overlay`, `paste-in-chat`, `trigger-event` (broadcasts `MAIN->CLIENT::widget-action`),
  `stash-search` or `copy-item` (presses the copy keys through `readItemText()`, sends `MAIN->CLIENT::item-text` to
  the last active client and, with `focusOverlay`, makes the overlay active when it was the last active client; it
  logs each error but `NoItemTextError` as `error [Shortcuts] Failed to copy the item text: <message>`). With
  `logKeys` it logs each key while the game window is active (`key-log.ts`). With `stashScroll` (the Stash tab
  scrolling setting) it taps `ArrowLeft` or `ArrowRight` for `Ctrl` and the mouse wheel while the game is active,
  except over the area `isStashArea()` computes.
- `HostClipboard.ts`: Electron's clipboard reads and writes return promises, and each one ends before main presses a
  key. `readItemText(pressCopyKeys)` clears the clipboard when it holds item text and then calls `pressCopyKeys`, so a
  write that ends late cannot replace the copied text. It polls every 48 ms (`POLL_DELAY`) after the first delay, for
  at most 500 ms (`POLL_LIMIT`). A call during a read presses the keys again and returns the same result. It resolves
  with text that starts as `LANGUAGE_DETECTOR` expects, or logs `warn [ClipboardPoller] No item text found.` and
  rejects with `NoItemTextError`. On Linux it always writes a `__EE2_FORCE_EMPTY_<time>` marker first, for KDE's
  "Prevent empty clipboard" feature and a Proton 10 bug (linked in the code). With Restore clipboard on it writes the
  previous text back, or empty text when that was item text. On Linux it also writes that text back after a failed
  read that leaves the marker, unless it is empty. `throttle(cb)` awaits `cb` and then 120 ms (`THROTTLE_TIME`), and
  until then drops another call to avoid the game's "Too many actions" disconnects. It leaves the text of `cb` on the
  clipboard, also with Restore clipboard on, since main cannot see when the game pastes. An error in `cb`, such as a
  failed clipboard write, logs `error [Clipboard] <message>`. `LANGUAGE_DETECTOR` holds the first line of item text,
  and an uncut gem's rarity line, per game language as literals: main reads no game data.
- `text-box.ts`: `typeInChat(text, send, clipboard)` runs inside `throttle()`. After its clipboard write ends, it
  presses `Enter`, then `Ctrl + A` unless the text starts with a channel prefix (`#`, `%`, `@`, `$`, `&` or `/`), and
  pastes the text. When the text is `@last` alone or starts with `@last` and a space, it removes `@last ` and presses
  `Ctrl + Enter` in place of `Enter` and `Ctrl + A`; `@lasthope hi` stays a whisper to `lasthope`. When the text ends
  with `@last`, it removes `@last`, presses `Ctrl + Enter`, `Home` twice and `Delete`, and then pastes. With `send` it
  presses `Enter`, then `Enter`, `ArrowUp` twice and `Escape` to bring back the last chat line.
  `stashSearch(text, clipboard, overlay)` runs inside `throttle()`, calls `overlay.focusGameFor()` and, when the game
  window has the focus, presses `Ctrl + F`, pastes the text and presses `Enter`. macOS uses `Meta` for `Ctrl` in
  `Ctrl + A`, `Ctrl + Enter` and the paste.
- `key-log.ts`: `logKeyPresses(logger, gameWindow, isOn)` logs `debug [Shortcuts] Keydown <keys>` and
  `debug [Shortcuts] Keyup <key>` for each key the `uiohook-napi` global hook reports while `isOn()` returns true
  and the game window is active. It leaves out the keys typed in other programs, which the global hook also reports.

`windowing/`:

- `OverlayWindow.ts`: `OverlayWindow` creates the overlay `BrowserWindow` with `OVERLAY_WINDOW_OPTS` from
  `electron-overlay-window` and the `webview` tag on, for the price check's built-in browser; links the page opens go
  to the default browser. Before a web view starts, its `will-attach-webview` handler removes a `preload`, sets
  `nodeIntegration` false and `contextIsolation` true, and blocks the web view with a `warn [Overlay]` line unless
  `isTradeSiteUrl()` accepts its first address. Later navigation inside it, such as a sign-in through another site,
  is not checked. The window's menu has the edit roles, `toggleDevTools` (Ctrl + Shift + I on Windows), which the
  [in-game check](../runbooks/in-game-check.md#where-the-logs-are) uses in a packaged build, and `reload` only in a dev
  run, since a reload drops the overlay's state. `roundedCorners` is false on Linux, where Electron otherwise rounds a
  frameless window. `loadAppPage(address)` loads `http://localhost:<port>/index.html`, or the Vite dev server in
  development, or with `--no-overlay` opens `pageUrl()` in the browser. A load or a link that fails logs
  `error [Overlay] Cannot ...`. `assertOverlayActive()`, `assertGameActive()`
  and `toggleActiveState()` move the focus between the overlay and the game, and `isInteractable` is true while the
  overlay has it. `focusGameFor(action)` calls `assertGameActive()` and returns whether the game window has the focus,
  and logs `warn [Overlay] Skipped <action>` when it does not, since keys go to the focused window, such as a browser.
  While the overlay has focus the hotkeys are not registered, so the window's `before-input-event` handler checks each
  key press with `overlayKeyCommand()`: `Escape` and `Ctrl + W` return to the game, and the overlay key toggles the
  focus. `updateOpts(settings)` reads `overlayKey`, `windowTitle` and `hideOverlayOnBlur` by name
  (`OverlaySettings`) and attaches the window to the game window. The library hides the window while neither the game
  nor the overlay has the focus. With `hideOverlayOnBlur` main also hides it while the overlay is not active and
  either the game is not active or the page sent `OVERLAY->MAIN::render-state` with `shouldShow` false. When the game
  has administrator rights that Kalandra lacks, it shows the error `PoE2 window: no access`. `watchPage()` in
  `page-watch.ts` logs a failed page load, except `ERR_ABORTED`, which a reload causes, and an exit of its renderer
  process. After an exit other than `clean-exit` it reloads the page, at most `MAX_RELOADS` (3) times in a run.
- `overlay-keys.ts`: `pressedHotkey(input)` names a key press in the overlay window with `hotkeyToString()` from
  `ipc/KeyToCode.ts`, the function the Hotkeys settings use to write a hotkey, so every combination of `Ctrl`,
  `Shift` and `Alt` matches the saved overlay key. `overlayKeyCommand(input, overlayKey)` returns `focus-game`,
  `toggle-overlay` or `undefined` for a key press.
- `GameWindow.ts`: `GameWindow`, an `EventEmitter`, attaches through `OverlayController.attachByTitle()` to the
  window whose title is `windowTitle`, and emits `active-change` on the game window's focus and blur. It also has
  `bounds`, `isActive`, `uiSidebarWidth` and `onAttach(cb)`.
- `OverlayVisibility.ts`: `OverlayVisibility` hides the overlay's UI when `Alt` is held alone, after 275 ms or
  85 ms while the overlay is interactable, and shows it again on any other key, a key release or a mouse move
  without `Alt`. It sends `MAIN->OVERLAY::visibility`.
- `WidgetAreaTracker.ts`: `WidgetAreaTracker` handles `OVERLAY->MAIN::track-area`. It follows the mouse through
  `uiohook-napi`. Moving further than `closeThreshold` from the press point, while the overlay is not interactable
  and the hold key is not held, sends `MAIN->OVERLAY::hide-exclusive-widget`. With the hold key held, or while the
  overlay is interactable, moving inside the area makes the overlay active, and so does a mouse press inside it.
  Leaving the area while the overlay is active returns to the game. On Windows and Linux it converts the page's
  coordinates to screen pixels first.

`host-files/`:

- `ConfigStore.ts`: `ConfigStore` reads and writes `apt-data/config.json` ([config.md](config.md)).
- `file-uploads.ts`: `addFileUploadRoutes(routes, logger)` adds the `/uploads/` routes, which store files in
  `apt-data/files/`. `POST` stores only a file whose URL path ends in an image extension that Chromium shows in an
  `<img>`, such as `.png` or `.jpg`, in any case, and returns 415 with a `warn [uploads]` log line otherwise. It closes
  the connection of a body over 16,000,000 bytes and stores nothing. A failed write returns 500 and logs
  `error [uploads] <message>`. Any method but `GET` and `POST` gets 405.
- `GameConfig.ts`: `GameConfig.readConfig(filePath)` reads `show_advanced_item_descriptions` in `[ACTION_KEYS]` of
  `poe2_production_Config.ini`, from the path in settings or the locations `defaultConfigFiles(platform)` returns:
  `My Games/Path of Exile 2/` under Documents on Windows and Linux, the Steam Proton prefix of app 2694490 on
  Linux, and none on macOS, where no source gives the folder of Path of Exile 2. When the file exists in more
  than one default location, it reads neither and logs an error that names them and asks for a path.
  `showModsKey` is that key, or `Alt` when none was read. Each `CLIENT->MAIN::update-host-config` reads the file
  again until a read succeeds; after that, only a new path reads it again.
- `GameLogWatcher.ts`: `GameLogWatcher.restart(logFile, readLog)` follows `Client.txt` only when `readLog` is true.
  With no path it tries the standalone and Steam paths from `defaultLogFiles(platform)`, none on macOS, and when both
  exist it logs an error that asks for a path. It polls the file every 450 ms with `fs.watchFile`, starts at the end
  of the file, and sends new non-empty lines as `MAIN->CLIENT::game-log`. `LineSplitter.ts` keeps a partial line until
  the game writes the rest, so a line or a character that the end of a 64 KiB read cuts is sent whole, and it skips a
  line longer than 64 KiB with a warning. Each time it reads, it first compares the open file with the path: when the
  file is shorter than the read position, or the path holds another file, it reads from the start. When the path holds
  no file, or its new file is deleted before it opens, it reads the open file. A restart with the same `logFile` keeps
  the open file. After a restart with `readLog` false, or one that found or opened no file, it opens the file again. A
  restart that closes the file stops a read in progress after its current chunk, and a failed read is logged.
- `FileWriter.ts`: `FileWriter` handles `CLIENT->MAIN::write-data` only while `restart(enabled, outputPath)` has
  enabled it. `main.ts` enables it for the library alpha: Enable experimental features with Item Data Collection on,
  in the General settings page (`libraryAlpha` in `HostConfig`). It writes `log-item` lines to `<name>.csv` between a
  `session` start and stop. It answers each start with `MAIN->CLIENT::library-session`: `started` once the file is
  open, `invalid-name` for a name that Windows does not allow as a file name, which includes a path separator, and
  `failed` while it is off or when the folder or file cannot be created, with the reason in the log. A start with a
  valid name closes the file of a session that did not stop, as after a page reload. It writes
  `client-log-event` lines to `client-log.ndjson`, which it overwrites at its first write in a run. The folder is the
  library output path, or `apt-data/csv-data` by default, and it creates the folder before it opens either file. A
  restart that turns it off closes both files. One that changes the folder closes `client-log.ndjson`, which the next
  entry opens in the new folder, and leaves a session file open in the folder it started in until the session stops.
  Each event and `restart` starts after the one before it ends, so an entry that comes while its file opens is written
  once the file is open, and lines keep the order of their events. A failed open or write is logged, and the next
  event still runs. `idle()` resolves once the events and restarts before it are handled.
- `utils.ts`: `guessFileLocation(entries, onUnreadable)` returns the one readable path, `null` when more than one is
  readable, or `undefined` when none is, and passes each error but `ENOENT` to `onUnreadable`, which logs a `warn`.

## Invariants

- The renderer reaches main only through the routes in `server.ts` and the `IpcEvent` messages
  ([ipc.md](ipc.md)). A new capability the page needs is a new message or route, never a Node.js API in the page.
- `HttpProxy` destroys a request to a host outside `PROXY_HOSTS`. Adding a host is a deliberate change to that list
  ([ADR-0005](../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)).
- A platform-specific path or API checks `process.platform`, as the default file paths, the Linux clipboard marker,
  the macOS accessibility check and the `Meta` key do. CI packages the app on Windows, Linux and macOS.
- Hotkeys are registered only while the game window is active, so they do not take keys from other programs.
- Item text goes to the last active client only; the log, the updater state, the config and the focus state go to
  every client.
- No file main reads or writes (`apt-data`, `Client.txt`, the game config) is committed to the repo.
- Code handles errors as rule 7 of [AGENTS.md](../../../AGENTS.md) says, and ESLint fails on an empty `catch` block
  or `.catch()` handler.

**Dependencies.** `ipc/types.ts`, `ipc/KeyToCode.ts` and `renderer/content-security-policy.ts`, by relative path. At run
time Electron 44, and the native modules `electron-overlay-window` 4.0.2 and `uiohook-napi` 1.5.x, which the bundle
leaves out with `electron`. Both modules load prebuilt Node-API binaries, which load in a new Electron version without a
rebuild. The bundle includes `electron-updater`, `ws` and `ini`. `main.ts` imports `electron-devtools-installer`
inside its `VITE_DEV_SERVER_URL` check, which the production build defines as `null`, so only a development bundle has
it. `build/script.mjs` bundles `dist/main.js` with esbuild; in development it sets `VITE_DEV_SERVER_URL` to
`http://localhost:5173` and restarts Electron after each rebuild. `electron-builder.yml` packages `dist/main.js` and
`../renderer/dist` as an NSIS installer and a portable build on Windows, an AppImage on Linux and an unsigned universal dmg on macOS, and publishes to GitHub
releases. The `electron` package has no install script. `require("electron")` downloads the Electron binary the first
time it runs, which `npm run dev` does, and electron-builder downloads its own copy to package the app.

**Tests.** `npm test` in `main/` runs Vitest over `main/specs/`, and the Tests job in `test.yml` runs it with
`--coverage`, which fails below the floor in `main/vitest.config.ts` (91.8% of the lines of `src/` on 26 Oct 2026).
[main-tests.md](main-tests.md) says what each test file checks. `npm run build` in `main/` runs `tsc --noEmit` and the
production bundle, and `npm run lint` runs ESLint 9 on `src/`, `specs/` and `build/` with the rules in
`eslint.config.mjs`; the Build workflow packages main on all three platforms. Hotkeys, overlay focus and clipboard
capture need the game: [runbooks/in-game-check.md](../runbooks/in-game-check.md) says how to check them,
[host/index.md](../host/index.md) lists every host check, and each task's Status line says whether it still has to run.
