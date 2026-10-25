import json
from pathlib import Path

import pandas as pd

from services.image_provider import NOT_FOUND
from services.static_items import add_static_data
from stores.trade_store import TradeStore

SPLINTER_IMAGE = "/gen/image/WzI1LDE0/4abb17ea8e/BreachstoneSplinter.png"
RING_ICON = "https://web.poecdn.com/gen/image/ring/RubyRing.png"


def read_static(tmp_path: Path, entries: list[dict[str, str]]) -> pd.DataFrame:
    """Writes a static.json with one group of entries and reads it as the build does."""
    data = {"result": [{"id": "Fragments", "label": "Fragments", "entries": entries}]}
    _ = (tmp_path / "static.json").write_text(json.dumps(data), encoding="utf-8")
    store = TradeStore("en")
    store.data_dir = str(tmp_path)
    return store.static()


def items(*rows: tuple[str, str]) -> pd.DataFrame:
    return pd.DataFrame([{"refName": name, "icon": icon} for name, icon in rows])


def icons_and_tags(merged: pd.DataFrame) -> list[tuple[str, str, str | None]]:
    rows = merged.astype(object).where(merged.notna(), None)
    return list(zip(rows["refName"], rows["icon"], rows["tradeTag"]))


def test_an_item_named_in_a_static_entry_takes_its_image_and_trade_tag(
    tmp_path: Path,
) -> None:
    static = read_static(
        tmp_path,
        [
            {
                "id": "breach-splinter",
                "text": "Breach Splinter",
                "image": SPLINTER_IMAGE,
            },
            {"id": "breachstone", "text": "Breachstone"},
        ],
    )

    merged = add_static_data(
        items(
            ("Breach Splinter", NOT_FOUND),
            ("Breachstone", NOT_FOUND),
            ("Ruby Ring", RING_ICON),
        ),
        static,
    )

    assert icons_and_tags(merged) == [
        (
            "Breach Splinter",
            f"https://web.poecdn.com{SPLINTER_IMAGE}",
            "breach-splinter",
        ),
        ("Breachstone", NOT_FOUND, "breachstone"),
        ("Ruby Ring", RING_ICON, None),
    ]


def test_an_item_keeps_its_icon_when_no_static_entry_has_an_image(
    tmp_path: Path,
) -> None:
    static = read_static(tmp_path, [{"id": "breachstone", "text": "Breachstone"}])

    merged = add_static_data(items(("Breachstone", RING_ICON)), static)

    assert icons_and_tags(merged) == [("Breachstone", RING_ICON, "breachstone")]
