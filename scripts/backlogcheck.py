"""Fails when a backlog index and its task files disagree, or a task file does not follow its index's template."""

import argparse
import re
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import NamedTuple

DATE = r"\d{4}-\d{2}-\d{2}"
AREAS = re.compile("config|main|renderer|parser|trade|docs|data|dataparser|priceservice|ci|release|repo|rules")
STATUSES_HEADING = "## Statuses"
TASKS_HEADING = "## Tasks"
HISTORY_HEADING = "## History"
_ENTRY = re.compile(r"- (?P<number>\d{3}): \[(?P<title>.+)\]\(tasks/(?P<file>(?P<prefix>\d{3})-[a-z0-9-]+\.md)\)")
_FILE = re.compile(r"\d{3}-[a-z0-9-]+\.md")
_HISTORY_LINE = re.compile(rf"- {DATE}: \S")
_STATUS = re.compile(r"- `(?P<status>[^`]+)`")
_PLACEHOLDER = re.compile(r"<([^>]+)>")


class Field(NamedTuple):
    """One `**Name:** value` line that an index's template asks of every task file, and the values it accepts."""

    name: str
    value: re.Pattern[str]
    expected: str


_ORIGIN = Field("Origin", re.compile(r"\[[^\]]+\]\([^)\s]+\)"), "a markdown link")
_VERIFIED = Field("Verified", re.compile(DATE), "a date")
BACKLOGS = {
    "docs/dev/refinements": (
        Field("Area", AREAS, "an area the index's template lists"),
        _ORIGIN,
        _VERIFIED,
    ),
    "docs/dev/host": (
        Field(
            "Needs", re.compile(r"Path of Exile 2 on Windows.*"), "a line that starts with 'Path of Exile 2 on Windows'"
        ),
        _ORIGIN,
        _VERIFIED,
    ),
}


class Problem(NamedTuple):
    """One disagreement between an index and its task files."""

    path: str
    message: str


class Entry(NamedTuple):
    """One line of an index's task list."""

    line: int
    number: str
    title: str
    file: str


def read_entries(index: str, text: str) -> tuple[list[Entry], list[Problem]]:
    """Returns the entries of the list under the Tasks heading, and each list line that is not an entry."""
    lines = text.splitlines()
    if TASKS_HEADING not in lines:
        return [], [Problem(index, f"has no {TASKS_HEADING!r} heading")]
    entries: list[Entry] = []
    problems: list[Problem] = []
    for number, line in enumerate(lines[lines.index(TASKS_HEADING) + 1 :], start=lines.index(TASKS_HEADING) + 2):
        if line.startswith("#"):
            break
        if not line.startswith("- "):
            continue
        found = _ENTRY.fullmatch(line)
        if found is None:
            problems.append(Problem(f"{index}:{number}", "is not '- NNN: [title](tasks/NNN-slug.md)'"))
        elif found.group("number") != found.group("prefix"):
            problems.append(Problem(f"{index}:{number}", "has a number that is not its file's number"))
        else:
            entries.append(Entry(number, found.group("number"), found.group("title"), found.group("file")))
    return entries, problems


def status_pattern(status: str) -> str:
    """Returns a regular expression for one status of an index: `<date>` is a date and any other `<...>` any text."""
    parts = _PLACEHOLDER.split(status)
    return "".join(
        (DATE if part == "date" else ".+") if number % 2 else re.escape(part) for number, part in enumerate(parts)
    )


def read_statuses(index: str, text: str) -> tuple[Field | None, list[Problem]]:
    """Returns the Status field that the list under the Statuses heading defines, or what is wrong with that list."""
    lines = text.splitlines()
    if STATUSES_HEADING not in lines:
        return None, [Problem(index, f"has no {STATUSES_HEADING!r} heading")]
    statuses: list[str] = []
    for line in lines[lines.index(STATUSES_HEADING) + 1 :]:
        if line.startswith("#"):
            break
        found = _STATUS.match(line)
        if found is not None:
            statuses.append(f"(?:{status_pattern(found.group('status'))})")
    if not statuses:
        return None, [Problem(index, f"has no '- `<status>`: <meaning>' line under {STATUSES_HEADING!r}")]
    return Field("Status", re.compile("|".join(statuses)), "a status the index lists"), []


def check_history(path: str, lines: Sequence[str]) -> list[Problem]:
    """Returns what is wrong with the History section: it is missing, repeated, empty or has an undated line."""
    if lines.count(HISTORY_HEADING) != 1:
        count = lines.count(HISTORY_HEADING)
        return [Problem(path, f"has {count} {HISTORY_HEADING!r} headings, and needs exactly one")]
    section: list[str] = []
    for line in lines[lines.index(HISTORY_HEADING) + 1 :]:
        if line.startswith("#"):
            break
        section.append(line)
    entries = [line for line in section if line.startswith("- ")]
    if not entries:
        return [Problem(path, f"has no '- <date>: <what happened>' line under {HISTORY_HEADING!r}")]
    return [
        Problem(path, f"has a History line that does not start with '- <date>: ': {line[:60]!r}")
        for line in entries
        if not _HISTORY_LINE.match(line)
    ]


def check_task(path: str, text: str, title: str, fields: Sequence[Field]) -> list[Problem]:
    """Returns what is wrong with one task file: its heading against the index, and the lines its template asks."""
    problems: list[Problem] = []
    lines = text.splitlines()
    heading = lines[0] if lines else ""
    if heading != f"# {title}":
        problems.append(Problem(path, f"its heading is {heading!r}, and the index lists it as {title!r}"))
    for field in fields:
        values = re.findall(rf"^\*\*{field.name}:\*\* (.*)$", text, re.MULTILINE)
        if len(values) != 1:
            problems.append(Problem(path, f"has {len(values)} **{field.name}:** lines, and needs exactly one"))
        elif not field.value.fullmatch(values[0]):
            problems.append(Problem(path, f"has the {field.name} {values[0]!r}, which is not {field.expected}"))
    return problems + check_history(path, lines)


def check_backlog(root: Path, folder: str, fields: Sequence[Field]) -> list[Problem]:
    """Compares one index with the task files in its tasks folder."""
    index = f"{folder}/index.md"
    text = (root / index).read_text(encoding="utf-8")
    entries, problems = read_entries(index, text)
    status, status_problems = read_statuses(index, text)
    problems.extend(status_problems)
    checked = [*fields] if status is None else [status, *fields]
    files = sorted(path.name for path in (root / folder / "tasks").iterdir())
    problems.extend(
        Problem(f"{folder}/tasks/{name}", "is not a NNN-slug.md task file")
        for name in files
        if not _FILE.fullmatch(name)
    )
    numbers = [entry.number for entry in entries]
    if numbers != sorted(set(numbers)):
        problems.append(Problem(index, "lists a task number twice, or out of order"))
    listed = {entry.file for entry in entries}
    problems.extend(
        Problem(f"{folder}/tasks/{name}", f"is not listed in {index}") for name in files if name not in listed
    )
    for entry in entries:
        path = f"{folder}/tasks/{entry.file}"
        if entry.file not in files:
            problems.append(Problem(f"{index}:{entry.line}", f"lists {entry.file}, which is not in {folder}/tasks/"))
        else:
            problems.extend(check_task(path, (root / path).read_text(encoding="utf-8"), entry.title, checked))
    return problems


def main(argv: Sequence[str] | None = None) -> int:
    """Checks every backlog and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(), help="the repo to check (default: this folder)")
    args = parser.parse_args(argv)
    root: Path = args.root
    try:
        problems = [problem for folder, fields in BACKLOGS.items() for problem in check_backlog(root, folder, fields)]
    except OSError as error:
        print(f"backlogcheck: {error}", file=sys.stderr)
        return 2
    for problem in problems:
        print(f"{problem.path}: {problem.message}")
    if problems:
        return 1
    print(f"backlogcheck OK: {', '.join(BACKLOGS)} match their task files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
