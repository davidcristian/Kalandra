# ADR-0010: Scripts check the written rules

**Status:** Accepted (2026-10-21)

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

**7. Two commit-msg hooks check each commit message.** conventional-pre-commit checks the type and form against the
ten types in AGENTS.md. `scripts/commitlint.py` checks the rest that a machine can read: the subject's length, case
and last character, a scope that repeats the type, the blank second line, the body's width and its 50 words, dashes,
banned words, and pointers into documents that change, such as a decision record or issue number, or a hash that
names a commit. A code fence or a line that starts with `$ ` holds pasted text, which the width, word, dash and
banned-word rules skip. Merge and fixup messages are not checked. Reason: a message cannot change after a push, so
the check runs before the commit exists. CI does not check messages, because the history inherited from Exiled
Exchange 2 does not follow these rules.

**8. The backlog indexes and the links the docs build does not read are checked.** `scripts/backlogcheck.py`
compares each index in `docs/dev/` with its task files: every file listed once, in number order, with its heading as
the title, one status the index defines, and the other lines and the History section of the index's template.
`scripts/linkcheck.py` checks that every relative link in the developer
docs and in the markdown outside `docs/` names a file in the repo, and a heading that file has. Reason: the indexes
are kept by hand ([ADR-0008](ADR-0008-developer-docs-layout.md)), and VitePress checks only the user pages.

**9. Each test suite has a coverage floor that CI checks.** The renderer and main set it in `vitest.config.ts`, over
every file under `src/`, and the price service and the scripts in `.coveragerc`, over lines and branches. Each floor
is the suite's coverage on 18 Oct 2026, and a change that raises coverage raises its floor. Reason: AGENTS.md asks
that no change lower coverage, and a floor turns that into a check. Counting every source file, rather than only the
files a test loads, keeps a deleted test from raising the number.

## Consequences

- A contributor runs `pre-commit install` once, and every commit then runs these checks. A clone that ran it before
  the commit-msg hooks were added runs it again.
- Imperative mood in a subject is the one commit rule that no hook checks.
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
