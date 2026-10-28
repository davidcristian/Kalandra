# Stash detection: finding the open stash tab in the game

**Purpose.** The stash prices feature ([renderer-stash-prices.md](renderer-stash-prices.md)) marks the items of one
stash tab while the user has that tab open in the game. On Windows the overlay page finds that out from a capture of
the game window, which only main can grant ([ADR-0004](../adr/ADR-0004-process-boundary.md)). This document covers
the capture handler in main, and the grid, the cells and the match in the renderer.

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

### The cells and the match (`cell-classifier.ts`, `tab-match.ts`)

- In the game, a cell under an item has a navy background, or a red one for an item the character cannot use, and an
  empty cell is dark gray with a lighter clover in its middle. Item art covers the middle of a cell, so
  `classifyCells(image, grid, side)` reads four pixels of each cell, at `CORNER_INSET` (a tenth of the cell) from its
  corners, of a `PixelImage` (RGBA rows, as `ImageData`).
- `pixelKind(r, g, b)` returns `item` for blue at least 18 above red and green, or red at least 25 above green and
  blue; `empty` for a pixel no brighter than 40 whose channels differ by at most 10; and `other` for the rest, such as
  a grid line, item art or a bright scene. The thresholds fit the reference screenshot, whose navy is about
  (4, 4, 42), red (60, 4, 5) and empty corner (8, 8, 8), and its navy after a window capture, (3, 6, 40). They are
  **estimates for other screens**: a brightness setting or an HDR screen is not checked. A pixel outside the image is
  `other`.
- `cellState(kinds)` returns `filled` for two `item` pixels or more, `empty` for three `empty` pixels and no `item`
  one, and `unknown` otherwise.
- `expectedCells(listings, side)` marks the cells under each listing (`x`, `y`, `w`, `h`), and
  `compareLayout(states, expected)` returns `itemCells` (the cells under the listings), `items` (their share that is
  `filled`) and `cells` (the share of all cells that is `filled` under a listing and `empty` elsewhere).
- `showsTab(match)` holds for at least 3 item cells (`MIN_ITEM_CELLS`) and at least 90% (`MIN_AGREEMENT`) of `items`
  and of `cells`. The item share keeps a mostly empty tab or a dark scene from matching a tab with few items, and the
  cell share keeps another tab with items in the same places from matching. Items the listings do not have yet, such as
  new items before the next check of the tab, count against `cells`: 14 such cells of a normal tab still match.
- `matchTab(image, gridOf, listings)` compares the image as a quad tab, and also as a normal tab when the listings fit
  one (`needsQuad()`), and returns the layout that shows the tab, or else the one with the higher `cells`, with
  `quad` and `seen`.

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
`cell-classifier.test.ts` reads the colors of a tab and the corner samples of all 144 cells of the reference
screenshot (`reference-cells.ts`), and classifies drawn tabs. `SyntheticFrame` in `synthetic-stash.ts` draws them from
the reference colors: navy and red items with art in their middle, clover in the empty cells, grid lines, noise on
every pixel, over a scene of random colors. `tab-match.test.ts` matches a drawn tab, the same tab with 10 and 20 new
items, a scene, a dark scene, an empty tab, another tab, a grid off by half a cell, quad tabs and too few items.
