# main/specs: the main process tests

What each file in `main/specs/` checks, in the order of the source folders in [main.md](main.md). The commands, the
coverage floor and the checks that need the game are in its Tests paragraph. A test of a module that imports Electron
replaces it with `vi.mock("electron", ...)`.

## The server and the app services

- `listen-option.test.ts` covers the `--listen` parsing and the fallback with real servers on a port in use and on a
  host address no computer has.
- `served-file.test.ts` covers the path check, and `request-origin.test.ts` the header check.
- `startup.test.ts` covers the startup order on each platform, with a fake `app` that emits `ready` once.
- `AppUpdater.test.ts` creates the updater with a fake electron-updater whose check finds a new version or fails.
- `start-server.test.ts` calls `startServer()` with a fake updater, reads `GET /config` and the first `/events`
  messages, sends overlay events with the User-Agent of the overlay window, of a browser and with none, sends
  messages main cannot use, and sends client log entries from the overlay window and a browser tab.
- `event-clients.test.ts` opens several `/events` clients and checks the events a new client receives first, and
  which client receives a `last-active` event after a connect, a `CLIENT->MAIN::used-recently` message and a close.
- `client-log-writer.test.ts` picks the writer from lists of fake clients.
- `server.test.ts` starts the server and sends `..` paths, foreign origins and host names to the HTTP routes and to
  `/events`, paths and methods that no route serves, and an upgrade request to another path.
- `proxy.test.ts` sends `/proxy` requests with and without the `x-kalandra-proxy` header, through a fake
  `net.request` that answers with the request it was given.
- `RemoteLogger.test.ts` writes more entries than the history keeps.

## shortcuts/

- `HostClipboard.test.ts` reads item text from a fake clipboard on each platform.
- `text-box.test.ts` types chat commands into the fake clipboard and chat box of `fake-chat.ts`, which applies each
  key press to the text in the box.
- `stash-search.test.ts` runs stash searches through `OverlayWindow` and `GameWindow` with a fake desktop that
  records the window each key press reaches.
- `key-log.test.ts` sends key events through the fake global hook of `fake-hook.ts` and reads the log lines.
- `shortcuts.test.ts` registers hotkeys through `fake-global-shortcut.ts`.
- `key-names.test.ts` writes hotkeys with `hotkeyToString()`, `mergeTwoHotkeys()` and `shortcutToElectron()`, and
  checks that `KeyToCode` gives each key a code of its own and that `KeyToElectron` has an accelerator for each key.

## windowing/

- `overlay-keys.test.ts` names a key press with each combination of modifiers and checks which presses move the
  focus.
- `page-watch.test.ts` fails loads of a fake `webContents` and ends its renderer process.

## host-files/

- `file-uploads.test.ts` posts images and other files to the `/uploads/` routes, and an image while a file holds the
  place of the uploads folder.
- `ConfigStore.test.ts` saves configs in a temporary folder through fakes that write slowly, stop partway through a
  write or fail the rename as Windows does for a file another program has open.
- `GameConfig.test.ts`, `GameLogWatcher.test.ts` and `FileWriter.test.ts` read and write real files in a temporary
  folder, and the first two pass their own default paths.
- `FileWriter.test.ts` sends client events through the fake server in `fake-server.ts`, whose `emit` settles when its
  handlers' promises settle, and delays the first write to check the line order.
- `GameLogWatcher.test.ts` calls the change listener of a fake `FileWatch` or `fs.watchFile`, deletes a new log as
  the watcher opens it, and on Windows fails that open with EPERM as Windows does during a delete.

## vision/

- `ocr-worker.test.ts` runs `OcrWorker` with a fake worker thread that answers through Comlink, fails or exits.
