import pandas as pd

from services.map_tiers import add_map_column, map_field


def test_map_field_reads_the_tier_from_a_waystone_id():
    assert map_field("Metadata/Items/Maps/MapKeyTier1") == {"tier": 1}
    assert map_field("Metadata/Items/Maps/MapKeyTier16") == {"tier": 16}


def test_map_field_is_none_for_other_items_and_missing_ids():
    assert map_field("Metadata/Items/Maps/AbstractMap") is None
    assert map_field("Metadata/Items/Maps/MapKeyTier12Unique") is None
    assert map_field("Metadata/Items/Armours/BodyArmours/FourBodyStr1") is None
    assert map_field(None) is None
    assert map_field(float("nan")) is None


def test_add_map_column_finds_each_item_by_its_base_item_index():
    base_item_types = pd.DataFrame(
        [
            {"_index": 801, "Id": "Metadata/Items/Maps/MapKeyTier1"},
            {"_index": 812, "Id": "Metadata/Items/Maps/MapKeyTier12"},
            {"_index": 5, "Id": "Metadata/Items/Rings/Ring1"},
        ]
    )
    items = pd.DataFrame(
        [
            {"refName": "Waystone (Tier 12)", "internal_index": 812},
            {"refName": "Iron Ring", "internal_index": 5},
            {"refName": "Waystone (Tier 1)", "internal_index": 801},
            {"refName": "Not in the table", "internal_index": 9999},
        ],
        index=[10, 11, 12, 13],
    )

    result = add_map_column(items, base_item_types)

    assert result["map"].to_dict() == {
        10: {"tier": 12},
        11: None,
        12: {"tier": 1},
        13: None,
    }
    assert "map" not in items.columns
