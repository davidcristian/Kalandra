from stores.helpers.description import Description
from services.value_divisors import description_divisors, divided_values


def divisors_of(block: str) -> dict[str, int]:
    return description_divisors(Description("en", "dummy.csd"), block)


def test_description_divisors_divide_hundredths_by_100():
    block = '1 local_critical_strike_chance\n1\n# "{0}% to Critical Hit Chance" divide_by_one_hundred 1'

    assert divisors_of(block) == {"local_critical_strike_chance": 100}


def test_description_divisors_divide_a_per_minute_value_by_60():
    block = (
        "1 generate_x_charges_for_any_flask_per_minute\n1\n"
        '# "[Flask|Flasks] gain {0} charges per Second" per_minute_to_per_second_2dp_if_required 1'
    )

    assert divisors_of(block) == {"generate_x_charges_for_any_flask_per_minute": 60}


def test_description_divisors_name_the_stat_that_the_handler_index_names():
    block = (
        "2 base_minimum_x base_life_regeneration_rate_per_minute\n1\n"
        '# # "Has {0}, Regenerate {1} Life per second" per_minute_to_per_second 2'
    )

    assert divisors_of(block) == {"base_life_regeneration_rate_per_minute": 60}


def test_description_divisors_keep_a_per_minute_percentage_and_other_handlers():
    block = (
        "2 life_regeneration_rate_per_minute_% base_skill_effect_duration\n1\n"
        '# # "Regenerate {0}% of Life per second for {1} seconds" '
        "per_minute_to_per_second 1 milliseconds_to_seconds 2"
    )

    assert divisors_of(block) == {}


def test_divided_values_divide_only_the_value_at_the_position():
    assert divided_values([500, 1], 0, 100, set()) == [5.0, 1]
    assert divided_values([30, 10, 180], 2, 60, set()) == [30, 10, 3.0]
    assert divided_values([500, 1], 1, None, set()) == [500, 1]


def test_divided_values_keep_a_value_that_a_matcher_names():
    assert divided_values([60, 1], 0, 60, {None, 60}) == [60, 1]
