# scripts/: the repo checks

**Purpose.** `scripts/` holds the command line tools that check the repo itself against
[AGENTS.md](../../../AGENTS.md). `check.py` runs every check a machine can run, `linecap.py`, `dashcheck.py` and
`prosecheck.py` check the line limits, the dash rule and the banned words, `linkcheck.py` and `backlogcheck.py` check
the developer docs, `commitlint.py` checks a commit message, and `ci_paths.py` picks the CI jobs a change affects.
The scripts are Python, use only the standard library, and run from the repo root. The decision is
[ADR-0010](../adr/ADR-0010-scripts-check-the-written-rules.md).

## Public contract

### check.py

`python scripts/check.py` runs each `Step` in `STEPS`, in this order: the pre-commit hooks, the renderer's index
files, lint, tests with coverage and build, main's tests with coverage and build, the price service's and the
scripts' tests and coverage reports, and the docs build. A `Step` is a name, a repo folder and a command run in that
folder.

- It runs every step, even after one fails, then prints `check: <n> of <m> steps failed: <names>` and exits with 1,
  or prints `check: all <m> steps passed` and exits with 0.
- A step whose tool is not on `PATH`, or an `npm` or `npx` step whose folder has no `node_modules`, fails without
  running, and the line `check: <name> cannot start: <reason>` says why.
- `python scripts/check.py --list` prints each step's name, command and folder, and runs none.
- On Windows, `shutil.which()` returns `npm.cmd` for `npm`, and `check.py` runs that path, since `subprocess` does
  not find a `.cmd` file from the bare name.
- The pre-commit hooks rewrite files (ESLint `--fix`, Prettier `--write`, Ruff `--fix`), so a run of `check.py`
  can leave changes in the working tree.

### The file checks

Each one prints one line per problem, starting with the file's path, and exits with 1 when it finds a problem, 0
when it finds none, and 2 when it cannot read what it needs or reads nothing. All but `backlogcheck.py` read the
files that `git ls-files --cached --others --exclude-standard` lists (`repofiles.py`). `--root <folder>` checks
another copy of the repo.

- **`linecap.py`** counts the lines of every source file (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.vue`, `.py`) that
  is not a test or game data, and of every markdown file. A source file over 300 lines fails unless
  `long-files.txt` lists it, and a listed file fails unless it has exactly its listed count. The message says which
  way to change the count. A markdown file over 250 lines fails.
- **`dashcheck.py`** reports every line with an em dash or an en dash, in every text file. In markdown it skips code
  spans and fenced code. `EXEMPTIONS` names the folders and files of game text (the game data, the copied item text
  and client log lines in `renderer/specs/`, and one comment that quotes item text), each with its reason. An
  exemption that covers no dash fails. A line that contains `dashcheck: allow` is skipped.
- **`prosecheck.py`** reports a banned word, and a spaced `--`, in prose. `prosesources.py` finds the prose:
  markdown outside fenced code; the comments of TypeScript, JavaScript, Vue, YAML, TOML and shell files; the
  docstrings and comments of Python; and the strings passed to `console.*`, `logger.write`, `new ...Error` and
  `throw new` calls, or in Python to `print`, a logging method, a `raise`, or a variable named `msg`.
  `bannedwords.py` reads the words from the table in AGENTS.md, skips code spans, link targets and URLs, finds a
  phrase across one line break, and skips the `GAME_TERMS` (`Delve`, `Spell`, `Spells`) when they have the game's
  capitals. The rows of the table itself are not checked.
- **`linkcheck.py`** reads every markdown file outside `docs/`, and those in `docs/dev/`, since VitePress checks the
  user pages. Each relative link outside code (`markdownlinks.py`) must name a file or folder in the repo, and an
  `#anchor` in a markdown file must match one of its headings as GitHub makes them: lowercase, punctuation removed,
  each space a hyphen, and `-1`, `-2` added to a repeated heading. A link to another site is not followed.
- **`backlogcheck.py`** reads `docs/dev/refinements/` and `docs/dev/host/`. Each line under `## Tasks` in the
  `index.md` must be `- NNN: [title](tasks/NNN-slug.md)`, in number order, and every task file must be listed once,
  with its first line `# <title>` and exactly one `**Status:**` line whose value the index defines. A task file
  also follows its index's template: exactly one `**Origin:**` line with a markdown link and one `**Verified:**`
  line with a date, one `**Area:**` line from `AREAS` in a refinement, which a test compares with the template's
  list, and one `**Needs:**` line that starts with `Path of Exile 2 on Windows` in a host task. One `## History`
  heading follows, and each list line under it starts with `- <date>: `.

### ci_paths.py

The Changed paths job of `.github/workflows/test.yml` passes the changed paths on stdin to
`python3 scripts/ci_paths.py`, with both the old and the new path of a moved file. The script prints `renderer=`,
`main=`, `price_service=`, `scripts=` and `docs=` with `true` or `false` for `GITHUB_OUTPUT`. `RULES` maps a file,
or a folder ending in `/`, to the jobs it affects, and the first rule that matches applies. `AGENTS.md` affects the
Scripts job, because `test_bannedwords.py` reads its banned words table. Any other markdown file at the repo root
affects no job, and any other path that no rule matches affects every job
([ADR-0011](../adr/ADR-0011-ci-runs-the-jobs-a-change-affects.md)).

### commitlint.py

The commit-msg hook runs `python scripts/commitlint.py <message file>`, after conventional-pre-commit has checked
the type and form. When git opened an editor for the message, the script drops the lines that start with `#`, which
git then removes. A message given with `-m` or `-F` keeps them under git's default cleanup, and git runs the hook with
`GIT_EDITOR=:`, so the script checks them. To check a stored message by hand, such as the output of
`git log -1 --format=%B`, set `GIT_EDITOR=:` too. The script prints `commitlint: <problem>` for each rule the message
breaks and exits with 1, or exits with 0.

- The first line: at most 72 characters, a lowercase first letter, no period at the end, and no scope that repeats
  the type (`docs(docs)`).
- The body: a blank second line, at most 72 characters a line unless the line is one long word, and at most 50
  words. The word count leaves out the footers: the last paragraph, when its first line starts with
  `BREAKING CHANGE: ` or a Conventional Commits footer token such as `Refs: ` or `Refs #`. Every other rule checks
  the footers too.
- No em dash, en dash or spaced `--`, and no banned word from the table in AGENTS.md.
- No pointer into a document that changes: `#12`, `PR 12`, `ADR-0009`, `rule 9`, `task 056`, `decision 3`, or a
  hexadecimal word that `git cat-file` finds as a commit.
- A code fence, or a line that starts with `$ `, is pasted text: the width, word, dash and banned-word rules skip it,
  and a fence that nothing closes is a problem. A message that starts with `Merge `, `fixup! `, `squash! ` or
  `amend! ` is not checked.

## Invariants

- `STEPS` holds every check AGENTS.md names except the data tool's, whose tests need files the repo does not have
  ([dataparser.md](dataparser.md#tests)). A new check in AGENTS.md is a new `Step` or hook in the same commit.
- Every step's folder exists, and no two steps have the same name; `test_check.py` checks both.
- The banned words exist only in the table in AGENTS.md, which `prosecheck.py` reads on every run.
- The pre-commit hooks run the five file checks on every commit, after the formatters, so the counts they read are
  the formatted ones.

## Tests

`python -m unittest discover -s tests` in `scripts/`, 61 tests on 21 Oct 2026. `tests/support.py` builds a temporary
git repo for each test that runs a script's `main()`, and the `check.py` tests run steps that start the current
Python with `-c`, so the tests need git but no Node and no network. The pre-commit hooks run Ruff and Pyright in
strict mode on `scripts/`: `scripts/ruff.toml` extends `priceService/ruff.toml` and allows `print`, and
`pyrightconfig.json` at the repo root covers both folders. CI runs the tests under coverage.py and fails below the
floor in `scripts/.coveragerc`, 93.2% of lines and branches on 21 Oct 2026.

**Dependencies.** Python 3.12 or newer and git. `check.py` also starts `pre-commit`, `npm` and `npx`.
