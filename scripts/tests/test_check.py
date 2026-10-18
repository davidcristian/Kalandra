import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import check
from check import Step

PASSES = Step("passes", ".", (sys.executable, "-c", "pass"))
FAILS = Step("fails", ".", (sys.executable, "-c", "raise SystemExit(3)"))
NO_TOOL = Step("no tool", ".", ("kalandra-no-such-tool",))
NO_PACKAGES = Step("no packages", "renderer", ("npm", "run", "lint"))


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
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "renderer").mkdir()
            code, output = quietly([NO_PACKAGES], root=Path(folder))
        self.assertEqual(code, 1)
        self.assertRegex(output, r"no packages cannot start: (npm is not on PATH|renderer/node_modules is missing)")


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
