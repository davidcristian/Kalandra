"""Skip markers for the tests that read the game export or the trade data, which a clone does not have."""

from pathlib import Path

import pytest

DATA = Path(__file__).parents[1] / "data"


def holds_files(folder: Path) -> bool:
    """Returns whether the folder holds a file other than .gitkeep, at any depth."""
    return any(path.is_file() and path.name != ".gitkeep" for path in folder.rglob("*"))


needs_game_export = pytest.mark.skipif(
    not (
        holds_files(DATA / "vendor" / "tables")
        or holds_files(DATA / "vendor" / "files")
    ),
    reason="no game export in data/vendor/: export it as dataParser/README.md says",
)
needs_trade_data = pytest.mark.skipif(
    not holds_files(DATA / "json"),
    reason="no trade data in data/json/: main.py --pull saves it from the trade sites",
)
