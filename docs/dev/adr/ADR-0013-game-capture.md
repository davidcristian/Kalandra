# ADR-0013: Kalandra captures the game window only to see the open stash tab, and keeps no frame

**Status:** Accepted (2026-10-28)

## Context

The stash prices feature ([ADR-0012](ADR-0012-background-trade-searches.md)) prices the items of one public stash
tab, and marks them while the user has that tab open in the game. The game tells no other program which panel or tab
it shows: `Client.txt` has no line for opening the stash or for changing tabs. What remains is the user, through a
key, and the pixels of the game window.

A capture of the game window shows everything the game shows, such as the chat with the names of other players. So
what is captured, when, how often, and what happens to the pixels must be fixed, and a review must find every place
that captures. Kalandra reads the pixels of no other window and of no screen.

The stash tab itself makes a check without text recognition possible. Every cell under an item has a navy
background, or a red one for an item the character cannot use, and an empty cell is a dark gray clover
(`docs/reference-images/DumpSortCurrency.jpg`). The listings from the trade site give the cells of the tab that hold
the items Kalandra read, so the open tab is the one whose filled and empty cells match that layout.

## Decision

**1. Only stash detection captures, on Windows, while the user turned it on.** `GameCapture` in
`main/src/windowing/GameCapture.ts` handles each `getDisplayMedia()` request of the default session. It grants one
only on Windows, only while the stash prices widget and its **Find the open tab in the game window** setting are on
(`stashCapture` in `HostConfig`), and only to the main frame of the overlay window's page, and denies every other
request, such as one from the trade site's web view or a browser tab. Reason: the user decides, and no page but
Kalandra's own sees the game.

**2. The game window alone.** Main grants the window that `desktopCapturer.getSources()` lists under the window title
setting, the title `electron-overlay-window` attaches to, which does not expose the window's handle. A window capture
shows the window's own content, so the overlay window over it, with Kalandra's own marks, is not in the frames.
Reason: the smallest capture that shows whether the tab is open, and frames that the marks cannot change.

**3. Only while a frame can change the result, 2 frames a second.** The page asks for the capture only in the overlay
window (`Host.isElectron`), while the game window is active and the tab's listings fill at least 3 cells, and stops
it otherwise. It asks for video alone at 2 frames per second and reads one frame every 500 ms. Reason: the stash
opens and closes at the speed of a hand, and a capture of an inactive game or of an empty tab changes nothing.

**4. The frames stay in memory, and only the match leaves.** The page draws the newest frame's part up to the far
corner of the stash grid onto a canvas, reads 4 pixels near the corners of each cell, and keeps the shares of cells
that match and whether the tab is open. No frame is stored, logged or sent to main or to any host, and main never
reads one. Reason: the pixels can show other players' names and anything else on the screen.

**5. It reads, and never acts.** Kalandra never presses a key or clicks to open the stash, to change tabs or to
check what it saw. Reason: detection only needs to look, and an input the user did not make could break the game's
rules on automation.

**6. Windows first, a hotkey everywhere.** Linux and macOS have no capture: under Wayland a window capture goes
through the desktop portal, which shows its own picker, and macOS asks for the screen recording permission, and no one
has checked either with the game. A `trigger-event` hotkey marks the tab open or closed on every platform, and on
Windows it changes what the capture saw until the capture sees the tab open or close. Reason: the feature works
without a capture, and a capture on another platform needs its own check first.

## Consequences

- The user page `docs/stash-prices.md` says what is captured, when, and that nothing is kept.
- The grid's place and the colors are estimates until the in-game check measures them
  ([stash-detection.md](../modules/stash-detection.md), [in-game-check.md](../runbooks/in-game-check.md)). The user
  can correct the grid in the settings.
- Items that the reader has not read yet, and items with a price, count against the match, since the layout comes
  from the trade site. A tab whose listings fill fewer than 3 cells is never seen by the capture.
- A capture that main granted runs until the page stops it; turning the feature off denies the next request.
- On 2026-10-28, on Windows 11 with Electron 44.9.3, a fake game window that drew the stash colors was captured this
  way: `getDisplayMedia()` resolved without a user gesture, a translucent window over the stash was not in the frames,
  and drawing and reading the grid's part of a 1920 x 1080 frame took 1 to 3 ms in the page. To measure it again in
  a dev run, time `read()` of the `FrameSource` that `openGameCapture()` returns with `performance.now()`.

## Alternatives rejected

- **Main calls `desktopCapturer.getSources()` with thumbnails on a timer.** Each call captures every window to make
  its thumbnails, not the game alone.
- **`OverlayController.screenshot()` of `electron-overlay-window`.** It copies the screen under the game window,
  overlay included, so the marks would change the frames, and it blocks main's thread for each copy.
- **Reading the tab's name with text recognition.** It needs a recognizer and its data for every game language, and
  the cell layout needs neither.
- **The hotkey alone on Windows.** It works, but the user would press it each time the stash opens and closes.

## Related

- [Stash detection module](../modules/stash-detection.md): the handler, the grid, the classifier, the match and the
  capture loop, and their tests.
- [Stash prices module](../modules/renderer-stash-prices.md) and [ADR-0012](ADR-0012-background-trade-searches.md):
  the listings the match compares with.
- [ADR-0004](ADR-0004-process-boundary.md): only main reaches the operating system, so main grants the capture.
