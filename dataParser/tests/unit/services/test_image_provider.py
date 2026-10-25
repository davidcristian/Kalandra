import json
from pathlib import Path

import pandas as pd
import pytest
import requests

from constants.filenames import ITEM_IMAGE_CACHE, OLD_ITEM_IMAGE_CACHE
from services.image_provider import (
    MAX_FAILED_IN_A_ROW,
    MODE,
    NOT_FOUND,
    ImageLookupError,
    ImageProvider,
    backup_cache,
)
from services.rate_limiter import RateLimiter, RateLimitError
from tests.fake_http import FakeClock, FakeResponse, FakeSession

RING_ICON = "https://web.poecdn.com/gen/image/ring/RubyRing.png"
UNKNOWN_BASE = FakeResponse(400, '{"error": {"code": 2, "message": "Unknown item"}}')


def read_cache(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def found(fetch_id: str, icon: str) -> list[FakeResponse | Exception]:
    """Returns the search and fetch responses of a lookup that finds a listing with this icon."""
    return [
        FakeResponse(text=json.dumps({"result": [fetch_id]})),
        FakeResponse(text=json.dumps({"result": [{"item": {"icon": icon}}]})),
    ]


def rings(*names: str) -> pd.DataFrame:
    return pd.DataFrame(
        [{"refName": name, "namespace": "ITEM", "unique": None} for name in names]
    )


def provider_for(
    tmp_path: Path, responses: list[FakeResponse | Exception], mode: MODE = "new"
) -> tuple[ImageProvider, FakeSession]:
    """Returns a provider whose requests get the given responses in order."""
    session = FakeSession(FakeClock(), responses)
    return ImageProvider(mode, str(tmp_path), RateLimiter(session=session)), session


def test_a_new_provider_creates_an_empty_cache_in_the_given_folder(
    tmp_path: Path,
) -> None:
    provider = ImageProvider("noLookup", str(tmp_path))

    assert provider.cache == {}
    assert [path.name for path in tmp_path.iterdir()] == [ITEM_IMAGE_CACHE]
    assert read_cache(tmp_path / ITEM_IMAGE_CACHE) == {}


def test_the_backup_keeps_the_cache_from_before_the_run_after_each_build_saves_it(
    tmp_path: Path,
) -> None:
    before = {"ITEM=Ruby Ring": NOT_FOUND}
    _ = (tmp_path / ITEM_IMAGE_CACHE).write_text(json.dumps(before), encoding="utf-8")

    backup_cache(str(tmp_path))
    english, _ = provider_for(tmp_path, found("a1", RING_ICON), "missing")
    _ = english.apply_images(rings("Ruby Ring"))
    _ = ImageProvider("noLookup", str(tmp_path)).apply_images(rings("Ruby Ring"))

    assert read_cache(tmp_path / ITEM_IMAGE_CACHE) == {"ITEM=Ruby Ring": RING_ICON}
    assert read_cache(tmp_path / OLD_ITEM_IMAGE_CACHE) == before


def test_the_backup_of_a_missing_cache_is_empty(tmp_path: Path) -> None:
    backup_cache(str(tmp_path))

    assert [path.name for path in tmp_path.iterdir()] == [OLD_ITEM_IMAGE_CACHE]
    assert read_cache(tmp_path / OLD_ITEM_IMAGE_CACHE) == {}


def test_no_lookup_sets_the_cached_icon_or_not_found_and_saves_the_cache(
    tmp_path: Path,
) -> None:
    cache = {"ITEM=Ruby Ring": RING_ICON}
    _ = (tmp_path / ITEM_IMAGE_CACHE).write_text(json.dumps(cache), encoding="utf-8")
    items = pd.DataFrame(
        [
            {"refName": "Ruby Ring", "namespace": "ITEM", "unique": None},
            {"refName": "Iron Ring", "namespace": "ITEM", "unique": None},
        ]
    )

    with_icons = ImageProvider("noLookup", str(tmp_path)).apply_images(items)

    assert list(with_icons["icon"]) == [RING_ICON, NOT_FOUND]
    assert read_cache(tmp_path / ITEM_IMAGE_CACHE) == cache


@pytest.mark.parametrize(
    "failed",
    [
        [UNKNOWN_BASE],
        [FakeResponse(text='{"result": ["a1"]}'), FakeResponse(500, "")],
        found("a1", "https://web.poecdn.com/image/Art/2DItems/Rings/IronRing.gif"),
    ],
    ids=["search status", "fetch status", "icon url"],
)
def test_a_failed_lookup_sets_not_found_and_the_next_item_is_still_looked_up(
    tmp_path: Path, failed: list[FakeResponse | Exception]
) -> None:
    provider, _ = provider_for(tmp_path, [*failed, *found("b2", RING_ICON)])

    with_icons = provider.apply_images(rings("Iron Ring", "Ruby Ring"))

    assert list(with_icons["icon"]) == [NOT_FOUND, RING_ICON]
    assert read_cache(tmp_path / ITEM_IMAGE_CACHE) == {
        "ITEM=Iron Ring": NOT_FOUND,
        "ITEM=Ruby Ring": RING_ICON,
    }


@pytest.mark.parametrize(
    "failed,error",
    [
        ([FakeResponse(429), FakeResponse(429), FakeResponse(429)], RateLimitError),
        ([requests.ConnectionError("connection reset")], requests.ConnectionError),
    ],
    ids=["rate limited", "connection lost"],
)
def test_a_lookup_that_ends_the_run_keeps_the_icons_found_before_it_in_the_cache(
    tmp_path: Path, failed: list[FakeResponse | Exception], error: type[Exception]
) -> None:
    provider, _ = provider_for(tmp_path, [*found("a1", RING_ICON), *failed])

    with pytest.raises(error):
        _ = provider.apply_images(rings("Ruby Ring", "Iron Ring"))

    assert read_cache(tmp_path / ITEM_IMAGE_CACHE) == {"ITEM=Ruby Ring": RING_ICON}


def test_failed_lookups_in_a_row_end_the_run_before_the_next_search(
    tmp_path: Path,
) -> None:
    names = [f"Ring {number}" for number in range(MAX_FAILED_IN_A_ROW + 1)]
    provider, session = provider_for(tmp_path, [UNKNOWN_BASE] * len(names))

    with pytest.raises(ImageLookupError, match="lookups in a row failed"):
        _ = provider.apply_images(rings(*names))

    assert len(session.sent) == MAX_FAILED_IN_A_ROW
    assert read_cache(tmp_path / ITEM_IMAGE_CACHE) == {
        f"ITEM={name}": NOT_FOUND for name in names[: MAX_FAILED_IN_A_ROW - 1]
    }


def test_a_lookup_that_works_starts_the_count_of_failures_again(
    tmp_path: Path,
) -> None:
    before = [f"Ring {number}" for number in range(MAX_FAILED_IN_A_ROW - 1)]
    after = [f"Amulet {number}" for number in range(MAX_FAILED_IN_A_ROW - 1)]
    failures: list[FakeResponse | Exception] = [UNKNOWN_BASE] * len(before)
    provider, _ = provider_for(
        tmp_path, [*failures, *found("a1", RING_ICON), *failures]
    )

    with_icons = provider.apply_images(rings(*before, "Ruby Ring", *after))

    assert list(with_icons["icon"]) == [
        *[NOT_FOUND] * len(before),
        RING_ICON,
        *[NOT_FOUND] * len(after),
    ]
