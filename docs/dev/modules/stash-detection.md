# Stash detection: the game window capture in main

**Purpose.** The stash prices feature ([renderer-stash-prices.md](renderer-stash-prices.md)) marks the items of one
stash tab while the user has that tab open in the game. On Windows the overlay page finds that out from a capture of
the game window, which only main can grant ([ADR-0004](../adr/ADR-0004-process-boundary.md)). This document covers
the part in main.

## Public contract

`main/src/windowing/GameCapture.ts`:

- `GameCapture.handleRequest(request, answer)` answers each `navigator.mediaDevices.getDisplayMedia()` request of
  the default session. `main.ts` passes it to `session.defaultSession.setDisplayMediaRequestHandler()` after it
  creates the overlay window.
- It answers with the game window only when all of these hold: `process.platform` is `win32`; the last `update()`
  turned it on; the request comes from the main frame of the overlay window's page (`isSameFrame()` with
  `OverlayWindow.pageFrame`, by process and routing number), so a web view or a browser tab gets nothing; and the
  request asks for video alone. The game window is the window that `desktopCapturer.getSources()` lists with the
  name of the `windowTitle` setting, the title `electron-overlay-window` attaches to. It lists the windows with a
  thumbnail size of 0, which captures none of them.
- Every other request gets `null`, which rejects the page's `getDisplayMedia()` promise.
- It writes each result to the log once, and again only after a different result: `warn [GameCapture] Refused a
  capture: <reason>`, `warn [GameCapture] Found no window named "<title>"`, `error [GameCapture] Cannot list the
  windows: <message>` or `info [GameCapture] Captures the window "<title>"`.
- `update(enabled, windowTitle)` takes `stashCapture` and `windowTitle` of `CLIENT->MAIN::update-host-config`
  through `passHostConfig()` ([ipc.md](ipc.md)). The renderer sets `stashCapture` from the stash prices widget's
  `enabled`.

## Invariants

- Main grants a capture and never reads a frame: the frames go to the page that asked, and main stores nothing.
- A capture that main granted runs until the page stops it. Turning the feature off refuses the next request only.
- Window capture shows the game window's own content, so the overlay window over it is not in the frames.

**Dependencies.** Electron's `session`, `desktopCapturer` and `WebFrameMain` (types only in `GameCapture.ts`), and
`Logger`.

**Tests.** `main/specs/game-capture.test.ts` sends requests through a fake desktop on each platform, with the
feature off and on, from the overlay page, a web view, another frame and a frame that is gone, for audio and without
video, with no window of the title and with a list that fails, and reads the log lines.
`overlay-window.test.ts` checks `OverlayWindow.pageFrame` with and without the overlay window, and
`host-config.test.ts` checks that `stashCapture` and `windowTitle` reach `GameCapture.update()`.
