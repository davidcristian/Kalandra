# The stash grid's place is a fixed estimate that only the user corrects

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/stash-prices/stash-grid.ts](../../../../renderer/src/web/stash-prices/stash-grid.ts)
**Verified:** 2026-10-28

`GRID_LEFT`, `GRID_TOP` and `GRID_CELL` in `stash-grid.ts` place the grid of a normal tab from
screenshots at 16:9. A user at another aspect ratio or UI scale, or with a grid a few pixels off,
sets the **Grid correction** by hand with the **Grid alignment view**. A grid off by half a cell
matches no frame (`tab-match.test.ts`), so the capture never sees the tab until the user corrects
it.

Done looks like: first the numbers that [host task 021](../../host/tasks/021-stash-detection.md)
measures. Then, while a capture runs with listings and no frame matches, the detector tries offsets
and cell sizes around the estimate on the same frame and keeps the best layout at or above
`MIN_AGREEMENT`, within a cost per frame the task measures. A decision for the maintainer: whether
the correction found is saved in the config, which is a config change under the one hard rule, or
kept for the session.

## History

- 2026-10-28: Left for later by the stash detection, which places the grid from estimates.
