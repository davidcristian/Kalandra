import unittest

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


def task(title: str, status: str) -> str:
    return f"# {title}\n\n**Status:** {status}\n**Area:** main\n\nWhat is wrong.\n"


def backlogs() -> dict[str, str]:
    return {
        "docs/dev/refinements/index.md": INDEX,
        "docs/dev/refinements/tasks/001-first-task.md": task("The first task", "open"),
        "docs/dev/refinements/tasks/002-second-task.md": task("The second task", "done 2026-10-18"),
        "docs/dev/host/index.md": HOST_INDEX,
        "docs/dev/host/tasks/001-a-check.md": task("A check in the game", "attempted 2026-10-18, inconclusive: down"),
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
            "docs/dev/refinements/tasks/003-third-task.md": task("The third task", "open"),
        }
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("tasks/003-third-task.md: is not listed in docs/dev/refinements/index.md", output)
        self.assertIn("index.md:7: lists 004-gone-task.md, which is not in docs/dev/refinements/tasks/", output)

    def test_reports_a_title_that_differs_and_a_status_the_index_does_not_list(self) -> None:
        files = {**backlogs(), "docs/dev/refinements/tasks/001-first-task.md": task("The renamed task", "closed")}
        with repo(files) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("its heading is '# The renamed task', and the index lists it as 'The first task'", output)
        self.assertIn("has the status 'closed', which the index does not list", output)

    def test_reports_entries_out_of_order_or_malformed(self) -> None:
        swapped = INDEX.replace("- 001: [The first task](tasks/001-first-task.md)\n", "") + (
            "- 001: [The first task](tasks/001-first-task.md)\n- 3: [Bad](tasks/3-bad.md)\n"
        )
        with repo({**backlogs(), "docs/dev/refinements/index.md": swapped}) as root:
            code, output = run(backlogcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("lists a task number twice, or out of order", output)
        self.assertIn("is not '- NNN: [title](tasks/NNN-slug.md)'", output)
