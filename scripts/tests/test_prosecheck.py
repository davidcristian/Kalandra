import unittest

from support import RULES_TABLE, repo, run

import prosecheck


class ProseCheckTest(unittest.TestCase):
    def test_passes_clean_prose_and_skips_the_table_and_game_data(self) -> None:
        files = {
            "AGENTS.md": RULES_TABLE,
            "docs/page.md": "A page that checks the price.\n",
            "renderer/public/data/en/client_strings.js": "// the gate of the game data\n",
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

    def test_allows_only_the_dashes_that_start_the_reason_of_an_eslint_directive(self) -> None:
        lines = [
            "// eslint-disable-next-line no-new -- the proxy adds its route",
            "new Proxy(); // eslint-disable-line no-new -- the same reason",
            "/* eslint-disable @typescript-eslint/no-explicit-any -- a reason -- and a dash */",
            "/* eslint-enable -- the end of the block */",
            "// a note -- with a dash",
            "// see eslint-disable-next-line -- in a sentence",
            "// eslint-disabled -- a word that is not a directive",
        ]
        with repo({"AGENTS.md": RULES_TABLE, "main/a.ts": "\n".join(lines) + "\n"}) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 1)
        dashes = [line for line in output.splitlines() if "a spaced `--` used as a dash" in line]
        self.assertEqual([line.split(":")[1] for line in dashes], ["3", "5", "6", "7"])

    def test_reports_a_spaced_hyphen_only_between_two_words(self) -> None:
        lines = [
            "A title - with a dash.",
            "Two  -  spaces.",
            "- a list item",
            "| a | - |",
            "Code `title - text`, b - a, 1 - 5 and a well-known word.",
        ]
        with repo({"AGENTS.md": RULES_TABLE, "docs/page.md": "\n".join(lines) + "\n"}) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 1)
        hyphens = [line for line in output.splitlines() if "a spaced hyphen used as a dash" in line]
        self.assertEqual([line.split(":")[1] for line in hyphens], ["1", "2"])

    def test_reports_a_banned_word_in_the_text_of_an_issue_form(self) -> None:
        form = "name: Bug\nbody:\n  - type: input\n    attributes:\n      label: The gates you passed\n"
        files = {"AGENTS.md": RULES_TABLE, ".github/ISSUE_TEMPLATE/bug.yml": form, ".github/workflows/a.yml": form}
        with repo(files) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 1)
        problems = [line for line in output.splitlines() if line.startswith(".github/")]
        self.assertEqual(
            problems, ['.github/ISSUE_TEMPLATE/bug.yml:5: banned word "gates"; AGENTS.md gives a plain replacement']
        )

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

    def test_fails_without_the_rules_file(self) -> None:
        with repo({"docs/page.md": "A page that checks the price.\n"}) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 2)
        self.assertTrue(output.startswith("prosecheck: cannot read "), output)

    def test_exits_2_when_no_file_has_prose(self) -> None:
        table = RULES_TABLE[RULES_TABLE.index("|") :]
        with repo({"AGENTS.md": table, "main/a.ts": "const price = 1;\n", "data.json": "{}\n"}) as root:
            code, output = run(prosecheck.main, root)
        self.assertEqual(code, 2)
        self.assertIn("prosecheck: no prose under", output)
