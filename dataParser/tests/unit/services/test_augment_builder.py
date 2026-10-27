import pandas as pd
import pytest

from constants.filenames import (
    ITEM_CLASSES,
    SOUL_CORE_STAT_CATEGORIES,
    SOUL_CORE_STATS,
    STATS,
)
from services.augment_builder import AugmentBuilder


def test_first_non_negated_uses_the_value_text_of_a_stat_with_only_value_matchers():
    matchers = [{"string": "Can roll Chronomancy modifiers", "value": 1}]

    assert (
        AugmentBuilder.first_non_negated(matchers) == "Can roll Chronomancy modifiers"
    )


def test_first_non_negated_prefers_a_matcher_without_a_value_or_negation():
    matchers = [
        {"string": "Lit", "value": 1},
        {"string": "# less Life", "negate": True},
        {"string": "# to maximum Life"},
        {"string": "# more Life"},
    ]

    assert AugmentBuilder.first_non_negated(matchers) == "# more Life"


def test_first_non_negated_prefers_a_negated_matcher_to_a_value_matcher():
    matchers = [
        {"string": "Lit", "value": 1},
        {"string": "# less Life", "negate": True},
    ]

    assert AugmentBuilder.first_non_negated(matchers) == "# less Life"


def test_first_non_negated_raises_on_a_stat_without_matchers():
    with pytest.raises(ValueError, match="no matchers"):
        AugmentBuilder.first_non_negated([])


class FakeGameStore:
    """Returns the soul core and item class tables of a small game export."""

    def __init__(self) -> None:
        self.tables = {
            SOUL_CORE_STAT_CATEGORIES: pd.DataFrame(
                [
                    {"_index": 0, "Id": "Martial Weapon", "TargetItemClasses": []},
                    {"_index": 1, "Id": "Wand or Staff", "TargetItemClasses": [8, 14]},
                    {"_index": 2, "Id": "Quarterstaff", "TargetItemClasses": [58]},
                    {"_index": 3, "Id": "Shield", "TargetItemClasses": [26]},
                    {"_index": 4, "Id": "New Category", "TargetItemClasses": []},
                ]
            ),
            SOUL_CORE_STATS: pd.DataFrame(
                [
                    {
                        "_index": 0,
                        "SoulCore": 0,
                        "StatCategory": 5,
                        "Stats": [1, 2],
                        "StatsValues": [1, -10],
                    },
                    {
                        "_index": 1,
                        "SoulCore": 1,
                        "StatCategory": 7,
                        "Stats": [3, 4, 5],
                        "StatsValues": [13, 16, 15],
                    },
                ]
            ),
            STATS: pd.DataFrame(
                [
                    {"_index": 0, "Id": "level"},
                    {"_index": 1, "Id": "base_avoid_ignite_%"},
                    {"_index": 2, "Id": "physical_attack_damage_taken_+"},
                    {"_index": 3, "Id": "local_minimum_added_fire_damage"},
                    {"_index": 4, "Id": "local_maximum_added_fire_damage"},
                    {"_index": 5, "Id": "mana_cost_%_as_life_cost"},
                ]
            ),
            ITEM_CLASSES: pd.DataFrame(
                [
                    {"_index": 8, "Id": "Wand"},
                    {"_index": 14, "Id": "Staff"},
                    {"_index": 26, "Id": "Shield"},
                    {"_index": 58, "Id": "Warstaff"},
                ]
            ),
        }

    def get(self, name: str) -> pd.DataFrame:
        return self.tables[name].copy()


def test_get_categories_names_the_item_classes_that_a_category_targets():
    builder = AugmentBuilder(pd.DataFrame())
    builder.ref_game_store = FakeGameStore()

    assert builder.get_categories() == {
        0: [
            "Bow",
            "Claw",
            "Crossbow",
            "Dagger",
            "Flail",
            "One Hand Axe",
            "One Hand Mace",
            "One Hand Sword",
            "Spear",
            "Talisman",
            "Two Hand Axe",
            "Two Hand Mace",
            "Two Hand Sword",
            "Warstaff",
        ],
        1: ["Wand", "Staff"],
        2: ["Warstaff"],
        3: ["Shield"],
        4: ["New Category"],
    }


def nd_stat(game_id: str, text: str, hash: int) -> dict[str, object]:
    return {
        "id": game_id,
        "matchers": [{"string": text}],
        "trade": {"ids": {"rune": [f"rune.stat_{hash}"]}},
    }


def test_get_stats_writes_a_line_for_each_stat_of_a_soul_core():
    builder = AugmentBuilder(pd.DataFrame())
    builder.ref_game_store = FakeGameStore()
    nd_stats = pd.DataFrame(
        [
            nd_stat("base_avoid_ignite_%", "Cannot be Ignited", 331731406),
            nd_stat(
                "physical_attack_damage_taken_+", "# Physical Damage taken", 3441651621
            ),
            nd_stat(
                "local_minimum_added_fire_damage", "Adds # to # Fire Damage", 709508406
            ),
            nd_stat(
                "mana_cost_%_as_life_cost", "#% of Mana Costs as Life Costs", 2480498143
            ),
        ]
    )

    lines = builder.get_stats(nd_stats).to_dict(orient="records")

    assert lines == [
        {
            "SoulCore": 0,
            "StatCategory": 5,
            "values": [1, -10],
            "string": "Cannot be Ignited",
            "tradeId": ["rune.stat_331731406"],
        },
        {
            "SoulCore": 0,
            "StatCategory": 5,
            "values": [1, -10],
            "string": "# Physical Damage taken",
            "tradeId": ["rune.stat_3441651621"],
        },
        {
            "SoulCore": 1,
            "StatCategory": 7,
            "values": [13, 16, 15],
            "string": "Adds # to # Fire Damage",
            "tradeId": ["rune.stat_709508406"],
        },
        {
            "SoulCore": 1,
            "StatCategory": 7,
            "values": [13, 16, 15],
            "string": "#% of Mana Costs as Life Costs",
            "tradeId": ["rune.stat_2480498143"],
        },
    ]
