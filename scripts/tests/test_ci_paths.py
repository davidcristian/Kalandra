import io
import unittest
from contextlib import redirect_stdout

import ci_paths


class ClassifyTest(unittest.TestCase):
    def test_sends_each_part_to_its_jobs(self) -> None:
        cases: dict[str, set[str]] = {
            "renderer/src/parser/Parser.ts": {"renderer"},
            "main/src/server.ts": {"main"},
            "ipc/types.ts": {"renderer", "main"},
            "renderer/public/data/namespaceMap.json": {"renderer", "price_service"},
            "priceService/tests/fixtures/price_file.json": {"renderer", "price_service"},
            "priceService/price_service/ninja.py": {"price_service"},
            "docs/faq.md": {"docs"},
            "docs/dev/index.md": set(),
            "AGENTS.md": {"scripts"},
            "DEVELOPING.md": set(),
            ".github/ISSUE_TEMPLATE/bug-report.yml": set(),
        }
        for path, jobs in cases.items():
            self.assertEqual(ci_paths.classify(path), jobs, path)

    def test_runs_every_job_for_workflows_scripts_and_unknown_paths(self) -> None:
        for path in (".github/workflows/test.yml", "scripts/ci_paths.py", "newfolder/notes.md", "Makefile"):
            self.assertEqual(ci_paths.classify(path), ci_paths.ALL, path)

    def test_no_rule_is_hidden_by_an_earlier_one(self) -> None:
        for index, rule in enumerate(ci_paths.RULES):
            earlier = [other.path for other in ci_paths.RULES[:index] if ci_paths.matches(other, rule.path)]
            self.assertEqual(earlier, [], rule.path)


class MainTest(unittest.TestCase):
    def test_prints_one_line_per_job_for_the_union_of_the_paths(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            ci_paths.main(["main/src/main.ts\n", "\n", "docs/index.md\n"])
        self.assertEqual(
            output.getvalue().splitlines(),
            ["renderer=false", "main=true", "price_service=false", "scripts=false", "docs=true"],
        )
