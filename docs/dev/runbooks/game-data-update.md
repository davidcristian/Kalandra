# Runbook: updating the game data for a patch

How to rebuild `stats.ndjson`, `items.ndjson` and `client_strings.js` for every language after a Path of Exile 2
patch changes item text, stats or client strings, and how to check the result before it is committed. Client strings
are the game's own text from its `ClientStrings` table, which the parser matches item text against. What the tool
reads and writes: [dataparser.md](../modules/dataparser.md). Decision:
[ADR-0007](../adr/ADR-0007-game-text-from-game-data.md). The parser that reads the data:
[renderer-parser.md](../modules/renderer-parser.md).

The data is generated, never edited by hand: when the output is wrong, fix the generator or its inputs and run it
again, and when this copy of the tool cannot produce the fix, stop and ask the maintainer
([AGENTS.md](../../../AGENTS.md)). Steps 2 and 3 send requests to the official trade sites, so an agent asks the
maintainer before each of them.

## What the machine needs

Nothing below is installed or listed by this repo; each item names the file that expects it.

- Path of Exile 2, installed in the folder that `steam` names in `dataParser/data/vendor/config.json`. The committed
  value is a Steam install folder on Windows.
- The `pathofexile-dat` command on the PATH, which `src/providers/game_api.py` runs. This repo does not say where the
  command comes from or which version the data was built with, so ask the maintainer.
- Node.js on the PATH, for `cloudscraper` in `src/providers/trade_api.py`.
- Python and the packages in [dataparser.md](../modules/dataparser.md#tests), which `dataParser/src/` and
  `dataParser/tests/` import.
- The item image cache `dataParser/src/services/itemImageCache.json` from the last run. Without it, every icon that
  the trade site's `static.json` does not give becomes `%NOT_FOUND%`.
- The folder `dataParser/data/json/fr/`, which git does not create. Create it before step 2.

## Before the run

Write down the current state, so step 5 can compare against it. From the repo root:

```sh
wc -l renderer/public/data/*/stats.ndjson renderer/public/data/*/items.ndjson
grep -c '%NOT_FOUND%' renderer/public/data/en/items.ndjson
grep -c '"map"' renderer/public/data/en/items.ndjson
```

On 18 Oct 2026 the last two print 445 and 16.

## Steps

1. **Check the export settings.** In `dataParser/data/vendor/config.json`, `steam` must be the game's install folder
   on this machine. When the tool must read a table or a stat description file that the patch adds, add it to
   `tables` or `files` there and to `src/constants/filenames.py`.

2. **Pull the inputs** (ask first). From `dataParser/`:

   ```sh
   python ./src/main.py --pull
   ```

   This runs the game export into `data/vendor/`, requests the trade site data for each language into
   `data/json/<lang>/`, then builds every language into `output/`. The log shows `Exported game data to: <path>`
   once, then `Fetching JSON from: <url> for language: <lang>` and `Saved JSON to: <path>` for each of the 36 trade
   files, then `Building <lang>: <n>/9` for each language. The trade requests go one at a time, 5 seconds apart,
   or further apart when the trade site's rate limit headers set a longer wait, so they take at least three minutes.

   `Game data export failed: <error>` means the export did not run, and the build used whatever `data/vendor/` held.
   A `Failed to fetch JSON from: <url>, code: <status>` line means that file kept its old copy. Fix either before
   going on, since the build in step 4 reads whatever `data/` holds.

3. **Look up new icons** (optional, ask first). Items new in the patch have no icon in the cache. `SEARCH_URL` in
   `src/services/image_provider.py` names the league the lookups search, `Fate of the Vaal` on 18 Oct 2026, which is
   not in poe.ninja's league list of that date (`priceService/tests/fixtures/ninja/leagues.json`). Change it to a
   current trade league in its own commit, then run:

   ```sh
   python ./src/main.py --image-mode missing
   ```

   The modes are listed in [dataparser.md](../modules/dataparser.md#image-modes). Without a cache file, `missing` and
   `new` both look up every item. The run saves the cache, and the next run reads it.

4. **Build and copy into the app.** From `dataParser/`:

   ```sh
   python ./src/main.py --push
   ```

   This builds from `data/` with no request and logs `Copying files to renderer/public/data` once per language, after
   that language's build.

5. **Read the diff.** Run the commands from [Before the run](#before-the-run) again, then
   `git diff --stat renderer/public/data`. Expect changed lines in all nine languages for the stats and items the
   patch changed. Stop and ask the maintainer, and do not commit, when:

   - a language has fewer lines in `stats.ndjson` or `items.ndjson` than before, and the patch removed nothing that
     explains it;
   - the `%NOT_FOUND%` count went up;
   - the `"map"` count fell, since this copy of the tool writes no `map` field
     ([dataparser.md](../modules/dataparser.md#outputs));
   - `git diff renderer/public/data/en/client_strings.js` shows a removed key.

   `git restore renderer/public/data dataParser/output` puts the committed data back. It also discards every other
   uncommitted change under those two folders, such as an edit to an `app_i18n.json`.

6. **Rebuild the index files.** In `renderer/`:

   ```sh
   npm run make-index-files
   ```

   It writes the `*.index.bin` files next to each language's data, as
   [renderer-parser.md](../modules/renderer-parser.md#the-game-data) describes. Git ignores them, and the tests and
   the build read them.

7. **Run the renderer checks.** In `renderer/`: `npm run lint`, `npx vitest run` and `npm run build`. The parser
   tests in `renderer/specs/Parser/` parse real copied item text with the English data, and a failure names the test
   whose item no longer parses.

8. **Add parser cases** for item text the patch changed: the text copied from the game, added under
   `renderer/specs/Parser/` (`items.ts` holds the copied items). Copying needs the game, so the maintainer collects
   the text ([in-game-check.md](in-game-check.md)).

9. **Commit** the data update as its own commit with the `data` scope, apart from any code change
   ([AGENTS.md](../../../AGENTS.md), Commits). It contains the changed files under `renderer/public/data/` and under
   `dataParser/output/`, which `--push` made identical. The inputs in `dataParser/data/` and the image cache are not
   committed.

## When it fails

| Error | Cause | What to do |
| --- | --- | --- |
| `FileNotFoundError` for `data/vendor/tables/<Language>/<Table>.json` | the export did not write that table | read the export's own output in step 2, and check the table and `translations` in `config.json` |
| `FileNotFoundError` for `data/vendor/files/data@StatDescriptions@<name>.csd` | the export did not write that stat description file | check `files` in `config.json` against `STAT_DESCRIPTION_FILES` in `src/constants/filenames.py` |
| `FileNotFoundError` for `data/json/fr/<name>.json` during `--pull` | the folder does not exist | create `dataParser/data/json/fr/` and run step 2 again |
| `Rate limited 4 times, gave up on: <url>` during step 2 | the trade site returned 429 for the request and its three retries; that file kept its old copy | run step 2 again only after the seconds in the last `Waiting <seconds> seconds for the rate limit of: <url>` line have passed, and never in a loop |
| `FileNotFoundError` for `data/json/<lang>/<name>.json` during a build | the trade data was never pulled for that language | run step 2 |
| `KeyError` from `use_game_store` in `src/services/client_strings_builder.py` | the patch renamed or removed a `ClientStrings` id the tool reads | find the entry with that id in `src/constants/client_string_data.py` and change it to the new id |
| `ValueError: No data found for <file>` or `No descriptions found for <file>` | a stat description file is empty or has no `description` block | run the export again; if the file stays empty, stop and ask the maintainer |
| `Unexpected status code` or `Retry limit exceeded` during step 3 | a lookup got a status other than 200 or 429, or got 429 three times; the error ends the run, and the cache is saved only at the end of the English build, so the lookups before the error are lost | stop; check `SEARCH_URL`, and do not retry in a loop, since the trade site bans clients that exceed its limits |
| a parser test fails in step 7 | the new data changed a line the parser reads | fix the generator, or add the client string the parser needs; never edit the generated file |

Each build shows a progress bar over the items. In an image mode other than `noLookup`, each lookup waits for the
trade site's rate limits, so the English bar moves slowly in step 3. That is expected and is no reason to restart it.
