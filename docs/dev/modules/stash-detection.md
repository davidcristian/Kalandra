# Stash detection: finding the open stash tab in the game

**Purpose.** The stash prices feature ([renderer-stash-prices.md](renderer-stash-prices.md)) marks the items of one
stash tab while the user has that tab open in the game. On Windows the overlay page finds that out from a capture of
the game window, which only main can grant ([ADR-0004](../adr/ADR-0004-process-boundary.md)). This document covers
the capture handler in main and the grid of the tab in the renderer.

## Public contract

### The capture handler (`main/src/windowing/GameCapture.ts`)

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

### The grid (`renderer/src/web/stash-prices/stash-grid.ts`)

- The Path of Exile 2 UI scales with the window height, and the stash panel is on the left. `GRID_LEFT`, `GRID_TOP`
  and `GRID_CELL` give a normal tab's grid as fractions of the height: at 1920 x 1080 its top left corner is at
  17, 126.5 and a cell is 52.5 pixels wide. **These are estimates**: the cell size and the left edge come from
  `docs/reference-images/DumpSortCurrency.jpg`, a 3840 x 2160 screenshot cropped without its top, and the top from
  aligning the HUD in it with the 1920 x 1080 screenshot `HoverImageStrip.jpg`. The in-game check measures them.
- A normal tab has 12 cells on a side and a quad tab 24, in the same area. `needsQuad(listings)` returns true when a
  listing reaches past the 12th column or row (`x + w` or `y + h` above 12).
- `stashGrid(view, quad, correction)` returns the grid (`left`, `top`, `cell`) in CSS pixels of the overlay, which
  covers the game window's client area, for a `Viewport` (the overlay's CSS size and its device pixel ratio). A
  `GridCorrection` adds `left`, `top` and `cell` (the cell of a normal tab) in pixels of the game window (`unit`
  `px`, divided by the device pixel ratio) or in percent of the window height (`%`). A value that is not a number
  counts as 0, and a cell stays at least 1 pixel wide.
- `frameMapping(frame, view)` returns where the overlay is in a captured frame: a windowed game's frame also has its
  title bar and borders, so the client area is centered across and at the bottom, and a frame smaller than the window
  scales it down. `gridInFrame()` and `scaleGrid()` move a grid into the frame and into a scaled copy of it.
- `sampleArea(frame, normal)` returns the part of the frame to read, from its top left corner to the far corner of
  the grid, and the scale that keeps a quad cell 16 pixels wide (`SAMPLE_CELL`), or 1 for a smaller frame.

## Invariants

- Main grants a capture and never reads a frame: the frames go to the page that asked, and main stores nothing.
- A capture that main granted runs until the page stops it. Turning the feature off refuses the next request only.
- Window capture shows the game window's own content, so the overlay window over it is not in the frames.

**Dependencies.** Electron's `session`, `desktopCapturer` and `WebFrameMain` (types only in `GameCapture.ts`), and
`Logger`. The grid reads the listings' places from the reader ([renderer-stash-prices.md](renderer-stash-prices.md)).

**Tests.** `main/specs/game-capture.test.ts` sends requests through a fake desktop on each platform, with the
feature off and on, from the overlay page, a web view, another frame and a frame that is gone, for audio and without
video, with no window of the title and with a list that fails, and reads the log lines.
`overlay-window.test.ts` checks `OverlayWindow.pageFrame` with and without the overlay window, and
`host-config.test.ts` checks that `stashCapture` and `windowTitle` reach `GameCapture.update()`.
`renderer/specs/web/stash-prices/stash-grid.test.ts` checks the grid at several window sizes, both tab kinds, each
correction unit, a frame of a borderless, a windowed and a scaled game, and the reference screenshot's cells.
