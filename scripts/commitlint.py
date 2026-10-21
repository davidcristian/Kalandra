"""Checks one commit message against the commit rules in AGENTS.md that a machine can read."""

import argparse
import os
import re
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import NamedTuple

import bannedwords

RULES = Path(__file__).resolve().parent.parent / "AGENTS.md"
MAX_HEADER = 72
MAX_WIDTH = 72
MAX_WORDS = 50
SCOPES = ("main", "renderer", "parser", "trade", "ipc", "data", "dataparser", "docs", "ci")

_HEADER = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]*)\))?(?P<breaking>!)?: (?P<subject>.+)$")
_BREAKING = re.compile(r"^BREAKING[ -]CHANGE: \S")
_EXEMPT = ("Merge ", "fixup! ", "squash! ", "amend! ")
_FENCE = re.compile(r"^\s*(```|~~~)")
_PROMPT = re.compile(r"^\s*\$ \S")
_DASHES = (
    (re.compile(chr(0x2014)), "an em dash"),
    (re.compile(chr(0x2013)), "an en dash"),
    (re.compile(r"\S\s+--\s"), "a spaced --"),
)
_POINTERS = (
    (re.compile(r"(?<![\w/])#\d+\b"), "an issue or pull request number"),
    (re.compile(r"\b(?:PR|issue)\s*#?\d+", re.IGNORECASE), "an issue or pull request number"),
    (re.compile(r"\bADR[-\s]?\d", re.IGNORECASE), "a decision record number"),
    (re.compile(r"\b(?:task|rule|decision)\s+0*\d+\b", re.IGNORECASE), "a numbered pointer into a document"),
)
_HEX = re.compile(r"\b[0-9a-f]{7,40}\b")
# The footers are the last paragraph when it starts with a token and `: ` or ` #`, and a value can go on over the
# next lines: https://www.conventionalcommits.org/en/v1.0.0/#specification
_FOOTER = re.compile(r"^(?:BREAKING CHANGE|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)(?:: | #)\S")


class Line(NamedTuple):
    """One line of the message, and whether it is pasted text rather than the author's prose."""

    number: int
    text: str
    pasted: bool


def check_header(header: str) -> list[str]:
    """Returns what is wrong with the first line; conventional-pre-commit checks its type and form."""
    match = _HEADER.match(header)
    if match is None:
        return []
    problems: list[str] = []
    if len(header) > MAX_HEADER:
        problems.append(f"the first line has {len(header)} characters, at most {MAX_HEADER}")
    subject = match.group("subject")
    if subject[0].isupper():
        problems.append("the subject starts with a capital letter")
    if subject.endswith("."):
        problems.append("the subject ends with a period")
    scope = match.group("scope")
    if scope == match.group("type"):
        problems.append(f"the scope repeats the type ({match.group('type')})")
    if scope is not None and scope not in SCOPES:
        problems.append(f"the scope {scope!r} is not one of {', '.join(SCOPES)}")
    return problems


def classify(lines: Sequence[str]) -> tuple[list[Line], int | None]:
    """Marks each line as prose or paste, and returns the line of a fence nothing closes."""
    classified: list[Line] = []
    opened: int | None = None
    for number, text in enumerate(lines, start=1):
        if number > 1 and _FENCE.match(text):
            opened = number if opened is None else None
            classified.append(Line(number, text, pasted=True))
        else:
            pasted = number > 1 and (opened is not None or _PROMPT.match(text) is not None)
            classified.append(Line(number, text, pasted))
    return classified, opened


def too_wide(text: str) -> bool:
    """Returns whether a line is over the width and could have been wrapped."""
    words = text.split()
    return len(text) > MAX_WIDTH and len(words) > 1 and max(map(len, words)) <= MAX_WIDTH


def footer_start(classified: Sequence[Line]) -> int:
    """Returns the number of the first footer line, or one past the last line when the message has no footer."""
    blanks = [line.number for line in classified[1:] if not line.text.strip() and not line.pasted]
    paragraph: Sequence[Line] = classified[blanks[-1] :] if blanks else []
    if not paragraph or not _FOOTER.match(paragraph[0].text):
        return len(classified) + 1
    return paragraph[0].number


def check_breaking(header: str, classified: Sequence[Line]) -> list[str]:
    """Returns a problem unless the first line's `!` and a BREAKING CHANGE footer come together."""
    match = _HEADER.match(header)
    if match is None:
        return []
    explained = any(_BREAKING.match(line.text) for line in classified[footer_start(classified) - 1 :])
    if match.group("breaking") and not explained:
        return ["the first line marks a breaking change with !, and no BREAKING CHANGE: footer says what breaks"]
    if explained and not match.group("breaking"):
        return ["a BREAKING CHANGE: footer needs a ! before the colon of the first line"]
    return []


def commit_exists(token: str, repo: Path) -> bool:
    """Returns whether ``token`` names a commit in ``repo``."""
    command = ["git", "-C", str(repo), "cat-file", "-e", f"{token}^{{commit}}"]
    try:
        result = subprocess.run(command, capture_output=True, check=False)  # noqa: S603 a fixed git command
    except OSError:
        return False
    return result.returncode == 0


def check_body(classified: Sequence[Line], opened: int | None, repo: Path) -> list[str]:
    """Returns what is wrong with the lines after the first: their blank line, width, words, dashes and pointers."""
    problems: list[str] = []
    if len(classified) > 1 and classified[1].text.strip():
        problems.append("the second line is not blank")
    if opened is not None:
        problems.append(f"line {opened} opens a code fence that nothing closes")
    prose = [line for line in classified[1:] if not line.pasted]
    problems.extend(
        f"line {line.number} has {len(line.text)} characters; wrap the body at {MAX_WIDTH}"
        for line in prose
        if too_wide(line.text)
    )
    footer = footer_start(classified)
    words = sum(len(line.text.split()) for line in prose if line.number < footer)
    if words > MAX_WORDS:
        problems.append(f"the body has {words} words outside code fences, at most {MAX_WORDS}")
    for line in classified:
        if not line.pasted:
            problems.extend(
                f"line {line.number} uses {label}" for pattern, label in _DASHES if pattern.search(line.text)
            )
    for line in classified:
        problems.extend(f"line {line.number} has {label}" for pattern, label in _POINTERS if pattern.search(line.text))
        problems.extend(
            f"line {line.number} names commit {token}, which a rebase changes"
            for token in _HEX.findall(line.text)
            if commit_exists(token, repo)
        )
    return problems


def check_words(classified: Sequence[Line], rules: Path) -> list[str]:
    """Returns the banned words in the author's prose, read from the table in ``rules``."""
    try:
        table = bannedwords.read_table(rules)
    except bannedwords.TableError as error:
        return [str(error)]
    pattern = bannedwords.compile_words(table.words)
    prose = [(line.number, line.text) for line in classified if not line.pasted]
    return [f'line {hit.line} uses the banned word "{hit.word}"' for hit in bannedwords.find_words(prose, pattern)]


def check_message(text: str, repo: Path, rules: Path = RULES, *, from_editor: bool = True) -> list[str]:
    """Returns every problem with a commit message, or nothing for a merge or a fixup.

    It drops the lines that start with `#` only from a message typed in an editor, where git drops them too.
    """
    lines = text.splitlines()
    if from_editor:
        lines = [line for line in lines if not line.startswith("#")]
    while lines and not lines[-1].strip():
        lines.pop()
    header = lines[0] if lines else ""
    if header.startswith(_EXEMPT):
        return []
    classified, opened = classify(lines)
    return (
        check_header(header)
        + check_breaking(header, classified)
        + check_body(classified, opened, repo)
        + check_words(classified, rules)
    )


def main(argv: Sequence[str] | None = None, environ: Mapping[str, str] = os.environ) -> int:
    """Checks the commit message file git passes to the commit-msg hook."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("message_file", type=Path, help="the file that holds the commit message")
    parser.add_argument("--repo", type=Path, default=Path(), help="the repo that commit hashes are looked up in")
    args = parser.parse_args(argv)
    message_file: Path = args.message_file
    # git sets GIT_EDITOR to ":" for the hook when it opens no editor (https://git-scm.com/docs/githooks), and then
    # its default cleanup keeps the lines that start with `#` (`--cleanup` in https://git-scm.com/docs/git-commit).
    from_editor = environ.get("GIT_EDITOR") != ":"
    problems = check_message(message_file.read_text(encoding="utf-8"), args.repo, from_editor=from_editor)
    for problem in problems:
        print(f"commitlint: {problem}", file=sys.stderr)
    if problems:
        print("commitlint: the rules are in AGENTS.md, Commits", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
