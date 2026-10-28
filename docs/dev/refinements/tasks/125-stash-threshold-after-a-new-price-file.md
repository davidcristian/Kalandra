# The trash threshold keeps an old currency price while the exchange rate stays the same

**Status:** done 2026-10-28
**Area:** renderer
**Origin:** [renderer/src/web/stash-prices/use-stash-highlights.ts](../../../../renderer/src/web/stash-prices/use-stash-highlights.ts)
**Verified:** 2026-10-28

`useStashHighlights()` computes the threshold with `findPriceByQuery()`, which is not reactive, and
reads `xchgRate` so that the computed value runs again when a price file loads. `xchgRate` is a
`shallowRef` in `renderer/src/web/background/Prices.ts`, which changes only when the rate changes,
so a new price file with the same Divine Orb rate keeps the Chaos Orb or Exalted Orb price of the
earlier file until the rate or the threshold setting changes.

Done looks like: `usePoeninja()` exposes a value that changes on each load, such as the load time,
the threshold reads it, and a test loads two price files with the same rate and different Chaos Orb
prices.

## History

- 2026-10-28: Left for later by the stash marks, whose threshold follows the exchange rate.
- 2026-10-28: Became "fix(renderer): convert the trash threshold again after each price file".
