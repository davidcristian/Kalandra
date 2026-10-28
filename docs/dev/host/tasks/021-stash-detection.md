# Stash detection sees the open tab, and its grid and marks lie on the cells

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows, a premium stash tab and a few items to put in it
**Origin:** [docs/stash-prices.md](../../../stash-prices.md#how-kalandra-sees-the-open-tab)
**Verified:** 2026-10-28

**Claims.** The user page says that on Windows Kalandra captures the game window twice a second while the game is
active, sees the open tab within a second, keeps no capture, and that the hotkey marks the tab open or closed
everywhere. The code places the grid of a normal tab from estimates, at 17, 126.5 with 52.5 pixel cells at 1920 x 1080,
scaled with the window height (`stash-grid.ts`), and reads a cell as filled from a navy or red corner and as empty from
a dark gray one (`cell-classifier.ts`). Both come from screenshots, not from a run of the game
([stash-detection.md](../../modules/stash-detection.md)). Main's capture handler and the match on drawn frames are
tested, and a fake game window was captured in Electron 44 ([ADR-0013](../../adr/ADR-0013-game-capture.md)); the game
itself was not. While the tab is open the overlay draws a mark on each item from the same grid, a progress bar under it,
and with **Grid alignment view** every cell; the layer takes no click and keeps the overlay window shown while the game
is active ([renderer-stash-prices.md](../../modules/renderer-stash-prices.md)). Its place was computed, not seen.

**Do.** Run [section 8](../../runbooks/in-game-check.md#8-stash-detection-the-grid-and-the-marks) of the runbook at
1920 x 1080 and at one other resolution, with a normal tab and, if one is at hand, a quad tab, in Windowed Fullscreen
and in Windowed mode. **Pass.** The line and the marks follow the stash within a second, the grid and the marks match a
screenshot within 3 pixels, the bar covers no button you need, and a click on a mark reaches the game. **Record.** The
grid the tooltip names and the one the screenshot shows at each resolution, the percentages on the open tab, and
Kalandra's CPU use with the stash open and closed, in the History; a constant that is off becomes a refinement with
those numbers.

## History

- 2026-10-28: Filed with the detection of the open stash tab, whose grid and colors are estimates.
- 2026-10-28: Added the marks, the progress bar and the grid alignment view over the open tab.
