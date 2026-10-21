"""Lists the files of the repo that git tracks or would add, and reads them as text."""

import subprocess
from collections.abc import Iterable
from fnmatch import fnmatchcase
from pathlib import Path

# The game data that dataParser writes or reads, which keeps the game's text as it is
GAME_DATA = (
    "renderer/public/data/*/client_strings.js",
    "renderer/public/data/*/items.ndjson",
    "renderer/public/data/*/stats.ndjson",
    "dataParser/output/",
    "dataParser/data/",
)


class RepoError(Exception):
    """git could not list the files of the repo."""


def repo_files(root: Path) -> list[str]:
    """Returns the paths, relative to ``root`` and with forward slashes, of the files git tracks or would add."""
    command = ["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"]
    try:
        result = subprocess.run(command, capture_output=True, check=False)  # noqa: S603 a fixed git command
    except OSError as error:
        msg = f"cannot run git: {error}"
        raise RepoError(msg) from error
    if result.returncode != 0:
        msg = f"git ls-files failed in {root}: {result.stderr.decode(errors='replace').strip()}"
        raise RepoError(msg)
    names = {name for name in result.stdout.decode("utf-8").split("\0") if name}
    return sorted(name for name in names if (root / name).is_file())


def read_text(path: Path) -> str | None:
    """Returns the file's text, or None when it is not UTF-8 text."""
    data = path.read_bytes()
    if b"\0" in data:
        return None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def matches(name: str, prefix: str) -> bool:
    """Returns whether ``name`` is ``prefix``, is inside it when it ends with `/`, or matches it with `*` as a name."""
    if prefix.endswith("/"):
        return name.startswith(prefix)
    return name.count("/") == prefix.count("/") and fnmatchcase(name, prefix)


def under(name: str, prefixes: Iterable[str]) -> bool:
    """Returns whether ``name`` matches one of ``prefixes``: a file, a folder that ends with `/`, or a pattern."""
    return any(matches(name, prefix) for prefix in prefixes)
