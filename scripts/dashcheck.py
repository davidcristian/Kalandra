"""Fails when a text file uses an em dash or an en dash, outside the game text the repo keeps as written."""

import argparse
import re
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import NamedTuple

from prosesources import markdown_prose
from repofiles import RepoError, read_text, repo_files, under

ALLOW = "dashcheck: allow"
# Each dash as a character, and as the HTML character references that render it:
# https://html.spec.whatwg.org/multipage/syntax.html#character-references
DASHES = {
    "em dash": re.compile(chr(0x2014) + r"|&(?:mdash|#0*8212|#[xX]0*2014);"),
    "en dash": re.compile(chr(0x2013) + r"|&(?:ndash|#0*8211|#[xX]0*2013);"),
}
_CODE_SPAN = re.compile(r"`[^`\n]*`")

# Each exemption keeps game text as the game writes it, and must still cover a dash
EXEMPTIONS = {
    "renderer/public/data/": "game data that dataParser writes",
    "dataParser/output/": "game data that dataParser writes",
    "renderer/specs/Parser/": "item text copied from the game",
    "renderer/specs/web/": "client log lines copied from the game",
    "renderer/src/web/price-check/filters/create-unique-filters.ts": "a comment quotes copied item text",
}


class Problem(NamedTuple):
    """One line that uses a dash, or an exemption that covers none."""

    path: str
    line: int
    message: str


class Scan(NamedTuple):
    """The number of text files read, and every problem found."""

    files: int
    problems: list[Problem]


def checked_lines(name: str, text: str) -> list[tuple[int, str]]:
    """Returns the lines to check: in markdown, the lines outside code blocks, with code spans removed."""
    if name.endswith(".md"):
        return [(number, _CODE_SPAN.sub("", line)) for number, line in markdown_prose(text)]
    return list(enumerate(text.splitlines(), start=1))


def find_dashes(name: str, text: str) -> list[Problem]:
    """Returns one problem per line that uses a dash and has no allow comment."""
    return [
        Problem(name, number, f"{kind}: {line.strip()[:100]}")
        for number, line in checked_lines(name, text)
        if ALLOW not in line
        for kind, dash in DASHES.items()
        if dash.search(line)
    ]


def scan(root: Path, names: Sequence[str], exemptions: dict[str, str]) -> Scan:
    """Checks every named text file, and reports each exemption that covers no dash."""
    files = 0
    problems: list[Problem] = []
    used: set[str] = set()
    for name in names:
        text = read_text(root / name)
        if text is None:
            continue
        files += 1
        found = find_dashes(name, text)
        exempt = [prefix for prefix in exemptions if under(name, [prefix])]
        if exempt and found:
            used.update(exempt)
        elif not exempt:
            problems.extend(found)
    problems.extend(
        Problem(prefix, 0, f"the exemption ({reason}) covers no dash, so remove it from dashcheck.py")
        for prefix, reason in exemptions.items()
        if prefix not in used
    )
    return Scan(files, problems)


def main(argv: Sequence[str] | None = None, exemptions: dict[str, str] = EXEMPTIONS) -> int:
    """Checks every text file in the repo and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(), help="the repo to check (default: this folder)")
    args = parser.parse_args(argv)
    root: Path = args.root
    try:
        found = scan(root, repo_files(root), exemptions)
    except RepoError as error:
        print(f"dashcheck: {error}", file=sys.stderr)
        return 2
    if not found.files:
        print(f"dashcheck: no text file under {root}, so the check cannot fail", file=sys.stderr)
        return 2
    for problem in found.problems:
        print(f"{problem.path}:{problem.line}: {problem.message}")
    if found.problems:
        print(
            f"\ndashcheck: {len(found.problems)} problem(s). Restructure the sentence rather than swapping in another "
            f"mark; a range takes a hyphen. A dash that is game text or a symbol gets '{ALLOW}' and a reason.",
            file=sys.stderr,
        )
        return 1
    print(f"dashcheck OK: {found.files} text files use no em dash or en dash")
    return 0


if __name__ == "__main__":
    sys.exit(main())
