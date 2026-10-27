# Five modules in main and the renderer have no spec that imports them

**Status:** open
**Area:** repo
**Origin:** [docs/dev/modules/main-tests.md](../../modules/main-tests.md)
**Verified:** 2026-10-26

No file in `main/specs/` or `renderer/specs/` imports these `.ts` files of `main/src/` and
`renderer/src/web/`. A `vi.mock` of a path does not count as an import. The share of lines is from
`npx vitest run --coverage` in each folder on 2026-10-25.

| Module | Lines covered | Why a spec of its own matters or not |
| --- | --- | --- |
| `main/src/main.ts` | 0% | The entry point. It creates every service at import. `startup.test.ts` checks the startup order in `startup.ts`, and `host-config.test.ts` checks `passHostConfig()` in `host-config.ts`, which passes each `HostConfig` field to the service that uses it. `updateActions()` and `updateOpts()` read their fields by name, so `tsc` fails on two swapped. The rest of `main.ts` creates the Electron objects, which a spec would replace with fakes. |
| `main/src/host-files/utils.ts` | 100% | `GameConfig.test.ts` and `GameLogWatcher.test.ts` cover `guessFileLocation()` through their default paths. No spec of its own is needed. |
| `renderer/src/web/client-log/client-log-parser.ts` | 85.6% | `client-log.test.ts` covers it with `FullCampaign.txt`. The lines left name the skill point types other than Passive, Weapon Set and Abyss Atlas. Nothing reads `pointType` yet, so a test with copied log lines can wait until something does. |
| `renderer/src/web/item-search/widget.ts` | no code | A config type. `widget-registry.test.ts` checks the defaults. |
| `renderer/src/web/leveling/widget.ts` | no code | A config type. `widget-registry.test.ts` checks the defaults. |

One thing the new specs showed, not yet checked against the trade site:

- `createUncutGemFilters()` in `create-item-filters.ts` never runs. The parser gives a copied uncut
  gem the Currency category and no `gemLevel`, although the `UncutSkillGem` case in
  `renderer/specs/Parser/items.ts` expects level 19, and the price check searches it in the exchange
  by its trade tag, which names the level.

Done looks like: a spec for `main.ts` once its settings pass through a function, and a result for
the point above: a `fix` commit with a test, or a
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
- 2026-10-26: The four `vision/` modules left the table when the Heist gem OCR was removed
  ([031](031-path-of-exile-1-features.md)), so the title names five modules.
- 2026-10-27: The settings of `CLIENT->MAIN::update-host-config` pass through `passHostConfig()`,
  which `host-config.test.ts` checks with fakes.
