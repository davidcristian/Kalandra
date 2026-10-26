# Data Parser

Builds the game data the app matches item text against: `stats.ndjson`, `items.ndjson` and `client_strings.js` for
each language, from an export of the game's files and the trade site's data endpoints.

- What it reads and writes, its flags and its tests:
  [docs/dev/modules/dataparser.md](../docs/dev/modules/dataparser.md).
- Updating the app's data for a game patch, step by step:
  [docs/dev/runbooks/game-data-update.md](../docs/dev/runbooks/game-data-update.md).

## Setup

The tool runs on Python 3.12 with the packages in [requirements.txt](./requirements.txt). From this folder:

```bash
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

On Linux and macOS, create it with `python3.12 -m venv .venv` and use `.venv/bin/python`. The commands below write
`python` for the Python in `.venv`.

## Exporting the game files

The build reads an export of the game's files in `data/vendor/`. The export tool is the npm package `pathofexile-dat`
from [SnosMe/poe-dat-viewer](https://github.com/SnosMe/poe-dat-viewer), and version 16.0.0 exported the current game
on 25 Oct 2026. From `data/vendor/`:

```bash
npx -y pathofexile-dat@16.0.0
```

It reads the game from the folder that `steam` names in [config.json](./data/vendor/config.json), the default Steam
folder on drive C:. For a Steam library on another drive, set `steam` to that folder for the run, and do not commit
that path.

## Running it

[main.py](./src/main.py) is the entry point. Run it from this folder:

```bash
python ./src/main.py
```

`--help` lists every option. An `--image-mode` other than `noLookup` sends a trade search and a fetch for each item
it looks up, and waits for the trade site's rate limits between them, so a run is slow and network heavy. `--pull` also
sends requests to the trade sites. Ask the maintainer before running either.

## Updating the app's data

`--push` copies the generated `stats.ndjson`, `items.ndjson` and `client_strings.js` for each language into
`renderer/public/data/`. `--main-repo-path` sets the repo root and defaults to `..`, the parent of this folder.
After a push, run `npm run make-index-files` in `renderer/` to rebuild the index files.
