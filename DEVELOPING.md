# Developing Kalandra

How to set up a machine, run the app from source, run the checks and package it. The rules every
change follows are in [AGENTS.md](AGENTS.md). The developer docs start at
[docs/dev/index.md](docs/dev/index.md), and [docs/dev/architecture.md](docs/dev/architecture.md)
describes the parts of the app and how they talk to each other.

## What you need

- **Node 24 and npm.** Every CI job that runs Node sets up version 24.
- **Python 3.12 or newer.** `priceService/` uses only the standard library, and CI tests it on
  3.12. `dataParser/` imports `typing.override`, which Python added in 3.12, and the packages in
  [dataparser.md](docs/dev/modules/dataparser.md#tests), which no requirements file lists.
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

When `npm run dev` in `main/` fails with `Electron failed to install correctly`, the Electron
binary is missing from `main/node_modules/electron`, because its install script did not run or
did not finish. `node node_modules/electron/install.js` in `main/` downloads and extracts it.

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
| Data tool | `python -m pytest` and the hooks in `dataParser/.pre-commit-config.yaml`, in `dataParser/` |

- `npm test` in `renderer/` starts Vitest in watch mode in an interactive terminal, so use
  `npx vitest run` there.
- `npm run build` in `main/` runs `tsc --noEmit`, then the esbuild bundle. Only `npm run dev`
  imports `electron`, so the build works without the Electron binary.
- `--coverage` and `coverage report` fail when a suite covers less than the floor in its config:
  `vitest.config.ts` in `renderer/` and `main/`, and `.coveragerc` in `priceService/` and
  `scripts/`. Vitest counts every file under `src/`, so a source file no test loads counts as
  uncovered.
- `npm run lint` in `renderer/` or `main/` runs ESLint on `src/` and `specs/`, and the
  pre-commit hooks run the same files with `--fix`.
- An ESLint rule turned on after code broke it skips only that code. In `renderer/`,
  `eslint-suppressions.json` holds how many violations of each such rule each file had, and the
  lint fails when a file has more or fewer; `npm run lint -- --prune-suppressions` lowers a count
  after a fix. main's ESLint 8 has no such file, so `existingOffenders` in `main/.eslintrc.cjs`
  turns a rule off for the files listed; remove a file once it passes. Both lists only shrink.
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

## Procedures

The runbooks are listed in [docs/dev/index.md](docs/dev/index.md#runbooks).

How to run and test the price service is in [priceService/README.md](priceService/README.md), and
the data tool's options are in [dataParser/README.md](dataParser/README.md).
