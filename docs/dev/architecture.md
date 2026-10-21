# Kalandra architecture

This document maps Kalandra: its parts, the boundary between its two processes, how a price check, the config and
the game data move through them, the CI workflows, and where each part lives in the repo. Kalandra is a Path of
Exile 2 overlay for price checking items, with widgets for maps, stash search, XP tracking and more. The rules are
in [AGENTS.md](../../AGENTS.md), and the reasons for the process boundary are in
[ADR-0004](adr/ADR-0004-process-boundary.md).

## Components

```
+-- one Electron app on the player's machine ------------------+
|                                                              |
|  main/  the main process (Node.js)                           |
|    shortcuts/   hotkeys, key presses, the clipboard          |
|    windowing/   the overlay window over the game window      |
|    host-files/  apt-data files, Client.txt, game config      |    +-- outside hosts, over HTTPS ----+
|    vision/      OCR worker, Windows only                     |    | official trade sites:           |
|    AppUpdater   updates from GitHub releases                 |    |   www.pathofexile.com and       |
|    AppTray      the tray icon and its menu                   |    |   eight regional hosts          |
|    server.ts    HTTP and WebSocket server on 127.0.0.1       |    | www.poeprices.info              |
|    proxy.ts     /proxy/<host>/... ---------------------------+--->| kalandra.ashoal.com/prices/     |
|        ^                                                     |    +----------------^----------------+
|        | /events WebSocket: IpcEvent messages, ipc/types.ts  |                     | hourly files
|        | GET /config, /uploads, /proxy, the page's files     |    priceService/ (Python, on a server)
|        v                                                     |                     ^
|  renderer/  the Vue 3 page in the overlay window             |                     | its own requests
|    parser/, price-check/, widgets, settings                  |                 poe.ninja
|    loads data/<lang>/ game data from main's server           |
+--------------------------------------------------------------+
        ^
        | committed output in renderer/public/data/<lang>/
  dataParser/ (Python, run by hand): game and trade exports to stats.ndjson, items.ndjson, client_strings.js
```

- **main** (`main/src/`) is the Electron main process and the only part with operating system access. It
  registers the hotkeys, presses keys in the game through `uiohook-napi`, reads the clipboard, places the overlay
  window over the game window through `electron-overlay-window`, reads and writes files under `apt-data`, follows
  the game's `Client.txt` log, reads the game's config file, checks for updates and shows the tray icon. It serves
  the renderer and forwards the renderer's requests to the outside hosts. See [modules/main.md](modules/main.md).
- **renderer** (`renderer/src/`) is the user interface: a Vue 3 page built by Vite and styled with Tailwind. main
  loads it from its own server into the overlay window; with `--no-overlay`, or from the tray's Open in Browser
  item, it opens in a browser instead. Electron's sandbox is on (`app.enableSandbox()` in `main/src/main.ts`) and
  the overlay window has no Node.js integration, so the page reaches the operating system only through main.
  `src/parser/` turns copied item text into a `ParsedItem` ([modules/renderer-parser.md](modules/renderer-parser.md)),
  `src/web/price-check/` builds the filters and trade queries and shows the prices
  ([modules/renderer-price-check.md](modules/renderer-price-check.md)), `src/web/overlay/` places the widgets
  ([modules/renderer-widgets.md](modules/renderer-widgets.md)), `src/web/Config.ts` holds the user's settings
  ([modules/config.md](modules/config.md)) and `src/assets/data/` loads the game data.
- **ipc** (`ipc/`) holds the types and key tables both processes import: `HostConfig`, `ShortcutAction`, the
  `IpcEvent` union and `ClientLogEvent` in `types.ts`, and the key name tables in `KeyToCode.ts`. See
  [modules/ipc.md](modules/ipc.md).
- **The outside hosts** are reached only through main's proxy. The official trade sites serve searches, listings,
  bulk exchange queries, the league list and the trade stat and item lists. `poeWebApi()` in `Config.ts` picks the
  site from the language, realm and preferred trade site settings. `www.poeprices.info` is a price prediction
  service for rare items, called from `price-check/price-prediction/poeprices.ts`. The price check settings have a
  checkbox for it, but `CheckedItem.vue` does not render the `PricePrediction` component, so the app sends it no
  request. `kalandra.ashoal.com` serves the price files. The app never calls poe.ninja's API and only links to its
  pages ([ADR-0006](adr/ADR-0006-own-price-service.md)).
- **priceService** (`priceService/`) is a Python service, standard library only, that runs on a server outside the
  app. Once an hour it builds one price file per league from poe.ninja's API and serves the files at
  `kalandra.ashoal.com/prices/`. See [modules/price-service.md](modules/price-service.md) and
  [runbooks/price-service-deploy.md](runbooks/price-service-deploy.md).
- **dataParser** (`dataParser/`) is a Python tool the maintainer runs when a game patch changes item text or stats.
  It builds `stats.ndjson`, `items.ndjson` and `client_strings.js` for each language. Its output is committed under
  `renderer/public/data/<lang>/`, and the app never runs it. See [modules/dataparser.md](modules/dataparser.md).
- **docs** (`docs/`) is the VitePress user site on GitHub Pages. `docs/dev/` holds these developer docs, which are
  read on GitHub and left out of the site ([ADR-0008](adr/ADR-0008-developer-docs-layout.md)).

## The boundary between the processes

`main/src/server.ts` runs one Node.js HTTP server. It listens on `127.0.0.1` on a port the operating system picks,
and `--listen=[host][:port]` sets either part; when it cannot listen on that address, it uses the default one. In
development, main listens on port 8584, and Vite's dev server on `localhost:5173` forwards these routes to it
(`server.proxy` in `renderer/vite.config.mts`). Every request passes one check first: its `Host` must be
`localhost` or an IP address, and its `Origin`, which a WebSocket must send, must match `Host`.
A request that fails gets 403 ([ADR-0009](adr/ADR-0009-local-server-accepts-only-its-own-page.md)).

| Route | What it does | Renderer side |
| --- | --- | --- |
| `/events` | A WebSocket that sends every `IpcEvent` as JSON text, in both directions. An upgrade request for any other path is destroyed, and one that fails the check gets 403. | `Host` in `renderer/src/web/background/IPC.ts` |
| `GET /config` | Returns `HostState`: the app version, the updater state and the text of `config.json`, or `null` when there is none. | `Host.getConfig()` |
| `/uploads/<name>` | `POST` stores the request body, at most 16,000,000 bytes, in `apt-data/files/` under its MD5 hash and extension, and returns `{ name }`. It returns 415 when `<name>` does not end in an image extension, such as `.png` or `.jpg`, and 500 when the write fails. `GET` returns a stored file, or 404 for a missing file or a path outside the folder. Any other method gets 405. The image strip widget stores imported images this way. | `Host.importFile()` |
| `/proxy/<host>/<path>` | Returns 403 without the `x-kalandra-proxy` request header, which a page on another site cannot send. Forwards the request to `https://<host>/<path>` when `<host>` is in `PROXY_HOSTS` in `main/src/proxy.ts`, and destroys it otherwise. | `Host.proxy()`, which sends the header |
| any other path | Returns the built renderer file from the folder that holds the bundled `main.js`, where electron-builder puts `renderer/dist`, or 404 for a missing file or a path outside that folder. This includes a path that only starts like a route, such as `/config?x` or `/uploads`. In development, Vite serves the renderer files and main returns 404. | |

A *client* is a page connected to `/events`: the overlay window, or a browser tab. Each event name starts with
its direction:

| Prefix | Sent by | Received by |
| --- | --- | --- |
| `CLIENT->MAIN::` | any client | main |
| `MAIN->CLIENT::` | main | every client (`sendEventTo("broadcast", ...)`) or the last active one (`"last-active"`) |
| `MAIN->OVERLAY::` | main | the overlay window; a page outside Electron does not listen for these |
| `OVERLAY->MAIN::` | the overlay window | main, which ignores these from a page outside Electron |

The last active client is the one that most recently connected or sent `CLIENT->MAIN::used-recently`, or the only
client left after another one disconnects. A new message starts as a new member of the `IpcEvent` union, then gets
its sender and its handler. [modules/ipc.md](modules/ipc.md) lists every event with both ends.

## A price check, from hotkey to price

1. The player points at an item in the game and presses the price check hotkey, `Ctrl + D` by default
   (`hotkeyHold` plus `hotkey` in the price check widget's config). `Shortcuts` in
   `main/src/shortcuts/Shortcuts.ts` registers every hotkey with Electron's `globalShortcut` while the game window
   is active.
2. main starts `HostClipboard.readItemText()` and presses the game's copy keys through `uiohook-napi`: `Ctrl + C`
   together with the game's advanced item description key, which `GameConfig` reads from
   `poe2_production_Config.ini` (`Alt` when the file sets none). The game copies the item text to the clipboard.
3. `HostClipboard` polls the clipboard every 48 ms, starting after the price check's `initialDelay` (48 ms by
   default) and stopping after 500 ms of polling, until the text starts the way copied item text starts in one of
   the game's languages. With Restore clipboard on, it then writes the previous clipboard text back.
4. main sends `MAIN->CLIENT::item-text` to the last active client, with the text, the cursor position and the
   target `price-check`. The other item hotkeys (item info, wiki, poedb and the rest) follow steps 1 to 4 with
   their own target.
5. `PriceCheckWindow.vue` shows the price check window. For the plain hotkey, as opposed to the locked one
   (`Ctrl + Alt + D`), the overlay window sends `OVERLAY->MAIN::track-area`, so that `WidgetAreaTracker` in main
   closes the window when the cursor moves away from where the key was pressed. It calls `parseClipboard()` from
   `renderer/src/parser/`, which matches the text through `CLIENT_STRINGS` and the stat matchers in `stats.ndjson`
   and returns a `ParsedItem` or an error.
6. For a parsed item, `queuePricesFetch()` from `usePoeninja()` in `renderer/src/web/background/Prices.ts` loads
   the league's [price file](modules/price-service.md#the-files) from `/proxy/kalandra.ashoal.com/prices/<file>`
   when the last successful load is over 31 minutes old. Which leagues have prices and when the file loads again:
   [modules/renderer-price-check.md](modules/renderer-price-check.md#price-estimates-backgroundpricests-backgroundprice-sourcets).
7. The price check builds filters from the `ParsedItem` and sends the trade search through
   `/proxy/<trade site>/api/trade2/search/<league>` and `/api/trade2/fetch/...`, or `/api/trade2/exchange/<league>`
   for bulk items. Each request first waits on its `RateLimiter` set in
   `renderer/src/web/price-check/trade/common.ts`, and `adjustRateLimits()` reads the site's `x-rate-limit-*`
   headers back into the sets ([ADR-0005](adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)).
8. `HttpProxy` in `main/src/proxy.ts` sends each request with Electron's `net.request`, with the session's cookies
   and `app.userAgentFallback` as the User-Agent, and returns the response with its `content-encoding` header
   removed.

## The config, from file to settings

1. At start, `initConfig()` in `renderer/src/web/Config.ts` fetches `GET /config`. main returns the text of
   `apt-data/config.json` from `ConfigStore.load()`; on Windows the file is
   `%APPDATA%\kalandra\apt-data\config.json`.
2. With no file, the renderer uses `defaultConfig()`. Otherwise `upgradeConfig()` runs every upgrade step above
   the file's `configVersion`. A file that is not JSON gives `defaultConfig()` and a temporary save that throws, so
   the page shows the start error described below instead of starting ([modules/config.md](modules/config.md)
   says why).
3. When the overlay mounts, `pushHostConfig()` sends `CLIENT->MAIN::update-host-config` with the `HostConfig` that
   `getConfigForHost()` builds: every hotkey as a `ShortcutAction`, and the settings main reads. The handler in
   `main/src/main.ts` passes them to the overlay window, the shortcuts, the clipboard, the log watcher, the game
   config reader, the tray and the file writer. The updater's first check does not wait for this: `AppUpdater`
   starts it when main creates it.
4. `saveConfig()` sends `CLIENT->MAIN::save-config` with the whole config as JSON when it differs from the last
   one sent or received, and never while an exclusive widget is shown. It runs when the overlay window loses
   focus and after an exclusive widget other than the settings window closes. Save in the settings window applies
   the edited copy and calls `pushHostConfig()`, which main applies at once, and `saveConfig()`. The settings
   window is itself an exclusive widget that is still shown at that moment, so that call sends nothing, and the
   file is written by the next save that runs, such as the one when the overlay window loses focus.
5. `ConfigStore` sends `MAIN->CLIENT::config-changed` to every client, and each client replaces its config with
   the one sent. It writes the file after any earlier save, so the last save is the one on disk. In development,
   main writes no file.

A saved config must survive every update: [the one hard rule](../../AGENTS.md#the-one-hard-rule),
[ADR-0003](adr/ADR-0003-config-survives-updates.md) and [modules/config.md](modules/config.md).

## The game data, from patch to parser

1. The maintainer runs `python ./src/main.py` in `dataParser/`
   ([runbooks/game-data-update.md](runbooks/game-data-update.md)). It writes `stats.ndjson`, `items.ndjson` and
   `client_strings.js` for each language to `dataParser/output/<lang>/`, and `--push` copies them into
   `renderer/public/data/<lang>/`. Both copies are committed, and nobody edits them by hand
   ([ADR-0007](adr/ADR-0007-game-text-from-game-data.md)).
2. `npm run make-index-files` in `renderer/` reads `stats.ndjson` and `items.ndjson` and writes four `*.index.bin`
   lookup tables per language, by stat ref, stat matcher text, item name and item ref name. Git ignores them. The
   tests, `npm run dev` and a build need them, so run it again after every data change. The table format and the
   nine languages: [modules/renderer-parser.md](modules/renderer-parser.md#the-game-data).
3. At start, `init()` in `renderer/src/assets/data/index.ts` loads the files for the configured language from
   `data/<lang>/`, which main serves with the page, the English client strings as `CLIENT_STRINGS_REF`, and the
   trade site's stat and item lists through the proxy. A change of language loads the other language's files
   (`loadForLang()`). A file that the server does not return fails the start with the file's name and status.
4. `renderer/src/main.ts` runs the start steps (the config, the UI text, the game data and the `/events` socket)
   through `startApp()` in `renderer/src/web/startup.ts`. When one fails, the page logs the error to the console
   and shows `Kalandra cannot start` with the error and what to do in place of the app. The text is English only,
   because `app_i18n.json` is one of the files whose load can fail. Only a browser tab shows it: main attaches the
   overlay window to the game when the page sends `CLIENT->MAIN::update-host-config`, which a failed start never
   sends.

## CI

Every job runs on `ubuntu-latest` unless the table names other runners, and every job that uses Node.js uses Node
24. A merged pull request into `master` is a push to `master`.

| Workflow | Runs on | Jobs |
| --- | --- | --- |
| `.github/workflows/test.yml` | every push to `master` or `dev`, and every pull request to them; each job but Lint & Format only when `scripts/ci_paths.py` finds a changed path that affects it or when Changed paths fails ([ADR-0011](adr/ADR-0011-ci-runs-the-jobs-a-change-affects.md)) | **Changed paths**: `git diff --name-only --no-renames` from the merge base or the push's `before` commit, which lists a moved file under its old and its new path, read by `scripts/ci_paths.py`. **Lint & Format**: `npm ci` in `renderer/` and `main/`, then every hook in `.pre-commit-config.yaml` over all files. **Tests**: `npm ci` in `renderer/` and `main/`, `npm run make-index-files`, then `npx vitest run --coverage` in `renderer/` and `npm test -- --coverage` in `main/`, which fail below the coverage floor in each `vitest.config.ts`. **Price service**: `pip install coverage`, then `python -m coverage run -m unittest discover -s tests -v` and `python -m coverage report` in `priceService/` on Python 3.12, which fails below the floor in `.coveragerc`. **Scripts**: the same commands in `scripts/` on Python 3.12. **Docs**: `npm ci` and `npm run build` in `docs/`, which fails on a dead internal link in a user page. |
| `.github/workflows/main.yml` (Build) | a push to `master`, unless every changed file is under `docs/` or is the root `README.md`; never a tag push (`tags-ignore: '**'`); one run at a time, and a newer push replaces a run that waits (`concurrency`) | **renderer**: `npm ci`, `npm run make-index-files`, `npm run lint` and `npm run build` in `renderer/`, then keeps `renderer/dist` as the workflow artifact `renderer-dist` for one day. **package**, after it, on `windows-2025`, `ubuntu-22.04` and `macos-14`: downloads `renderer-dist`, runs `npm ci` and `npm run build` in `main/`, then packages the app with electron-builder (`npm run package "--" -p onTagOrDraft`), which uploads the packages only into a draft GitHub release for the current version. |
| `.github/workflows/pages.yml` (Docs) | a push to `master` that changes a file under `docs/` outside `docs/dev/`, never a tag push; or by hand: Actions, Docs, Run workflow, with `master` as the branch (`workflow_dispatch`) | **deploy**: `npm ci` and `npm run build` in `docs/`, then `actions/configure-pages`, `actions/upload-pages-artifact` with `docs/.vitepress/dist`, and `actions/deploy-pages` into the `github-pages` environment. |

- No job in `test.yml` runs `npm run build` in `renderer/` or `main/`. Only Build does, on a push to `master`, so
  run both builds yourself before opening a pull request.
- A push that changes only files under `docs/` never packages the app. A push that changes only files under
  `docs/dev/` also deploys nothing.
- No workflow runs the `dataParser/` tests.
- Each workflow gives its `GITHUB_TOKEN` only `contents: read`. The Build `package` job has `contents: write`, which
  electron-builder needs to find the draft release and upload into it, and the Docs `deploy` job adds `pages: write`
  and `id-token: write` for `actions/deploy-pages`. Every checkout sets `persist-credentials: false`, so the token is
  not in the git config while `npm ci` runs the install scripts of the dependencies.
- A push that changes only `docs/dev/` or a markdown file at the repo root runs only Changed paths and Lint & Format
  in `test.yml`.

The package job's upload outcomes and the release steps are in [runbooks/release.md](runbooks/release.md), and
working on the docs site in [runbooks/docs-site.md](runbooks/docs-site.md).

## Repo map

```
main/              the Electron main process: TypeScript bundled by esbuild, packaged by electron-builder
  src/             main.ts (entry), server.ts, proxy.ts, AppUpdater.ts, AppTray.ts, RemoteLogger.ts
    shortcuts/     hotkeys, key presses, reading item text, typing chat commands and stash searches
    windowing/     the overlay window, the game window, overlay visibility, the widget area tracker
    host-files/    config.json, uploads, the Client.txt watcher, the game config, the data file writer
    vision/        the OCR worker thread, Windows only
  build/           script.mjs (the esbuild build and dev runner) and the app icons
  electron-builder.yml  NSIS installer and portable on Windows, AppImage on Linux, universal dmg on macOS
renderer/          the Vue 3 page: Vite, Tailwind, Vitest
  src/parser/      item text to ParsedItem
  src/web/         Config.ts, the widgets, price check, settings, and background/ (IPC, prices, leagues, trade data)
  src/assets/      the game data loader and make-index-files.mjs
  public/data/     the game data per language, app_i18n.json per language, namespaceMap.json
  specs/           Vitest tests, parser cases with real item text, saved trade responses
ipc/               types.ts, KeyToCode.ts and library.ts, imported by both processes
dataParser/        the Python game data generator, run by hand; output/ holds its last output
priceService/      the Python price file service, deployed outside the app
scripts/           check.py, which runs every check AGENTS.md names, the repo and commit checks, and ci_paths.py
docs/              the VitePress user site; dev/ holds the developer docs, left out of the site
.github/           test.yml, main.yml, pages.yml, the issue templates and FUNDING.yml
versionCheck.py    fails unless the five files AGENTS.md names have the same version
pyrightconfig.json strict Pyright settings for priceService/ and scripts/
testUpdate.sh      builds the renderer and main and packages the app on the local machine
```
