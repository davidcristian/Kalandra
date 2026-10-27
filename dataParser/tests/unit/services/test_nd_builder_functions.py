import pandas as pd

from services.nd_builder_functions import unique_field


def unique_row(ref_name: str, base: str) -> pd.Series:
    return pd.Series({"refName": ref_name, "type": base})


def test_unique_field_names_the_fixed_stats_of_a_unique_whose_stats_do_not_roll():
    assert unique_field(unique_row("Runeseeker's Call", "Runic Fork")) == {
        "base": "Runic Fork",
        "fixedStats": [
            "#% increased effect of Socketed Runes",
            "Only Runes can be Socketed in this item",
        ],
    }
    assert unique_field(unique_row("Mastered Domain", "Irradiated Tablet")) == {
        "base": "Irradiated Tablet",
        "fixedStats": ["Adds Irradiated to a Map \n# use remaining"],
    }


def test_unique_field_gives_a_jewel_without_fixed_stats_an_empty_list():
    for name in ("Flesh Crucible", "Split Personality", "Voices"):
        assert unique_field(unique_row(name, "Diamond")) == {
            "base": "Diamond",
            "fixedStats": [],
        }


def test_unique_field_has_only_the_base_for_other_uniques():
    assert unique_field(unique_row("Bramblejack", "Plate Vest")) == {
        "base": "Plate Vest"
    }
