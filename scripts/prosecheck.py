"""Fails when prose uses a banned word from the table in AGENTS.md, or a spaced `--` as a dash."""

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


def check_prose(path: str, lines: Sequence[Line], pattern: re.Pattern[str]) -> list[Problem]:
    """Returns the banned words and spaced dashes in one file's prose."""
    problems = [
        Problem(path, hit.line, f'banned word "{hit.word}"; AGENTS.md gives a plain replacement')
        for hit in bannedwords.find_words(lines, pattern)
    ]
    problems.extend(
        Problem(path, number, "a spaced `--` used as a dash; restructure the sentence")
        for number, text in lines
        if SPACED_DASH.search(bannedwords.mask(text))
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
