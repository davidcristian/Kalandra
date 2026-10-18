# ADR-0010: Scripts check the written rules

**Status:** Accepted (2026-10-18)

## Context

[AGENTS.md](../../../AGENTS.md) sets rules for line counts, dashes, banned words and the checks a change must pass.
Until now no tool checked those rules, so each change needed a reader who knew them all, and an agent or a
contributor learned of a broken rule only in review. Cortex, the maintainer's other repo, checks the same rules with
Python scripts that run in its pre-commit hook and in CI. Kalandra inherits code from Exiled Exchange 2 that was
written without these rules: 33 source files were over 300 lines on 18 Oct 2026.

## Decision

**1. The checks are Python scripts in `scripts/`, using only the standard library.** Each one is a pre-commit hook,
so the Lint & Format job of `.github/workflows/test.yml`, which runs every hook, runs them in CI too. Reason: every
contributor already has Python for pre-commit, and a standard library script installs nothing.

**2. `scripts/check.py` runs every check in one command.** It runs the pre-commit hooks, the builds and every test
suite but the data tool's, keeps going after a failure, and names each step that failed. A new check is a new step
in the same commit. Reason: AGENTS.md lists checks for six parts of the repo, and one command leaves none out.

**3. A source file is at most 300 lines and a markdown file at most 250.** `scripts/linecap.py` measures every file
git tracks or would add, except tests and game data. The files that were over 300 lines when the check was added are
in `scripts/long-files.txt`, and each must have exactly the count written there. Reason: an exact count makes every
change to a long file visible in its diff. A file that grows fails, so new code goes into a new module, or the count
goes up with its reason in the commit body.

**4. No text file has an em dash or an en dash.** `scripts/dashcheck.py` reads every text file, and in markdown it
skips code spans and fenced code, which show game text. `EXEMPTIONS` in the script names the folders and files that
keep game text as the game writes it, each with its reason, and an exemption that covers no dash fails. Any other
dash that stays has `dashcheck: allow` and its reason on its line. Reason: the game's text uses both dashes, and the
parser matches that text exactly.

**5. Prose has no banned word and no spaced `--`.** `scripts/prosecheck.py` reads the banned words from the table in
AGENTS.md, so the table is the only list. Prose is markdown outside code, the comments and docstrings of the code,
and the strings that the code passes to a log or error call. `GAME_TERMS` in `scripts/bannedwords.py` names the game
terms the check skips when they have the game's capitals, such as Spell and Delve. Reason: one list means the rule
and the check cannot disagree, and the capitals tell a game term from the same word used as a metaphor.

**6. Every script fails rather than passing on nothing.** A script that finds no file to read, or cannot read the
table or the long-file list, exits with 2. Reason: a check that reads nothing cannot fail, which AGENTS.md calls a
defect.

## Consequences

- A contributor runs `pre-commit install` once, and every commit then runs these checks.
- The comment rules that need judgment, such as a comment that repeats the code, are still checked only by reading
  the diff.
- A dash in inherited code, such as an item text example in a comment, needs an exemption or an allow comment.
- `prosesources.py` reads TypeScript and JavaScript with a small lexer, not a parser. A `/` after a keyword such as
  `return` is read as division, so a regular expression there can hide the comments that follow it on that line.

## Alternatives rejected

- **Cortex's scripts as they are.** They read Cortex's Rust, Docker and proto files, which Kalandra does not have.
- **A `justfile`.** The maintainer works on Windows, where `just` is not installed by default, and Python is.
- **A limit of 300 lines for the inherited files too.** Splitting 33 files is work of its own, and AGENTS.md makes
  each split its own commit.

## Related

- [modules/scripts.md](../modules/scripts.md): what each script reads and reports.
- [AGENTS.md](../../../AGENTS.md), What every change must pass and Prose: the rules these scripts check.
