import io
import subprocess
import tempfile
from collections.abc import Callable, Generator, Mapping, Sequence
from contextlib import contextmanager, redirect_stderr, redirect_stdout
from pathlib import Path

RULES_TABLE = """# Rules

| Do not write | Write instead |
| --- | --- |
| gate, gates | check |
| spell, spells | write |
| delve | look at |
| under the hood | say it literally |
"""


@contextmanager
def repo(files: Mapping[str, str | bytes]) -> Generator[Path, None, None]:
    """Yields a new git repo that holds ``files``, none of them committed."""
    with tempfile.TemporaryDirectory() as folder:
        root = Path(folder)
        subprocess.run(["git", "init", "-q", str(root)], check=True)  # noqa: S603, S607 a fixed git command
        for name, content in files.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(content, bytes):
                path.write_bytes(content)
            else:
                path.write_text(content, encoding="utf-8", newline="\n")
        yield root


@contextmanager
def broken_repo() -> Generator[Path, None, None]:
    """Yields a folder with a markdown file and a .git file that names no repo, so git fails in it."""
    with tempfile.TemporaryDirectory() as folder:
        root = Path(folder)
        (root / ".git").write_text("gitdir: missing\n", encoding="utf-8")
        (root / "README.md").write_text("[a](README.md)\n", encoding="utf-8")
        yield root


def run(main: Callable[[Sequence[str]], int], root: Path) -> tuple[int, str]:
    """Runs a check's main() on ``root`` and returns its exit code and everything it printed."""
    output = io.StringIO()
    with redirect_stdout(output), redirect_stderr(output):
        code = main(["--root", str(root)])
    return code, output.getvalue()
