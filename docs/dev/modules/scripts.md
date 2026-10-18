# scripts/: the repo checks

**Purpose.** `scripts/` holds the command line tools that check the repo itself. `check.py` runs every check in
[AGENTS.md, What every change must pass](../../../AGENTS.md#what-every-change-must-pass) that a machine can run, so
one command tells a contributor whether a change is done. The scripts are Python, use only the standard library, and
run from the repo root.

## Public contract

### check.py

`python scripts/check.py` runs each `Step` in `STEPS`, in this order: the pre-commit hooks, the renderer's index
files, lint, tests and build, main's tests and build, the price service's tests, the scripts' tests and the docs
build. A `Step` is a name, a repo folder and a command run in that folder.

- It runs every step, even after one fails, then prints `check: <n> of <m> steps failed: <names>` and exits with 1,
  or prints `check: all <m> steps passed` and exits with 0.
- A step whose tool is not on `PATH`, or an `npm` or `npx` step whose folder has no `node_modules`, fails without
  running, and the line `check: <name> cannot start: <reason>` says why.
- `python scripts/check.py --list` prints each step's name, command and folder, and runs none.
- On Windows, `shutil.which()` returns `npm.cmd` for `npm`, and `check.py` runs that path, since `subprocess` does
  not find a `.cmd` file from the bare name.
- The pre-commit hooks rewrite files (ESLint `--fix`, Prettier `--write`, Ruff `--fix`), so a run of `check.py`
  can leave changes in the working tree.

## Invariants

- `STEPS` holds every check AGENTS.md names except the data tool's, whose tests need files the repo does not have
  ([dataparser.md](dataparser.md#tests)). A new check in AGENTS.md is a new `Step` in the same commit.
- Every step's folder exists, and no two steps have the same name; `test_check.py` checks both.

## Tests

`python -m unittest discover -s tests` in `scripts/`, 6 tests on 18 Oct 2026. They run steps that start the current
Python with `-c`, so they need no Node and no network. The pre-commit hooks run Ruff and Pyright in strict mode on
`scripts/`: `scripts/ruff.toml` extends `priceService/ruff.toml` and allows `print`, and `pyrightconfig.json` at the
repo root covers both folders.

**Dependencies.** Python 3.12 or newer. `check.py` starts `pre-commit`, `npm` and `npx`, and the Python it runs on.
