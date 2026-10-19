# main/: the Electron main process

**Purpose.** `main/` is the Electron main process, the only part of Kalandra with operating system access
([ADR-0004](../adr/ADR-0004-process-boundary.md)). It registers the hotkeys, presses keys in the game, reads the
clipboard, places the overlay window over the game window, reads and writes the files under `apt-data`, follows
the game's log, serves the renderer page over HTTP and forwards the page's requests to the outside hosts. The map
of the whole app is [architecture.md](../architecture.md), the messages main exchanges with the renderer are in
[ipc.md](ipc.md), and the config it stores is in [config.md](config.md).

## Public contract

The entry, the server and the app services, in `main/src/`:

- `main.ts`, bundled into `dist/main.js`, takes Electron's single instance lock, turns off hardware acceleration
  except on macOS and turns on Electron's sandbox. It passes the startup to `startWhenReady()` in `startup.ts`,
  which on macOS waits up to 15 seconds for the accessibility permission and quits without it. It then awaits
  `app.whenReady()`, which also resolves when Electron emitted `ready` during that wait, and runs the start
  function, which creates `AppTray`, `Logger`, `GameConfig`, `GameWindow`, `AppUpdater`, `HttpProxy`, `FileWriter`
  and `GameLogWatcher`, and adds the `/uploads/` routes. It creates `OverlayWindow`, `OverlayVisibility` and
  `Shortcuts` after a timer: 1 second on Linux, because the window is black instead of transparent otherwise, and 0
  elsewhere. Its `CLIENT->MAIN::update-host-config` handler passes each `HostConfig` field to the object that uses
  it. It then starts `uIOhook`, calls `startServer()` and loads the page. When `startServer()` rejects, it shows the
  error box `Kalandra cannot start` and quits. In development it also installs Vue Devtools.
- `server.ts` exports `server` (the `http.Server`), `httpRoutes`, `startServer(appUpdater, logger)`, which adds
  the `/config` route and the `/events` connection handler, listens and returns the port, and `eventPipe`, the
  `ServerEvents` pair of `onEventAnyClient(name, cb)` and `sendEventTo(target, event)`. A class that sends or handles
  messages takes `ServerEvents` in its constructor rather than importing `server.ts`. Every HTTP route listens on
  `httpRoutes`, never on `server`: `server` passes a request on only when `isAllowedRequest()` accepts it, and
  returns 403 otherwise. `addFileUploadRoutes()` and `HttpProxy` take `httpRoutes`.
  The target `"broadcast"` sends to every client, and `"last-active"` and `"any"` both send to the last active
  client. A new client receives the log history and the current updater state, which the first update check can
  change after the page reads `GET /config`. An `OVERLAY->MAIN::` message is ignored and logged unless the client's
  WebSocket upgrade request has `Electron` in its User-Agent, as the overlay window's does. The routes are in
  [architecture.md](../architecture.md#the-boundary-between-the-processes).
- `request-origin.ts`: `isAllowedRequest(headers, isWebSocket)` accepts a `Host` that is `localhost` or an IP
  address, and an `Origin` that matches it with the `http:` scheme; a WebSocket must send `Origin`, plain HTTP may
  leave it out ([ADR-0009](../adr/ADR-0009-local-server-accepts-only-its-own-page.md)).
- `listen-option.ts`: `readListenOption(argv, defaults)` reads `--listen=[host][:port]`, with an IPv6 host in
  brackets, and never throws. For `--listen` without `=`, an unreadable value or a port over 65535 it returns the
  defaults and an `error` text, which `startServer()` writes to the log. `listenWithFallback(server, address,
  fallback, onFallback)` listens on `address`, and after an error such as `EADDRINUSE` or `EADDRNOTAVAIL` passes the
  error to `onFallback` and listens on `fallback`; it rejects when `address` is `fallback`. `startServer()` passes the
  defaults as `fallback` and logs the error.
- `proxy.ts`: `HttpProxy` forwards `/proxy/<host>/<path>` for the hosts in `PROXY_HOSTS`: the nine official trade
  sites (`official: true`, a flag that changes nothing in forwarding), `www.poeprices.info` and
  `kalandra.ashoal.com`. It returns 403 for a request without the `x-kalandra-proxy` header, which `Host.proxy()`
  sends and a page on another site cannot ([ADR-0009](../adr/ADR-0009-local-server-accepts-only-its-own-page.md)).
  It drops the `sec-*`, `host`, `origin`, `content-length` and `x-kalandra-proxy` request headers, sends the
  request through `net.request` with the session's cookies and `app.userAgentFallback` as the User-Agent, and
  drops `content-encoding` from the response.
  It removes the `Partitioned` attribute from every `set-cookie` in the default session, because Cloudflare sets it
  and `net.request` cannot give a partition key. An error logs `error [proxy] <message> (<host>)`.
- `RemoteLogger.ts`: `Logger.write(message)` prefixes the local time, adds the line to `history` and broadcasts
  `MAIN->CLIENT::log-entry`. Callers start each message with its level (`info`, `warn`, `error` or `debug`), and
  most add a `[Component]` tag after it. The Debug settings page shows the log.
- `AppUpdater.ts`: `AppUpdater` wraps electron-updater. Setting `info` broadcasts `MAIN->CLIENT::updater-state`. It
  checks once when it is created, after it reads `--no-updates`, and every 16 hours, so the first check does not
  wait for the page. It handles the `check-for-update` and `update-and-restart` user actions. Automatic download is
  off for the Windows portable build (`PORTABLE_EXECUTABLE_DIR` is set) and, on every platform but macOS, with
  `--no-updates`. `noAutoUpdatesReason` is `not-supported` for the portable build and on macOS, and
  `disabled-by-flag` for the flag.
- `AppTray.ts`: `AppTray` shows the tray icon (tooltip `Kalandra v<version>`) and its menu: Settings/League, a
  message box that says to press the overlay key; Open in Browser; Open config folder (`apt-data`); and Quit.

`shortcuts/`:

- `Shortcuts.ts`: `Shortcuts.create(logger, overlay, poeWindow, gameConfig, server)` starts the OCR worker and
  returns the shortcuts. `updateActions(actions, stashScroll, logKeys, restoreClipboard, language)` replaces the
  hotkeys, and `updateDelay(delay)` sets the clipboard's first poll delay. Every hotkey is registered with
  Electron's `globalShortcut` while the game window is active, and all are unregistered when it is not. It drops,
  with an `error [Shortcuts]` log line, a hotkey the game uses (`Ctrl + C`, `Ctrl + V`, `Ctrl + A`, `Ctrl + F`,
  `Ctrl + Enter`, `Home`, `Delete`, `Enter`, `ArrowUp`, `ArrowRight`, `ArrowLeft` and the copy keys) and a hotkey
  given to two actions, except that a `toggle-overlay` action keeps it. On a press it releases the hotkey's keys
  through `uiohook-napi` (all but the modifiers when `keepModKeys` is set) and runs the action: `toggle-overlay`,
  `paste-in-chat`, `trigger-event` (broadcasts `MAIN->CLIENT::widget-action`), `stash-search`, `copy-item`
  (presses the copy keys, sends `MAIN->CLIENT::item-text` to the last active client and, with `focusOverlay`,
  makes the overlay active when the overlay was the last active client) or `ocr-text` (Windows only, sends
  `MAIN->CLIENT::ocr-text`). With `logKeys` it logs each key while the game window is active (`key-log.ts`). With
  `stashScroll` (the Stash tab scrolling setting) it taps `ArrowLeft` or `ArrowRight` for `Ctrl` and the mouse wheel
  while the game is active, except over the area `isStashArea()` computes.
- `HostClipboard.ts`: `readItemText()` clears the clipboard when it holds item text, then polls every 48 ms
  (`POLL_DELAY`) after the first delay, for at most 500 ms (`POLL_LIMIT`). It resolves with text that starts as
  `LANGUAGE_DETECTOR` expects, or logs `warn [ClipboardPoller] No item text found.` and rejects. On Linux it always
  writes a `__EE2_FORCE_EMPTY_<time>` marker first, for KDE's "Prevent empty clipboard" feature and a Proton 10 bug
  (linked in the code). With Restore clipboard on it writes the previous text back. `restoreShortly(cb)` runs `cb`
  and, with Restore clipboard on, restores the clipboard after 120 ms (`RESTORE_AFTER`). It drops a call that comes
  within those 120 ms, to avoid the game's "Too many actions" disconnects. `LANGUAGE_DETECTOR` holds the first line
  of copied item text, and an uncut gem's rarity line, per game language as literals: main reads no game data.
- `text-box.ts`: `typeInChat(text, send, clipboard)` runs inside `restoreShortly()`. It presses `Enter`, then
  `Ctrl + A` unless the text starts with a channel prefix (`#`, `%`, `@`, `$`, `&` or `/`), and pastes the text.
  When the text is `@last` alone or starts with `@last` and a space, it removes `@last ` and presses
  `Ctrl + Enter` in place of `Enter` and `Ctrl + A`; `@lasthope hi` stays a whisper to `lasthope`. When the text
  ends with `@last`, it removes `@last`, presses `Ctrl + Enter`, `Home` twice and `Delete`, and then pastes. With
  `send` it presses `Enter`, then `Enter`, `ArrowUp` twice and `Escape` to bring back the last chat line.
  `stashSearch(text, clipboard, overlay)` focuses the game, presses `Ctrl + F`, pastes the text and presses
  `Enter`. macOS uses `Meta` for `Ctrl` in `Ctrl + A`, `Ctrl + Enter` and the paste.
- `key-log.ts`: `logKeyPresses(logger, gameWindow, isOn)` logs `debug [Shortcuts] Keydown <keys>` and
  `debug [Shortcuts] Keyup <key>` for each key the `uiohook-napi` global hook reports while `isOn()` returns true
  and the game window is active. It leaves out the keys typed in other programs, which the global hook also reports.

`windowing/`:

- `OverlayWindow.ts`: `OverlayWindow` creates the overlay `BrowserWindow` with `OVERLAY_WINDOW_OPTS` from
  `electron-overlay-window` and the `webview` tag on, for the price check's built-in browser; links the page opens
  go to the default browser. `loadAppPage(port)` loads `http://localhost:<port>/index.html`, or the Vite dev server
  in development, or with `--no-overlay` (no window) opens it in the default browser. `assertOverlayActive()`,
  `assertGameActive()` and `toggleActiveState()` move the focus between the overlay and the game, and
  `isInteractable` is true while the overlay has it. While the overlay has focus the hotkeys are not registered,
  so the window's `before-input-event` handler checks each key press with `overlayKeyCommand()`: `Escape` and
  `Ctrl + W` return to the game, and the overlay key toggles the focus. `updateOpts()` attaches the window to the game window. With `hideOverlayOnBlur`, the window is hidden rather than transparent
  while the overlay is not active and either the game is not active or the page sent
  `OVERLAY->MAIN::render-state` with `shouldShow` false. When the game runs with administrator rights that
  Kalandra lacks, it shows the error box `PoE2 window - No access`.
- `overlay-keys.ts`: `pressedHotkey(input)` names a key press in the overlay window with `hotkeyToString()` from
  `ipc/KeyToCode.ts`, the function the Hotkeys settings use to write a hotkey, so every combination of `Ctrl`,
  `Shift` and `Alt` matches the saved overlay key. `overlayKeyCommand(input, overlayKey)` returns `focus-game`,
  `toggle-overlay` or `undefined` for a key press.
- `GameWindow.ts`: `GameWindow`, an `EventEmitter`, attaches through `OverlayController.attachByTitle()` to the
  window whose title is `windowTitle`, and emits `active-change` on the game window's focus and blur. It also has
  `bounds`, `isActive`, `uiSidebarWidth`, `onAttach(cb)` and `screenshot()`.
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
  `<img>`, such as `.png` or `.jpg`, in any case, and returns 415 with a `warn [uploads]` log line otherwise. A failed
  write returns 500 and logs `error [uploads] <message>`.
- `served-file.ts`: `sendFile(res, folder, urlPath)` streams a file for the static route and `GET /uploads/`, and
  returns 404 for a missing file or a path that `resolveInside(folder, urlPath)` finds outside the folder, such as
  one with `..` segments, which Node passes on in `req.url` as sent.
- `GameConfig.ts`: `GameConfig.readConfig(filePath)` reads `show_advanced_item_descriptions` in `[ACTION_KEYS]` of
  `poe2_production_Config.ini`, from the path in settings or the default location for the platform:
  `My Games/Path of Exile 2/` under Documents on Windows and Linux, the Steam Proton prefix of app 2694490 on
  Linux, and `Path of Exile 2/Preferences/` under the application data folder on macOS. `showModsKey` is that key,
  or `Alt` when none was read.
- `GameLogWatcher.ts`: `GameLogWatcher.restart(logFile, readLog)` follows `Client.txt` only when `readLog` is true.
  With no path it tries the standalone and Steam install folders for the platform, and when both exist it logs an
  error that asks for a path. It polls the file every 450 ms with `fs.watchFile`, starts at the end of the file, and
  sends new non-empty lines as `MAIN->CLIENT::game-log`. `LineSplitter.ts` keeps a partial line until the game writes
  the rest, so a line or a character that the end of a 64 KiB read cuts is sent whole, and it skips a line longer than
  64 KiB with a warning. Each time it reads, it first compares the open file with the path: when the file is shorter
  than the read position, or the path holds another file, it reads from the start. A restart with the same `logFile`
  keeps the open file. After a restart with `readLog` false, or one that found or opened no file, it opens the file
  again. `CLIENT->MAIN::re-parse-log` reads the file again from the start. A restart that closes the file stops a read
  in progress after its current chunk, and a failed read is logged.
- `FileWriter.ts`: `FileWriter` handles `CLIENT->MAIN::write-data` only while `restart(enabled, outputPath)` has
  enabled it. `main.ts` enables it for the library alpha: Enable experimental features with Item Data Collection
  on, in the General settings page (`libraryAlpha` in `HostConfig`). It writes `log-item` lines to `<name>.csv`
  between a `session` start and stop. It answers each start with `MAIN->CLIENT::library-session`: `started` once
  the file is open, `invalid-name` for a name that Windows does not allow as a file name, which includes a path
  separator, and `failed` while it is off or when the folder or file cannot be created, with the reason in the
  log. It writes `client-log-event` lines to `client-log.ndjson`, which it overwrites at its first write in a run
  and at the first write after a log re-parse. The folder is the library output path, or `apt-data/csv-data` by
  default, and it creates the folder before it opens either file. A restart that turns it off closes both files. One
  that changes the folder closes `client-log.ndjson`, which the next entry opens in the new folder, and leaves a
  session file open in the folder it started in until the session stops. Each event, `restart` and
  `flushClientLogFile` starts after the one before it ends, so an entry that comes while its file opens is written
  once the file is open, and lines keep the order of their events. A failed open or write is logged, and the next
  event still runs.
- `utils.ts`: `guessFileLocation(entries)` returns the one readable path, `null` when more than one is readable,
  or `undefined` when none is.

`vision/`: `OcrWorker` in `link-main.ts` runs `link-worker.ts`, bundled as `dist/vision.js`, in a worker thread
through Comlink. The worker loads the Tesseract and OpenCV WebAssembly builds from `apt-data/cv-ocr/`, which the
user installs ([the OCR guide](../../ocr-guide.md)), and `HeistGemFinder` reads Heist gem names from a screenshot
of the game window. `init()` in `wasm-bindings.ts` throws on every platform but Windows.

## Invariants

- The renderer reaches main only through the routes in `server.ts` and the `IpcEvent` messages
  ([ipc.md](ipc.md)). A new capability the page needs is a new message or route, never a Node.js API in the page.
- `HttpProxy` destroys a request to a host outside `PROXY_HOSTS`. Adding a host is a deliberate change to that list
  ([ADR-0005](../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)).
- A platform-specific path or API checks `process.platform`, as the default file paths, the Linux clipboard marker,
  the Windows-only OCR, the macOS accessibility check and the `Meta` key do. CI packages the app on Windows, Linux
  and macOS.
- Hotkeys are registered only while the game window is active, so they do not take keys from other programs.
- Item text and OCR text go to the last active client only; the log, the updater state, the config and the focus
  state go to every client.
- No file main reads or writes (`apt-data`, `Client.txt`, the game config) is committed to the repo.
- Some existing code drops errors in empty `catch` blocks: `ConfigStore.load()`, `guessFileLocation()`,
  `OcrWorker` and the `copy-item` and `ocr-text` handlers in `Shortcuts`. New code handles errors as rule 7 of
  [AGENTS.md](../../../AGENTS.md) says.

**Dependencies.** `ipc/types.ts` and `ipc/KeyToCode.ts`, by relative path. At run time `electron-overlay-window`
4.0.2 and `uiohook-napi` 1.5.x, native modules the bundle leaves out with `electron`; bundled: `electron-updater`,
`electron-devtools-installer`, `ws`, `ini`, `comlink` and `@wokwi/bmp-ts`. `build/script.mjs` bundles `dist/main.js`
and `dist/vision.js` with esbuild; in development it sets `VITE_DEV_SERVER_URL` to `http://localhost:5173` and
restarts Electron after each rebuild. `electron-builder.yml` packages `dist/main.js`, `dist/vision.js` and
`../renderer/dist` as an NSIS installer and a portable build on Windows, an AppImage on Linux and an unsigned
universal dmg on macOS, and publishes to GitHub releases.

**Tests.** `npm test` in `main/` runs Vitest over `main/specs/`, and the Tests job in `test.yml` runs it with
`--coverage`, which fails below the floor in `main/vitest.config.ts` (42.1% of the lines of `src/` on 19 Oct 2026).
`listen-option.test.ts` covers the `--listen` parsing and the fallback with real servers on a port in use and on a
host address no computer has, `served-file.test.ts` the path check, `request-origin.test.ts` the header check and
`startup.test.ts` the startup order on each platform, with a fake `app` that emits `ready` once.
`AppUpdater.test.ts` creates the updater with a fake electron-updater whose check finds a new version, and
`start-server.test.ts` calls `startServer()` with a fake updater, reads `GET /config` and the first `/events`
messages, and sends overlay events with the User-Agent of the overlay window, of a browser and with none.
`text-box.test.ts` types chat commands into the fake clipboard and chat box of `fake-chat.ts`, which applies each
key press to the text in the box. `key-log.test.ts` sends key events through the fake global hook of
`fake-hook.ts` and reads the log lines. `overlay-keys.test.ts` names a key press with each combination of
modifiers and checks which presses move the focus. `server.test.ts` starts the server and sends `..` paths, foreign origins
and host names to the HTTP routes and to `/events`. `file-uploads.test.ts` posts
images and other files to the `/uploads/` routes, and an image while a file holds the place of the uploads folder.
`proxy.test.ts` sends `/proxy` requests with and without the `x-kalandra-proxy` header, through a fake
`net.request` that answers with the request it was given.
`ConfigStore.test.ts` saves configs in a temporary folder through fakes that write slowly, stop partway through a
write or fail the rename as Windows does for a file another program has open. `GameLogWatcher.test.ts` and
`FileWriter.test.ts` read and write real files in a temporary folder and send client events through the fake server
in `fake-server.ts`, whose `emit` settles when the promises the handlers return settle. `FileWriter.test.ts` also
delays the first file write to check that lines keep their order.
A test of a module that imports Electron replaces it with `vi.mock("electron", ...)`.
`npm run build` in `main/` runs `tsc --noEmit` and the production bundle, and `npm run lint` runs ESLint; the Build
workflow packages main on all three platforms.
Hotkeys, overlay focus, clipboard capture and OCR need the game:
[runbooks/in-game-check.md](../runbooks/in-game-check.md) says how to check them, [host/index.md](../host/index.md)
lists every host check, and each task's Status line says whether it still has to run.
