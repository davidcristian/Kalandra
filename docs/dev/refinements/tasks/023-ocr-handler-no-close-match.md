# The OCR handler throws when no gem name has a close length

**Status:** done 2026-10-26
**Area:** renderer
**Origin:** [renderer/src/web/item-search/WidgetItemSearch.vue](../../../../renderer/src/web/item-search/WidgetItemSearch.vue)
**Verified:** 2026-10-26

`fuzzyFindHeistGem()` in `WidgetItemSearch.vue` compares the text OCR read with each gem name plus
the prefix `Anomalous`, `Divergent` or `Phantasmal`. It skips a candidate whose length differs from
the text by more than 5 characters. When it skips every candidate, `bestMatch` is never set, and
`return bestMatch!` returns `undefined`. The `MAIN->CLIENT::ocr-text` handler then reads `res.name`
and throws a `TypeError`, so the lines after it in the same OCR result are not handled either. A
short or garbled OCR line causes this.

Done looks like: `fuzzyFindHeistGem()` returns `undefined` with a type that says so, the handler
skips that line, and a test covers a line with no close candidate. If the maintainer removes OCR
([031](031-path-of-exile-1-features.md)), this task closes with it.

## History

- 2026-10-18: Found while docs/ocr-guide.md was rewritten, by reading `fuzzyFindHeistGem()` and the
  `ocr-text` handler.
- 2026-10-26: Done. The maintainer chose to remove the Heist gem OCR
  ([031](031-path-of-exile-1-features.md)), and `fuzzyFindHeistGem()` and the
  `MAIN->CLIENT::ocr-text` handler were removed with it.
