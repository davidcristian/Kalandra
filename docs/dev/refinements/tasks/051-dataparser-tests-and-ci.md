# dataParser tests need files the repo does not have, and CI does not run them

**Status:** open
**Area:** dataparser
**Origin:** [dataParser/tests/](../../../../dataParser/tests/)
**Verified:** 2026-10-18

`tests/unit/stores/helpers/test_description.py` and
`tests/integration/stores/helpers/test_description_i.py` read expected results from
`tests/data/expected/`. That folder is not in the repo: `git ls-files dataParser/tests/data` lists
only the 14 files in `tests/data/cases/`. `tests/integration/stores/test_game_store_i.py` needs the
game export under `data/vendor/`, and `tests/test_main.py` needs it and the trade data under
`data/json/`. A fresh clone has neither ([050](050-dataparser-untracked-inputs.md)).

CI does not run any of it: `.github/workflows/test.yml` has no dataParser job, and the root
`.pre-commit-config.yaml` does not include the hooks of `dataParser/.pre-commit-config.yaml`. Rule 4
of [AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass) asks for `python -m pytest` in
`dataParser/` on every change there.

Done looks like: the expected files committed, or the tests that need them marked so that a run
without them skips them with a reason; then a CI job that installs the dependencies
([048](048-dataparser-dependencies.md)) and runs the tests that need no export, plus the dataParser
hooks. Break one test and watch the job fail.

## History

- 2026-10-18: Found while the dataParser module doc was written, by listing what the tests open.
