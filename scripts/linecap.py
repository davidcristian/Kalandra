"""Fails when a source file is over 300 lines or a markdown file over 250, or a file in the long-file list changes."""

import argparse
import re
import sys
from collections.abc import Sequence
from pathlib import Path, PurePosixPath
from typing import NamedTuple

from repofiles import GAME_DATA, RepoError, repo_files, under

SOURCE_LIMIT = 300
MARKDOWN_LIMIT = 250
SOURCE_SUFFIXES = frozenset({".ts", ".tsx", ".js", ".mjs", ".cjs", ".vue", ".py"})
LONG_FILES = "scripts/long-files.txt"
_TEST = re.compile(r"(^|/)(specs|tests)/|(^|/)test_[^/]*\.py$|\.(test|spec)\.[jt]sx?$")


class ListError(Exception):
    """The long-file list cannot be read."""


class Problem(NamedTuple):
    """One file over its limit, or one entry of the long-file list that is out of date."""

    path: str
    message: str


class Scan(NamedTuple):
    """The number of source and markdown files measured, and every problem found."""

    sources: int
    documents: int
    problems: list[Problem]


def is_source(name: str) -> bool:
    """Returns whether the line limit for source files applies: code that is not a test and not game data."""
    return PurePosixPath(name).suffix in SOURCE_SUFFIXES and not _TEST.search(name) and not under(name, GAME_DATA)


def read_list(path: Path) -> dict[str, int]:
    """Reads the long-file list: one "<lines> <path>" per line, and # for a comment."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as error:
        msg = f"cannot read {path}: {error}"
        raise ListError(msg) from error
    counts: dict[str, int] = {}
    for number, line in enumerate(text.splitlines(), start=1):
        if not line.strip() or line.startswith("#"):
            continue
        count, _, name = line.partition(" ")
        if not count.isdigit() or not name:
            msg = f"{path}:{number}: expected '<lines> <path>', found {line!r}"
            raise ListError(msg)
        counts[name] = int(count)
    return counts


def check_long_file(name: str, lines: int, recorded: int) -> Problem | None:
    """Returns the problem with a file in the long-file list, or None when its count is current."""
    if lines <= SOURCE_LIMIT:
        return Problem(name, f"has {lines} lines, within the limit, so remove it from {LONG_FILES}")
    if lines > recorded:
        return Problem(
            name,
            f"grew from {recorded} to {lines} lines; move the new code into a new module, or raise its count in "
            f"{LONG_FILES} with the reason in the commit body",
        )
    if lines < recorded:
        return Problem(name, f"has {lines} lines, so lower its count in {LONG_FILES} from {recorded} to {lines}")
    return None


def scan(root: Path, names: Sequence[str], long_files: dict[str, int]) -> Scan:
    """Measures every named source and markdown file under ``root``."""
    sources = documents = 0
    problems: list[Problem] = []
    for name in names:
        markdown = name.endswith(".md")
        if not markdown and not is_source(name):
            continue
        lines = len((root / name).read_bytes().splitlines())
        if markdown:
            documents += 1
            if lines > MARKDOWN_LIMIT:
                problems.append(Problem(name, f"{lines} lines, at most {MARKDOWN_LIMIT}; split it by subject"))
        elif name in long_files:
            sources += 1
            problem = check_long_file(name, lines, long_files[name])
            if problem is not None:
                problems.append(problem)
        else:
            sources += 1
            if lines > SOURCE_LIMIT:
                problems.append(Problem(name, f"{lines} lines, at most {SOURCE_LIMIT}; split it by responsibility"))
    problems.extend(
        Problem(name, f"is in {LONG_FILES} but is not a source file of the repo")
        for name in long_files
        if name not in names or not is_source(name)
    )
    return Scan(sources, documents, problems)


def main(argv: Sequence[str] | None = None) -> int:
    """Measures every file in the repo and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(), help="the repo to check (default: this folder)")
    args = parser.parse_args(argv)
    root: Path = args.root
    try:
        found = scan(root, repo_files(root), read_list(root / LONG_FILES))
    except (RepoError, ListError) as error:
        print(f"linecap: {error}", file=sys.stderr)
        return 2
    if not found.sources or not found.documents:
        print(f"linecap: no source or no markdown file under {root}, so the check cannot fail", file=sys.stderr)
        return 2
    for problem in found.problems:
        print(f"{problem.path}: {problem.message}")
    if found.problems:
        return 1
    print(f"linecap OK: {found.sources} source files and {found.documents} markdown files are within their limits")
    return 0


if __name__ == "__main__":
    sys.exit(main())
