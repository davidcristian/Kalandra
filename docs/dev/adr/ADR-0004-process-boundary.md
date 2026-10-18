# ADR-0004: Only the main process reaches the operating system, and the renderer is a web page

**Status:** Accepted (2026-10-18)

## Context

An Electron app runs two kinds of process. The main process is a Node.js program with access to the operating
system. A renderer process shows a web page. In Kalandra, `main/` is the main process and `renderer/` is a Vue page
that the overlay window shows over the game. The two exchange item text, settings, game events and network
responses. The layout below comes from Awakened PoE Trade.

## Decision

**1. Only `main` reaches the operating system.** It holds the global hotkeys (Electron's `globalShortcut`) and the key
presses and input events (`uiohook-napi`), both in `main/src/shortcuts/`, the overlay window (`electron-overlay-window`,
`main/src/windowing/`), the clipboard (`main/src/shortcuts/HostClipboard.ts`), the files in `apt-data`, the game config
and the client log (`main/src/host-files/`), network access to other hosts (`main/src/proxy.ts`), auto update
(`main/src/AppUpdater.ts`), the tray (`main/src/AppTray.ts`) and the OCR worker (`main/src/vision/`). Reason: decision 2
keeps Node.js and Electron APIs out of the page, so the main process is the only place that can reach the operating
system. Code that differs per platform checks `process.platform` there.

**2. The renderer is a web page that `main` serves over HTTP.** The HTTP server in `main/src/server.ts` serves the
built renderer files, and `startServer()` makes it listen on `127.0.0.1`, at a port the operating system picks. The
overlay window loads `http://localhost:<port>/index.html`. Its `webPreferences` set only
`allowRunningInsecureContent`, `webviewTag` (for the built-in browser, a `<webview>` in `PriceCheckWindow.vue`) and
`spellcheck`, and it has no preload script. Electron's defaults therefore apply: no Node integration and an isolated
context. Reason: the page is ordinary web code, so it runs the same in the overlay window and in a browser tab.

**3. [ipc/types.ts](../../../ipc/types.ts) is the only contract between the two.** Messages are `IpcEvent` objects
sent as JSON on the `/events` WebSocket. Beside it, `main` serves three HTTP routes: `/config` returns `HostState`
(the app version, the updater state and the config text), `/uploads` stores a file the user adds in
`apt-data/files` and serves it back, and `/proxy` forwards a request to another host
([ADR-0005](ADR-0005-proxy-hosts-and-trade-rate-limits.md)). Both processes import the types from that one file.
Reason: the TypeScript compiler checks every sender and every handler against one definition.

**4. An event name states its direction.** A name starts with `CLIENT->MAIN::`, `MAIN->CLIENT::`, `MAIN->OVERLAY::`
or `OVERLAY->MAIN::`. A client is any page connected to `/events`, the overlay window or a browser tab. The overlay
events have meaning only in the overlay window, and `onEvent` in `renderer/src/web/background/IPC.ts` skips
`MAIN->OVERLAY` events when the page does not run in Electron. Reason: a reader of a handler sees who sends the
message without searching for the sender.

**5. A new message starts as a new member of the `IpcEvent` union.** Its sender and its handler follow. Reason:
`sendEvent` in the renderer and `onEventAnyClient` and `sendEventTo` in `main/src/server.ts` accept only members of
that union, so a message outside it does not compile.

## Consequences

- The renderer runs in a normal browser. With `--no-overlay` the main process creates no overlay window and opens
  the page in the default browser, and `--listen=[host][:port]` sets the address of the server
  ([the command-line options page](../../cmd-flags.md)).
- In development, the Vite dev server serves the renderer and forwards `/config`, `/uploads`, `/proxy` and `/events`
  to `main` on port 8584 (`renderer/vite.config.mts`, and `startServer()` when `VITE_DEV_SERVER_URL` is set).
- A renderer feature that needs the operating system adds an `IpcEvent` message and a handler in `main`. It never
  imports a Node.js or Electron module.
- The server has no authentication. `--listen` with an address that other machines can reach, such as `0.0.0.0`,
  makes every route, `/events` included, reachable from them.

## Alternatives rejected

- **Electron's own IPC (`ipcRenderer` through a preload script).** The page would then run only inside Electron, and
  the browser tab that `--no-overlay` uses would stop working.
- **Turning on Node integration in the overlay window.** The page could then reach the file system directly, and
  it would no longer run in a browser tab once any widget used that access.

## Related

- [Main process module](../modules/main.md) and [IPC module](../modules/ipc.md).
- [Architecture](../architecture.md): the components and the data flow of a price check.
- [ADR-0003](ADR-0003-config-survives-updates.md): `HostConfig` and the config messages.
- [ADR-0005](ADR-0005-proxy-hosts-and-trade-rate-limits.md): what the `/proxy` route forwards.
