import pytest

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
