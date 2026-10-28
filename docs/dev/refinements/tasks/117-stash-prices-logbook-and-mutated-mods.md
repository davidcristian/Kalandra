# Stash prices cannot read an Expedition Logbook or an item with mutated modifiers

**Status:** open
**Area:** trade
**Origin:** [renderer/src/web/stash-prices/item-text.ts](../../../../renderer/src/web/stash-prices/item-text.ts)
**Verified:** 2026-10-28

`listingItem()` returns `UNREADABLE` for a fetch result with `logbookMods` or `mutatedMods`
(`UNWRITTEN_FIELDS` in `item-text.ts`), because `listingItemText()` does not write those lines, and
an item read without them would get the price of another item. `item-text.test.ts` checks the saved
Logbook, but no saved fetch result has `mutatedMods`, so that branch has no test with real data.

Done looks like: the converter writes the logbook's lines and the mutated modifier lines as the game
copies them, checked against copied item text under `renderer/specs/Parser/` (a copied logbook is
also what [refinement 109](109-expedition-logbook-parser-case.md) needs) and against a saved fetch
result of each.

## History

- 2026-10-28: Left for later by the stash prices pricer, which counts these items as unreadable.
