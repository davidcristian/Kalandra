# Decide whether the Path of Exile 1 features stay

**Status:** open
**Area:** renderer
**Origin:** [docs/extra-widgets.md](../../../extra-widgets.md)
**Verified:** 2026-10-18

Three features target Path of Exile 1 content. The user pages already describe them as they work
now.

- **The OCR key** of the Item search widget, "Perform an OCR for a Skill Gem". `HeistGemFinder` in
  `main/src/vision/HeistGemFinder.ts` looks for two copies of the Heist lock icon
  (`heist-lock.bmp` from the `cv-ocr` files) on one line and reads the text between them.
  `fuzzyFindHeistGem()` in `renderer/src/web/item-search/WidgetItemSearch.vue` compares that text
  with each gem name after the prefix `Anomalous`, `Divergent` or `Phantasmal`
  (`QUALITY_ANOMALOUS` and the others in `client_strings.js`).
  `grep -c "Anomalous\|Divergent\|Phantasmal" renderer/public/data/en/items.ndjson` prints `0`.
- **The Delve grid**, the "Grid for Delve Chart" hotkey: `WidgetDelveGrid.vue` draws 11 by 9 cells
  over the game window, sized for the Path of Exile 1 Delve chart.
- **The default image strip** opens `renderer/public/images/syndicate.jpg` (`initInstance()` in
  `renderer/src/web/overlay/WidgetImageStrip.vue`), a Path of Exile 1 Betrayal syndicate cheat
  sheet marked `3.24 Version`.

This is a decision for the maintainer. For each feature: keep it, replace it with a Path of Exile 2
equivalent, or remove it. [Host task 010](../../host/tasks/010-ocr-and-delve-grid.md) checks in the
game whether the OCR key or the grid matches anything Path of Exile 2 shows. Removing a widget or a
default image changes the config and follows the hard rule in
[AGENTS.md](../../../../AGENTS.md#the-one-hard-rule). Removing OCR also removes
[docs/ocr-guide.md](../../../ocr-guide.md), its sidebar entry in `docs/.vitepress/config.js`, the
`ocr-text` action, and closes [010](010-ocr-errors-dropped.md) and
[023](023-ocr-handler-no-close-match.md). Each removal is its own commit.

## History

- 2026-10-18: Found while docs/extra-widgets.md, docs/ocr-guide.md and docs/settings.md were
  rewritten, by reading the three features' code and viewing `syndicate.jpg`.
- 2026-10-18: Checked against the tree. Removed the note on `cheatSheetSynd.png`, which this docs
  change deletes from `docs/reference-images/`.
