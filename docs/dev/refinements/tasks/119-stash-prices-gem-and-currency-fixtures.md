# No saved fetch result of a gem or a currency stack tests the stash prices converter

**Status:** open
**Area:** trade
**Origin:** [renderer/specs/web/stash-prices/item-text.test.ts](../../../../renderer/specs/web/stash-prices/item-text.test.ts)
**Verified:** 2026-10-28

`listingItemText()` writes `Rarity: Gem` and `Rarity: Currency` with the `Stack Size` property, but
`renderer/specs/docs/fetchResponses.json` and `fetchResponses2.json` hold no gem, no uncut gem and
no currency stack above 1. `item-text.test.ts` checks these lines only through a rune taken from a
socket, and `stash-pricer.test.ts` prices a stack from the price file fixture with a listing built
by the test.

Done looks like: the fetch responses that step 3 of [host task
021](../../host/tasks/021-stash-detection.md) saves, added under `renderer/specs/docs/` with the
account and character names replaced, and cases in `item-text.test.ts` and `stash-pricer.test.ts`
that read and price a gem, an uncut gem and a currency stack from them.

## History

- 2026-10-28: Left for later by the stash prices pricer, since no such fetch result was saved.
