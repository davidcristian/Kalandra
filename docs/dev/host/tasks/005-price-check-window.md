# The price check window opens, stays and closes as the pages say

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/price-check.md](../../../price-check.md)
**Verified:** 2026-10-18

**Claims.** [docs/price-check.md](../../../price-check.md), [docs/quick-start.md](../../../quick-start.md),
[docs/settings.md](../../../settings.md) and
[modules/renderer-price-check.md](../../modules/renderer-price-check.md) say:

- Auto-hide Mode (Ctrl + D): hold Ctrl and move the cursor into the window, and the window takes
  focus. Release Ctrl and move the cursor away from the item, and the window closes
  (`main/src/windowing/WidgetAreaTracker.ts`). Leaving the window returns focus to the game and
  closes it.
- docs/settings.md also says a click on the window gives it focus. Main does give focus on a click
  inside the window (`handleMouseDown`). But with Ctrl up, it closes the window as soon as the
  cursor is more than 2.5 times the font size from the item: 40 px at the default font size of 16
  (`closeThreshold` in `PriceCheckWindow.vue`).
- Open without auto-hide (Ctrl + Alt + D): the window opens with focus and stays until Escape or a
  return to the game.
- The window opens beside the game's side panel on the side of the item and does not cover that
  panel. Its position comes from `poePanelWidth` in `OverlayWindow.vue`, 986/1600 of the window
  height.
- **Tier 1** and **Tier 2** labels show on modifier filters by default, and Always show tier shows
  every tier (`FilterModifierTiers.vue`). The code highlights tiers 1 and 2 as the best, which is
  the Path of Exile 1 order. `app_i18n.json` also holds unused strings for a tier numbering setting
  that call the Path of Exile 2 order "higher is better".

**Do.** [Section 4 of the runbook](../../runbooks/in-game-check.md#4-the-price-check-keys), with the
cursor on items at the left and the right of the screen, at two resolutions. After Ctrl + D,
release Ctrl, move the cursor to the window and click it. Price check a rare item whose advanced
description shows tier numbers.

**Pass.** Each claim holds, and the window never covers the open side panel.

**Record.** The resolutions used, what a click on the window does, and which tier number the game
gives the modifier with the highest value range. A difference goes into the page that states it, in
the same commit as this file's History line.

## History

- 2026-10-18: Filed from the claims the writers of the price check pages could not settle without
  the overlay over the game.
