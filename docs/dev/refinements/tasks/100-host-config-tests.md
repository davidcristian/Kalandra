# No test covers getConfigForHost

**Status:** done 2026-10-27
**Area:** config
**Origin:** [renderer/src/web/Config.ts](../../../../renderer/src/web/Config.ts)
**Verified:** 2026-10-27

`getConfigForHost()` in `renderer/src/web/Config.ts` builds the `HostConfig` that
`pushHostConfig()` sends to main. It is not exported, and `renderer/specs/vitest.setup.ts`
replaces `@/web/Config` with a mock in every test, so a test reaches it only through the real
module from `vi.importActual` and `pushHostConfig()`. `renderer/specs/web/shortcut-actions.test.ts`
checks the hotkey list it takes from `shortcutActions()`, but no test checks the other fields,
such as `libraryAlpha`, which reads `enableAlphas` and `alphas`, or `initialDelay` from the price
check widget.

Done looks like: a spec that sets a config with `updateConfig()` of the real module and checks the
`HostConfig` that `pushHostConfig()` sends. Break one field and watch the spec fail before
trusting it.

## History

- 2026-10-26: Split from [005](005-config-upgrade-tests.md) when the config upgrade spec closed
  its `upgradeConfig()` part.
- 2026-10-27: test(renderer): check the HostConfig that pushHostConfig sends.
