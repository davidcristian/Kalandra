# The source and version of the game export command are not recorded

**Status:** done 2026-10-26
**Area:** dataparser
**Origin:** [dataParser/src/providers/game_api.py](../../../../dataParser/src/providers/game_api.py)
**Verified:** 2026-10-26

`python ./src/main.py --pull` first runs the shell command `pathofexile-dat` in
`dataParser/data/vendor/` (`run_export()` of `GameDataProvider` in `game_api.py`).
`data/vendor/config.json` holds its settings: the game's install folder in `steam`, and the
`files`, `translations` and `tables` to export. The build then reads
`data/vendor/tables/<Language>/<Table>.json` (`GameStore` in `src/stores/game_store.py`) and
`data/vendor/files/data@StatDescriptions@<name>.csd` (`Description` in
`src/stores/helpers/description.py`).

No file in the repo installs the command, names its package or names its version. Outside
`docs/dev/`, only `game_api.py` and its unit test `tests/unit/providers/test_game_api.py` name it
(`git grep pathofexile-dat`). So [runbooks/game-data-update.md](../../runbooks/game-data-update.md)
can say only what the build reads afterwards, and a new game patch cannot be processed from this
repo alone. AGENTS.md calls this copy of `dataParser/` the only source of the data.

Done looks like: the maintainer names the tool, where it comes from and the version that produced
the committed data. [modules/dataparser.md](../../modules/dataparser.md), the runbook and
`dataParser/README.md` give the install command with that exact version. If the tool installs with
pip, it also goes into the dependency list of [048](048-dataparser-dependencies.md).

## History

- 2026-10-18: Found while the game data update runbook was written. A review of the repo against
  the maintainer's documentation practices listed it as an open question.
- 2026-10-26: Done. The maintainer named the tool: the npm package `pathofexile-dat` from
  [SnosMe/poe-dat-viewer](https://github.com/SnosMe/poe-dat-viewer). A `package-lock.json` in this
  repo's history, first under `renderer/public/.DS_Store/` and then in `dataParser/`, records 11.0.1
  from the first data tool commit and 14.0.0 from v0.5.0 of January 2025, until the data tool moved
  to a private repo and the file was removed. Version 16.0.0 exported the current game on
  2026-10-25, after two columns in `config.json` got the names of the current schema. The module
  doc, the runbook and `dataParser/README.md` give `npx -y pathofexile-dat@16.0.0`, run in
  `data/vendor/`. It comes from npm, not pip, so [048](048-dataparser-dependencies.md) does not list it.
