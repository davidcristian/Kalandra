# Map check and Item info are two hotkey rows for one setting

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/settings/hotkeys.vue](../../../../renderer/src/web/settings/hotkeys.vue)
**Verified:** 2026-10-18

Settings, Hotkeys has a Map check row and an Item info row. Both edit
`_configModelValue(itemCheckWidget, "hotkey")` in `hotkeys.vue`, so a key set in one shows in the
other. `getConfigForHost()` in `renderer/src/web/Config.ts` registers that key as one `copy-item`
action with the target `item-check`. `WidgetItemCheck.vue` shows Map check when `isMapLike` is true
and Item info for any other item.

The docs already describe the shared key: [docs/settings.md](../../../settings.md),
[docs/map-check.md](../../../map-check.md) and
[runbooks/in-game-check.md](../../runbooks/in-game-check.md#4-the-price-check-keys).

Done looks like: a decision by the maintainer. Either one row replaces the two, its label names both
uses as a new string in `renderer/public/data/en/app_i18n.json`, and docs/settings.md and
docs/map-check.md describe the one row. Or both rows stay, the reason goes into the History and the
task is declined.

## History

- 2026-10-18: Found while the in-game check runbook was written, by reading the hotkey list in
  `hotkeys.vue`.
- 2026-10-18: Checked against the tree. Removed the option to document the shared key, because
  docs/settings.md and docs/map-check.md already say the two rows set one key.
- 2026-10-27: The maintainer chose one row whose label names both uses.
