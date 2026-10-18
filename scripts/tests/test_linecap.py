import unittest

from support import repo, run

import linecap

LIST_HEADER = "# the long files\n"


def lines(count: int) -> str:
    return "x\n" * count


class LineCapTest(unittest.TestCase):
    def test_passes_files_within_their_limits_and_skips_tests_and_data(self) -> None:
        files = {
            linecap.LONG_FILES: LIST_HEADER + "301 main/long.ts\n",
            "main/long.ts": lines(301),
            "main/ok.ts": lines(300),
            "main/specs/big.test.ts": lines(400),
            "renderer/public/data/en/big.js": lines(400),
            "docs/page.md": lines(250),
        }
        with repo(files) as root:
            code, output = run(linecap.main, root)
        self.assertEqual(code, 0, output)
        self.assertIn("linecap OK: 2 source files and 1 markdown files", output)

    def test_reports_a_long_source_file_and_a_long_markdown_file(self) -> None:
        files = {linecap.LONG_FILES: LIST_HEADER, "main/a.py": lines(301), "docs/a.md": lines(251)}
        with repo(files) as root:
            code, output = run(linecap.main, root)
        self.assertEqual(code, 1)
        self.assertIn("main/a.py: 301 lines, at most 300", output)
        self.assertIn("docs/a.md: 251 lines, at most 250", output)

    def test_a_listed_file_must_keep_its_count(self) -> None:
        self.assertIn("grew from 400 to 401", str(linecap.check_long_file("a.ts", 401, 400)))
        self.assertIn("lower its count in", str(linecap.check_long_file("a.ts", 399, 400)))
        self.assertIn("remove it from", str(linecap.check_long_file("a.ts", 300, 400)))
        self.assertIsNone(linecap.check_long_file("a.ts", 400, 400))

    def test_reports_a_listed_file_that_is_gone_and_an_unreadable_list(self) -> None:
        files = {linecap.LONG_FILES: LIST_HEADER + "400 main/gone.ts\n", "main/a.ts": "x\n", "a.md": "x\n"}
        with repo(files) as root:
            code, output = run(linecap.main, root)
            self.assertEqual(code, 1)
            self.assertIn("main/gone.ts: is in scripts/long-files.txt but is not a source file", output)
            (root / linecap.LONG_FILES).write_text("four hundred main/a.ts\n", encoding="utf-8")
            code, output = run(linecap.main, root)
        self.assertEqual(code, 2)
        self.assertIn("expected '<lines> <path>'", output)
