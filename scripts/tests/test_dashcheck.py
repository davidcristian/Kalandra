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

    def test_reports_the_html_references_of_both_dashes(self) -> None:
        em_refs = ["mdash;", "#8212;", "#08212;", "#x2014;", "#X2014;"]
        en_refs = ["ndash;", "#8211;", "#x2013;"]
        other_refs = ["amp;mdash;", "minus;", "#8208;", "Mdash;", "mdash"]
        lines = [f"<span>a &{ref} b</span>" for ref in em_refs + en_refs + other_refs]
        with repo({"a.vue": "\n".join(lines) + "\n", "b.md": "Text &mdash in `&" + "mdash;` code.\n"}) as root:
            code, output = run(lambda argv: dashcheck.main(argv, {}), root)
        self.assertEqual(code, 1)
        reported = [line.split(": <span>")[0] for line in output.splitlines() if line.startswith("a.vue:")]
        expected = [f"a.vue:{number}: em dash" for number in range(1, 6)]
        self.assertEqual(reported, expected + [f"a.vue:{number}: en dash" for number in range(6, 9)])
        self.assertNotIn("b.md", output)

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
