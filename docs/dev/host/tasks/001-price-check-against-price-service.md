# A price check in the game matches the price files at kalandra.ashoal.com

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [ADR-0006](../../adr/ADR-0006-own-price-service.md)
**Verified:** 2026-10-18

**Claims.** The app's price estimates come from Kalandra's own price service. `load()` in
`renderer/src/web/background/Prices.ts` requests `kalandra.ashoal.com/prices/<file>` through main's
`/proxy` route. Both test suites read `priceService/tests/fixtures/price_file.json`, so the tests
show that the service and the app read the same format. No price check in the game has used a live
file yet.

`load()` requests the file only for a league on the International realm (`realm === "pc-ggg"`)
whose `isPopular` is true. The realm is International by default, and Settings, General shows
Realm only for the language `cmn-Hant`. `useLeagues` in `Leagues.ts` sets `isPopular` for each
league the trade site lists, except a private league: an id that ends with `(PL<number>)` or
contains `Ruthless`.

**Do.** Set up as [Before you start](../../runbooks/in-game-check.md#before-you-start) says, then:

1. In Settings, Price check, choose a league that
   `https://kalandra.ashoal.com/prices/index.json` lists under `leagues`.
2. With Ctrl + D, price check a currency item, such as a Chaos Orb, a unique, and a unique
   flask, such as Olroth's Resolve
   ([section 4 of the runbook](../../runbooks/in-game-check.md#4-the-price-check-keys)).
3. Open the league's file in a browser: the `file` next to the league's `id` in `index.json`. Find
   each item by `name`, and a unique also by `variant`.
4. Repeat steps 1 to 3 with a hardcore league. Its file name is the league id in lower case with
   every character other than `a-z` and `0-9` removed (`leagueFileName` in `price-source.ts`), so
   `HC Runes of Aldur` reads `hcrunesofaldur.json`.
5. Price check a boss fragment, such as a Primary Calamity Fragment.

**Pass.** The window shows an estimate for each item. The estimate is the item's `primaryValue`,
which the file holds in divine orbs, times the rate in `core.rates` for the currency the window
shows. When the window shows divine orbs, the estimate is `primaryValue` itself. For the boss
fragment, a panel beside the window lists the items that `renderer/public/data/item-drop.json`
gives for it, each with its estimate when the file lists it.

**Record.** The build, the leagues, and each item with the estimate shown and its line in the file.
A wrong value is a bug: file a refinement with the item, the estimate and the line. When no
estimate shows, read the developer tools console for `No price file for <league> (<status>)`, which
reaches only the console ([refinement 013](../../refinements/tasks/013-renderer-errors-not-in-debug.md)).
A dev run opens the developer tools at start, and [003](003-overlay-key-and-focus.md) checks
whether Ctrl + Shift + I opens them in a packaged build. Settings, Debug shows
`error [proxy] <message> (kalandra.ashoal.com)` when main cannot reach the host.

## History

- 2026-10-18: Filed when the user docs and the developer docs were written: the price service
  replaced poe.ninja as the app's price source, and no in-game check of it has run.
- 2026-10-19: Added a unique flask to step 2. The price check finds a unique flask by its base
  item, as it does every other unique.
