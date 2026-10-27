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

## Setup

`requirements.txt` lists the packages that `src/` and `tests/` import, and `pandas-stubs`, which the Pyright hook
needs, at the exact versions the tests pass with on Python 3.12. `numpy` must stay at 2 or newer, for
`numpy.strings`. From `dataParser/`:

```sh
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

## Command line

`python ./src/main.py`, run from `dataParser/`, since the output paths are relative to the working directory. The
flags (`src/main.py`):

| Flag | Default | Does |
| --- | --- | --- |
| `--pull` | off | first runs the game export and pulls the trade site data into `data/`, then builds |
| `--image-mode` | `noLookup` | how the English build finds item icons: `noLookup`, `missing`, `new` or `all` ([Image modes](#image-modes)) |
| `--league` | `Standard` | the trade league the image lookups search, as the trade site names it |
| `--push` | off | copies each language's three files to `<main-repo-path>/renderer/public/data/<lang>/` |
| `--main-repo-path` | `..` | the repo root, which is the parent of `dataParser/` |
| `--log` | `info` | the log level: `debug`, `info`, `warn` or `error` |

Each module logs through `logging.getLogger(__name__)`, so each line names its module. Only the `__main__` block of a
command sets the log level and format, so importing a module changes neither.

Without `--pull`, it builds from the inputs already in `data/`. It builds English first, then the other eight
languages in no fixed order, and each language overwrites `output/<lang>/stats.ndjson`, `items.ndjson` and
`client_strings.js`. Each build logs `Building <lang>: <n>/9` between two lines of `=` signs.

`src/create-styles.py` is a second command. It builds three CSS user styles for the trade site (`tagOnly`,
`tagOnlyCompact` and `kvanRules`). A rule that matches no stat writes only a comment with its name and logs a
warning. It writes each style to `output/css/` and then copies it to `../gist-trade-highlight/`. This repo has no
such folder, so the first copy fails and ends the run before the other two styles are written. The app does not read
these styles.

## Inputs

None of these is committed: git has only `data/vendor/config.json` and `.gitkeep` files that keep the empty folders.
No `.gitignore` entry covers them either, so `git status` lists them after a run.

| Path | Contents | Written by |
| --- | --- | --- |
| `data/vendor/tables/<Language>/<Table>.json` | one JSON file per game table and language; the folder is the language's name in `translations` (`English`, `Traditional Chinese`) | the game export |
| `data/vendor/files/data@StatDescriptions@<name>.csd` | the game's stat description files, the templates for mod text, UTF-16 with every language in one file | the game export |
| `data/json/<lang>/{filters,stats,items,static}.json` | the trade site's `/api/trade2/data/` endpoints, one set per language | `--pull` |
| `src/services/itemImageCache.json` | item icon URLs found by earlier image lookups | every build: `ImageProvider` creates it empty when it is missing and saves it after it sets the icons |

**The game export.** The export tool is the npm package `pathofexile-dat` from
[SnosMe/poe-dat-viewer](https://github.com/SnosMe/poe-dat-viewer). Version 16.0.0 exported the current game on
25 Oct 2026. Run it from `data/vendor/`:

```sh
npx -y pathofexile-dat@16.0.0
```

It reads `data/vendor/config.json`: `steam`, the Path of Exile 2 install folder it reads from; `files`, the stat
description files to extract; `translations`, the languages; and `tables`, each table with the columns to keep. The
committed `steam` is the default Steam folder on drive C:. When the game is in a Steam library on another drive, set
`steam` to that folder for the run and do not commit it. When a game patch renames a column that `tables` lists, the
export stops at that table, and the column needs the new name there.

`--pull` also runs the export, but only as the command `pathofexile-dat` on the PATH, in `data/vendor/` and without a
shell (`GameDataProvider` in `src/providers/game_api.py`). `npx` does not put it on the PATH. A command missing from
the PATH or a failed export is logged as `Game data export failed: <error>`, and the build continues with whatever
`data/vendor/` already holds.

**The trade data.** `TradeApiProvider` (`src/providers/trade_api.py`) requests the four endpoints for each language
from the host in `LANG_URLS` (`src/constants/urls.py`), 36 requests one at a time through one `RequestPacer`
(`src/services/request_pacer.py`). Each language's host is one that `tradeHost()` in `renderer/src/web/trade-host.ts`
returns for it, which `tests/unit/constants/test_urls.py` checks. The requests:

- Each request starts at least 5 seconds after the one before, as the app's trade requests do until the trade site
  sends its limits.
- After each response it reads `Retry-After` and the `X-Rate-Limit-<rule>` and `X-Rate-Limit-<rule>-State` headers
  that `X-Rate-Limit-Rules` names. It waits the seconds a restriction has left, or the whole window of a rule that
  is one request from its limit. A header it cannot read is logged as `Ignored ...` and adds no wait.
- A request that gets a 429 is sent again up to three times, after the response's wait or 60 seconds when the
  response has none. Then it logs `Rate limited 4 times, gave up on: <url>`, and that file keeps its old copy.

It uses `cloudscraper`, which needs Node.js on the PATH (`interpreter="nodejs"`) and sends a browser User-Agent.
`create_trade_session` adds `kalandra-dataparser/1` and the link to the issues to it, as Electron adds the app's name
to the app's User-Agent. It sorts the entries of `stats.json` by id. It writes a file only after the response passes
these checks, and otherwise logs the failure and keeps the old copy:

- A request that raises, such as on a lost connection, is logged as `Failed to fetch JSON from: <url>, error: <error>`.
- A status other than 200 is logged as `Failed to fetch JSON from: <url>, code: <status>`.
- A body that is not JSON or has no `result` list is logged as `Failed to read JSON from: <url>, error: <reason>`, as
  is a `stats` group without `id`, `label` or an `entries` list, or with an entry without `id`.

It writes the new copy to `<name>.json.tmp` and then moves it over the old one, so a failed write also keeps the old
copy, and its error ends the pull. Before the first request it creates the folder `data/json/<lang>/` when it is
missing, as `data/json/fr/` is in a clone, since that folder has no `.gitkeep`.

## Image modes

`ImageProvider` (`src/services/image_provider.py`) sets each item's `icon`:

- `noLookup` only reads the cache. An item missing from it gets `%NOT_FOUND%`.
- `new` looks up items that are missing from the cache.
- `missing` looks up items that are missing from the cache or cached as `%NOT_FOUND%`.
- `all` looks up every item.

A lookup is a trade search and a fetch on `www.pathofexile.com`, through the tool's own `RateLimiter`
(`src/services/rate_limiter.py`). The search is in the league that `--league` names, which `search_url()` adds to
the search address. The default is `DEFAULT_LEAGUE`, `Standard`, since the trade site lists it in every season. After each response it reads the `X-Rate-Limit-Ip` and
`X-Rate-Limit-Ip-State` headers. With T as twice the seconds per request a rule allows, it waits 1.4 T when the
previous response of the same policy came at most 1.5 T before, 3 T when the rule's count is at 90% of its limit, and
the rule's full penalty when the state reports a restriction.

A lookup that gets a status other than 200 or 429, or an icon URL outside `https://web.poecdn.com/gen/image`, logs
`Image lookup failed for <item>: <reason>` and caches `%NOT_FOUND%` for the item, so `missing` looks it up again. Five
such failures in a row, three 429 responses to one request, or a request that raises end the build. The cache is saved
in every case, with the icons found before the failure.

Only the English build uses `--image-mode`. The other languages use `noLookup` and read the cache the English build
saved. Each run copies the cache to `src/services/itemImageCache.old.json` once, before the English build, so the
copy keeps the cache from before the run's lookups. Where the trade site's `static.json` has an image for an item,
that image replaces the icon (`src/services/static_items.py`). An entry without an image, such as a list separator,
leaves the item's icon unchanged. The cache is not in this repo, so a `noLookup` run without it writes `%NOT_FOUND%`
for every other icon.

## Outputs

`output/<lang>/` for each language in `LANGUAGES` in `src/constants/lang.py`, the same nine as the app's list in
[renderer-parser.md](renderer-parser.md#the-game-data). The two `.ndjson` files are NDJSON (newline-delimited JSON):
one JSON object per line, written by `write_ndjson` in `src/main.py`. A field without a value is left out, and a NaN
inside a value stops the build with a `ValueError`, since `JSON.parse` in the app cannot read `NaN`.

- `stats.ndjson`, one line per stat: `ref` (the English text), `better`, `matchers` (the text in this language, with
  `#` for a number) and `trade.ids` (the trade site's stat ids by type, or `null` for a stat without any, such as a
  logbook faction), plus `id`, `dp`, `fromAreaMods`, `trade.option` and `trade.inverted` where they apply. The parser
  matches mod lines against `matchers`. The types of a trade id without a `|<value>` part are those in `MOD_TYPES`
  (`src/constants/mod_types.py`), with `augment` written as `rune`. Any other type on such an id in the trade site's
  `stats.json` stops the build with a `ValueError`. Each matcher of `Allocates #` has `oils`, the English item names
  of the three oils that anoint the notable, from the game's `BlightCraftingItems` rows (`get_blight()` in
  `src/services/value_converter_service.py`). Every language gets the English stat list
  (`src/services/english_stat_list.py`): the same refs and a stat for every English trade id. Stats that share an
  English matcher text become one stat in every language, under the ref the English build keeps. Stats that only the
  language gives the same text stay apart, and each gets the trade ids of all of them, so a search finds any of them.
  The `trade.ids` of each list its own types first, then the other types in the order of their refs, so the file does
  not change with `PYTHONHASHSEED`. A stat that the language's trade site does not list takes its matchers from the
  game's descriptions, and has none when the game has no description for it either: on 25 Oct 2026 `pathofexile.tw`
  listed 5915 of the 8229 stat ids of `www.pathofexile.com`, so 33 Traditional Chinese stats, such as the `Bonded:` rune
  stats, have no matchers.
- `items.ndjson`, one line per item: `name` (this language), `refName` (English), `namespace`, `icon`, `tags`, `w`,
  `h`, and `craftable`, `unique`, `tradeTag`, `armour` and `augment` where they apply. A unique's `refName`
  is its name on the English trade site, and its `name` is the `Text2` of the game's `Words` row whose English
  `Text2` is that name (`src/services/unique_names.py`). `Text` is the game's internal name, which keeps an old name
  after a rename. A unique without such a row is left out and logged as `No unique named <name> ...`.
- `client_strings.js`, a JavaScript module whose default export maps app keys such as `RARITY_NORMAL` to the game's
  text in this language, as a string, an array or a regular expression. `TranslationDict` in
  `renderer/src/assets/data/interfaces.ts` types it. A client string is a piece of text from the game's
  `ClientStrings` table. Each key comes from an entry in `CLIENT_STRING_KEY_VALUES`, `CLIENT_STRING_ARRAYS` or
  `CLIENT_STRING_REGEX` in `src/constants/client_string_data.py`, and each key must be a key of `TranslationDict`,
  which `tests/unit/constants/test_client_string_data.py` checks. An entry names the `ClientStrings` ids its text is
  built from, or gives a fixed text (`ConstClientString` and `ConstRegexClientString`). A regular expression built
  from game text (`CapturePlaceholderClientString`) matches that text literally: the tool escapes each character
  that a JavaScript regex reads as syntax, and `/` and line breaks, and puts a capture group or the entry's `format`
  in place of each placeholder such as `{0}`. A write that fails, such as on text with no UTF-8 form, logs `Failed to write <path>: <error>` and
  stops the build.

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
  below check the last two, and Pyright fails on a parameter without an annotation or a value of unknown type. It
  passes a missing return annotation whose type it infers.

## Tests

`python -m pytest` in `dataParser/`, where `pyproject.toml` adds `.` and `src` to the import path. `tests/unit/`
tests the constants, models, providers, services and stores one module at a time. Its provider tests run a fake
export command, the trade site and image lookup tests use the fake session and clock in `tests/fake_http.py`, and its
description tests compare the blocks they load from the sample files in `tests/data/cases/` with
`tests/data/expected/`. `tests/integration/` reads real files. Its description tests compare the frame parsed from a
sample file with `tests/data/expected/<name>_integration.json` and skip a sample without one. Only the bleeding
sample has one, since a description's hash can be checked by hand only against a trade site stat id.
`test_game_store_i.py` fails when parsed game text keeps markup such as `[` or `|` for an id outside
`BROKEN_GAME_TEXT`, the ids whose game text is broken, or when one of those ids is fixed, so a game patch that changes
either updates that set. `tests/test_main.py` runs `main()` end to end with `push`, checks the files it writes and
copies, checks that each language has the English refs and trade ids and that stats sharing a game text have the same
trade ids, and tests the `--pull` step with a fake export and the fake session. Every test writes to a temporary folder:
`main()` takes the output folder and `ImageProvider` the cache folder, and `NdBuilderService` opens the image cache
only when it applies the icons.

The hooks in `dataParser/.pre-commit-config.yaml` run Ruff (lint with `--fix`, and format), Bandit outside `tests/`,
the pygrep checks (annotations instead of type comments, no `eval`, no blanket `noqa`, no misused mock assertions
and no `log.warn`) and Pyright in strict mode on `src/`. Pyright reads its settings from `pyproject.toml` and the
packages from `dataParser/.venv`, which needs `pandas-stubs` for the pandas types. `stubs/cloudscraper/` declares the
calls the tool makes to `cloudscraper`, which has no types. Run the hooks with
`pre-commit run -c dataParser/.pre-commit-config.yaml --all-files` in the repo root. pre-commit runs every hook from
the repo root, so the config's top-level `files: ^dataParser/` keeps them to this folder. The Data tool job of
`.github/workflows/test.yml` runs the tests and these hooks on Python 3.12 for a change under `dataParser/` or to
the two renderer files its tests read ([architecture.md](../architecture.md#ci)). The root `.pre-commit-config.yaml`
does not include these hooks, so Lint & Format does not run them.

The tests that read inputs a clone does not have skip with a reason when the inputs are missing. `tests/inputs.py`
gives the markers: `needs_game_export` skips when `data/vendor/tables/` and `data/vendor/files/` hold no file but
`.gitkeep`, and `needs_trade_data` when `data/json/` holds none. `test_game_store_i.py` needs the export, and the
`main()` tests that build every language need both. `ValueConverterService` reads the blight tables on first use and
the advanced stat descriptions through `GameStore`, so its tests give it small tables through a `FakeGameStore`.
Without the inputs, 269 tests pass and 280 skip on 27 Oct 2026.

**Dependencies.** Python 3.12, the packages in `requirements.txt` ([Setup](#setup)), Node.js for `cloudscraper` and
`npx`, `pathofexile-dat` 16.0.0 from npm, a local Path of Exile 2 install, and the official trade sites.
