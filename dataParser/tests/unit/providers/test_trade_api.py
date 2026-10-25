import json
from pathlib import Path

import pytest

from constants.lang import ENGLISH
from providers.trade_api import (
    USER_AGENT_PRODUCT,
    TradeApiProvider,
    create_trade_session,
)
from services.request_pacer import MIN_INTERVAL_SECONDS, RequestPacer
from tests.fake_http import FakeClock, FakeResponse, FakeSession

BASE_URL = "https://www.pathofexile.com/api/trade2/data"
FILTERS = {"result": [{"id": "type_filters", "title": "Type Filters"}]}
STATS = {
    "result": [
        {
            "id": "explicit",
            "label": "Explicit",
            "entries": [
                {"id": "explicit.stat_2", "text": "+# to Strength"},
                {"id": "explicit.stat_1", "text": "+# to Dexterity"},
            ],
        }
    ]
}


def ok(body: object) -> FakeResponse:
    return FakeResponse(200, json.dumps(body))


def pull(output_dir: Path, results: list[FakeResponse | Exception]) -> FakeSession:
    """Pulls the English trade data from a fake session into output_dir."""
    clock = FakeClock()
    session = FakeSession(clock, results)
    pacer = RequestPacer(session, clock.sleep, clock)
    TradeApiProvider(ENGLISH, pacer, str(output_dir)).pull()
    return session


def read(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def test_pull_saves_the_four_endpoints_with_a_pause_between_requests(
    tmp_path: Path,
) -> None:
    session = pull(
        tmp_path, [ok(FILTERS), ok(STATS), ok({"result": []}), ok({"result": []})]
    )

    assert [url for url, _ in session.sent] == [
        f"{BASE_URL}/filters",
        f"{BASE_URL}/stats",
        f"{BASE_URL}/items",
        f"{BASE_URL}/static",
    ]
    assert session.gaps() == [MIN_INTERVAL_SECONDS] * 3
    assert read(tmp_path / "filters.json") == FILTERS
    assert read(tmp_path / "items.json") == {"result": []}
    assert read(tmp_path / "static.json") == {"result": []}


def test_pull_sorts_the_stats_entries_by_id(tmp_path: Path) -> None:
    _ = pull(tmp_path, [ok(FILTERS), ok(STATS), ok({"result": []}), ok({"result": []})])

    stats = (tmp_path / "stats.json").read_text(encoding="utf-8")
    assert stats.index("explicit.stat_1") < stats.index("explicit.stat_2")


def test_pull_keeps_the_old_file_after_a_status_other_than_200(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    _ = (tmp_path / "items.json").write_text("old items", encoding="utf-8")

    _ = pull(
        tmp_path,
        [ok(FILTERS), ok(STATS), FakeResponse(404, "Not Found"), ok({"result": []})],
    )

    assert (tmp_path / "items.json").read_text(encoding="utf-8") == "old items"
    assert f"Failed to fetch JSON from: {BASE_URL}/items, code: 404" in caplog.text
    assert read(tmp_path / "static.json") == {"result": []}


def test_create_trade_session_adds_the_tool_name_to_the_browser_user_agent() -> None:
    user_agent = create_trade_session().headers["User-Agent"]

    assert isinstance(user_agent, str)
    assert user_agent.startswith("Mozilla/5.0")
    assert user_agent.endswith(f" {USER_AGENT_PRODUCT}")
