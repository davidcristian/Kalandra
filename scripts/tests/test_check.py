import io
import sys
import tempfile
import unittest
from contextlib import AbstractContextManager, redirect_stdout
from pathlib import Path
from unittest import mock

import check
from check import Step

PASSES = Step("passes", ".", (sys.executable, "-c", "pass"))
FAILS = Step("fails", ".", (sys.executable, "-c", "raise SystemExit(3)"))
NO_TOOL = Step("no tool", ".", ("kalandra-no-such-tool",))
NODE_STEP = Step("node step", "renderer", (sys.executable, "-c", "pass"))
NOT_A_NODE_TOOL = Step("not node", "renderer", ("git", "--version"))


def python_as_the_node_tool() -> AbstractContextManager[frozenset[str]]:
    # Python is on every machine that runs these tests, and npm is not
    return mock.patch.object(check, "NODE_TOOLS", frozenset({sys.executable}))


def quietly(steps: list[Step], argv: list[str] | None = None, root: Path = check.ROOT) -> tuple[int, str]:
    output = io.StringIO()
    with redirect_stdout(output):
        code = check.main(argv or [], steps, root)
    return code, output.getvalue()


class RunTest(unittest.TestCase):
    def test_runs_every_step_and_names_the_ones_that_failed(self) -> None:
        with redirect_stdout(io.StringIO()):
            failed = check.run(check.ROOT, [FAILS, PASSES, NO_TOOL])
        self.assertEqual(failed, ["fails", "no tool"])

    def test_a_node_step_without_its_packages_does_not_start(self) -> None:
        with tempfile.TemporaryDirectory() as folder, python_as_the_node_tool():
            (Path(folder) / "renderer").mkdir()
            code, output = quietly([NODE_STEP], root=Path(folder))
        self.assertEqual(code, 1)
        missing = "renderer/node_modules is missing, so run npm ci in renderer/ first"
        self.assertIn(f"check: node step cannot start: {missing}\n", output)


class MissingTest(unittest.TestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        (self.root / "renderer").mkdir()
        self.enterContext(python_as_the_node_tool())

    def test_names_a_tool_that_is_not_on_path(self) -> None:
        self.assertEqual(check.missing(self.root, NO_TOOL), "kalandra-no-such-tool is not on PATH")

    def test_names_the_missing_packages_of_a_node_step(self) -> None:
        self.assertEqual(
            check.missing(self.root, NODE_STEP), "renderer/node_modules is missing, so run npm ci in renderer/ first"
        )

    def test_a_node_step_with_its_packages_can_start(self) -> None:
        (self.root / "renderer" / "node_modules").mkdir()
        self.assertIsNone(check.missing(self.root, NODE_STEP))

    def test_another_tool_needs_no_packages(self) -> None:
        self.assertIsNone(check.missing(self.root, NOT_A_NODE_TOOL))


class MainTest(unittest.TestCase):
    def test_returns_0_when_every_step_passes(self) -> None:
        code, output = quietly([PASSES, PASSES])
        self.assertEqual(code, 0)
        self.assertIn("check: all 2 steps passed", output)

    def test_returns_1_and_lists_the_failed_steps(self) -> None:
        code, output = quietly([PASSES, FAILS])
        self.assertEqual(code, 1)
        self.assertIn("check: 1 of 2 steps failed: fails", output)

    def test_list_prints_the_steps_and_runs_none(self) -> None:
        code, output = quietly([FAILS], ["--list"])
        self.assertEqual(code, 0)
        self.assertEqual(output, f"fails: {sys.executable} -c raise SystemExit(3) in ./\n")


class StepsTest(unittest.TestCase):
    def test_every_step_has_its_own_name_and_an_existing_folder(self) -> None:
        names = [step.name for step in check.STEPS]
        self.assertEqual(len(names), len(set(names)))
        for step in check.STEPS:
            self.assertTrue((check.ROOT / step.folder).is_dir(), step.folder)
