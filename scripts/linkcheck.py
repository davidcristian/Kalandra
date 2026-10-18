"""Fails when a relative link in a markdown file that the docs build does not read names a missing file or heading."""

import argparse
import re
import sys
from collections.abc import Sequence
from pathlib import Path, PurePosixPath
from typing import NamedTuple
from urllib.parse import unquote

from markdownlinks import anchors, links
from repofiles import GAME_DATA, RepoError, read_text, repo_files, under

# VitePress builds the pages in docs/ and fails on a dead link there, so this check reads the rest
SITE = "docs/"
DEVELOPER_DOCS = "docs/dev/"
_SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*:", re.IGNORECASE)


class Problem(NamedTuple):
    """One link whose target is not there."""

    path: str
    line: int
    message: str


class Scan(NamedTuple):
    """The number of files and links read, and every problem found."""

    files: int
    links: int
    problems: list[Problem]


def is_checked(name: str) -> bool:
    """Returns whether ``name`` is a markdown file this check reads: any outside the site, and the developer docs."""
    outside_site = not name.startswith(SITE) or name.startswith(DEVELOPER_DOCS)
    return name.endswith(".md") and outside_site and not under(name, GAME_DATA)


def check_target(root: Path, name: str, target: str, files: set[str]) -> str | None:
    """Returns what is wrong with one link target, or None when its file and heading are there."""
    if _SCHEME.match(target) or target.startswith("//"):
        return None
    path, _, anchor = target.partition("#")
    resolved = PurePosixPath(name) if not path else PurePosixPath(name).parent / unquote(path)
    parts: list[str] = []
    for part in resolved.parts:
        if part == "..":
            if not parts:
                return f"{target} points outside the repo"
            parts.pop()
        elif part != ".":
            parts.append(part)
    destination = "/".join(parts)
    if destination not in files and not any(file.startswith(f"{destination}/") for file in files):
        return f"{target} names {destination}, which is not in the repo"
    if anchor and destination.endswith(".md"):
        text = read_text(root / destination) or ""
        if anchor.lower() not in anchors(text):
            return f"{target} names the heading #{anchor}, which {destination} does not have"
    return None


def scan(root: Path, names: Sequence[str]) -> Scan:
    """Checks every link in every markdown file this check reads."""
    files = set(names)
    read = count = 0
    problems: list[Problem] = []
    for name in names:
        text = read_text(root / name) if is_checked(name) else None
        if text is None:
            continue
        read += 1
        for link in links(text):
            count += 1
            problem = check_target(root, name, link.target, files)
            if problem is not None:
                problems.append(Problem(name, link.line, problem))
    return Scan(read, count, problems)


def main(argv: Sequence[str] | None = None) -> int:
    """Checks the links of the repo's markdown and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(), help="the repo to check (default: this folder)")
    args = parser.parse_args(argv)
    root: Path = args.root
    try:
        found = scan(root, repo_files(root))
    except RepoError as error:
        print(f"linkcheck: {error}", file=sys.stderr)
        return 2
    if not found.links:
        print(f"linkcheck: no link under {root}, so the check cannot fail", file=sys.stderr)
        return 2
    for problem in found.problems:
        print(f"{problem.path}:{problem.line}: {problem.message}")
    if found.problems:
        return 1
    print(f"linkcheck OK: {found.links} links in {found.files} markdown files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
