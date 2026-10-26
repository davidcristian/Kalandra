# Nine modules in main and the renderer have no spec that imports them

**Status:** open
**Area:** repo
**Origin:** [docs/dev/modules/main-tests.md](../../modules/main-tests.md)
**Verified:** 2026-10-25

No file in `main/specs/` or `renderer/specs/` imports these `.ts` files of `main/src/` and
`renderer/src/web/`. A `vi.mock` of a path does not count as an import. The share of lines is from
`npx vitest run --coverage` in each folder on 2026-10-25.

| Module | Lines covered | Why a spec of its own matters or not |
| --- | --- | --- |
| `main/src/main.ts` | 0% | The entry point. It creates every service at import and passes `CLIENT->MAIN::update-host-config` to them. `startup.test.ts` checks the startup order in `startup.ts`. A spec needs the passing of settings moved into a function that takes the services. It matters because `updateActions()` takes three booleans in a row and `updateOpts()` two strings, so `tsc` does not notice two of them swapped. |
| `main/src/vision/HeistGemFinder.ts` | 0% | Needs the OpenCV and Tesseract builds that the user installs in `apt-data/cv-ocr/`. The point grouping it calls in `vision/utils.ts` has `heist-points.test.ts`. Heist is not in Path of Exile 2, so whether to keep the Heist gem OCR is a decision for the maintainer before any test. |
| `main/src/vision/wasm-bindings.ts` | 4% | Loads the same builds and throws on every platform but Windows. Same decision as `HeistGemFinder.ts`. |
| `main/src/vision/worker-calls.ts` | 100% | `ocr-worker.test.ts` covers it through `OcrWorker`. No spec of its own is needed. |
| `main/src/host-files/utils.ts` | 100% | `GameConfig.test.ts` and `GameLogWatcher.test.ts` cover `guessFileLocation()` through their default paths. No spec of its own is needed. |
| `main/src/vision/wasm-types.ts` | no code | Types only. |
| `renderer/src/web/client-log/client-log-parser.ts` | 85.6% | `client-log.test.ts` covers it with `FullCampaign.txt`. The lines left name the skill point types other than Passive, Weapon Set and Abyss Atlas. Nothing reads `pointType` yet, so a test with copied log lines can wait until something does. |
| `renderer/src/web/item-search/widget.ts` | no code | A config type. `widget-registry.test.ts` checks the defaults. |
| `renderer/src/web/leveling/widget.ts` | no code | A config type. `widget-registry.test.ts` checks the defaults. |

One thing the new specs showed, not yet checked against the trade site:

- `createUncutGemFilters()` in `create-item-filters.ts` never runs. The parser gives a copied uncut
  gem the Currency category and no `gemLevel`, although the `UncutSkillGem` case in
  `renderer/specs/Parser/items.ts` expects level 19, and the price check searches it in the exchange
  by its trade tag, which names the level.

Done looks like: a spec for `main.ts` once its settings pass through a function, the maintainer's
decision on the Heist gem OCR, and a result for the point above: a `fix` commit with a test, or a
History line that says why the code stays.

## History

- 2026-10-25: Filed after specs were added for the tray, the overlay window, the OCR worker thread,
  the hotkey actions, the Mageblood preset, anointments, the result list wait, exchange searches,
  property filters, gems and the item check hotkeys. Before them, 8 main and 7 renderer web modules
  had no importing spec.
- 2026-10-26: `createTradeRequest` sends each Legacy filter of a Mageblood once in the `and` group,
  and `mageblood.test.ts` checks it.
- 2026-10-26: `poeprices.ts` left the table when the price prediction was removed, so the title
  names nine modules.
