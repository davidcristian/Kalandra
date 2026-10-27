# An older Kalandra uses a config written by a newer version without a check

**Status:** done 2026-10-27
**Area:** config
**Origin:** [renderer/src/web/Config.ts](../../../../renderer/src/web/Config.ts)
**Verified:** 2026-10-27

`upgradeConfig()` runs every step whose number is above the stored `configVersion`. A user can
install an older version over a newer one that added upgrade steps. The stored `configVersion` is
then above `defaultConfig().configVersion` (35 on 2026-10-18), so no step runs and the older app
uses the config as it is, with fields and values it does not know. Nothing compares the two
numbers.

`initConfig()` shows no message for this case. `dialog.showErrorBox` is an Electron API that the
renderer does not have, so a message comes from main or from the page.

This is a decision for the maintainer, then code. The options:

- Show a message and stop.
- Start from the defaults and keep the newer file aside, as main does with a `config-broken-<time>.json`
  backup for a file that is not JSON.
- Accept the newer file as now, and state that in the docs.

Done looks like: the maintainer's choice is in the History and in
[ADR-0003](../../adr/ADR-0003-config-survives-updates.md), the code does it, and a test with a
`configVersion` above the current one covers it.

## History

- 2026-10-18: Found while ADR-0003 was written, by reading `initConfig()` and `upgradeConfig()`.
- 2026-10-22: Deleted the commented-out `dialog.showErrorBox` in `initConfig()`, titled
  `Kalandra: incompatible configuration`, which described this case from the `catch` block for a
  file that does not parse.
- 2026-10-27: The maintainer chose to use the newer file as it is and log a warning. Left: the
  warning, a test with a `configVersion` above the current one, and the rule in ADR-0003.
- 2026-10-27: feat(renderer): log a warning for a config from a newer version
