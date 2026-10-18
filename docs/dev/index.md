# Developer docs index

Start here. The rules for working in this repo are in [AGENTS.md](../../AGENTS.md). Setting up a machine, running
the app from source, running the checks and packaging it are in [DEVELOPING.md](../../DEVELOPING.md). The user
documentation is the site at <https://davidcristian.github.io/Kalandra/>, which VitePress builds from `docs/`
without `docs/dev/`. These developer docs are plain GitHub markdown and are read on GitHub
([ADR-0008](adr/ADR-0008-developer-docs-layout.md)).

## Map

- [architecture.md](architecture.md): the components, the routes and messages between the two processes, how a
  price check, the config and the game data move through them, the CI workflows, and the repo map.

## Decisions (ADRs)

An architecture decision record (ADR) states one decision and its reasons, and [adr/README.md](adr/README.md) gives
the rules for writing, numbering and editing one, including the row each new record gets here.

| Record | What it decides |
| --- | --- |
| [ADR-0001: Kalandra continues Exiled Exchange 2 as its own project](adr/ADR-0001-kalandra-continues-exiled-exchange-2.md) | Kalandra's own name, app ID, repo and settings folder; upstream fixes come in only by cherry-pick with a Conventional Commits message; no agent work goes upstream; the credits stay. |
| [ADR-0002: Kalandra is under the AGPL v3 and keeps the MIT notice of the code it inherits](adr/ADR-0002-agpl-with-mit-notice.md) | Kalandra is under the AGPL v3 only, and the inherited code and every cherry-picked fix keep their MIT notice in `LICENSES/MIT.txt`. |
| [ADR-0003: A user's saved config survives every update](adr/ADR-0003-config-survives-updates.md) | A default for every field, one `configVersion` and one appended upgrade step per change, no edit to an old step, field names and `wmType` as stored format, and `HostConfig` for what main reads. |
| [ADR-0004: Only the main process reaches the operating system, and the renderer is a web page](adr/ADR-0004-process-boundary.md) | main holds all operating system access, the renderer is a page main serves over HTTP without Node integration, and `ipc/types.ts` is the only contract, with event names that state their direction. |
| [ADR-0005: Other hosts only through the proxy list, trade searches through the rate limiters](adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md) | Other hosts only through `/proxy` and the `PROXY_HOSTS` list, and every trade search, exchange and fetch through its `RateLimiter` set, which follows the server's rate limit headers. |
| [ADR-0006: Prices come from Kalandra's own price service](adr/ADR-0006-own-price-service.md) | `priceService/` builds one price file per league each hour, in divines, at `kalandra.ashoal.com/prices/`; the app never calls poe.ninja; the file's key order is a format with one shared fixture. |
| [ADR-0007: Game text comes from generated game data](adr/ADR-0007-game-text-from-game-data.md) | The parser matches item text through `CLIENT_STRINGS` and `stats.ndjson`, never English literals; `dataParser` output is regenerated, never edited; the `*.index.bin` files are built, not committed. |
| [ADR-0008: Developer docs live in docs/dev/ and are left out of the user site](adr/ADR-0008-developer-docs-layout.md) | `docs/dev/` is left out of the site by `srcExclude`, a user page links a developer doc by its GitHub URL, a user page has a frontmatter title and a developer doc an H1, 250 lines per file, one file per backlog task, and no readings directory. |
| [ADR-0009: The local server accepts requests only from its own page](adr/ADR-0009-local-server-accepts-only-its-own-page.md) | Every HTTP route listens on `httpRoutes` behind one check: `Host` is `localhost` or an IP address, `Origin` matches `Host` (required on a WebSocket), and a file route serves only the files inside its folder. |
| [ADR-0010: Scripts check the written rules](adr/ADR-0010-scripts-check-the-written-rules.md) | Standard library Python scripts in `scripts/` run as pre-commit hooks and in CI; `check.py` runs every check; 300 lines per source file with the longer inherited files at exact counts, 250 per markdown file; no em or en dash outside the listed game text; banned words read from the table in AGENTS.md; two commit-msg hooks check each commit message; the backlog indexes and the developer doc links are checked; each test suite has a coverage floor in CI. |

## Contracts

[ipc/types.ts](../../ipc/types.ts) is the contract between the main process and the renderer. It defines the
`IpcEvent` union of every message on the `/events` WebSocket, `HostConfig`, `ShortcutAction`, `HostState` and
`ClientLogEvent`. Both processes import it, so the TypeScript compiler checks every sender and every handler against
one definition. [modules/](modules/) holds one document per part of the code, each giving its purpose, its public
contract, its invariants, its dependencies and its tests:

| Document | What it covers |
| --- | --- |
| [config.md](modules/config.md) | `Config.ts` and `ConfigStore.ts`: the `Config` type, `defaultConfig()` and its defaults, `upgradeConfig()`, how the file is loaded and saved, and the next upgrade step |
| [dataparser.md](modules/dataparser.md) | `dataParser/`, the Python game data generator: its flags, its inputs, the image modes, the three files it writes per language, and its tests |
| [ipc.md](modules/ipc.md) | `ipc/`: every `IpcEvent` with its payload, sender and handler, each `HostConfig` field, the `ShortcutAction` types, and the key tables in `KeyToCode.ts` |
| [main.md](modules/main.md) | `main/`, the Electron main process: the entry, the server and the proxy, the logger, updater and tray, the hotkeys and the clipboard, the overlay window, the files under `apt-data`, and OCR |
| [price-service.md](modules/price-service.md) | `priceService/`: the files each cycle writes, the price file format and why its key order is a format, `namespaceMap.json`, the environment variables, its requests to poe.ninja, and the app side |
| [renderer-parser.md](modules/renderer-parser.md) | `renderer/src/parser/` and `renderer/src/assets/data/`: `parseClipboard()` and `ParsedItem`, the parser files, and how the game data and its index files are loaded and searched |
| [renderer-price-check.md](modules/renderer-price-check.md) | `renderer/src/web/price-check/` with `Prices.ts`, `price-source.ts` and `Leagues.ts`: the window and its hotkeys, the filters, the trade queries and rate limiters, and the price estimates |
| [scripts.md](modules/scripts.md) | `scripts/`: `check.py`, which runs every check in AGENTS.md that a machine can run, and the line, dash and prose checks: what each one reads, reports and skips, and their tests |
| [renderer-widgets.md](modules/renderer-widgets.md) | `renderer/src/web/overlay/`: the `Widget` type and its flags, `WidgetSpec`, the registry, the window manager, every registered widget, and the steps to add one |

## Runbooks

Each one is a procedure: what to run or press, in what order, what you should see, and what to do when a step
fails.

| Runbook | What it does |
| --- | --- |
| [cherry-pick-upstream.md](runbooks/cherry-pick-upstream.md) | Takes one fix from Exiled Exchange 2: the read-only `upstream` remote without its tags, finding the commit, `git cherry-pick -e`, conflicts, and the pull request against `origin` |
| [docs-site.md](runbooks/docs-site.md) | Previews, builds and deploys the user site: `npm run dev`, `build` and `preview` in `docs/`, a new page with its frontmatter title and sidebar entry, and the Docs workflow |
| [game-data-update.md](runbooks/game-data-update.md) | Rebuilds `stats.ndjson`, `items.ndjson` and `client_strings.js` for a game patch with `dataParser`, checks the diff before the commit, and writes the index files again |
| [in-game-check.md](runbooks/in-game-check.md) | Checks the behavior that needs the game on Windows: the overlay and its key, clipboard capture, the price check keys, chat commands, stash tab scrolling, OCR and `Client.txt`, each with its keys and log lines |
| [price-service-deploy.md](runbooks/price-service-deploy.md) | Runs `priceService/` with Docker Compose so that `kalandra.ashoal.com/prices/` serves its files, checks it with `curl`, and fixes an unhealthy service, failed leagues or missing prices |
| [release.md](runbooks/release.md) | Releases a version: how the Build workflow uploads only into a draft release, the five version places, the steps from the draft to the published release, and the failures |

## Backlog

Deferred work is one file per task, and each index lists the tasks without their status
([ADR-0008](adr/ADR-0008-developer-docs-layout.md), decision 6).

- [refinements/](refinements/index.md): work that is deferred and that anyone can pick up, one file per task under
  `refinements/tasks/`.
- [host/](host/index.md): checks that need Path of Exile 2 running on Windows, which an agent cannot run, one file
  per task under `host/tasks/`. The steps for each check are in [in-game-check.md](runbooks/in-game-check.md).
