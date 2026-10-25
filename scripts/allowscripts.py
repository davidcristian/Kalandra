"""Fails when an allowScripts entry in a package.json names a package that its lock file has with no install script."""

import argparse
import json
import re
import sys
from collections.abc import Sequence
from pathlib import Path, PurePosixPath
from typing import NamedTuple, cast

from repofiles import RepoError, repo_files

PACKAGE = "package.json"
LOCK = "package-lock.json"
_EXACT_VERSION = re.compile(r"^\d+\.\d+\.\d+([-+][0-9A-Za-z.+-]+)?$")


class CheckError(Exception):
    """A package file cannot be read, does not parse, or has an allowScripts field that is not an object."""


class Entry(NamedTuple):
    """One allowScripts key: the package name and the exact version it names, or None for any version."""

    key: str
    name: str
    version: str | None


def parse_key(key: str) -> Entry:
    """Splits ``name@version``; a key with no version or with a range matches the name alone, as a range can."""
    at = key.rfind("@")
    if at <= 0:
        return Entry(key, key, None)
    name, spec = key[:at], key[at + 1 :]
    return Entry(key, name, spec if _EXACT_VERSION.match(spec) else None)


def as_object(value: object) -> dict[str, object] | None:
    """Returns ``value`` as a JSON object, or None when it is another JSON value."""
    # A dict that json.loads returned has string keys and JSON values, which isinstance cannot check
    return cast("dict[str, object]", value) if isinstance(value, dict) else None


def read_json(root: Path, name: str) -> dict[str, object]:
    """Returns the JSON object in the file ``name`` under ``root``."""
    try:
        data: object = json.loads((root / name).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        msg = f"cannot read {name}: {error}"
        raise CheckError(msg) from error
    found = as_object(data)
    if found is None:
        msg = f"{name} is not a JSON object"
        raise CheckError(msg)
    return found


def allowed(root: Path, name: str) -> list[Entry]:
    """Returns the allowScripts entries of the package.json ``name``."""
    field = read_json(root, name).get("allowScripts", {})
    entries = as_object(field)
    if entries is None:
        msg = f"{name}: allowScripts is not an object"
        raise CheckError(msg)
    return [parse_key(key) for key in entries]


def with_scripts(root: Path, name: str) -> dict[str, set[str]]:
    """Returns each package that the lock file ``name`` installs with an install script, and its versions."""
    packages = as_object(read_json(root, name).get("packages")) or {}
    found: dict[str, set[str]] = {}
    for path, value in packages.items():
        package = as_object(value) or {}
        if "node_modules/" not in path or package.get("hasInstallScript") is not True:
            continue
        version = package.get("version")
        # An alias installs a package under another folder name, and the lock gives the real one as "name"
        names = {path.rsplit("node_modules/", 1)[1], package.get("name")}
        for package_name in names:
            if isinstance(package_name, str):
                found.setdefault(package_name, set()).add(version if isinstance(version, str) else "")
    return found


def problem(folder: str, entry: Entry, locked: dict[str, set[str]]) -> str | None:
    """Returns what is wrong with one entry, or None when the lock has a package with an install script it names."""
    versions = locked.get(entry.name)
    if versions and (entry.version is None or entry.version in versions):
        return None
    where = f"{folder}/{PACKAGE}: allowScripts names {entry.key}, but {LOCK} has"
    if not versions:
        return f"{where} no {entry.name} with an install script: run npm install-scripts prune in {folder}/"
    listed = ", ".join(sorted(versions))
    return (
        f"{where} {entry.name} {listed}: review that version's install script, then run"
        f" npm install-scripts approve {entry.name} in {folder}/"
    )


def scan(root: Path, names: Sequence[str]) -> tuple[int, list[str]]:
    """Checks every package.json that has a lock file next to it, and returns the entries read and the problems."""
    files = set(names)
    count = 0
    problems: list[str] = []
    for name in names:
        path = PurePosixPath(name)
        lock = str(path.with_name(LOCK))
        if path.name != PACKAGE or lock not in files:
            continue
        entries = allowed(root, name)
        if not entries:
            continue
        count += len(entries)
        locked = with_scripts(root, lock)
        folder = str(path.parent)
        problems.extend(found for entry in entries if (found := problem(folder, entry, locked)) is not None)
    return count, problems


def main(argv: Sequence[str] | None = None) -> int:
    """Checks the allowScripts entries of the repo and returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(), help="the repo to check (default: this folder)")
    args = parser.parse_args(argv)
    root: Path = args.root
    try:
        count, problems = scan(root, repo_files(root))
    except (RepoError, CheckError) as error:
        print(f"allowscripts: {error}", file=sys.stderr)
        return 2
    if not count:
        print(f"allowscripts: no allowScripts entry under {root}, so the check cannot fail", file=sys.stderr)
        return 2
    for line in problems:
        print(line)
    if problems:
        return 1
    print(f"allowscripts OK: {count} allowScripts entries match their lock files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
