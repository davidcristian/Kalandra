import json
from pathlib import Path

import pandas as pd

from constants.filenames import ITEM_IMAGE_CACHE, OLD_ITEM_IMAGE_CACHE
from services.image_provider import NOT_FOUND, ImageProvider

RING_ICON = "https://web.poecdn.com/gen/image/ring/RubyRing.png"


def read_cache(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def test_a_new_provider_creates_an_empty_cache_and_its_copy_in_the_given_folder(
    tmp_path: Path,
) -> None:
    provider = ImageProvider("noLookup", str(tmp_path))

    assert provider.cache == {}
    assert read_cache(tmp_path / ITEM_IMAGE_CACHE) == {}
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
    assert read_cache(tmp_path / OLD_ITEM_IMAGE_CACHE) == cache
