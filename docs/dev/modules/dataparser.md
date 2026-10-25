# dataParser/: the game data generator

**Purpose.** `dataParser/` is a Python tool that builds the game data the app matches copied item text against, for
each of the nine languages the app supports. It reads an export of the game's own data files and the trade site's
data endpoints, writes `stats.ndjson`, `items.ndjson` and `client_strings.js` per language, and with `--push` copies
them into `renderer/public/data/<lang>/`. It is the only source of those files
([ADR-0007](../adr/ADR-0007-game-text-from-game-data.md)), and the data committed in `renderer/public/data/` can be
newer than what this copy of the tool produces (see [Outputs](#outputs)). Updating the data for a game patch:
[game-data-update.md](../runbooks/game-data-update.md). The commands:
[dataParser/README.md](../../../dataParser/README.md). The parser that reads the data:
[renderer-parser.md](renderer-parser.md).

## Command line

`python ./src/main.py`, run from `dataParser/`, since the output paths are relative to the working directory. The
flags (`src/main.py`):

| Flag | Default | Does |
| --- | --- | --- |
| `--pull` | off | first runs the game export and pulls the trade site data into `data/`, then builds |
| `--image-mode` | `noLookup` | how the English build finds item icons: `noLookup`, `missing`, `new` or `all` ([Image modes](#image-modes)) |
| `--push` | off | copies each language's three files to `<main-repo-path>/renderer/public/data/<lang>/` |
| `--main-repo-path` | `..` | the repo root, which is the parent of `dataParser/` |
| `--log` | `info` | the log level: `debug`, `info`, `warn` or `error` |

Without `--pull`, it builds from the inputs already in `data/`. It builds English first, then the other eight
languages in no fixed order, and each language overwrites `output/<lang>/stats.ndjson`, `items.ndjson` and
`client_strings.js`. Each build logs `Building <lang>: <n>/9` between two lines of `=` signs.

`src/create-styles.py` is a second command. It builds three CSS user styles for the trade site (`tagOnly`,
`tagOnlyCompact` and `kvanRules`). It writes each one to `output/css/` and then copies it to
`../gist-trade-highlight/`. This repo has no such folder, so the first copy fails and ends the run before the other two
styles are written. The app does not read these styles.

## Inputs

None of these is committed: git has only `data/vendor/config.json` and `.gitkeep` files that keep the empty folders.
No `.gitignore` entry covers them either, so `git status` lists them after a run.

| Path | Contents | Written by |
| --- | --- | --- |
| `data/vendor/tables/<Language>/<Table>.json` | one JSON file per game table and language; the folder is the language's name in `translations` (`English`, `Traditional Chinese`) | the game export |
| `data/vendor/files/data@StatDescriptions@<name>.csd` | the game's stat description files, the templates for mod text, UTF-16 with every language in one file | the game export |
| `data/json/<lang>/{filters,stats,items,static}.json` | the trade site's `/api/trade2/data/` endpoints, one set per language | `--pull` |
| `src/services/itemImageCache.json` | item icon URLs found by earlier image lookups | every build: `ImageProvider` creates it empty when it is missing and saves it after it sets the icons |

**The game export.** `--pull` finds the command `pathofexile-dat` on the PATH and runs it in `data/vendor/` without a
shell (`GameDataProvider` in `src/providers/game_api.py`). The command reads `data/vendor/config.json`: `steam`, the
Path of Exile 2 install folder it reads from, set to a Steam install on Windows; `files`, the stat description files
to extract; `translations`, the languages; and `tables`, each table with the columns to keep. No file in this repo
installs that command or names its version. A command missing from the PATH or a failed export is logged as
`Game data export failed: <error>`, and the build continues with whatever `data/vendor/` already holds.

**The trade data.** `TradeApiProvider` (`src/providers/trade_api.py`) requests the four endpoints for each language
from the host in `LANG_URLS` (`src/constants/urls.py`), 36 requests in a row with no pause. It uses `cloudscraper`,
which needs Node.js on the PATH (`interpreter="nodejs"`). It sorts the entries of `stats.json` by id. A response
other than 200 is logged as `Failed to fetch JSON from: <url>, code: <status>`, and that file keeps its old copy.
The folder `data/json/fr/` is not in the repo, and the tool does not create it.

## Image modes

`ImageProvider` (`src/services/image_provider.py`) sets each item's `icon`:

- `noLookup` only reads the cache. An item missing from it gets `%NOT_FOUND%`.
- `new` looks up items that are missing from the cache.
- `missing` looks up items that are missing from the cache or cached as `%NOT_FOUND%`.
- `all` looks up every item.

A lookup is a trade search and a fetch on `www.pathofexile.com`, in the league that `SEARCH_URL` names, through the
tool's own `RateLimiter` (`src/services/rate_limiter.py`). Only the English build uses `--image-mode`. The other
languages use `noLookup` and read the cache the English build saved. Each build first copies the cache to
`src/services/itemImageCache.old.json`. Where the trade site's `static.json` has an image for an item, that image
replaces the icon. The cache is not in this repo, so a `noLookup` run without it writes `%NOT_FOUND%` for every other
icon.

## Outputs

`output/<lang>/` for each language in `LANGUAGES` in `src/constants/lang.py`, the same nine as the app's list in
[renderer-parser.md](renderer-parser.md#the-game-data). The two `.ndjson` files are NDJSON (newline-delimited JSON):
one JSON object per line.

- `stats.ndjson`, one line per stat: `ref` (the English text), `better`, `matchers` (the text in this language, with
  `#` for a number) and `trade.ids` (the trade site's stat ids by type, or `null` for a stat without any, such as a
  logbook faction), plus `id`, `dp`, `fromAreaMods`, `trade.option` and `trade.inverted` where they apply. The parser
  matches mod lines against `matchers`.
- `items.ndjson`, one line per item: `name` (this language), `refName` (English), `namespace`, `icon`, `tags`, `w`,
  `h`, and `craftable`, `unique`, `tradeTag`, `gem`, `armour` and `augment` where they apply.
- `client_strings.js`, a JavaScript module whose default export maps app keys such as `RARITY_NORMAL` to the game's
  text in this language, as a string, an array or a regular expression. `TranslationDict` in
  `renderer/src/assets/data/interfaces.ts` types it. A client string is a piece of text from the game's
  `ClientStrings` table. Each key comes from an entry in `CLIENT_STRING_KEY_VALUES`, `CLIENT_STRING_ARRAYS` or
  `CLIENT_STRING_REGEX` in `src/constants/client_string_data.py`. An entry names the `ClientStrings` ids its text is
  built from, or gives a fixed text (`ConstClientString` and `ConstRegexClientString`).

`dataParser/output/` is tracked by git, and `--push` copies from it. On 18 Oct 2026 the app's data is newer than this
output: `wc -l` gives 1936 lines for `dataParser/output/en/stats.ndjson` and 2526 for
`renderer/public/data/en/stats.ndjson`, and `grep -c '"map"' renderer/public/data/en/items.ndjson` gives 16 Waystone
lines with a `map` field, which this copy of the tool does not write.

`--push` writes only the three files per language. The other files in `renderer/public/data/` (`namespaceMap.json`,
`item-drop.json`, `item-drop.jsonc`, `remnants.json`, `patrons.json` and each `app_i18n.json`) are not this tool's
output. After a push, run `npm run make-index-files` in `renderer/`. It writes the `*.index.bin` lookup files from
the two `.ndjson` files ([renderer-parser.md](renderer-parser.md#the-game-data)), and git ignores them.

## Invariants

- The three files under `renderer/public/data/<lang>/` change only through this tool. A wrong line is fixed in the
  generator or its inputs, and when this copy cannot produce the fix, stop and ask the maintainer
  ([AGENTS.md](../../../AGENTS.md)).
- `--pull` and every image mode other than `noLookup` send requests to the official trade sites, so ask the maintainer
  first ([AGENTS.md](../../../AGENTS.md), Safety).
- `--push` replaces the app's data with this copy's output, which can drop lines and fields the committed data has.
  Read the diff before committing ([game-data-update.md](../runbooks/game-data-update.md)).
- Python code has type annotations, no `eval` and no blanket `noqa` ([AGENTS.md](../../../AGENTS.md)). The hooks
  below check the last two.

## Tests

`python -m pytest` in `dataParser/`, where `pyproject.toml` adds `.` and `src` to the import path. `tests/unit/`
tests the constants, models, providers, services and stores one module at a time. Its provider tests mock the export
command and the trade site requests, and its description tests read the sample files in `tests/data/cases/`.
`tests/integration/` reads real files, and `tests/test_main.py` runs `main()` end to end. The hooks in
`dataParser/.pre-commit-config.yaml` run Ruff (lint with `--fix`, and format), Bandit outside `tests/`, and the
pygrep checks: annotations instead of type comments, no `eval`, no blanket `noqa`, no misused mock assertions and no
`log.warn`. Run them with `pre-commit run -c dataParser/.pre-commit-config.yaml --all-files` in the repo root.
pre-commit runs every hook from the repo root, so the config's top-level `files: ^dataParser/` keeps them to this
folder. CI runs neither: `.github/workflows/test.yml` has no job for `dataParser/`, and the root
`.pre-commit-config.yaml` does not include these hooks.

A fresh clone cannot pass the tests as of 18 Oct 2026:

- No file lists the packages `src/` and `tests/` import: `pandas`, `numpy` 2 or newer (for `numpy.strings`), `tqdm`,
  `cloudscraper`, `requests`, `murmurhash2` and `pytest`.
- `tests/integration/stores/test_game_store_i.py` needs the game export in `data/vendor/`, and `tests/test_main.py`
  needs it and the trade data in `data/json/`.
- The description tests in `tests/unit/stores/helpers/test_description.py` and `tests/integration/stores/helpers/`
  read expected results from `tests/data/expected/`, which is not in the repo.

**Dependencies.** Python, the packages above, Node.js for `cloudscraper`, the `pathofexile-dat` command, a local
Path of Exile 2 install, and the official trade sites.
