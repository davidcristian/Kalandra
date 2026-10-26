# A failed read of config.json can replace the saved config with defaults

**Status:** done 2026-10-26
**Area:** config
**Origin:** [main/src/host-files/ConfigStore.ts](../../../../main/src/host-files/ConfigStore.ts)
**Verified:** 2026-10-26

This can break the hard rule in [AGENTS.md](../../../../AGENTS.md#the-one-hard-rule): a user's saved
config must survive every update. `ConfigStore.load()` wraps `fs.readFile` in an empty `catch {}`
and returns `null` for every error. A missing `config.json` and one that exists but cannot be read
for a moment, for example while an antivirus scan or a sync tool locks it, both reach the renderer
as `null`.

`initConfig()` in `renderer/src/web/Config.ts` treats `null` as a first start and applies
`defaultConfig()`. `_lastSavedConfig` starts as `null`, so the first `saveConfig()` always sends the
config to main. The overlay calls `saveConfig()` when its window loses focus (the `blur` listener in
`renderer/src/web/overlay/OverlayWindow.vue`), and `ConfigStore.save()` then writes the defaults
over the user's file.

Done looks like: `load()` tells a missing file (`ENOENT`) apart from every other error and passes
the other errors on with a type. On such an error the renderer does not save over the file, and the
error is logged so that Settings, Debug shows it. One way is the temporary save to
`config.json.tmp` that `initConfig()` already uses for a file that does not parse, once
[002](002-unparsable-config-stops-renderer.md) makes that save work. A test covers both cases. The
reasons for the rule are in [ADR-0003](../../adr/ADR-0003-config-survives-updates.md), and the code
is described in [modules/config.md](../../modules/config.md).

## History

- 2026-10-18: Found while the config module doc was written, by reading `ConfigStore.load()`,
  `initConfig()` and the blur listener in `OverlayWindow.vue`. Not reproduced in a running app.
- 2026-10-26: Done in `fix(main): keep config.json when a read of it fails`. `load()` returns
  the read error as a `ConfigProblem`, saves are skipped until a later read succeeds, and the
  start banner names the file. Checked with fakes; the running app on Windows is unchecked.
