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
- **pre-commit**, for example `pip install pre-commit`. Run `pre-commit install` once in the repo so
  the hooks run on every `git commit`.
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

The command-line options the app reads (`--no-overlay`, `--listen` and `--no-updates`) are on the
user page [docs/cmd-flags.md](docs/cmd-flags.md). `main/build/script.mjs` starts Electron without
options.

## Checks

The checks a change must pass, and which one applies to which part, are in
[AGENTS.md, What every change must pass](AGENTS.md#what-every-change-must-pass).
[docs/dev/architecture.md](docs/dev/architecture.md#ci) lists what each CI workflow runs and on
which pushes. No workflow runs `npm run build` in `renderer/` or `main/` on a pull request, so run
both yourself before opening one. Behavior inside the game is checked by hand on Windows,
following [docs/dev/runbooks/in-game-check.md](docs/dev/runbooks/in-game-check.md).

`npm run format` in `main/` or `renderer/` runs Prettier alone, which the pre-commit hooks also run.

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
