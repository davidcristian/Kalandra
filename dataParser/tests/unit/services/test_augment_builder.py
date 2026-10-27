import pandas as pd
import pytest

from constants.filenames import ITEM_CLASSES, SOUL_CORE_STAT_CATEGORIES
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
    """Returns the soul core stat categories and item classes of a small game export."""

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
