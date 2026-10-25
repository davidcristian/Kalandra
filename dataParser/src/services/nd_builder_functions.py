"""Typed functions that NdBuilderService passes to pandas apply and pivot_table."""

import pandas as pd

from constants.known_stats import UNIQUE_ITEMS_FIXED_STATS
from models.matcher import Matcher


def custom_sort_key(matcher: Matcher) -> tuple[int, int]:
    if "negate" in matcher:
        group = 1
    elif "value" in matcher:
        group = 2
    else:
        group = 0
    return (group, len(matcher["string"]))


def sort_matchers(matchers: list[Matcher]) -> list[Matcher]:
    return sorted(matchers, key=custom_sort_key)


def trade_hash(row: pd.Series) -> int:
    return int(row["id"].split("_")[-1])


def id_list(ids: pd.Series) -> list[str]:
    return list(ids)


def ids_or_empty(ids: list[str] | str) -> list[str]:
    return ids if isinstance(ids, list) else []


def craftable(category: str) -> dict[str, str]:
    return {"category": category}


def unique_field(row: pd.Series) -> dict[str, object]:
    if row["refName"] not in UNIQUE_ITEMS_FIXED_STATS:
        return {"base": row["type"]}
    return {
        "base": row["type"],
        "fixedStats": UNIQUE_ITEMS_FIXED_STATS[row["refName"]],
    }


def namespace(trade_category: str) -> str:
    return "GEM" if trade_category == "gem" else "ITEM"


def matcher_key(matcher: Matcher | float) -> frozenset[tuple[str, object]]:
    """Returns a matcher as a hashable set of its items, or an empty set for the NaN of a stat without matchers."""
    if isinstance(matcher, dict):
        return frozenset(matcher.items())
    return frozenset([])
