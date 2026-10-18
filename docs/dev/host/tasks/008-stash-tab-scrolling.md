# Ctrl and the mouse wheel switch stash tabs

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/faq.md](../../../faq.md)
**Verified:** 2026-10-18

**Claims.** With Stash tab scrolling on (the default, Ctrl + MouseWheel), main presses ArrowRight
or ArrowLeft for each wheel step while the game window is active and the cursor is outside the
stash grid. Over the grid it presses nothing. `isStashArea` in `main/src/shortcuts/Shortcuts.ts`
takes the grid as the left part of the window up to `uiSidebarWidth` (370/600 of the window
height), between 154/1600 and 1192/1600 of the window height. [docs/faq.md](../../../faq.md),
[docs/quick-start.md](../../../quick-start.md), [docs/features.md](../../../features.md),
[docs/settings.md](../../../settings.md) and [modules/main.md](../../modules/main.md) say:

- The arrow keys move the stash one tab per wheel step.
- The game also zooms the camera on the mouse wheel, so **Mousewheel Zoom** must be off, in the
  **UI** tab of the game's options. The app's tip `tip_23` says the same.
- The camera zoom key bindings, Control + Page Up and Control + Page Down, still work. The FAQ page
  shows the option in `mousewheel-zoom.png` and the bindings in `zoom-keybinds.png`. Nothing in the
  repo says which game those two screenshots show.

**Do.** [Section 6 of the runbook](../../runbooks/in-game-check.md#6-stash-tab-scrolling), at two
window sizes, so the grid area is checked at more than one resolution. Then find the option and the
bindings in the game.

**Pass.** One tab per wheel step outside the grid, nothing over it, and the option, its tab and the
bindings exist with these names.

**Record.** The option and binding names exactly as the game writes them. If the screenshots show
Path of Exile 1, take new ones ([017](017-game-screenshots.md)).

## History

- 2026-10-18: Filed from the stash scrolling claims that the code supports only up to the key
  presses.
