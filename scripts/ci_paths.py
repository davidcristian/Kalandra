"""Reads changed paths on stdin and prints which test jobs of CI they affect, for GITHUB_OUTPUT."""

import sys
from collections.abc import Iterable
from typing import NamedTuple

JOBS = ("renderer", "main", "price_service", "scripts", "docs")
ALL = frozenset(JOBS)
NONE: frozenset[str] = frozenset()


class Rule(NamedTuple):
    """A path, or a folder when it ends with /, and the jobs a change to it affects."""

    path: str
    jobs: frozenset[str]


# The first rule that matches applies, so a file comes before its folder, and a path no rule matches runs every job.
# Lint & Format runs every pre-commit hook on every push, so a path that only the hooks read affects no job here.
RULES = (
    Rule(".github/workflows/", ALL),
    Rule("scripts/", ALL),
    # test_bannedwords.py and test_commitlint.py read the banned words table and the scope list in AGENTS.md.
    Rule("AGENTS.md", frozenset({"scripts"})),
    Rule("ipc/", frozenset({"renderer", "main"})),
    Rule("renderer/public/data/namespaceMap.json", frozenset({"renderer", "price_service"})),
    Rule("priceService/tests/fixtures/", frozenset({"renderer", "price_service"})),
    Rule("priceService/", frozenset({"price_service"})),
    Rule("renderer/", frozenset({"renderer"})),
    Rule("main/", frozenset({"main"})),
    # test_backlogcheck.py reads the task template in the backlog index.
    Rule("docs/dev/refinements/index.md", frozenset({"scripts"})),
    Rule("docs/dev/", NONE),
    Rule("docs/", frozenset({"docs"})),
    Rule("dataParser/", NONE),
    Rule(".github/", NONE),
    Rule("LICENSES/", NONE),
    Rule(".pre-commit-config.yaml", NONE),
    Rule("pyrightconfig.json", NONE),
    Rule(".gitignore", NONE),
    Rule("LICENSE", NONE),
    Rule("crowdin.yml", NONE),
    Rule("kalandra.code-workspace", NONE),
    Rule("testUpdate.sh", NONE),
)


def matches(rule: Rule, path: str) -> bool:
    """Returns whether ``path`` is the rule's file or inside the rule's folder."""
    return path.startswith(rule.path) if rule.path.endswith("/") else path == rule.path


def classify(path: str) -> frozenset[str]:
    """Returns the jobs a change to one path affects; a markdown file outside a folder above affects none."""
    for rule in RULES:
        if matches(rule, path):
            return rule.jobs
    return NONE if path.endswith(".md") and "/" not in path else ALL


def affected(paths: Iterable[str]) -> frozenset[str]:
    """Returns the jobs that any of ``paths`` affects."""
    return frozenset(job for path in paths if path.strip() for job in classify(path.strip()))


def main(lines: Iterable[str] | None = None) -> int:
    """Prints one job=true or job=false line per job, for the changed paths on stdin."""
    jobs = affected(sys.stdin if lines is None else lines)
    for job in JOBS:
        print(f"{job}={'true' if job in jobs else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
