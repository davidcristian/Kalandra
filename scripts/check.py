"""Runs every check in AGENTS.md that a machine can run, and names each one that failed."""

import argparse
import importlib.util
import shutil
import subprocess
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NODE_TOOLS = frozenset({"npm", "npx"})


@dataclass(frozen=True)
class Step:
    """One check: a command and the repo folder it runs in."""

    name: str
    folder: str
    command: tuple[str, ...]


PYTHON = sys.executable
STEPS = (
    Step("pre-commit hooks", ".", ("pre-commit", "run", "--all-files")),
    Step("renderer index files", "renderer", ("npm", "run", "make-index-files")),
    Step("renderer lint", "renderer", ("npm", "run", "lint")),
    Step("renderer tests", "renderer", ("npx", "vitest", "run", "--coverage")),
    Step("renderer build", "renderer", ("npm", "run", "build")),
    Step("main tests", "main", ("npm", "test", "--", "--coverage")),
    Step("main build", "main", ("npm", "run", "build")),
    Step(
        "price service tests",
        "priceService",
        (PYTHON, "-m", "coverage", "run", "-m", "unittest", "discover", "-s", "tests"),
    ),
    Step("price service coverage", "priceService", (PYTHON, "-m", "coverage", "report")),
    Step("script tests", "scripts", (PYTHON, "-m", "coverage", "run", "-m", "unittest", "discover", "-s", "tests")),
    Step("script coverage", "scripts", (PYTHON, "-m", "coverage", "report")),
    Step("docs build", "docs", ("npm", "run", "build")),
)


def missing(root: Path, step: Step) -> str | None:
    """Returns what ``step`` needs and does not have, or None when it can start."""
    tool = step.command[0]
    if shutil.which(tool) is None:
        return f"{tool} is not on PATH"
    if tool in NODE_TOOLS and not (root / step.folder / "node_modules").is_dir():
        return f"{step.folder}/node_modules is missing, so run npm ci in {step.folder}/ first"
    module = step.command[2] if step.command[1:2] == ("-m",) and step.command[2:] else None
    if tool == PYTHON and module is not None and importlib.util.find_spec(module.partition(".")[0]) is None:
        return f"{tool} has no module named {module}, so install it as DEVELOPING.md says"
    return None


def run(root: Path, steps: Sequence[Step]) -> list[str]:
    """Runs every step in order and returns the names of those that failed or could not start."""
    failed: list[str] = []
    for step in steps:
        print(f"\n==> {step.name}: {' '.join(step.command)} in {step.folder}/", flush=True)
        problem = missing(root, step)
        if problem is not None:
            print(f"check: {step.name} cannot start: {problem}", flush=True)
            failed.append(step.name)
            continue
        # which() returns npm.cmd on Windows, which subprocess cannot find from the bare name
        executable = shutil.which(step.command[0]) or step.command[0]
        command = [executable, *step.command[1:]]
        result = subprocess.run(command, cwd=root / step.folder, check=False)  # noqa: S603 the commands are the fixed STEPS
        if result.returncode != 0:
            failed.append(step.name)
    return failed


def main(argv: Sequence[str] | None = None, steps: Sequence[Step] = STEPS, root: Path = ROOT) -> int:
    """Runs the steps, or lists them with --list, and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="print each step and its command, and run nothing")
    args = parser.parse_args(argv)
    if args.list:
        for step in steps:
            print(f"{step.name}: {' '.join(step.command)} in {step.folder}/")
        return 0
    failed = run(root, steps)
    if failed:
        print(f"\ncheck: {len(failed)} of {len(steps)} steps failed: {', '.join(failed)}")
        return 1
    print(f"\ncheck: all {len(steps)} steps passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
