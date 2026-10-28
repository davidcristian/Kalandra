# Decide whether the stash marks stay while Alt is held

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/overlay/OverlayWindow.vue](../../../../renderer/src/web/overlay/OverlayWindow.vue)
**Verified:** 2026-10-28

`OverlayWindow.vue` hides the stash layer while `hideUI` is set, which follows main's visibility
event while Alt alone is held (`main/src/windowing/OverlayVisibility.ts`), as it hides every widget.
In the game, Alt also shows the advanced item descriptions, so a user who reads an item's modifiers
next to its mark loses the mark.

Done looks like: a decision for the maintainer after step 6 of [host task
021](../../host/tasks/021-stash-detection.md): keep it, or add a setting on the Stash prices page
that keeps the layer while Alt is held, which is a config change under the one hard rule, with a
test.

## History

- 2026-10-28: Left for later by the stash marks, which hide with the rest of the overlay.
