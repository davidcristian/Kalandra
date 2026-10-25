import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from constants.filenames import ITEM_IMAGE_CACHE, OLD_ITEM_IMAGE_CACHE
from constants.lang import ENGLISH, LANGUAGES
from main import main, pull_inputs, write_ndjson, write_text
from providers.game_api import GameDataProvider
from services.request_pacer import RequestPacer
from tests.fake_http import FakeClock, FakeResponse, FakeSession

OUTPUT_FILES = ("stats.ndjson", "items.ndjson", "client_strings.js")


@pytest.fixture(scope="module")
def build(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Builds every language from the inputs in data/ and pushes it to a temporary app folder."""
    root = tmp_path_factory.mktemp("build")
    for lang in LANGUAGES:
        (root / "app" / "renderer" / "public" / "data" / lang).mkdir(parents=True)
    (root / "cache").mkdir()

    main(
        push=True,
        main_repo_path=str(root / "app"),
        output_dir=str(root / "output"),
        image_cache_dir=str(root / "cache"),
    )
    return root


def read_ndjson(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


@pytest.mark.parametrize("lang", LANGUAGES)
def test_main_writes_the_stats_and_items_of_each_language(build: Path, lang: str):
    stats = read_ndjson(build / "output" / lang / "stats.ndjson")
    items = read_ndjson(build / "output" / lang / "items.ndjson")
    client_strings = (build / "output" / lang / "client_strings.js").read_text(
        encoding="utf-8"
    )

    assert len(stats) > 1000
    assert all({"ref", "better", "matchers"} <= stat.keys() for stat in stats)
    assert len(items) > 1000
    assert all({"namespace", "w", "h"} <= item.keys() for item in items)
    # A unique item the game's Words table does not name is written without a name
    assert all(
        {"name", "refName"} <= item.keys() or item["namespace"] == "UNIQUE"
        for item in items
    )
    assert "export default {" in client_strings


def test_main_matches_a_trade_stat_to_its_english_text(build: Path):
    stats = read_ndjson(build / "output" / ENGLISH / "stats.ndjson")

    life = next(stat for stat in stats if stat["ref"] == "# to maximum Life")

    assert life["matchers"] == [{"string": "# to maximum Life"}]
    assert life["trade"]["ids"]["explicit"] == ["explicit.stat_3299347043"]


@pytest.mark.parametrize("lang", LANGUAGES)
def test_main_pushes_the_files_of_each_language_to_the_app(build: Path, lang: str):
    for name in OUTPUT_FILES:
        pushed = build / "app" / "renderer" / "public" / "data" / lang / name
        assert pushed.read_bytes() == (build / "output" / lang / name).read_bytes()


def test_main_saves_the_image_cache_in_the_given_folder(build: Path):
    assert sorted(path.name for path in (build / "cache").iterdir()) == sorted(
        [ITEM_IMAGE_CACHE, OLD_ITEM_IMAGE_CACHE]
    )


class FakeExport(GameDataProvider):
    """Writes exported.txt into the vendor folder in place of running the export command."""

    def __init__(self, vendor_dir: Path):
        super().__init__()
        self.vendor_dir = str(vendor_dir)

    def run_export(self) -> None:
        _ = (Path(self.vendor_dir) / "exported.txt").write_text("done")


def test_pull_inputs_exports_the_game_data_and_saves_the_trade_data_of_each_language(
    tmp_path: Path,
):
    vendor = tmp_path / "vendor"
    vendor.mkdir()
    for lang in LANGUAGES:
        (tmp_path / "json" / lang).mkdir(parents=True)
    clock = FakeClock()
    session = FakeSession(clock, [FakeResponse() for _ in range(4 * len(LANGUAGES))])

    pull_inputs(
        FakeExport(vendor),
        RequestPacer(session, clock.sleep, clock),
        str(tmp_path / "json"),
    )

    assert (vendor / "exported.txt").is_file()
    for lang in LANGUAGES:
        saved = sorted(path.name for path in (tmp_path / "json" / lang).iterdir())
        assert saved == ["filters.json", "items.json", "static.json", "stats.json"]
    assert len(session.sent) == 4 * len(LANGUAGES)


def test_write_ndjson_leaves_out_the_missing_values_of_a_string_column(tmp_path):
    df = pd.DataFrame(
        [
            {"ref": "a", "id": None, "matchers": [{"string": "a"}], "better": 1},
            {"ref": "b", "id": "b_id", "matchers": [], "better": -1},
        ]
    )
    path = tmp_path / "stats.ndjson"

    write_ndjson(df, str(path))

    lines = path.read_text(encoding="utf-8").splitlines()
    assert [json.loads(line) for line in lines] == [
        {"ref": "a", "matchers": [{"string": "a"}], "better": 1},
        {"ref": "b", "id": "b_id", "matchers": [], "better": -1},
    ]
    assert "NaN" not in path.read_text(encoding="utf-8")


def test_write_ndjson_raises_on_a_nan_inside_a_value(tmp_path):
    df = pd.DataFrame(
        [{"ref": "a", "matchers": [{"string": "a", "value": float("nan")}]}]
    )

    with pytest.raises(ValueError, match="JSON"):
        write_ndjson(df, str(tmp_path / "stats.ndjson"))


def test_write_text_writes_the_text_as_utf8(tmp_path: Path):
    path = tmp_path / "client_strings.js"

    write_text(str(path), 'export default { a: "é" }')

    assert path.read_text(encoding="utf-8") == 'export default { a: "é" }'


def test_write_text_logs_a_failed_write_and_raises_it_again(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
):
    path = tmp_path / "client_strings.js"

    # A lone surrogate has no UTF-8 form
    with pytest.raises(UnicodeEncodeError):
        write_text(str(path), 'export default { a: "\ud800" }')

    assert [record.levelname for record in caplog.records] == ["ERROR"]
    assert caplog.records[0].getMessage().startswith(f"Failed to write {path}: ")
    assert capsys.readouterr().out == ""


def test_importing_main_adds_no_log_handler_and_keeps_the_default_level():
    # A new interpreter, since this test run has already imported every module
    script = "import logging, main; root = logging.getLogger(); print(len(root.handlers), root.level)"
    src = Path(__file__).parent.parent / "src"
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=src,
        env={**os.environ, "PYTHONPATH": str(src)},
        capture_output=True,
        text=True,
        check=True,
    )

    assert result.stdout.splitlines()[-1].split() == ["0", str(logging.WARNING)]
