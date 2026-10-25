# Developing Kalandra

How to set up a machine, run the app from source, run the checks and package it. The rules every
change follows are in [AGENTS.md](AGENTS.md). The developer docs start at
[docs/dev/index.md](docs/dev/index.md), and [docs/dev/architecture.md](docs/dev/architecture.md)
describes the parts of the app and how they talk to each other.

## What you need

- **Node 24 and npm.** Every CI job that runs Node sets up version 24.
- **Python 3.12 or newer.** `priceService/` uses only the standard library, and CI tests it on
  3.12. `dataParser/` imports `typing.override`, which Python added in 3.12, and the packages in
  `dataParser/requirements.txt` ([dataparser.md](docs/dev/modules/dataparser.md#setup)).
- **pre-commit and coverage**, for example `pip install pre-commit coverage`. Run
  `pre-commit install` once in the repo, and again after `default_install_hook_types` in
  `.pre-commit-config.yaml` changes. It installs the pre-commit hooks and the commit-msg hooks,
  which check each commit's message.
- **Windows with Path of Exile 2** to see the overlay over the game. The app also builds and runs on
  Linux and macOS, and CI packages it on all three.

## Run the app from source

The renderer and the main process run in two shells. Start the renderer first:

```shell
cd renderer
npm ci
npm run make-index-files
npm run dev
```

Then, in a second shell:

```shell
cd main
npm ci
npm run dev
```

You should see:

- `npm run dev` in `renderer/` starts Vite on `http://localhost:5173`. Vite forwards `/config`,
  `/uploads`, `/proxy` and the `/events` WebSocket to `127.0.0.1:8584` (`renderer/vite.config.mts`).
  Vite updates the page when a renderer file changes.
- `npm run dev` in `main/` runs `main/build/script.mjs`. It bundles `main/src/main.ts` with esbuild
  in watch mode and starts Electron, and starts it again after each rebuild. In this mode main
  listens on port 8584, loads the page from Vite and opens the developer tools in their own window.
- Main always loads `http://localhost:5173` (`main/build/script.mjs`), so start the renderer
  before any other Vite server, such as `npm run dev` in `docs/`. Vite gives the server started
  second the next free port.
- The overlay appears only over a window titled `Path of Exile 2`. Without the game, open
  `http://localhost:5173` in a browser to work on the page against the running main process.

Two more facts about a dev run:

- **The config is read and never written.** Main reads `apt-data/config.json` from Electron's
  `userData` folder, but `ConfigStore` (`main/src/host-files/ConfigStore.ts`) does not save while
  `VITE_DEV_SERVER_URL` is set. A setting changed in a dev run lasts until Electron restarts.
- **The game data needs its index files.** `npm run make-index-files` writes the `*.index.bin`
  files into `renderer/public/data/<lang>/`, which git ignores. Run it again after any change to
  the data there. What the files hold, and the list of languages, is in
  [renderer-parser.md](docs/dev/modules/renderer-parser.md#the-game-data).

When Electron starts and quits at once, another copy of Kalandra is running: `main/src/main.ts`
calls `app.requestSingleInstanceLock()` and exits when another copy holds it. Quit the other copy
from its tray icon.

The first `npm run dev` in `main/` downloads the Electron binary into `main/node_modules/electron`,
since the `electron` package has no install script. When the download fails, `npm run dev` stops
with `Electron failed to install correctly`; `npx install-electron` in `main/` downloads it again.

The command-line options the app reads (`--no-overlay`, `--listen` and `--no-updates`) are on the
user page [docs/cmd-flags.md](docs/cmd-flags.md). `main/build/script.mjs` starts Electron without
options.

## Checks

`python scripts/check.py` runs every check in
[AGENTS.md, What every change must pass](AGENTS.md#what-every-change-must-pass) that it can, one
after another, and ends with the names of the steps that failed. `python scripts/check.py --list`
prints the steps and runs none. Run `npm ci` in `renderer/`, `main/` and `docs/` first. To run one
part alone:

| Part | Commands |
| --- | --- |
| Pre-commit hooks | `pre-commit run --all-files` in the repo root |
| Renderer | `npm run make-index-files`, `npm run lint`, `npx vitest run --coverage` and `npm run build` in `renderer/` |
| Main process | `npm test -- --coverage` and `npm run build` in `main/` |
| Price service | `python -m coverage run -m unittest discover -s tests`, then `python -m coverage report`, in `priceService/` |
| Scripts | the same two commands in `scripts/` |
| Docs site | `npm run build` in `docs/` |
| Data tool | `python -m pytest` in `dataParser/`, then `pre-commit run -c dataParser/.pre-commit-config.yaml --all-files` in the repo root |

- `npm test` in `renderer/` starts Vitest in watch mode in an interactive terminal, so use
  `npx vitest run` there.
- `npm run build` in `main/` runs `tsc --noEmit`, then the esbuild bundle. Only `npm run dev`
  imports `electron`, so the build works without the Electron binary.
- `npm run check-types` in `renderer/`, which a pre-commit hook runs, checks `src/` and `specs/`
  with `tsconfig.json`, then `vite.config.mts` and `vitest.config.ts` with `tsconfig.node.json`.
  `npm run build` there checks only `src/` and `specs/`.
- `--coverage` and `coverage report` fail when a suite covers less than the floor in its config:
  `vitest.config.ts` in `renderer/` and `main/`, and `.coveragerc` in `priceService/` and
  `scripts/`. Vitest counts every `.ts` file under `src/`, so a `.ts` file no test loads counts
  as uncovered. The renderer's `.vue` components are not counted.
- `npm run lint` in `renderer/` or `main/` runs ESLint on `src/` and `specs/`, and in `main/`
  on `build/script.mjs` too. The pre-commit hooks run the same files with `--fix`.
- Both processes run ESLint 9 from their `devDependencies`, with the flat config in their
  `eslint.config.mjs`. Each config adds the `strict` rules of typescript-eslint to a Standard
  style base: `neostandard` in `main/` and `@vue/eslint-config-standard-with-typescript` in
  `renderer/`.
- An ESLint rule turned on after code broke it skips only that code. In `renderer/`,
  `eslint-suppressions.json` holds how many violations of each such rule each file had, and the
  lint fails when a file has more or fewer; `npm run lint -- --prune-suppressions` lowers a count
  after a fix. In `main/`, `existingOffenders` in `main/eslint.config.mjs` turns a rule off for
  the files listed; remove a file once it passes. Both lists only shrink.
- ESLint checks rule 7 of AGENTS.md in both processes: `no-explicit-any`, `ban-ts-comment` for
  `@ts-ignore` and an `@ts-expect-error` without a reason, `no-empty` for an empty `catch`, and
  `no-restricted-syntax` for a cast through `unknown` and an empty `.catch()` handler. No installed
  plugin checks the reason on an `eslint-disable` line, so reading the diff checks it.
- `no-console` allows only `console.warn` and `console.error`, except in `main/build/script.mjs`.
  main writes the rest of its messages with `Logger`, which the Debug settings page shows, and
  uses the console only before `Logger` exists.
- `check.py` leaves out the data tool, whose tests need files the repo does not have
  ([dataparser.md](docs/dev/modules/dataparser.md#tests)).

[docs/dev/architecture.md](docs/dev/architecture.md#ci) lists what each CI workflow runs and on
which pushes. No workflow runs `npm run build` in `renderer/` or `main/` on a pull request, and
`check.py` does, so run it before opening one. Behavior inside the game is checked by hand on
Windows, following [docs/dev/runbooks/in-game-check.md](docs/dev/runbooks/in-game-check.md).

`npm run format` in `main/` or `renderer/` runs Prettier alone, which the pre-commit hooks also run.
It keeps the line endings it finds (`"endOfLine": "auto"` in each `.prettierrc`). Git for Windows
checks files out with CRLF (`core.autocrlf=true`) and counts a file rewritten with LF as modified,
even when `git diff` shows nothing.

## Package locally

`testUpdate.sh` builds installers for the platform it runs on. From the repo root, in Git Bash on
Windows:

```shell
sh testUpdate.sh
```

It deletes `renderer/dist` and `main/dist`, then runs `npm install`, `npm run make-index-files` and
`npm run build` in `renderer/`, and `npm install`, `npm run build` and `npm run package` in
`main/`. `npm run package` is electron-builder with the targets in `main/electron-builder.yml`, so
on Windows it writes the NSIS installer and the portable exe to `main/dist/`. Outside CI and without
a tag, electron-builder uploads nothing. It signs nothing either, since the repo sets no
certificate.

`npm install` can rewrite `package-lock.json`. Run `git status` afterwards and keep no lock file
change you did not intend.

## Dependencies

npm 12 (Node 24.18.1 includes 12.1.0) runs a dependency's install script only when `allowScripts` in
the `package.json` of that folder has an entry for the package. It skips every other install script
and lists the skipped ones at the end of the install; `npm install-scripts ls` lists them again.

- Each entry here names an exact version, such as `uiohook-napi@1.5.4`. An update that changes the
  version of a package in `allowScripts` makes npm skip its script. Read the new version's install
  script, then run `npm install-scripts approve <package>` in that folder, which writes the new
  version into the entry, and `npm rebuild <package>`, which runs the script. Commit `package.json`
  with the lock file.
- `electron` has no install script: `require("electron")` downloads the binary on its first run.
  `electron-overlay-window` and `uiohook-napi` run `node-gyp-build`, which finds their prebuilt
  Node-API binaries and compiles nothing.
- `npm install-scripts prune` removes the entries whose package is gone or has no install script.
- The `allowscripts` pre-commit hook fails when an entry names a package that the lock file has at
  another version or without an install script
  ([scripts.md](docs/dev/modules/scripts.md#allowscriptspy)).
- `renderer/` and `docs/` have no `allowScripts`: Vite 8 in `renderer/` builds with Rolldown and
  does not need esbuild. npm skips the scripts of `vue-demi`, `unrs-resolver` and the esbuild of
  `docs/`, and the tests and builds pass without them.
- An `overrides` entry has its reason in the module doc of its folder.
- npm lists `postcss-selector-parser` 6.1.5 in `renderer/` as vulnerable to GHSA-rj75-hqrm-r3gf.
  Tailwind CSS 3 depends on it through `^6`, and 6.1.5 has the fix backported from 7.1.6, but the
  advisory names only 7.1.6 as fixed. So no override moves Tailwind CSS 3 to version 7.
- A Vue update in `renderer/` must keep the watchers of a component in the order they are
  defined, which `CheckedItem.vue` needs
  ([renderer-price-check.md](docs/dev/modules/renderer-price-check.md)).
  `specs/web/watch-order.test.ts` there fails on a Vue that changes the order.

## Procedures

The runbooks are listed in [docs/dev/index.md](docs/dev/index.md#runbooks).

How to run and test the price service is in [priceService/README.md](priceService/README.md), and
the data tool's options are in [dataParser/README.md](dataParser/README.md).
