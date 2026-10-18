"""Fails when a backlog index and its task files disagree, or a task file has no valid status."""

import argparse
import re
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import NamedTuple

DATE = r"\d{4}-\d{2}-\d{2}"
BACKLOGS = {
    "docs/dev/refinements": re.compile(rf"open|done {DATE}|declined {DATE}"),
    "docs/dev/host": re.compile(rf"never attempted|attempted {DATE}(?:, inconclusive: .+)?|done {DATE}"),
}
TASKS_HEADING = "## Tasks"
_ENTRY = re.compile(r"- (?P<number>\d{3}): \[(?P<title>.+)\]\(tasks/(?P<file>(?P<prefix>\d{3})-[a-z0-9-]+\.md)\)")
_FILE = re.compile(r"\d{3}-[a-z0-9-]+\.md")
_STATUS = re.compile(r"^\*\*Status:\*\* (.*)$", re.MULTILINE)


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


def check_task(path: str, text: str, title: str, status: re.Pattern[str]) -> list[Problem]:
    """Returns what is wrong with one task file: its heading against the index, and its status line."""
    problems: list[Problem] = []
    heading = text.splitlines()[0] if text else ""
    if heading != f"# {title}":
        problems.append(Problem(path, f"its heading is {heading!r}, and the index lists it as {title!r}"))
    statuses = _STATUS.findall(text)
    if len(statuses) != 1:
        problems.append(Problem(path, f"has {len(statuses)} **Status:** lines, and needs exactly one"))
    elif not status.fullmatch(statuses[0]):
        problems.append(Problem(path, f"has the status {statuses[0]!r}, which the index does not list"))
    return problems


def check_backlog(root: Path, folder: str, status: re.Pattern[str]) -> list[Problem]:
    """Compares one index with the task files in its tasks folder."""
    index = f"{folder}/index.md"
    entries, problems = read_entries(index, (root / index).read_text(encoding="utf-8"))
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
            problems.extend(check_task(path, (root / path).read_text(encoding="utf-8"), entry.title, status))
    return problems


def main(argv: Sequence[str] | None = None) -> int:
    """Checks every backlog and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(), help="the repo to check (default: this folder)")
    args = parser.parse_args(argv)
    root: Path = args.root
    try:
        problems = [problem for folder, status in BACKLOGS.items() for problem in check_backlog(root, folder, status)]
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
