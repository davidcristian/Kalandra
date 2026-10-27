"""Reads the number that the game's stat descriptions divide each stat's value by."""

import re
from collections.abc import Collection
from functools import cache

from constants.filenames import STAT_DESCRIPTION_FILES
from constants.lang import ENGLISH
from stores.helpers.description import Description

# The handlers for which Description.parse_dp marks a stat dp, with their trailing stat index
HANDLER = re.compile(r"(divide_by_one_hundred|per_minute_to_per_second)\w*\s+(\d+)")
DIVISORS = {"divide_by_one_hundred": 100, "per_minute_to_per_second": 60}


def description_divisors(description: Description, block: str) -> dict[str, int]:
    """Returns the divisor of each stat id that an English line of the block divides."""
    ids, _, lang_blocks = description.split_on_lang(block)
    _, id_strings = description.parse_ids(ids)
    out: dict[str, int] = {}
    for line in lang_blocks.get(ENGLISH, []):
        if "table_only" in line:
            continue
        _, text, flags = description.parse_line(line)
        for handler, index in HANDLER.findall(flags or ""):
            # As in parse_dp, a per minute value shown as a percentage keeps its number
            if handler == "per_minute_to_per_second" and "%" in text:
                continue
            _ = out.setdefault(id_strings[int(index) - 1], DIVISORS[handler])
    return out


@cache
def value_divisors() -> dict[str, int]:
    """Returns the divisor of every stat id that an English stat description divides."""
    out: dict[str, int] = {}
    for filename in STAT_DESCRIPTION_FILES:
        description = Description(ENGLISH, filename)
        description.load()
        for block in description.data or []:
            for stat_id, divisor in description_divisors(description, block).items():
                _ = out.setdefault(stat_id, divisor)
    return out


def divided_values(
    values: list[int], position: int, divisor: int | None, kept: Collection[object]
) -> list[int | float]:
    """Returns the values with the one at position divided by divisor, as the parser reads it.

    A value in kept stays whole, since the parser reads it from a matcher with that value.
    """
    return [
        value / divisor
        if divisor and index == position and value not in kept
        else value
        for index, value in enumerate(values)
    ]
