"""Reads the banned-word table in AGENTS.md and finds those words in prose."""

import re
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import NamedTuple

HEADER = "Do not write"
# Written with the game's capitals, these are game terms, which AGENTS.md exempts
GAME_TERMS = frozenset({"Delve", "Spell", "Spells"})

_SEPARATOR = re.compile(r":?-+:?")
_CODE_SPAN = re.compile(r"``[^`\n]+``|`[^`\n]+`")
_LINK_TARGET = re.compile(r"\]\([^)\n]*\)")
_URL = re.compile(r"\b[a-z][a-z0-9+.-]*://\S+", re.IGNORECASE)
_MASK = "\x01"

Line = tuple[int, str]


class TableError(Exception):
    """The banned-word table is missing, empty or cannot be read."""


class Table(NamedTuple):
    """The banned words, and the first and last line of the table that lists them."""

    words: tuple[str, ...]
    first: int
    last: int


class Hit(NamedTuple):
    """One banned word found on one line."""

    line: int
    word: str


def _cells(line: str) -> list[str]:
    text = line.strip()
    return [cell.strip() for cell in text.strip("|").split("|")] if text.startswith("|") else []


def parse_table(text: str, name: str) -> Table:
    """Returns the table whose first column is headed ``HEADER``; ``name`` is used in errors."""
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if _cells(line)[:1] != [HEADER]:
            continue
        rows: list[list[str]] = []
        for row in lines[index + 1 :]:
            cells = _cells(row)
            if not cells:
                break
            rows.append(cells)
        words = tuple(
            word.strip().lower()
            for cells in rows
            if not all(_SEPARATOR.fullmatch(cell) for cell in cells)
            for word in cells[0].split(",")
            if word.strip()
        )
        if not words:
            msg = f"the banned-word table in {name} lists no word"
            raise TableError(msg)
        return Table(words=words, first=index + 1, last=index + 1 + len(rows))
    msg = f"{name} has no table whose first column is headed {HEADER!r}"
    raise TableError(msg)


def read_table(path: Path) -> Table:
    """Reads the banned-word table from the file at ``path``."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        msg = f"cannot read {path}: {error}"
        raise TableError(msg) from error
    return parse_table(text, str(path))


def compile_words(words: Iterable[str]) -> re.Pattern[str]:
    """Returns one pattern for all ``words``, in any case; the words of a phrase may have a line break between them."""
    phrases = sorted({r"\s+".join(map(re.escape, word.split())) for word in words}, key=lambda p: (-len(p), p))
    return re.compile(rf"(?<![\w-])(?:{'|'.join(phrases)})(?![\w-])", re.IGNORECASE)


def mask(text: str) -> str:
    """Blanks out code spans, link targets and URLs, keeping every line break where it was."""
    for pattern in (_CODE_SPAN, _LINK_TARGET, _URL):
        text = pattern.sub(lambda found: re.sub(r"[^\n]", _MASK, found.group()), text)
    return text


def runs(lines: Iterable[Line]) -> list[list[Line]]:
    """Splits numbered lines into runs of consecutive lines that are not blank."""
    grouped: list[list[Line]] = []
    for number, text in lines:
        if not text.strip():
            continue
        if grouped and grouped[-1][-1][0] == number - 1:
            grouped[-1].append((number, text))
        else:
            grouped.append([(number, text)])
    return grouped


def find_words(lines: Sequence[Line], pattern: re.Pattern[str]) -> list[Hit]:
    """Returns every banned word in ``lines``, on the line where it starts; game terms are left out."""
    hits: list[Hit] = []
    for run in runs(lines):
        text = mask("\n".join(line for _, line in run))
        starts = [0]
        for _, line in run[:-1]:
            starts.append(starts[-1] + len(line) + 1)
        for found in pattern.finditer(text):
            if found.group() in GAME_TERMS:
                continue
            index = max(i for i, start in enumerate(starts) if start <= found.start())
            hits.append(Hit(line=run[index][0], word=" ".join(found.group().split()).lower()))
    return hits
