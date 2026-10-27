import json
from pathlib import Path

import pandas as pd
import pytest

from constants.filenames import ARMOUR_TYPES
from services import specific_column_service
from services.specific_column_service import SpecificColumnService

RUNE_AUGMENT: dict[str, str | list[str] | list[int]] = {
    "categories": ["Helmet"],
    "string": "#% to Fire Resistance",
    "values": [10],
    "tradeId": ["rune.stat_3372524247"],
}


class FakeAugmentBuilder:
    """Stands in for AugmentBuilder, which reads the soul core tables of the game export."""

    def __init__(self, nd_stats: pd.DataFrame) -> None:
        self.nd_stats: pd.DataFrame = nd_stats

    def build(self) -> pd.DataFrame:
        return pd.DataFrame([{"refName": "Desert Rune", **RUNE_AUGMENT}])


@pytest.fixture
def service(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> SpecificColumnService:
    armour_types = [
        {"BaseItemType": 1, "Armour": 20, "Evasion": 0, "EnergyShield": 15},
    ]
    _ = (tmp_path / ARMOUR_TYPES).write_text(json.dumps(armour_types), encoding="utf-8")
    monkeypatch.setattr(specific_column_service, "AugmentBuilder", FakeAugmentBuilder)
    service = SpecificColumnService("en")
    service.ref_game_store.data_dir = str(tmp_path)
    return service


def test_item_specific_columns_add_armour_and_augment_but_no_gem_field(
    service: SpecificColumnService,
):
    items = pd.DataFrame(
        [
            {"refName": "Arc", "namespace": "GEM", "internal_index": 0},
            {"refName": "Plate Vest", "namespace": "ITEM", "internal_index": 1},
            {"refName": "Desert Rune", "namespace": "ITEM", "internal_index": 2},
        ]
    )

    result = service.apply_item_specific_columns(items, pd.DataFrame())

    assert list(result.columns) == [
        "refName",
        "namespace",
        "internal_index",
        "armour",
        "augment",
    ]
    by_name = result.set_index("refName")
    assert by_name.at["Plate Vest", "armour"] == {"ar": [20, 20], "es": [15, 15]}
    assert by_name.at["Desert Rune", "augment"] == [RUNE_AUGMENT]
    assert pd.isna(by_name.at["Arc", "armour"])
    assert by_name.at["Arc", "augment"] is None
