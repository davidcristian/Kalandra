import unittest

from support import repo, run

import linkcheck
from markdownlinks import anchors, links, slug

PAGE = """# The page

## Run `check.py` *now*

See [the map](map.md#the-boundary) and [the code](../main/src/server.ts),
and the [section
below](#run-checkpy-now). `[not a link](gone.md)`

```
[also not a link](gone.md)
```

## Run `check.py` *now*
"""


class MarkdownTest(unittest.TestCase):
    def test_reads_links_outside_code_on_the_line_where_they_start(self) -> None:
        self.assertEqual(
            [(link.line, link.target) for link in links(PAGE)],
            [(5, "map.md#the-boundary"), (5, "../main/src/server.ts"), (6, "#run-checkpy-now")],
        )

    def test_makes_anchors_as_github_does(self) -> None:
        self.assertEqual(slug("What every change must pass"), "what-every-change-must-pass")
        self.assertEqual(slug("The [map](map.md): `server.ts`, not <b>it</b>"), "the-map-serverts-not-it")
        self.assertEqual(anchors(PAGE), {"the-page", "run-checkpy-now", "run-checkpy-now-1"})


class LinkCheckTest(unittest.TestCase):
    def test_passes_links_to_files_folders_headings_and_other_sites(self) -> None:
        files = {
            "docs/dev/index.md": "[a](map.md#the-boundary), [b](tasks/), [c](https://example.com), [d](#top)\n# Top\n",
            "docs/dev/map.md": "## The boundary\n",
            "docs/dev/tasks/001-a.md": "# A\n",
            "docs/page.md": "[the site checks this one](/missing)\n",
        }
        with repo(files) as root:
            code, output = run(linkcheck.main, root)
        self.assertEqual(code, 0, output)
        self.assertIn("linkcheck OK: 4 links in 3 markdown files", output)

    def test_reports_a_missing_file_a_missing_heading_and_a_path_outside_the_repo(self) -> None:
        files = {"README.md": "[a](gone.md)\n[b](AGENTS.md#gone)\n[c](../outside.md)\n", "AGENTS.md": "# Rules\n"}
        with repo(files) as root:
            code, output = run(linkcheck.main, root)
        self.assertEqual(code, 1)
        self.assertIn("README.md:1: gone.md names gone.md, which is not in the repo", output)
        self.assertIn("README.md:2: AGENTS.md#gone names the heading #gone", output)
        self.assertIn("README.md:3: ../outside.md points outside the repo", output)
