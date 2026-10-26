# ADR-0003: A user's saved config survives every update

**Status:** Accepted (2026-10-26)

## Context

Kalandra keeps all of a user's settings in one JSON file, `apt-data/config.json` in Electron's `userData` folder,
which is `%APPDATA%\kalandra\apt-data\config.json` on Windows. The main process stores the file as text
(`ConfigStore` in `main/src/host-files/ConfigStore.ts`). The renderer defines its shape: the `Config` interface in
`renderer/src/web/Config.ts`, and each widget's config type in `renderer/src/web/overlay/widgets.ts` or in a
`widget.ts` in the widget's folder.

Users install a new version over the old one and keep the file, and a user can skip any number of versions. On start
the renderer reads the file from `GET /config`, and `initConfig()` passes it to `upgradeConfig()`, which brings it to
the current shape. The mechanism comes from Awakened PoE Trade, and Exiled Exchange 2 added steps to it.
[AGENTS.md](../../../AGENTS.md), section The one hard rule, states the rule this record gives the reasons for.

## Decision

**1. Every field and every widget has a default in `defaultConfig()`.** A widget's default instance comes from its
`WidgetSpec` (`initInstance` or `defaultInstances`), which `defaultConfig()` collects from the widget registry.
Reason: a new install starts from `defaultConfig()`, and upgrade steps copy defaults from it.

**2. Each change to the config shape adds one version and one step.** `configVersion` in `defaultConfig()` goes up
by one, and an `if (config.configVersion < N)` step is appended to the end of `upgradeConfig()`. The step sets the
field on the existing config and ends with `config.configVersion = N`. Reason: the stored number records which steps
a file has had, so each step runs once for each file.

**3. An existing step is never edited, reordered or deleted.** Reason: every step from the user's version runs in
order on the next start. A changed step reaches only the users who have not run it yet, so two users on the same
version would end up with different configs.

**4. A new widget type adds its instance in its step.** The `< 3` step shows the form: it pushes the default
`image-strip` and `delve-grid` widgets into `config.widgets`, each with a new `wmId`. Reason: an existing config has
only the widgets it was saved with, because `initConfig()` does not merge a saved file with `defaultConfig()`. It
adds a missing single instance widget only to a config at or above the version whose step adds that widget.

**5. Field names and `wmType` strings are part of the stored format.** Renaming a field or a widget's `wmType` is a
change to the config shape, so its step moves the saved value to the new name. Reason: `AppConfig(type)` finds a
widget by its `wmType`, and a field read under a new name is `undefined` in every saved config.

**6. The test mock gets every new top-level field.** A new top-level `Config` field and its default go into
`defaultConfigMock` in `renderer/specs/vitest.setup.ts`. Its `widgets` list holds only the price check widget, so
another widget goes there only when a test reads its config. Reason: the tests use that mock in place of
`defaultConfig()`, so a field missing there is `undefined` in every test, and the mock is a typed `Config` literal,
so `tsc` fails while a required top-level field is missing from it.

**7. A setting the main process needs goes through `HostConfig`.** `getConfigForHost()` copies it into `HostConfig`
(`ipc/types.ts`), and `pushHostConfig()` sends it as `CLIENT->MAIN::update-host-config`. Reason: `ConfigStore` loads
and saves the file as a string and parses it only to check that it is a JSON object, so `main` sees a setting
only through that message ([ADR-0004](ADR-0004-process-boundary.md)).

## Consequences

- The current `configVersion`, the next step, the gaps in the step numbers, the checks that run on every start and
  what an older version does with a newer file are in [config.md](../modules/config.md#invariants).
- A file that is not a JSON object is moved to a backup beside it, never deleted, and the page starts from
  `defaultConfig()`. A file that cannot be read stays as it was, and no save replaces it until a read succeeds
  ([config.md](../modules/config.md#public-contract)).
- `renderer/specs/web/config-upgrade.test.ts` upgrades saved configs of six older versions, so a step that leaves out
  a key of `defaultConfig()`, writes the wrong version or runs again on a current config fails the renderer tests.

## Alternatives rejected

- **Renumbering the steps to close the gaps at 20 and 34.** A saved file stores the number it reached, and
  renumbering changes which steps that file runs.
- **Fixing a mistake inside an old step.** The users who already ran it never run it again. A fix is a new step.

## Related

- [Config module](../modules/config.md): `Config.ts`, `ConfigStore.ts` and the test mock in detail.
- [ADR-0004](ADR-0004-process-boundary.md): the `GET /config` route and the `IpcEvent` messages that move the file.
- [ADR-0001](ADR-0001-kalandra-continues-exiled-exchange-2.md): why the folder is `%APPDATA%\kalandra`.
