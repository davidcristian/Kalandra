import unittest

from support import RULES_TABLE, repo, run

import prosecheck


class ProseCheckTest(unittest.TestCase):
    def test_passes_clean_prose_and_skips_the_table_and_game_data(self) -> None:
        files = {
            "AGENTS.md": RULES_TABLE,
            "docs/page.md": "A page that checks the price.\n",
            "renderer/public/data/en/notes.md": "the gate of the game data\n",
        }
        with repo(files) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 0, output)
        self.assertIn("prosecheck OK: 3 lines of prose in 2 files", output)

    def test_reports_a_banned_word_and_a_spaced_dash_with_their_lines(self) -> None:
        files = {
            "AGENTS.md": RULES_TABLE,
            "main/a.ts": "// this gates the request -- always\nconst gate = 1;\n",
        }
        with repo(files) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn('main/a.ts:1: banned word "gates"', output)
        self.assertIn("main/a.ts:1: a spaced `--` used as a dash", output)
        self.assertNotIn("main/a.ts:2", output)

    def test_reports_a_python_file_it_cannot_parse(self) -> None:
        with repo({"AGENTS.md": RULES_TABLE, "a.py": "def broken(:\n"}) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("a.py:1: cannot parse", output)

    def test_fails_without_the_rules_table(self) -> None:
        with repo({"AGENTS.md": "# Rules\n"}) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 2)
        self.assertIn("no table", output)
