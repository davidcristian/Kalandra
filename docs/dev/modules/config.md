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
- `defaultConfig()` returns a new default config with `configVersion` 35. Among its defaults: `overlayKey` is
  `Shift + Space`, `windowTitle` is `Path of Exile 2`, `language` is `en`, `realm` is `pc-ggg`, `fontSize` is 16,
  `stashScroll` is true, and `restoreClipboard`, `hideOverlayOnBlur`, `readClientLog` and `enableAlphas` are false.
  `commands` has six entries: `/hideout` on `F5`, `/exit` on `F9`, and `@last ty`, `/invite @last`,
  `/tradewith @last` and `/hideout @last` with no hotkey. `widgets` has one `initInstance()` of each single
  instance widget and the `defaultInstances()` of each multi instance one, in the order of
  `renderer/src/web/overlay/widget-registry.ts`, with `wmId` numbered from 1.
- `upgradeConfig(config)`, not exported, runs each `if (config.configVersion < N)` step in order on a parsed config.
  A step sets what version N added and ends with `config.configVersion = N`. A step that adds a widget adds that
  widget's default instance from `defaultConfig()` with the next free `wmId`.
- `initConfig()` loads the config at start and listens for `MAIN->CLIENT::config-changed`. With no file it uses
  `defaultConfig()`, and otherwise `upgradeConfig()` of the parsed file. With a file that is not JSON it uses
  `defaultConfig()` and calls `saveConfig({ isTemporary: true })` to make main write `config.json.tmp` and keep
  the broken file. That save fails: `renderer/src/main.ts` calls `initConfig()` before `Host.init()` opens the
  WebSocket, so `Host.sendEvent()` throws and the page does not mount.
- `AppConfig()` returns the current config, and `AppConfig<T>(type)` returns the first widget config whose
  `wmType` is `type`. The config is a deep `reactive` object in a `shallowRef`, and components change its fields
  in place. The settings window edits a deep copy and applies it on Save
  ([architecture.md](../architecture.md#the-config-from-file-to-settings) says when the file is then written).
  `settings/draft.ts` holds the copy. While the window is open, Language and Preferred trade site also go into the
  current config, so the window's text switches at once and **Refresh** on its Price check page uses the new trade
  site. Closing the window without Save puts back the old values.
- `updateConfig(config)` replaces the current config with a deep copy and sets the page's root font size from
  `fontSize`. `validFontSize()` in `settings/font-size.ts` first limits `fontSize` to 10 to 40 px, and replaces a
  value that is not a number, such as text an older Settings field saved, with 16.
- `saveConfig(opts?)` sends `CLIENT->MAIN::save-config` with `JSON.stringify(AppConfig())` when the config differs
  from the last one sent or received, and does nothing while an exclusive widget is shown. `opts.isTemporary` makes
  main write `config.json.tmp`.
- `pushHostConfig()` sends `CLIENT->MAIN::update-host-config` with `getConfigForHost()`, which builds the
  `HostConfig` main reads: every hotkey as a `ShortcutAction`, and the settings main uses. [ipc.md](ipc.md) lists
  each field and each action with the setting it comes from.
- `poeWebApi()` returns the trade site host: `www.pathofexile.com` when `preferredTradeSite` is `www`, and
  otherwise the site for `language`, with `pathofexile.tw` for `cmn-Hant` on the `pc-garena` realm.

`renderer/src/web/overlay/widgets.ts` and the widget folders:

- `Widget` has the fields the overlay manages for every widget: `wmId`, `wmType`, `wmTitle`, `wmWants` (`show` or
  `hide`), `wmZorder` (a number, `exclusive` or `null`) and `wmFlags`. Each widget's config type extends it:
  `WidgetMenu`, `PriceCheckWidget`, `StopwatchWidget`, `DelveGridWidget`, `ImageStripWidget` and `NotepadWidget`
  in `widgets.ts`, and `ItemCheckWidget`, `ItemSearchWidget`, `StashSearchWidget`, `XpWidget` and `LibraryWidget`
  in the `widget.ts` of their folders. A widget's defaults are in its component's `initInstance()` or
  `defaultInstances()` ([renderer-widgets.md](renderer-widgets.md)).

`main/src/host-files/ConfigStore.ts`:

- `ConfigStore` keeps the file at `apt-data/config.json` under Electron's `userData` folder. `load()` returns its
  text, or `null` when it cannot be read; `server.ts` returns that text from `GET /config`. On
  `CLIENT->MAIN::save-config` it sends the text to every client as `MAIN->CLIENT::config-changed` at once and
  queues the write. Reads and writes of the file run one at a time in the order they arrive, so the last save is
  the one on disk, and `load()` returns the text of a save that is still being written. The first temporary save
  switches the path to `config.json.tmp` for the rest of the run, so a file that did not parse stays as it was. It
  creates `apt-data` when it is missing. A write goes to the file's name with `.new` added, is flushed to disk and
  is renamed over the file, so a crash or a power loss during a save leaves the previous file whole. Windows fails
  a rename over a file that another program has open, so the rename is tried again for up to 750 ms. When the
  write or the rename fails, the file stays as it was and the app exits with status 1; the next save overwrites
  the `.new` file. In development (`VITE_DEV_SERVER_URL` is set) it writes nothing.

## Invariants

- A change to the config shape follows [the one hard rule](../../../AGENTS.md#the-one-hard-rule). A widget's
  default goes in its `initInstance()` or `defaultInstances()`, which `defaultConfig()` calls.
- `defaultConfig()` returns `configVersion` 35, so the next step is `if (config.configVersion < 36)`, ending with
  `config.configVersion = 36`, and `defaultConfig()` then returns 36. The last step of `upgradeConfig()` shows the
  current number. The existing steps have two gaps: no `< 20` step exists (`< 19` is followed by `< 21`), and the
  `< 33` step sets version 34, so no `< 34` step exists. The code between the `< 21` and `< 22` steps runs on every
  load and sets three fields when they are missing: `rememberCurrency` on the price check widget, `enableHotkeys`
  on each stash search widget, and `logKeys`.
- Field names and `wmType` values are keys in saved files. Renaming one takes an upgrade step that moves the value,
  as the `< 7` step does when it turns the `map-check` widget into `item-check`.
- A new widget type also takes an upgrade step that adds its default instance to saved configs, as the `< 29` and
  `< 30` steps do for `experience-tracker` and `library`. Without one, `AppConfig(type)` returns `undefined` for a
  user whose saved config is older than the widget.
- A saved config with a higher `configVersion` than the app's, from a newer version, runs no step, only the code
  between the `< 21` and `< 22` steps, and is used as it is. Nothing compares the stored `configVersion` with the
  app's ([refinement 004](../refinements/tasks/004-older-version-uses-newer-config.md)).
- main never parses the config: it stores the text and reads only `HostConfig`. A setting main needs goes through
  `getConfigForHost()` into `HostConfig` ([ipc.md](ipc.md)).
- No `config.json` is committed to the repo ([AGENTS.md](../../../AGENTS.md#safety)).

**Dependencies.** `HostConfig` and `ShortcutAction` from `ipc/types.ts`, `Host` from
`renderer/src/web/background/IPC.ts`, the widget registry for the default widgets, `vue` and `fast-deep-equal`.
`ConfigStore` uses Electron's `app` and Node's `fs/promises`, and takes `ServerEvents` from `main/src/server.ts`.

**Tests.** `renderer/specs/vitest.setup.ts` replaces `@/web/Config` with a mock in every test: `AppConfig()`
returns the config `defaultConfigMock()` builds, a typed `Config` literal with `configVersion` 99999999 and only
the price check widget, so `tsc` fails on it when a new required `Config` field is missing from it. No test runs
`defaultConfig()`, `upgradeConfig()` or `getConfigForHost()`, so an upgrade step is checked by reading it against
the steps before it and against the type. `main/specs/ConfigStore.test.ts` checks `ConfigStore` in a temporary
folder: the order of its reads and writes, a write that stops partway, and a rename that fails while another
program has the file open.
