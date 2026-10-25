# dataParser declares none of its Python dependencies

**Status:** done 2026-10-25
**Area:** dataparser
**Origin:** [dataParser/pyproject.toml](../../../../dataParser/pyproject.toml)
**Verified:** 2026-10-25

`dataParser/pyproject.toml` holds only `[tool.pytest.ini_options]`: no `requires-python` and no
dependencies, and the folder has no requirements file. The code in `src/` imports `pandas`,
`numpy` (2.0 or newer, for `numpy.strings`), `tqdm`, `cloudscraper`, `requests` and
`murmurhash2`, and the tests need `pytest`. Six files in `src/models/` import `override` from
`typing`, which needs Python 3.12 or newer. On a new machine, each missing package shows up only
as a `ModuleNotFoundError` when a run or a test imports it.

Done looks like: a `[project]` table in `pyproject.toml` with `requires-python = ">=3.12"` and each
dependency with a version range that `python -m pytest` passes with, and an install command in
`dataParser/README.md` and [runbooks/game-data-update.md](../../runbooks/game-data-update.md). Check
it in a new virtual environment: install, then `python -m pytest`.

## History

- 2026-10-18: Found while the dataParser module doc and the game data update runbook were written,
  by listing the third-party imports of `src/` and `tests/`.
- 2026-10-25: Closed. `dataParser/requirements.txt` lists each package and `pandas-stubs` at the
  exact version installed in the `.venv` where `python -m pytest` passes, instead of a `[project]`
  table with ranges. `pip install --dry-run -r requirements.txt` there finds nothing to install.
  The data tool's README and module doc give the install commands, and the game data runbook links
  them. The install was not tried in a new virtual environment.
