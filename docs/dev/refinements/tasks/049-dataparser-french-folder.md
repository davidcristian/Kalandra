# dataParser has no data/json/fr folder, so a French pull fails

**Status:** open
**Area:** dataparser
**Origin:** [dataParser/src/providers/trade_api.py](../../../../dataParser/src/providers/trade_api.py)
**Verified:** 2026-10-18

`LANGUAGES` in `dataParser/src/constants/lang.py` includes `fr`. `TradeApiProvider.pull()` in
`trade_api.py` opens `data/json/<lang>/<name>.json` for writing and never creates the folder. Git
keeps the folders of the other eight languages through a `.gitkeep` each, and none for `fr`
(`git ls-files dataParser/data/json`). So a `--pull` raises `FileNotFoundError` when it writes the
first French file. Running `pull()` for `fr` with a stub session and a missing folder raises it
for `filters.json`.

The error ends the run. `main()` in `src/main.py` pulls the languages in the order of the set
`LANGUAGES`, which changes from one run to the next, so the languages after `fr` are not pulled
and no language is built. The table of errors in
[runbooks/game-data-update.md](../../runbooks/game-data-update.md) gives the manual workaround.

Done looks like: `pull()` creates the folder before it writes, with a unit test, or
`dataParser/data/json/fr/.gitkeep` is added. The same commit removes the `fr` row from the
runbook's table of errors and the `data/json/fr/` item from its list of what the machine needs.

## History

- 2026-10-18: Found while the game data update runbook was written, by comparing `LANGUAGES` with
  the tracked folders.
