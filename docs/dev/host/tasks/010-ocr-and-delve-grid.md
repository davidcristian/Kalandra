# Whether OCR and the Delve grid match anything Path of Exile 2 shows

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/ocr-guide.md](../../../ocr-guide.md)
**Verified:** 2026-10-18

**Claims.** Both features target Path of Exile 1 content
([refinement 031](../../refinements/tasks/031-path-of-exile-1-features.md)). This check gives the
maintainer the facts for that decision.

- **OCR.** `HeistGemFinder` in `main/src/vision/HeistGemFinder.ts` looks in a screenshot of the
  game window for two copies of the Heist lock icon (`heist-lock.bmp`) on one line and reads the
  text between them. [docs/ocr-guide.md](../../../ocr-guide.md) asks for both icons to be fully
  visible and for nothing to cover a gem name. OCR runs on Windows only, for the app languages
  English and Russian.
- **The match.** `fuzzyFindHeistGem()` in `renderer/src/web/item-search/WidgetItemSearch.vue`
  compares that text only with gem names after the prefix `Anomalous`, `Divergent` or
  `Phantasmal`. No item in the Path of Exile 2 data has one, so the Item search widget cannot list
  a Path of Exile 2 gem from OCR.
  [Refinement 023](../../refinements/tasks/023-ocr-handler-no-close-match.md) covers the error it
  throws instead.
- **The Delve grid.** "Grid for Delve Chart" in Settings, Hotkeys has no default key. It shows 11 by
  9 cells in a box whose size follows the window height (`WidgetDelveGrid.vue`), drawn for the Path
  of Exile 1 Delve chart.

**Do.** Look for a Path of Exile 2 screen that shows gem names between two lock icons. If one
exists, press the OCR key on it as
[section 7 of the runbook](../../runbooks/in-game-check.md#7-ocr-of-skill-gem-names) says. Then set
a key for Grid for Delve Chart and press it in the game.

**Pass.** The name of a screen that shows gem names between two lock icons, or a note that no such
screen exists. For the grid, whether it lines up with anything the game shows. Either result closes
this task.

**Record.** The result in the History of
[refinement 031](../../refinements/tasks/031-path-of-exile-1-features.md), in the same commit as this
file's History line.

## History

- 2026-10-18: Filed from the OCR guide rewrite, which found that the feature matches only Path of
  Exile 1 gem names.
- 2026-10-18: Checked against the code. The pass no longer expects the widget to list gems, because
  `fuzzyFindHeistGem()` compares only with names that have one of the three prefixes.
