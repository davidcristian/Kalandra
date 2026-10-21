import io
import os
import re
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
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


COMMENT_LINE = "fix: a subject\n\n#12 is a line that starts with a hash -- here\n"
SCRIPT = Path(commitlint.__file__).resolve()


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

    def test_checks_lines_that_start_with_a_hash_in_a_message_not_typed_in_an_editor(self) -> None:
        self.assertEqual(
            commitlint.check_message(COMMENT_LINE, Path(), self.rules, from_editor=False),
            ["line 3 uses a spaced --", "line 3 has an issue or pull request number"],
        )

    def test_main_reads_from_the_environment_whether_git_opened_an_editor(self) -> None:
        message = Path(self.rules.parent) / "COMMIT_EDITMSG"
        message.write_text(COMMENT_LINE, encoding="utf-8")
        output = io.StringIO()
        with redirect_stderr(output):
            without_editor = commitlint.main([str(message)], {"GIT_EDITOR": ":"})
            with_editor = commitlint.main([str(message)], {"GIT_EDITOR": "vim"})
            unset = commitlint.main([str(message)], {})
        self.assertEqual((without_editor, with_editor, unset), (1, 0, 0))
        self.assertIn("commitlint: line 3 has an issue or pull request number", output.getvalue())

    def test_checks_the_lines_that_git_keeps_as_a_commit_msg_hook(self) -> None:
        with repo({"a.txt": "a\n", "message.txt": COMMENT_LINE}) as root:
            hook = root / "hooks" / "commit-msg"
            hook.parent.mkdir()
            python, script = Path(sys.executable).as_posix(), SCRIPT.as_posix()
            hook.write_text(f'#!/bin/sh\nexec "{python}" "{script}" "$1"\n', encoding="utf-8", newline="\n")
            hook.chmod(0o755)
            git = ["git", "-C", str(root), "-c", "core.hooksPath=hooks", "-c", "user.name=t", "-c", "user.email=t@t"]
            env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
            subprocess.run([*git, "add", "a.txt"], check=True, env=env)  # noqa: S603 a fixed git command
            commit = [*git, "commit", "-q", "-F", "message.txt"]
            kept = subprocess.run(commit, capture_output=True, text=True, check=False, env=env)  # noqa: S603 a fixed git command
            editor = {**env, "GIT_EDITOR": "test -f"}
            dropped = subprocess.run([*commit, "-e"], capture_output=True, text=True, check=False, env=editor)  # noqa: S603 a fixed git command
        self.assertEqual(kept.returncode, 1, kept.stderr)
        self.assertIn("commitlint: line 3 has an issue or pull request number", kept.stderr)
        self.assertEqual(dropped.returncode, 0, dropped.stderr)

    def test_reports_a_fence_nothing_closes(self) -> None:
        self.assertIn("line 3 opens a code fence that nothing closes", self.check("fix: a subject\n\n```\npasted\n"))

    def test_reports_a_scope_outside_the_list(self) -> None:
        listed = ", ".join(commitlint.SCOPES)
        self.assertEqual(self.check("fix(kitchen): a subject\n"), [f"the scope 'kitchen' is not one of {listed}"])
        self.assertEqual(
            self.check("fix(main,renderer): a subject\n"), [f"the scope 'main,renderer' is not one of {listed}"]
        )
        self.assertEqual(self.check("fix(Main): a subject\n"), [f"the scope 'Main' is not one of {listed}"])
        self.assertEqual(self.check("fix(dataparser): a subject\n"), [])

    def test_reports_a_breaking_change_without_both_the_bang_and_the_footer(self) -> None:
        bang = "the first line marks a breaking change with !, and no BREAKING CHANGE: footer says what breaks"
        footer = "a BREAKING CHANGE: footer needs a ! before the colon of the first line"
        self.assertEqual(self.check("feat!: a subject\n\nThe settings move.\n"), [bang])
        self.assertEqual(self.check("feat(main)!: a subject\n\nBREAKING CHANGE: the settings move.\n\nMore.\n"), [bang])
        self.assertEqual(self.check("feat: a subject\n\nA body.\n\nBREAKING CHANGE: the settings move.\n"), [footer])
        self.assertEqual(self.check("feat!: a subject\n\nA body.\n\nRefs: settings\nBREAKING-CHANGE: they move.\n"), [])

    def test_leaves_a_first_line_outside_the_form_to_conventional_pre_commit(self) -> None:
        self.assertEqual(self.check("Update the readme.\n\nA body.\n\nBREAKING CHANGE: the settings move.\n"), [])

    def test_the_scopes_are_the_list_in_the_real_rules(self) -> None:
        text = " ".join(commitlint.RULES.read_text(encoding="utf-8").split())
        found = re.search(r"name one area: ((?:`[a-z]+`, )*`[a-z]+`)\.", text)
        self.assertIsNotNone(found, "AGENTS.md names no scope list")
        self.assertEqual(tuple(re.findall(r"`([a-z]+)`", found.group(1) if found else "")), commitlint.SCOPES)
