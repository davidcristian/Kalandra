# The price label on a quad tab and the stash progress bar are not fitted to the game

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/stash-prices/StashHighlights.vue](../../../../renderer/src/web/stash-prices/StashHighlights.vue)
**Verified:** 2026-10-28

`StashHighlights.vue` sets the text at 0.28 of a normal tab's cell (`FONT_CELLS`), and at least 10
pixels. A quad tab's cells are half as wide, so the price of a 1 x 1 item there is wider than its
cell and covers the items beside it. `highlightView()` in `highlight-marks.ts` places the progress
bar under the grid, 0.1 of a cell below it, and nobody has checked what the game shows there.

Done looks like: after step 6 of [host task 021](../../host/tasks/021-stash-detection.md), a label
that fits its item's width on a quad tab, such as a smaller font for a narrow item, and the bar
moved if it covers a button the user needs, with tests in `highlight-marks.test.ts` and
`stash-highlights.test.ts`.

## History

- 2026-10-28: Left for later by the stash marks, whose sizes were computed, not seen in the game.
