# The config: Config.ts defines it, ConfigStore stores it

**Purpose.** The config is every setting Kalandra keeps for a user: the overlay key, the chat commands, the
league, the language, and each widget's settings and position. `renderer/src/web/Config.ts` defines it, gives its
defaults and upgrades a saved one, and `main/src/host-files/ConfigStore.ts` reads and writes it as
`apt-data/config.json` (`%APPDATA%\kalandra\apt-data\config.json` on Windows). Users install a new version over the
old one and keep that file, so a saved config must survive every update: this is
[the one hard rule](../../../AGENTS.md#the-one-hard-rule), and
[ADR-0003](../adr/ADR-0003-config-survives-updates.md) gives its reasons. The flow from file to settings is in
[architecture.md](../architecture.md#the-config-from-file-to-settings).

## Public contract

`renderer/src/web/Config.ts`:

- `Config` is the type of the whole config. Its fields: `configVersion`, `leagueId?`, `overlayKey`,
  `overlayBackground`, `overlayBackgroundClose`, `overlayAlwaysClose`, `hideOverlayOnBlur`, `restoreClipboard`,
  `showAttachNotification`, `commands` (each with `text`, `hotkey` and `send`), `clientLog`, `gameConfig`,
  `windowTitle`, `logKeys`, `accountName`, `stashScroll`, `language`, `preferredTradeSite`, `realm`, `fontSize`,
  `widgets`, `enableAlphas`, `alphas`, `tipsFrequency` (a `TipsFrequency`) and `readClientLog`.
- `defaultConfig()` returns a new default config with `configVersion` 40. Among its defaults: `overlayKey` is
  `Shift + Space`, `windowTitle` is `Path of Exile 2`, `language` is `en`, `realm` is `pc-ggg`, `fontSize` is 16,
  `stashScroll` is true, and `restoreClipboard`, `hideOverlayOnBlur`, `readClientLog` and `enableAlphas` are false.
  `commands` has six entries: `/hideout` on `F5`, `/exit` on `F9`, and `@last ty`, `/invite @last`,
  `/tradewith @last` and `/hideout @last` with no hotkey. `widgets` has one `initInstance()` of each single
  instance widget and the `defaultInstances()` of each multi instance one, in the order of
  `renderer/src/web/overlay/widget-registry.ts`, with `wmId` numbered from 1.
- `upgradeConfig(config)`, exported for the tests, runs each `if (config.configVersion < N)` step in order on a parsed config.
  A step sets what version N added and ends with `config.configVersion = N`. A step that adds a widget adds that
  widget's default instance from `defaultConfig()` with the next free `wmId`, and takes the index to insert at from
  `findIndex()`. The `< 29` and `< 30` steps pass the item search `wmId` to `splice()` as an index instead.
- `repairSavedConfig(config)` in `renderer/src/web/config-repair.ts` is what the `< 36` step runs. It sets
  `overlayAlwaysClose` to false when it is missing, since no step adds it to a config from Awakened PoE Trade. It
  keeps the first library widget, which the settings window and the hotkeys read, and removes the others: a v0.14.0
  install saved version 29 with its library widget, so the `< 30` step added a second one. When neither the library
  nor the XP tracker follows item search, as in some configs from before version 12, it moves both there.
- `nameDefaultMarksByRef(config)` in `renderer/src/web/map-check/saved-marks.ts` is what the `< 37` step runs. Map
  check marks name a modifier by its stat ref from version 37 on, and older ones by its text in the language of that
  time. The step names the four default marks of earlier versions, which are English text, by ref. The other marks
  need the game data, which loads after `upgradeConfig()`, so `renderer/src/main.ts` converts them after each data
  load ([renderer-widgets.md](renderer-widgets.md#invariants)).
- `addKeysWithoutStep(config, defaults)` in `config-repair.ts` is what the `< 38` step runs. Awakened PoE Trade
  added `language`, `restoreClipboard`, `clientLog`, `gameConfig` and two hotkeys to its defaults without a new
  version, and a new install of versions 15 to 21 has no item search `ocrGemsKey`. The step sets those four keys,
  the item check `craftOfExileKey`, the Delve grid `toggleKey` and the item search `ocrGemsKey` to their values in
  `defaultConfig()` where the saved config has none, and keeps a saved value, `null` included.
- `namePresetEntries(config, englishDefaults)` in `renderer/src/web/stash-search/presets.ts` gives each stash
  search entry whose text is one of the English defaults the `preset` that makes it search that game text in the
  game language ([renderer-widgets.md](renderer-widgets.md#stash-search-presets)). It keeps the entry's text. The
  `< 39` step names `Currency`, `"Rarity: Normal"` and `Trials:`, and the `< 40` step `"Martial Weapon"` and
  `"Waystone Tier"` (`ENGLISH_DEFAULTS_40`).
- `initConfig()` loads the config at start and listens for `MAIN->CLIENT::config-changed`. With no contents from
  main it uses `defaultConfig()`, and otherwise `upgradeConfig()` of the parsed file. `Host.configProblem` keeps
  the `ConfigProblem` main sent, and `LoadingAnimation.vue` names it, with the file's path, in the banner it shows
  when the overlay first attaches to the game, for 20 seconds and even when that banner is turned off in
  Settings. Before the steps, `addMissingWidgets()` in
  `missing-widgets.ts` adds the default of each single instance widget that the file lacks and a config of its
  version has, with the next free `wmId`, and logs `[config] Added the default widgets that the saved config
  lacks:` and their types to the console. A widget that a later step adds, such as the library to a config before
  version 30, is left to that step. main sends only a JSON object, so `initConfig()` parses the text without a
  check.
- `AppConfig()` returns the current config, and `AppConfig<T>(type)` returns the first widget config whose
  `wmType` is `type`. The config is a deep `reactive` object in a `shallowRef`, and components change its fields
  in place. The settings window edits a deep copy and applies it on Save
  ([architecture.md](../architecture.md#the-config-from-file-to-settings) says when the file is then written).
  `settings/draft.ts` holds the copy. While the window is open, Language and Preferred trade site also go into the
  current config, so the window's text switches at once and **Refresh** on its Price check page uses the new trade
  site. Closing the window without Save puts back the old values. `settings/hotkey-conflicts.ts` runs
  `shortcutActions()` on the copy, and `HotkeyInput.vue` outlines in red a field whose hotkey another action has,
  or that main did not register for the saved config (`Host.unregisteredHotkeys`), with a tooltip for the reason.
- `updateConfig(config)` replaces the current config with a deep copy and sets the page's root font size from
  `fontSize`. `validFontSize()` in `settings/font-size.ts` first limits `fontSize` to 10 to 40 px, and replaces a
  value that is not a number, such as text an older Settings field saved, with 16.
- `saveConfig()` sends `CLIENT->MAIN::save-config` with `JSON.stringify(AppConfig())` when the config differs
  from the last one sent or received, and does nothing while an exclusive widget is shown.
- `pushHostConfig()` sends `CLIENT->MAIN::update-host-config` with `getConfigForHost()`, which builds the
  `HostConfig` main reads: every hotkey as a `ShortcutAction`, and the settings main uses. `shortcutActions(config)`
  in `shortcut-actions.ts` builds the hotkey list from any config, so the Settings window can check its edited copy.
  [ipc.md](ipc.md) lists each field and each action with the setting it comes from.
- `poeWebApi()` returns the trade site host: `www.pathofexile.com` when `preferredTradeSite` is `www`, and
  otherwise `tradeHost(language, realm)` from `trade-host.ts`, the site for `language`, with `pathofexile.tw` for
  `cmn-Hant` on the `pc-garena` realm. The General settings page names the `tradeHost` of its edited copy.

`renderer/src/web/overlay/widgets.ts` and the widget folders:

- `Widget` has the fields the overlay manages for every widget: `wmId`, `wmType`, `wmTitle`, `wmWants` (`show` or
  `hide`), `wmZorder` (a number, `exclusive` or `null`) and `wmFlags`. Each widget's config type extends it:
  `WidgetMenu`, `PriceCheckWidget`, `StopwatchWidget`, `DelveGridWidget`, `ImageStripWidget` and `NotepadWidget`
  in `widgets.ts`, and `ItemCheckWidget`, `ItemSearchWidget`, `StashSearchWidget`, `XpWidget` and `LibraryWidget`
  in the `widget.ts` of their folders. A widget's defaults are in its component's `initInstance()` or
  `defaultInstances()` ([renderer-widgets.md](renderer-widgets.md)).

`main/src/host-files/ConfigStore.ts`:

- `ConfigStore` keeps the file at `apt-data/config.json` under Electron's `userData` folder. `load()` returns a
  `LoadedConfig`: the file's text, or `null` when there is no file, and `problem` null. Any other read error, such
  as `EBUSY` while another program holds the file, gives `null` and a `ConfigProblem` with reason `unreadable`, the
  path and the error message, and logs `error [ConfigStore] Failed to read <path>: <message>`. Until a later read
  succeeds, each save is skipped with `warn [ConfigStore] Did not save the config`, so the page, which runs on the
  defaults, never replaces the file. `server.ts` returns both in `HostState` from `GET /config`. On
  `CLIENT->MAIN::save-config` it sends the text to every client as `MAIN->CLIENT::config-changed` at once and
  queues the write. Reads and writes of the file run one at a time in the order they arrive, so the last save is
  the one on disk, and `load()` returns the text of a save that is still being written. A file that is not a JSON
  object, such as one cut short or emptied, moves to `config-broken-<time>.json` beside it, with `warn
  [ConfigStore] <path> is not JSON, so it was moved to <backup>` in the log, and `load()` returns `null` and a
  `ConfigProblem` with reason `not-json` and the `backup` path. The page then starts from the defaults, and its
  first save writes a new `config.json`. A move that fails is handled as a read error. It
  creates `apt-data` when it is missing. A write goes to the file's name with `.new` added, is flushed to disk and
  is renamed over the file, so a crash or a power loss during a save leaves the previous file whole. Windows fails
  a rename over a file that another program has open, so the rename is tried again for up to 750 ms. When the
  write or the rename fails, the file stays as it was, `error [ConfigStore] Failed to save the config: <message>`
  goes to the log and the app keeps running; the next save writes the whole config to the `.new` file again. In
  development (`VITE_DEV_SERVER_URL` is set) it writes no save.

## Invariants

- A change to the config shape follows [the one hard rule](../../../AGENTS.md#the-one-hard-rule). A widget's
  default goes in its `initInstance()` or `defaultInstances()`, which `defaultConfig()` calls.
- `defaultConfig()` returns `configVersion` 40, so the next step is `if (config.configVersion < 41)`, ending with
  `config.configVersion = 41`, and `defaultConfig()` then returns 41. The last step of `upgradeConfig()` shows the
  current number. The existing steps have two gaps: no `< 20` step exists (`< 19` is followed by `< 21`), and the
  `< 33` step sets version 34, so no `< 34` step exists. The code between the `< 21` and `< 22` steps runs on every
  load and sets three fields when they are missing: `rememberCurrency` on the price check widget, `enableHotkeys`
  on each stash search widget, and `logKeys`.
- The `< 29` step sets `tipsFrequency` to Never on every config older than version 29, which Exiled Exchange 2
  v0.12.x and earlier saved, while `defaultConfig()` gives Normal. Those users see no tips until they change the
  setting under Help. Exiled Exchange 2 added that line in v0.13.0 with no recorded reason. No new step sets
  Normal: a saved Never does not show whether the user chose it, and such a step would override the users who did.
- A config from an older version keeps keys that no type or default has and no code outside `upgradeConfig()`
  reads. On the price check widget, the `< 4` and `< 10` steps set `chaosPriceThreshold`, the `< 22` step
  `autoFillEmptyRuneSockets` and the `< 25` step `openItemEditorAbove`. The top-level keys that the `< 10`, `< 14`
  and `< 16` steps copy into widgets, such as `priceCheckKey` and `itemCheckKey`, also stay. These keys change
  nothing, so no step deletes them: such a step would raise `configVersion` and rewrite every saved config with no
  change in behavior.
- The steps read the single instance widgets without a check, so `initConfig()` adds the missing ones first. A
  config older than version 7 without a map check widget still throws a `TypeError` in the `< 4` or `< 7` step:
  `defaultConfig()` has no widget of that type, and only an Awakened PoE Trade config edited by hand lacks one.
- Field names and `wmType` values are keys in saved files. Renaming one takes an upgrade step that moves the value,
  as the `< 7` step does when it turns the `map-check` widget into `item-check`.
- A new widget type also takes an upgrade step that adds its default instance to saved configs, as the `< 29` and
  `< 30` steps do for `experience-tracker` and `library`. Without one, `AppConfig(type)` returns `undefined` for a
  user whose saved config is older than the widget. A single instance type also gets that step's version in
  `SAVED_SINCE` in `missing-widgets.ts`, and the config upgrade spec fails for a type missing there.
- A saved config with a higher `configVersion` than the app's, from a newer version, runs no step, only the code
  between the `< 21` and `< 22` steps, and is used as it is. Nothing compares the stored `configVersion` with the
  app's ([refinement 004](../refinements/tasks/004-older-version-uses-newer-config.md)).
- main reads no setting from the config: it parses the text only to check that it is a JSON object, stores it,
  and reads only `HostConfig`. A setting main needs goes through
  `getConfigForHost()` into `HostConfig` ([ipc.md](ipc.md)).
- No `config.json` is committed to the repo ([AGENTS.md](../../../AGENTS.md#safety)).

**Dependencies.** `HostConfig` and `ShortcutAction` from `ipc/types.ts`, `Host` from
`renderer/src/web/background/IPC.ts`, the widget registry for the default widgets, `vue` and `fast-deep-equal`.
`ConfigStore` uses Electron's `app` and Node's `fs/promises`, and takes `ServerEvents` from `main/src/server.ts` and
the `Logger` from `main/src/RemoteLogger.ts`.

**Tests.** `renderer/specs/vitest.setup.ts` replaces `@/web/Config` with a mock in every test: `AppConfig()`
returns the config `defaultConfigMock()` builds, a typed `Config` literal with `configVersion` 99999999 and only
the price check widget, so `tsc` fails on it when a new required `Config` field is missing from it.
`renderer/specs/web/widget-registry.test.ts` loads the real module with `vi.importActual`, checks the widgets of
`defaultConfig()` and checks that the mock has each top-level field of `defaultConfig()`.
`renderer/specs/web/config-upgrade.test.ts` runs the real `upgradeConfig()` on the saved configs in
`renderer/specs/saved-configs/`: a new install's config of versions 2, 16, 25, 28, 32 and 36, each built from the
defaults at that version's commits, with a changed league, hotkeys and widget position. It checks that each ends at
the current version with every key of `defaultConfig()`, gets the default of each key the `< 38` step sets, keeps the
user's choices, and runs each step once and in order, with the same result when every version in between saved the
file. It also checks that a current config stays unchanged, that the `< 38` step keeps each saved value, that the
`< 39` and `< 40` steps name the default stash searches of a version 36 config by preset, that the `< 39` step
leaves the two that the `< 40` step names, that a widget of an unknown type stays. It runs the real `initConfig()` with a fake `Host.getConfig()` and checks that a
saved config loads as `upgradeConfig()` returns it, that a config without the price check or another single
instance widget gets the default one with a new `wmId` and a log line, and that a version 2 config without its map
check widget still throws. It takes the last step version from `defaultConfig()`, so a new step needs no change to
the spec. No test runs `getConfigForHost()`
([refinement 100](../refinements/tasks/100-host-config-tests.md)).
`renderer/specs/web/shortcut-actions.test.ts` checks the hotkey list that
`shortcutActions()` builds. `renderer/specs/web/config-repair.test.ts` checks `repairSavedConfig()`
on the widget lists that the `< 29` and `< 30` steps left in saved configs, and
`renderer/specs/web/map-check-marks.test.ts` checks `nameDefaultMarksByRef()`, and `trade-host.test.ts` beside it
the host `tradeHost()` returns for each language and realm. `main/specs/ConfigStore.test.ts` checks
`ConfigStore` in a temporary folder: the order of its reads and writes, a write that stops partway, a rename
that fails while another program has the file open, with the log line of each failed save, a
run in development, a `config.json` that is not a JSON object and one whose move to a backup fails, a `config.json` that is a folder, and a read that fails with `EBUSY`, after which no save
replaces the file until a read succeeds. `main/specs/start-server.test.ts` reads `GET /config` after a
`save-config` message, and `renderer/specs/web/host-events.test.ts` checks that `Host.getConfig()` keeps the
`ConfigProblem`.
