"""Fails when prose uses a banned word from the table in AGENTS.md, or a spaced `--` or hyphen as a dash."""

import argparse
import re
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import NamedTuple

import bannedwords
from prosesources import Line, SourceError, prose_lines
from repofiles import GAME_DATA, RepoError, read_text, repo_files, under

RULES = "AGENTS.md"
SPACED_DASH = re.compile(r"(?<=\S)\s--\s(?=\S)")
# Only between two words of two letters or more, so a list marker, a "-" table cell, `b - a` and `1 - 5` pass
SPACED_HYPHEN = re.compile(r"(?<=[^\W\d_]{2})\s+-\s+(?=[^\W\d_]{2})")
_DIRECTIVE_REASON = re.compile(r"^(\s*eslint-(?:disable|enable)(?:-next-line|-line)?\b.*?\s)--(?=\s)")


class Problem(NamedTuple):
    """One rule broken on one line of a file."""

    path: str
    line: int
    message: str


class Scan(NamedTuple):
    """The number of files and prose lines read, and every problem found in them."""

    files: int
    lines: int
    problems: list[Problem]


def without_directive_separator(text: str) -> str:
    """Blanks the `--` before the reason of an `eslint-disable` or `eslint-enable` comment, which ESLint needs."""
    return _DIRECTIVE_REASON.sub(lambda found: f"{found.group(1)}  ", text)


def check_prose(path: str, lines: Sequence[Line], pattern: re.Pattern[str]) -> list[Problem]:
    """Returns the banned words and spaced dashes in one file's prose."""
    problems = [
        Problem(path, hit.line, f'banned word "{hit.word}"; AGENTS.md gives a plain replacement')
        for hit in bannedwords.find_words(lines, pattern)
    ]
    for number, text in lines:
        masked = without_directive_separator(bannedwords.mask(text))
        problems.extend(
            Problem(path, number, f"a spaced {mark} used as a dash; restructure the sentence")
            for mark, dash in (("`--`", SPACED_DASH), ("hyphen", SPACED_HYPHEN))
            if dash.search(masked)
        )
    return sorted(problems)


def scan(root: Path, names: Sequence[str], table: bannedwords.Table) -> Scan:
    """Reads the prose of every named file under ``root`` and checks it."""
    pattern = bannedwords.compile_words(table.words)
    files = lines_read = 0
    problems: list[Problem] = []
    for name in names:
        text = None if under(name, GAME_DATA) else read_text(root / name)
        if text is None:
            continue
        try:
            lines = prose_lines(name, text)
        except SourceError as error:
            problems.append(Problem(name, 1, str(error)))
            continue
        if name == RULES:
            lines = [(number, line) for number, line in lines if not table.first <= number <= table.last]
        if lines:
            files += 1
            lines_read += len(lines)
            problems.extend(check_prose(name, lines, pattern))
    return Scan(files, lines_read, problems)


def main(argv: Sequence[str] | None = None) -> int:
    """Checks the prose of every file in the repo and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(), help="the repo to check (default: this folder)")
    args = parser.parse_args(argv)
    root: Path = args.root
    try:
        table = bannedwords.read_table(root / RULES)
        found = scan(root, repo_files(root), table)
    except (bannedwords.TableError, RepoError) as error:
        print(f"prosecheck: {error}", file=sys.stderr)
        return 2
    if not found.files:
        print(f"prosecheck: no prose under {root}, so the check cannot fail", file=sys.stderr)
        return 2
    for problem in found.problems:
        print(f"{problem.path}:{problem.line}: {problem.message}")
    if found.problems:
        print(f"\nprosecheck: {len(found.problems)} problem(s); the rules are in AGENTS.md, Prose", file=sys.stderr)
        return 1
    print(f"prosecheck OK: {found.lines} lines of prose in {found.files} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
