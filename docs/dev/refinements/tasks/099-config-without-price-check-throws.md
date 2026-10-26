# A saved config without a price check widget stops the overlay from starting

**Status:** open
**Area:** config
**Origin:** [renderer/specs/web/config-upgrade.test.ts](../../../../renderer/specs/web/config-upgrade.test.ts)
**Verified:** 2026-10-26

The code between the `< 21` and `< 22` steps of `upgradeConfig()` in `renderer/src/web/Config.ts`
runs on every load and reads `rememberCurrency` of the price check widget without checking that
the widget exists. A saved config without one throws a `TypeError` at any version, and an older
one throws earlier, in the first step that reads that widget. `initConfig()` passes the error on,
so `renderer/src/main.ts` shows the start error until the user edits or deletes `config.json`.
Steps also read the menu, item check, item search, settings, Delve grid and library widgets
without a check.

The price check window has no remove control, since it does not use `overlay/Widget.vue`, so only
a file edited by hand or damaged lacks the widget. The spec expects the `TypeError` for the saved
configs in `renderer/specs/saved-configs/` and for a current one.

Done looks like: a decision on how to load such a file. A step never changes
([ADR-0003](../../adr/ADR-0003-config-survives-updates.md)), so a fix is code that runs before
`upgradeConfig()`, such as `initConfig()` adding each missing single instance widget from
`defaultConfig()`, or a start error that names the file and the missing widget. The spec's
`TypeError` case then checks the new result.

## History

- 2026-10-26: Found by the config upgrade spec, which removes the price check widget from each
  saved config and from `defaultConfig()`.
