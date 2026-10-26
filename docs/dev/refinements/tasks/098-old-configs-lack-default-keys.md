# Saved configs of versions 2 to 21 upgrade without some keys of defaultConfig()

**Status:** open
**Area:** config
**Origin:** [renderer/specs/web/config-upgrade.test.ts](../../../../renderer/specs/web/config-upgrade.test.ts)
**Verified:** 2026-10-26

`upgradeConfig()` in `renderer/src/web/Config.ts` adds a key only in the step of the version
that added it, so a key that entered the defaults without a step is missing from older configs:

- Awakened PoE Trade added `language`, `restoreClipboard`, `clientLog`, `gameConfig`,
  `craftOfExileKey` and `delveGridKey` to its top-level defaults in 2020 and 2021 without a new
  version (`src/ipc/types.ts` in its history). A config of version 2, from June 2020, upgrades
  without the first four. The `< 14` and `< 16` steps copy the other two into the item check
  `craftOfExileKey` and the Delve grid `toggleKey` as `undefined`, so those are missing too.
  Without `language`, `renderer/src/main.ts` passes `undefined` to `I18n.init()` and
  `Data.init()`.
- The `< 15` step sets the item search `ocrGemsKey`, but `defaultConfig()` of versions 15 to 21
  has none. A new install of those versions, which includes Awakened PoE Trade's last release and
  Exiled Exchange 2 before v0.7.0, upgrades without it. `shortcutActions()` reads it only as true
  or false, so the missing key acts as `null`.

`KEYS_NO_STEP_ADDS` in the spec lists these keys for the fixtures of versions 2 and 16 in
`renderer/specs/saved-configs/`. A step never changes
([ADR-0003](../../adr/ADR-0003-config-survives-updates.md)), so a fix is a new step.

Done looks like: a new step that sets each missing key to its value in `defaultConfig()` when it
is `undefined`, and an empty `KEYS_NO_STEP_ADDS`. Users of Exiled Exchange 2 saved version 16 or
later, and [docs/download.md](../../../download.md) tells Awakened PoE Trade users to copy their
`apt-data`, so the `language` case needs a config from 2020 that was never upgraded since.

## History

- 2026-10-26: Found by the config upgrade spec, which compares each upgraded fixture with
  `defaultConfig()`. The fixtures are new installs built from the defaults at the commits of
  each version.
