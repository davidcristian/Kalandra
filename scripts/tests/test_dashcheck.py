import unittest

from support import repo, run

import dashcheck

EM, EN = chr(0x2014), chr(0x2013)


class DashCheckTest(unittest.TestCase):
    def test_reports_an_em_dash_and_an_en_dash_with_their_lines(self) -> None:
        with repo({"a.ts": f"// one {EM} two\nconst range = '1{EN}2';\n"}) as root:
            code, output = run(lambda argv: dashcheck.main(argv, {}), root)
        self.assertEqual(code, 1)
        self.assertIn("a.ts:1: em dash", output)
        self.assertIn("a.ts:2: en dash", output)

    def test_passes_markdown_code_an_allow_comment_and_binary_files(self) -> None:
        files = {
            "a.md": f"Text with `{EM}` in code.\n\n```\n{EM}\n```\n",
            "b.vue": f"<span>{EN}</span><!-- {dashcheck.ALLOW}, a range sign -->\n",
            "c.png": f"\0{EM}".encode(),
        }
        with repo(files) as root:
            code, output = run(lambda argv: dashcheck.main(argv, {}), root)
        self.assertEqual(code, 0, output)
        self.assertIn("dashcheck OK: 2 text files", output)

    def test_an_exemption_covers_its_folder_and_must_cover_a_dash(self) -> None:
        exemptions = {"fixtures/": "copied game text", "gone.ts": "a file without dashes"}
        with repo({"fixtures/item.txt": f"Charm {EM} Unique\n", "gone.ts": "const a = 1;\n"}) as root:
            found = dashcheck.scan(root, ["fixtures/item.txt", "gone.ts"], exemptions)
        self.assertEqual([(problem.path, problem.line) for problem in found.problems], [("gone.ts", 0)])
        self.assertIn("covers no dash", found.problems[0].message)
