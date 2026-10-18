"""Finds the links of a markdown file and the anchors GitHub gives its headings."""

import re
from typing import NamedTuple

from prosesources import markdown_prose

_CODE_SPAN = re.compile(r"``[^`\n]+``|`[^`\n]+`")
_LINK = re.compile(r"!?\[(?:[^\]\\]|\\.)*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
_HEADING = re.compile(r"^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$")
_INLINE_LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")
_HTML_TAG = re.compile(r"<[^>]+>")
_NOT_SLUG = re.compile(r"[^\w\- ]")


class Link(NamedTuple):
    """The target of one link, and the line where the link starts."""

    line: int
    target: str


def _outside_fences(text: str) -> list[str]:
    """Returns the lines of the text with each line of a fenced code block blanked."""
    kept = dict(markdown_prose(text))
    return [line if number in kept else "" for number, line in enumerate(text.splitlines(), start=1)]


def links(text: str) -> list[Link]:
    """Returns every link and image outside code, including link text that continues on the next line."""
    prose = "\n".join(_CODE_SPAN.sub("", line) for line in _outside_fences(text))
    return [Link(prose.count("\n", 0, found.start()) + 1, found.group(1)) for found in _LINK.finditer(prose)]


def slug(heading: str) -> str:
    """Returns the anchor GitHub makes from a heading's text: lowercase, punctuation removed, a space as a hyphen."""
    text = _INLINE_LINK.sub(r"\1", heading)
    text = _HTML_TAG.sub("", text).replace("`", "").replace("*", "")
    return _NOT_SLUG.sub("", text.lower()).replace(" ", "-")


def anchors(text: str) -> set[str]:
    """Returns the anchor of every heading outside code; a repeated heading gets -1, -2 and so on."""
    seen: dict[str, int] = {}
    found: set[str] = set()
    for line in _outside_fences(text):
        match = _HEADING.match(line)
        if match is None:
            continue
        base = slug(match.group(1))
        count = seen.get(base, 0)
        seen[base] = count + 1
        found.add(base if count == 0 else f"{base}-{count}")
    return found
