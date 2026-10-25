import re
import unittest
from pathlib import Path

from support import repo, run

import backlogcheck

INDEX = """# Refinements

## Statuses

- `open`: still to do.
- `done <date>`: finished on that date.
- `declined <date>`: decided against on that date.

## Tasks

- 001: [The first task](tasks/001-first-task.md)
- 002: [The second task](tasks/002-second-task.md)
"""
HOST_INDEX = """# Host checks

## Statuses

A check has more outcomes than a refinement:

- `never attempted`: nobody has run it.
- `attempted <date>`: it ran and a claim failed.
- `attempted <date>, inconclusive: <what happened>`: it ran and gave no answer,
  for example because the game was down.
- `done <date>`: every claim held.

## Tasks

- 001: [A check in the game](tasks/001-a-check.md)
"""
AREA = "**Area:** main\n"
NEEDS = "**Needs:** Path of Exile 2 on Windows, and a private league\n"
ORIGIN = "**Origin:** [main/src/server.ts](../../../../main/src/server.ts)\n**Verified:** 2026-10-18\n"
HISTORY = "\n## History\n\n- 2026-10-18: Found in a test.\n"
TASKS = "docs/dev/refinements/tasks/"
HOST_TASKS = "docs/dev/host/tasks/"


def task(title: str, status: str, first: str = AREA, history: str = HISTORY) -> str:
    return f"# {title}\n\n**Status:** {status}\n{first}{ORIGIN}\nWhat is wrong.\n{history}"


def backlogs() -> dict[str, str]:
    return {
        "docs/dev/refinements/index.md": INDEX,
        f"{TASKS}001-first-task.md": task("The first task", "open"),
        f"{TASKS}002-second-task.md": task("The second task", "done 2026-10-18"),
        "docs/dev/host/index.md": HOST_INDEX,
        f"{HOST_TASKS}001-a-check.md": task("A check in the game", "attempted 2026-10-18, inconclusive: down", NEEDS),
    }


class BacklogCheckTest(unittest.TestCase):
    def test_passes_indexes_that_match_their_task_files(self) -> None:
        with repo(backlogs()) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 0, output)

    def test_reports_a_task_the_index_does_not_list_and_an_entry_without_a_file(self) -> None:
        index = INDEX + "- 004: [A gone task](tasks/004-gone-task.md)\n"
        files = {
            **backlogs(),
            "docs/dev/refinements/index.md": index,
            f"{TASKS}003-third-task.md": task("The third task", "open"),
        }
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("tasks/003-third-task.md: is not listed in docs/dev/refinements/index.md", output)
        self.assertIn("index.md:13: lists 004-gone-task.md, which is not in docs/dev/refinements/tasks/", output)

    def test_reports_a_title_that_differs_and_a_status_the_index_does_not_list(self) -> None:
        files = {**backlogs(), f"{TASKS}001-first-task.md": task("The renamed task", "closed")}
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("its heading is '# The renamed task', and the index lists it as 'The first task'", output)
        self.assertIn("has the Status 'closed', which is not a status the index lists", output)

    def test_reads_the_statuses_from_the_index(self) -> None:
        statuses = "## Statuses\n\n- `waiting on <who>`: needs a decision.\n- `done <date>`: done.\n"
        index = f"# Refinements\n\n{INDEX[INDEX.index('## Tasks') :]}\n{statuses}"
        files = {
            **backlogs(),
            "docs/dev/refinements/index.md": index,
            f"{TASKS}002-second-task.md": task("The second task", "waiting on the maintainer"),
            f"{HOST_TASKS}001-a-check.md": task("A check in the game", "done soon", NEEDS),
        }
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertEqual(
            output.splitlines(),
            [
                f"{TASKS}001-first-task.md: has the Status 'open', which is not a status the index lists",
                f"{HOST_TASKS}001-a-check.md: has the Status 'done soon', which is not a status the index lists",
            ],
        )

    def test_reports_an_index_without_a_list_of_statuses(self) -> None:
        host_index = HOST_INDEX.replace("\n- `", "\n  `")
        files = {
            **backlogs(),
            "docs/dev/refinements/index.md": INDEX.replace("## Statuses", "## States"),
            "docs/dev/host/index.md": host_index,
        }
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertEqual(
            output.splitlines(),
            [
                "docs/dev/refinements/index.md: has no '## Statuses' heading",
                "docs/dev/host/index.md: has no '- `<status>`: <meaning>' line under '## Statuses'",
            ],
        )

    def test_reports_entries_out_of_order_or_malformed(self) -> None:
        swapped = INDEX.replace("- 001: [The first task](tasks/001-first-task.md)\n", "") + (
            "- 001: [The first task](tasks/001-first-task.md)\n- 3: [Bad](tasks/3-bad.md)\n"
        )
        with repo({**backlogs(), "docs/dev/refinements/index.md": swapped}) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("lists a task number twice, or out of order", output)
        self.assertIn("is not '- NNN: [title](tasks/NNN-slug.md)'", output)

    def test_reports_an_index_without_the_tasks_heading(self) -> None:
        index = INDEX.replace("## Tasks", "## Open tasks")
        with repo({**backlogs(), "docs/dev/refinements/index.md": index}) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertEqual(
            output.splitlines(),
            [
                "docs/dev/refinements/index.md: has no '## Tasks' heading",
                f"{TASKS}001-first-task.md: is not listed in docs/dev/refinements/index.md",
                f"{TASKS}002-second-task.md: is not listed in docs/dev/refinements/index.md",
            ],
        )

    def test_reports_an_entry_whose_number_is_not_its_files_number(self) -> None:
        index = INDEX.replace("- 002: [The second task]", "- 003: [The second task]")
        with repo({**backlogs(), "docs/dev/refinements/index.md": index}) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertEqual(
            output.splitlines(),
            [
                "docs/dev/refinements/index.md:12: has a number that is not its file's number",
                f"{TASKS}002-second-task.md: is not listed in docs/dev/refinements/index.md",
            ],
        )

    def test_reads_the_task_list_only_up_to_the_next_heading(self) -> None:
        index = INDEX + "\n## Ideas\n\n- 009: [Not a task yet](tasks/009-not-a-task-yet.md)\n"
        with repo({**backlogs(), "docs/dev/refinements/index.md": index}) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 0, output)

    def test_reports_two_status_lines_and_a_file_that_is_not_a_task(self) -> None:
        twice = task("The first task", "open").replace("**Status:** open\n", "**Status:** open\n**Status:** open\n")
        files = {**backlogs(), f"{TASKS}001-first-task.md": twice, f"{TASKS}notes.txt": "A note.\n"}
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertEqual(
            output.splitlines(),
            [
                f"{TASKS}notes.txt: is not a NNN-slug.md task file",
                f"{TASKS}notes.txt: is not listed in docs/dev/refinements/index.md",
                f"{TASKS}001-first-task.md: has 2 **Status:** lines, and needs exactly one",
            ],
        )

    def test_exits_2_when_an_index_or_its_tasks_folder_is_missing(self) -> None:
        without_index = {name: text for name, text in backlogs().items() if name != "docs/dev/host/index.md"}
        without_tasks = {name: text for name, text in backlogs().items() if not name.startswith(HOST_TASKS)}
        for files in (without_index, without_tasks):
            with self.subTest(files=sorted(files)), repo(files) as root:
                code, output = run(backlogcheck.main, root)
                self.assertEqual(code, 2)
                self.assertTrue(output.startswith("backlogcheck: "), output)
                self.assertIn("docs", output)

    def test_exits_2_when_a_backlog_has_no_task_file(self) -> None:
        files = {name: text for name, text in backlogs().items() if not name.startswith(HOST_TASKS)}
        files["docs/dev/host/index.md"] = HOST_INDEX[: HOST_INDEX.index("- 001")]
        for others in ({}, {f"{HOST_TASKS}notes.txt": "A note.\n"}):
            with self.subTest(others=sorted(others)), repo(files | others) as root:
                (root / HOST_TASKS).mkdir(exist_ok=True)
                code, output = run(backlogcheck.main, root)
                self.assertEqual(code, 2)
                self.assertEqual(output, f"backlogcheck: {HOST_TASKS} has no task file, so the check cannot fail\n")

    def test_reports_template_lines_that_are_missing_or_have_a_wrong_value(self) -> None:
        wrong = task("The first task", "open", "**Area:** kitchen\n").replace("2026-10-18\n", "soon\n", 1)
        files = {
            **backlogs(),
            f"{TASKS}001-first-task.md": wrong,
            f"{TASKS}002-second-task.md": task("The second task", "open").replace("**Origin:**", "-"),
            f"{HOST_TASKS}001-a-check.md": task("A check in the game", "never attempted", "**Needs:** a mouse\n"),
        }
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        needs = "which is not a line that starts with 'Path of Exile 2 on Windows'"
        self.assertEqual(
            output.splitlines(),
            [
                f"{TASKS}001-first-task.md: has the Area 'kitchen', which is not an area the index's template lists",
                f"{TASKS}001-first-task.md: has the Verified 'soon', which is not a date",
                f"{TASKS}002-second-task.md: has 0 **Origin:** lines, and needs exactly one",
                f"{HOST_TASKS}001-a-check.md: has the Needs 'a mouse', {needs}",
            ],
        )

    def test_asks_the_host_template_of_a_host_task(self) -> None:
        files = {**backlogs(), f"{HOST_TASKS}001-a-check.md": task("A check in the game", "never attempted")}
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertEqual(output, f"{HOST_TASKS}001-a-check.md: has 0 **Needs:** lines, and needs exactly one\n")

    def test_reports_a_history_that_is_missing_empty_or_undated(self) -> None:
        undated = HISTORY + "- Later, it was fixed.\n\n## Notes\n\n- An aside.\n"
        files = {
            **backlogs(),
            f"{TASKS}001-first-task.md": task("The first task", "open", history=""),
            f"{TASKS}002-second-task.md": task("The second task", "open", history="\n## History\n"),
            f"{HOST_TASKS}001-a-check.md": task("A check in the game", "never attempted", NEEDS, undated),
        }
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        undated_line = "has a History line that does not start with '- <date>: ': '- Later, it was fixed.'"
        self.assertEqual(
            output.splitlines(),
            [
                f"{TASKS}001-first-task.md: has 0 '## History' headings, and needs exactly one",
                f"{TASKS}002-second-task.md: has no '- <date>: <what happened>' line under '## History'",
                f"{HOST_TASKS}001-a-check.md: {undated_line}",
            ],
        )

    def test_the_areas_are_the_list_in_the_real_index_template(self) -> None:
        index = Path(__file__).resolve().parents[2] / "docs/dev/refinements/index.md"
        found = re.search(r"^\*\*Area:\*\* <(.+)>$", index.read_text(encoding="utf-8"), re.MULTILINE)
        self.assertIsNotNone(found, "the template in the index has no **Area:** line")
        areas = re.split(r", | or ", found.group(1)) if found else []
        self.assertEqual(areas, backlogcheck.AREAS.pattern.split("|"))
