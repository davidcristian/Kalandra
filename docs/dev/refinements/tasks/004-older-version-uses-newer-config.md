# An older Kalandra uses a config written by a newer version without a check

**Status:** open
**Area:** config
**Origin:** [renderer/src/web/Config.ts](../../../../renderer/src/web/Config.ts)
**Verified:** 2026-10-18

`upgradeConfig()` runs every step whose number is above the stored `configVersion`. A user can
install an older version over a newer one that added upgrade steps. The stored `configVersion` is
then above `defaultConfig().configVersion` (35 on 2026-10-18), so no step runs and the older app
uses the config as it is, with fields and values it does not know. Nothing compares the two
numbers.

The commented-out `dialog.showErrorBox` titled `Kalandra - Incompatible configuration` in
`initConfig()` describes this case. It sits after a `return` in the `catch` block for a file that
does not parse ([002](002-unparsable-config-stops-renderer.md)), and `dialog` is an Electron API
that the renderer does not have.

This is a decision for the maintainer, then code. The options:

- Show a message and stop.
- Start from the defaults and keep the newer file aside, as main does with `config.json.tmp` for a
  file that does not parse.
- Accept the newer file as now, and state that in the docs.

Done looks like: the maintainer's choice is in the History and in
[ADR-0003](../../adr/ADR-0003-config-survives-updates.md), the code does it, and a test with a
`configVersion` above the current one covers it.

## History

- 2026-10-18: Found while ADR-0003 was written, by reading `initConfig()` and `upgradeConfig()`.
