# Whether the Delve grid matches anything Path of Exile 2 shows

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/extra-widgets.md](../../../extra-widgets.md)
**Verified:** 2026-10-26

**Claims.** The Delve grid targets Path of Exile 1 content, and the maintainer chose to remove it
([refinement 031](../../refinements/tasks/031-path-of-exile-1-features.md)). Until that commit, this
check records whether the grid matches anything Path of Exile 2 shows.

- **The Delve grid.** "Grid for Delve Chart" in Settings, Hotkeys has no default key. It shows 11 by
  9 cells in a box whose size follows the window height (`WidgetDelveGrid.vue`), drawn for the Path
  of Exile 1 Delve chart.

**Do.** Set a key for Grid for Delve Chart and press it in the game.

**Pass.** Whether the grid lines up with anything the game shows. Either result closes this task.

**Record.** The result in the History of
[refinement 031](../../refinements/tasks/031-path-of-exile-1-features.md), in the same commit as this
file's History line.

## History

- 2026-10-18: Filed from the OCR guide rewrite, which found that the feature matches only Path of
  Exile 1 gem names.
- 2026-10-18: Checked against the code. The pass no longer expects the widget to list gems, because
  `fuzzyFindHeistGem()` compares only with names that have one of the three prefixes.
- 2026-10-26: The OCR claims left this task when the Heist gem OCR was removed
  ([refinement 031](../../refinements/tasks/031-path-of-exile-1-features.md)), so it checks only the
  Delve grid. The Origin links docs/extra-widgets.md, since docs/ocr-guide.md is gone.
