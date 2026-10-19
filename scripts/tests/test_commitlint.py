import subprocess
import tempfile
import unittest
from pathlib import Path

from support import RULES_TABLE, repo

import commitlint

GOOD = """fix(main): read --listen without throwing

A bad value stopped the overlay from loading its page. The server now
logs the value and uses the default address.

```
break                         suite          result
skip the default address      main (27)      4 failed, and this fence line is wider than seventy-two characters
```
"""

BREAKING = r"""feat!: rename the app to Kalandra and point it at its own repo

Kalandra is now its own project, but the app, docs and templates still
named Exiled Exchange 2 and sent users, bug reports and auto updates to
Kvan7's repo. This renames the app, gives it its own app ID and config
folder, and repoints every link at davidcristian/Kalandra.

BREAKING CHANGE: settings live in %APPDATA%\kalandra; copy apt-data
from %APPDATA%\exiled-exchange-2 to keep existing settings.
"""


def words(count: int) -> str:
    return "\n".join(" ".join(["word"] * min(8, count - start)) for start in range(0, count, 8))


class CommitLintTest(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.rules = Path(folder.name) / "AGENTS.md"
        self.rules.write_text(RULES_TABLE, encoding="utf-8")

    def check(self, text: str) -> list[str]:
        return commitlint.check_message(text, Path(), self.rules)

    def test_passes_a_message_that_follows_the_rules(self) -> None:
        self.assertEqual(self.check(GOOD), [])

    def test_reports_the_header_rules(self) -> None:
        problems = self.check(f"docs(docs): Add a page that is long enough to pass {'x' * 30}.\n")
        self.assertEqual(len(problems), 4, problems)

    def test_reports_width_words_and_the_missing_blank_line(self) -> None:
        body = " ".join(["word"] * 51)
        problems = self.check(f"fix: a subject\nnot blank\n\n{body}\n")
        self.assertIn("the second line is not blank", problems)
        self.assertIn("the body has 53 words outside code fences, at most 50", problems)
        self.assertTrue(any("wrap the body at 72" in problem for problem in problems))

    def test_leaves_footers_out_of_the_word_count(self) -> None:
        self.assertEqual(self.check(BREAKING), [])
        footers = "BREAKING-CHANGE: the settings move to a new folder\nand the old one stays\nRefs #settings-folder"
        self.assertEqual(self.check(f"feat!: a subject\n\n{words(48)}\n\n{footers}\n"), [])
        self.assertEqual(self.check(f"feat!: a subject\n\n{footers}\n"), [])

    def test_counts_a_last_paragraph_that_does_not_start_with_a_footer(self) -> None:
        expected = ["the body has 55 words outside code fences, at most 50"]
        self.assertEqual(self.check(f"fix: a subject\n\n{words(30)}\n\n{words(25)}\n"), expected)
        self.assertEqual(self.check(f"fix: a subject\n\nRefs: {words(29)}\n\n{words(25)}\n"), expected)
        self.assertEqual(self.check(f"fix: a subject\n\n{words(30)}\n\n{words(16)}\nRefs: {words(8)}\n"), expected)

    def test_checks_footers_for_width_dashes_and_banned_words(self) -> None:
        footer = "BREAKING CHANGE: this gates it -- now, and the old folder stays where it was"
        self.assertEqual(
            self.check(f"feat!: a subject\n\nA body.\n\n{footer}\n"),
            [
                f"line 5 has {len(footer)} characters; wrap the body at 72",
                "line 5 uses a spaced --",
                'line 5 uses the banned word "gates"',
            ],
        )

    def test_reports_dashes_and_banned_words_outside_a_paste(self) -> None:
        dash = chr(0x2014)
        text = f"fix: a subject {dash} here\n\nThis gates it -- now.\n\n$ git log -- gates\n"
        self.assertEqual(
            self.check(text),
            ["line 1 uses an em dash", "line 3 uses a spaced --", 'line 3 uses the banned word "gates"'],
        )

    def test_reports_pointers_into_documents_that_change(self) -> None:
        text = "fix: a subject\n\nAs ADR-0009 says.\nAs rule 9 says.\nThis closes #12.\nSee task 056.\n"
        self.assertEqual(len(self.check(text)), 4, self.check(text))

    def test_reports_a_hash_only_when_it_names_a_commit(self) -> None:
        with repo({"a.txt": "a\n"}) as root:
            git = ["git", "-C", str(root), "-c", "user.name=t", "-c", "user.email=t@t"]
            subprocess.run([*git, "add", "a.txt"], check=True)  # noqa: S603 a fixed git command
            subprocess.run([*git, "commit", "-q", "-m", "a"], check=True)  # noqa: S603 a fixed git command
            head = subprocess.run([*git, "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True)  # noqa: S603 a fixed git command
            text = f"fix: a subject\n\nThis follows {head.stdout.strip()} and leaves cafe123 alone.\n"
            problems = commitlint.check_message(text, root, self.rules)
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("which a rebase changes", problems[0])

    def test_skips_merges_fixups_and_git_comments(self) -> None:
        self.assertEqual(self.check("Merge branch 'master' into dev\n\nThis gates it -- now.\n"), [])
        self.assertEqual(self.check("fixup! fix: a subject\n\nThis gates it -- now.\n"), [])
        self.assertEqual(self.check("fix: a subject\n# Please enter the commit message -- here\n"), [])

    def test_reports_a_fence_nothing_closes(self) -> None:
        self.assertIn("line 3 opens a code fence that nothing closes", self.check("fix: a subject\n\n```\npasted\n"))
