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
