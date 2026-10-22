import unittest

from prosesources import SourceError, prose_lines

SCRIPT = """// a line comment
const url = "http://example.com"; // after code
/* a block
   over two lines */
const pattern = /["'\\/]/g;
console.log(`logged ${value} text`);
throw new Error("thrown text");
const ignored = "not a message";
dialog.showErrorBox("box title", "box text");
"""

VUE = """<template>
  <p>Don't read this</p>
  <!-- a template comment -->
</template>

<script setup lang="ts">
// a script comment
</script>

<style>
/* a style comment */
</style>
"""

PYTHON = '''"""The module docstring."""

import logging

log = logging.getLogger(__name__)


def run() -> None:
    """The function docstring."""
    print("printed")  # a comment
    log.warning("logged %s", "argument text")
    msg = f"message {run} text"
    raise ValueError(msg)


ignored = "not a message"
'''


def texts(name: str, text: str) -> list[tuple[int, str]]:
    return [(number, line.strip()) for number, line in prose_lines(name, text)]


class ScriptTest(unittest.TestCase):
    def test_reads_comments_and_the_strings_of_log_and_error_calls(self) -> None:
        self.assertEqual(
            texts("a.ts", SCRIPT),
            [
                (1, "a line comment"),
                (2, "after code"),
                (3, "a block"),
                (4, "over two lines"),
                (6, "logged  text"),
                (7, "thrown text"),
                (9, "box title"),
                (9, "box text"),
            ],
        )

    def test_reads_only_comments_in_a_vue_file(self) -> None:
        self.assertEqual(
            texts("a.vue", VUE), [(3, "a template comment"), (7, "a script comment"), (11, "a style comment")]
        )


class MarkdownTest(unittest.TestCase):
    def test_leaves_out_fenced_code(self) -> None:
        text = "before\n```sh\ninside\n~~~\n```\nafter\n"
        self.assertEqual(texts("a.md", text), [(1, "before"), (6, "after")])


class PythonTest(unittest.TestCase):
    def test_reads_docstrings_comments_and_message_strings(self) -> None:
        self.assertEqual(
            texts("a.py", PYTHON),
            [
                (1, "The module docstring."),
                (9, "The function docstring."),
                (10, "a comment"),
                (10, "printed"),
                (11, "argument text"),
                (11, "logged %s"),
                (12, "text"),
                (12, "message"),
            ],
        )

    def test_reads_the_messages_of_problems_errors_and_option_help(self) -> None:
        lines = [
            'problems.append(Problem("a.md", "problem text"))',
            'error = errors.TableError("error text")',
            'parser.add_argument("--root", help="help text")',
            'others.append("not a message")',
            'call("not a message", help_text="not read")',
            'handlers[0]("not a message")',
        ]
        self.assertEqual(
            texts("a.py", "\n".join(lines)), [(1, "a.md"), (1, "problem text"), (2, "error text"), (3, "help text")]
        )

    def test_reads_every_string_of_a_message_expression(self) -> None:
        lines = [
            'print("joined " + "text")',
            'print("formatted %s" % name)',
            'print("first" if name else "second")',
            'problems.extend(f"built {n}" for n in names)',
        ]
        self.assertEqual(
            texts("a.py", "\n".join(lines)),
            [(1, "joined"), (1, "text"), (2, "formatted %s"), (3, "first"), (3, "second"), (4, "built")],
        )

    def test_reports_a_file_it_cannot_parse(self) -> None:
        with self.assertRaises(SourceError):
            prose_lines("a.py", "def broken(:\n")


class OtherTest(unittest.TestCase):
    def test_reads_hash_comments_of_yaml_and_nothing_of_json(self) -> None:
        self.assertEqual(texts("a.yml", "# a comment\nkey: value # not read\n"), [(1, "a comment")])
        self.assertEqual(texts("a.json", '{"comment": "text"}'), [])

    def test_reads_hash_comments_of_dockerfiles_dotfiles_and_text_files(self) -> None:
        names = ["a/Dockerfile", ".gitignore", "a/.coveragerc", "list.txt", "nginx.conf", "Dockerfile.dockerignore"]
        read = {name: texts(name, "# a comment\nnot read\n") for name in [*names, "LICENSE"]}
        self.assertEqual(read, {name: [(1, "a comment")] for name in names} | {"LICENSE": []})

    def test_reads_the_comments_of_css_html_jsonc_and_mts(self) -> None:
        self.assertEqual(
            texts("a.css", "/* one */\na { color: red; }\n/* two\n   lines */\n"),
            [(1, "one"), (3, "two"), (4, "lines")],
        )
        html = "<!-- a page comment -->\n<p>not read</p>\n<script>\n// a script comment\n</script>\n"
        self.assertEqual(texts("a.html", html), [(1, "a page comment"), (4, "a script comment")])
        self.assertEqual(texts("a.jsonc", '// a comment\n{"url": "https://example.com"}\n'), [(1, "a comment")])
        self.assertEqual(texts("a.mts", "// a comment\n"), [(1, "a comment")])
