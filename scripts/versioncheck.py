"""Fails unless the five files that hold the app's version all name the same one."""

import argparse
import json
import re
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import cast

README = "README.md"
BUG_REPORT = ".github/ISSUE_TEMPLATE/bug-report.yml"
DOCS_CONFIG = "docs/.vitepress/config.js"
PACKAGE_JSON = "main/package.json"
PACKAGE_LOCK = "main/package-lock.json"

_README_VERSION = re.compile(r"Kalandra-Setup-(\d+\.\d+\.\d+)")
_BUG_REPORT_VERSION = re.compile(r"^\s*-\s*(\d+\.\d+\.\d+)")
_CONFIG_VERSION = re.compile(r"appVersion: '(\d+\.\d+\.\d+)'")


class VersionError(Exception):
    """A version file cannot be read, or a package file has no version string where npm writes one."""


def read_text(root: Path, name: str) -> str:
    """Returns the text of the file ``name`` under ``root``."""
    try:
        return (root / name).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        msg = f"cannot read {name}: {error}"
        raise VersionError(msg) from error


def first_match(pattern: re.Pattern[str], text: str) -> str | None:
    """Returns the version that ``pattern`` finds first in ``text``, or None."""
    match = pattern.search(text)
    return match.group(1) if match else None


def bug_report_version(text: str) -> str | None:
    """Returns the first list line of the bug report template that is a version: the newest dropdown option."""
    for line in text.splitlines():
        match = _BUG_REPORT_VERSION.match(line)
        if match:
            return match.group(1)
    return None


def read_json(root: Path, name: str) -> object:
    """Returns the parsed JSON file ``name`` under ``root``."""
    text = read_text(root, name)
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        msg = f"cannot parse {name}: {error}"
        raise VersionError(msg) from error


def string_at(data: object, name: str, *keys: str) -> str:
    """Returns the string at ``keys`` in ``data``, the parsed JSON file ``name``."""
    value = data
    for key in keys:
        # A dict that json.loads returned has string keys and JSON values, which isinstance cannot check
        fields = cast("dict[str, object]", value) if isinstance(value, dict) else {}
        value = fields.get(key)
    if not isinstance(value, str):
        path = "".join(f"[{key!r}]" for key in keys)
        msg = f"{name} has no version string at {path}"
        raise VersionError(msg)
    return value


def read_versions(root: Path) -> dict[str, str | None]:
    """Returns each version the five files hold, named as the mismatch report prints it."""
    package = read_json(root, PACKAGE_JSON)
    lock = read_json(root, PACKAGE_LOCK)
    return {
        "README.md version": first_match(_README_VERSION, read_text(root, README)),
        "Bug report version": bug_report_version(read_text(root, BUG_REPORT)),
        "Config.js version": first_match(_CONFIG_VERSION, read_text(root, DOCS_CONFIG)),
        "package.json version": string_at(package, PACKAGE_JSON, "version"),
        "package-lock.json top-level version": string_at(lock, PACKAGE_LOCK, "version"),
        "package-lock.json packages[] version": string_at(lock, PACKAGE_LOCK, "packages", "", "version"),
    }


def main(argv: Sequence[str] | None = None) -> int:
    """Compares the versions and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(), help="the repo to check (default: this folder)")
    parser.add_argument("files", nargs="*", help="the changed files pre-commit passes, which the check does not read")
    args = parser.parse_args(argv)
    root: Path = args.root
    try:
        versions = read_versions(root)
    except VersionError as error:
        print(f"versioncheck: {error}", file=sys.stderr)
        return 2
    if len(set(versions.values())) > 1:
        print("Version mismatch detected:")
        for label, version in versions.items():
            print(f"  {label}: {version}")
        return 1
    print("Version check passed. All versions are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
