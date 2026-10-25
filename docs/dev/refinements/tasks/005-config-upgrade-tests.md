# No test covers upgradeConfig, defaultConfig or getConfigForHost

**Status:** open
**Area:** config
**Origin:** [renderer/specs/vitest.setup.ts](../../../../renderer/specs/vitest.setup.ts)
**Verified:** 2026-10-25

`renderer/specs/vitest.setup.ts` replaces `@/web/Config` with a mock in every test file:
`vi.mock("@/web/Config", ...)` returns only `AppConfig` and `TipsFrequency`, and `AppConfig` reads
the config that `defaultConfigMock()` builds, whose `configVersion` is `99999999`. `upgradeConfig()`
is not exported. No spec calls `upgradeConfig()`, `defaultConfig()` or `getConfigForHost()`, and no
file under `renderer/src/` has an in-source test.

So a broken upgrade step, a wrong default or a wrong value in `getConfigForHost()` passes CI. The
hard rule in [AGENTS.md](../../../../AGENTS.md#the-one-hard-rule) is checked only by review and by
starting the app with an old config.

Done looks like: `upgradeConfig()` exported for tests, and a spec that loads the real module with
`vi.importActual`, upgrades saved configs of several old versions to the current one, checks that
each result has every field of `defaultConfig()`, and checks the output of `getConfigForHost()`.
Break one upgrade step and watch the spec fail before trusting it
([AGENTS.md](../../../../AGENTS.md#working-agreement)). Old configs for the cases can come from the
defaults at older commits, found with `git log -p -- renderer/src/web/Config.ts`.

## History

- 2026-10-18: Found while ADR-0003 and the config module doc were written, by reading
  `vitest.setup.ts` and searching `renderer/specs/` for calls to the three functions.
- 2026-10-21: The hotkey list moved from `getConfigForHost()` to `shortcutActions()` in
  `renderer/src/web/shortcut-actions.ts`, which `renderer/specs/web/shortcut-actions.test.ts` checks. The
  other `HostConfig` fields, `defaultConfig()` and `upgradeConfig()` still have no test.
- 2026-10-25: `renderer/vitest.config.ts` adds the Vue plugin, so a test can load the real `Config.ts`
  and the widget registry. `renderer/specs/web/widget-registry.test.ts` checks the widgets of
  `defaultConfig()`. `upgradeConfig()`, `getConfigForHost()` and the other defaults still have no test.
