import re
import unittest
from pathlib import Path

from support import repo, run

import backlogcheck

INDEX = """# Refinements

## Tasks

- 001: [The first task](tasks/001-first-task.md)
- 002: [The second task](tasks/002-second-task.md)
"""
HOST_INDEX = """# Host checks

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
        self.assertIn("index.md:7: lists 004-gone-task.md, which is not in docs/dev/refinements/tasks/", output)

    def test_reports_a_title_that_differs_and_a_status_the_index_does_not_list(self) -> None:
        files = {**backlogs(), f"{TASKS}001-first-task.md": task("The renamed task", "closed")}
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("its heading is '# The renamed task', and the index lists it as 'The first task'", output)
        self.assertIn("has the Status 'closed', which is not a status the index lists", output)

    def test_reports_entries_out_of_order_or_malformed(self) -> None:
        swapped = INDEX.replace("- 001: [The first task](tasks/001-first-task.md)\n", "") + (
            "- 001: [The first task](tasks/001-first-task.md)\n- 3: [Bad](tasks/3-bad.md)\n"
        )
        with repo({**backlogs(), "docs/dev/refinements/index.md": swapped}) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("lists a task number twice, or out of order", output)
        self.assertIn("is not '- NNN: [title](tasks/NNN-slug.md)'", output)

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
