# main/specs: the main process tests

What each file in `main/specs/` checks, in the order of the source folders in [main.md](main.md). The commands, the
coverage floor and the checks that need the game are in its Tests paragraph. A test of a module that imports Electron
replaces it with `vi.mock("electron", ...)`.

## The server and the app services

- `listen-option.test.ts` covers the `--listen` parsing, the fallback with real servers on a port in use and on a
  host address no computer has, and the `pageUrl()` of each kind of host.
- `served-file.test.ts` covers the path check, and `request-origin.test.ts` the header check.
- `startup.test.ts` covers the startup order on each platform, with a fake `app` that emits `ready` once.
- `AppTray.test.ts` builds the tray through a fake Electron on each platform, clicks each menu entry, Open in Browser
  also before the server listens and with a desktop that fails to open each one, and sends `CLIENT->MAIN::user-action`
  messages.
- `AppUpdater.test.ts` creates the updater with a fake electron-updater whose check finds a new version, finds none or
  fails, with or without an `error` event. It sends each user action and checks again after 16 hours of fake time.
  The fake downloads only while `autoDownload` is on, and the test passes each platform in, with and without
  `--no-updates`, and as the portable build.
- `start-server.test.ts` calls `startServer()` with a fake updater, checks the address it resolves, reads `GET /config`
  before and after a `save-config` message and the first `/events` messages, sends overlay events with the User-Agent of
  the overlay window, of a browser and with none, sends messages main cannot use, and sends client log entries from the
  overlay window and a browser tab.
- `event-clients.test.ts` opens several `/events` clients and checks the events a new client receives first, and
  which client receives a `last-active` event after a connect, a `CLIENT->MAIN::used-recently` message and a close.
  After a close that leaves one client, it checks the `isOverlay` main reports for a browser and the overlay window.
- `client-log-writer.test.ts` picks the writer from lists of fake clients.
- `server.test.ts` starts the server and sends `..` paths, foreign origins and host names to the HTTP routes and to
  `/events`, paths and methods that no route serves, and an upgrade request to another path. It reads each directive
  of the `Content-Security-Policy` header on the page, a static file and an upload.
- `proxy.test.ts` sends `/proxy` requests through the server's request check, with and without the `x-kalandra-proxy`
  header, from another origin and for hosts that differ from the list in case, a port, user info or a suffix. A fake
  `net.request` answers with the request and body it was given, or fails. It sends the page's `cookie` header to a trade
  site and to the other hosts, and reads the headers of a response that sets a cookie. The test also passes `set-cookie`
  headers through the listener the proxy adds to the default session.
- `RemoteLogger.test.ts` writes more entries than the history keeps, and logs an `Error` and a string with
  `logRejection()`.
- `renderer-log.test.ts` sends `CLIENT->MAIN::log-entry` payloads through `FakeServer` and reads the lines main's log
  broadcasts: one with line breaks, one over the length limit, and payloads without a known level or a text message.
- `host-config.test.ts` sends `CLIENT->MAIN::update-host-config` through `FakeServer` to fake services that keep
  the settings they are given. Every text in its config differs, and each switch is turned on alone, so a field
  passed to the wrong service fails. It also sends empty paths and a log watcher restart that fails.
- `uncaught-errors.test.ts` emits uncaught errors and unhandled rejections of each kind of value from an `EventEmitter`
  in place of `process`.

## shortcuts/

- `HostClipboard.test.ts` reads item text on each platform from a fake clipboard, whose writes end a tick after the
  call as the operating system's do, and checks that the copy keys are pressed after item text copied before is
  cleared.
- `text-box.test.ts` types chat commands into the fake clipboard and chat box of `fake-chat.ts`, which applies each
  key press to the text in the box, or keeps the presses while the game stalls and applies them when it resumes. Its
  clipboard writes end a tick late too, and a test can make a read or a write fail. The tests check that a game that
  stalls pastes the command with Restore clipboard on, that a command during the last one is dropped, and the log
  line and the next command after a failed write.
- `stash-search.test.ts` runs stash searches through `OverlayWindow` and `GameWindow` with a fake desktop that
  records the window each key press reaches and the text each paste reaches it with, or keeps the presses while the
  game stalls and handles them when it resumes. The tests check that a game that stalls pastes the search with
  Restore clipboard on, and that a search during the last one is dropped.
- `key-log.test.ts` sends key events through the fake global hook of `fake-hook.ts` and reads the log lines.
- `shortcuts.test.ts` registers hotkeys through `fake-global-shortcut.ts` while the game window is active and checks
  the hotkeys `updateActions()` leaves out. It reads each `MAIN->CLIENT::unregistered-hotkeys` list main sends, as
  the config changes and as other applications take and release keys in `fake-global-shortcut.ts`. It presses a
  hotkey and reads the keys it releases from `fake-hook.ts`, which keeps each key main presses, and turns the mouse
  wheel with `Ctrl` at the edges of the stash area.
- `hotkey-actions.test.ts` presses the copy item hotkey on Windows and macOS with a fake clipboard that the game
  fills when main taps `C`, and reads the keys and the item text main sends. A test makes each clipboard read fail
  and reads the error log line. It also registers a hotkey that another application holds in
  `fake-global-shortcut.ts`.
- `key-names.test.ts` writes hotkeys with `hotkeyToString()`, `mergeTwoHotkeys()` and `shortcutToElectron()`, and
  checks that `KeyToCode` gives each key a code of its own and that `KeyToElectron` has an accelerator for each key.

## windowing/

- `overlay-keys.test.ts` names a key press with each combination of modifiers and checks which presses move the
  focus.
- `page-watch.test.ts` fails loads of a fake `webContents` and ends its renderer process.
- `overlay-window.test.ts` creates `OverlayWindow` with a fake `BrowserWindow` and a fake `OverlayController`. It checks
  the window options on each platform, the menu with and without a dev run, the page it loads, a load and a link that
  fail, the attach to the game window, the focus changes, the overlay key and Escape in the window and in a web view,
  and Hide overlay on blur. It sends `will-attach-webview` with a preload and Node.js on, for the trade site and for
  addresses the check blocks.
- `widget-area.test.ts` sends `OVERLAY->MAIN::track-area` through the fake server and mouse events through the fake
  global hook at the edges of the area and the close threshold, and on Windows and Linux through a fake `screen` at
  150% scale.
- `overlay-visibility.test.ts` holds `Alt` alone or with other keys and reads the `MAIN->OVERLAY::visibility` events,
  with fake timers in place of the 85 ms and 275 ms delays.

## host-files/

- `file-uploads.test.ts` posts images and other files to the `/uploads/` routes, images of 16,000,000 bytes and one
  byte more, and an image while a file holds the place of the uploads folder.
- `ConfigStore.test.ts` saves configs in a temporary folder through fakes that write slowly, stop partway through a
  write or fail the rename as Windows does for a file another program has open, with a fake wait between rename
  retries that returns at once and adds up the delays. It also saves in development,
  reads a `config.json` that is a folder or is not a JSON object, and fails a read with `EBUSY`.
- `GameConfig.test.ts`, `GameLogWatcher.test.ts` and `FileWriter.test.ts` read and write real files in a temporary
  folder, and the first two pass their own default paths, of which `unreadable-files.ts` makes some fail with EACCES.
  They also check the default paths of each platform, and that on macOS, which has none, a read without a path
  ignores the log folder of the Path of Exile 1 Mac client and the game folder under the application data folder.
- `GameConfig.test.ts` reads each modifier code, a file with a byte order mark, a file without the key and key
  codes it cannot read, and reads a file again only at a new path.
- `FileWriter.test.ts` sends client events through the fake server in `fake-server.ts` and waits for `idle()` after
  each one. It stops sessions, starts one twice with the same name and sends events while the
  feature is off. It delays the first write to check the line order, and keeps the files it opens to check which
  ones it closed.
- `GameLogWatcher.test.ts` calls the change listener of a fake `FileWatch` or `fs.watchFile`, deletes a new log as
  the watcher opens it, and on Windows fails that open with EPERM as Windows does during a delete. It also fails that
  open with EACCES, turns reading off while it runs, restarts with the same path and finds both default logs.
