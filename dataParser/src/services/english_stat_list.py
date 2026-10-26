"""Keeps the stats of every language to the English stat list."""

from collections import defaultdict
from collections.abc import Iterable

import pandas as pd

TradeIds = dict[str, list[str]]


def with_language_text(english: pd.DataFrame, lang: pd.DataFrame) -> pd.DataFrame:
    """Returns each English trade stat with its English text as ref and the language's text, NaN where it has none."""
    combined = pd.merge(
        english, lang, on="id", how="left", suffixes=("_ref", "_text"), validate="1:1"
    )
    return combined.rename(columns={"text_text": "text", "text_ref": "ref"})


def language_text_rows(trade_stats: pd.DataFrame) -> pd.DataFrame:
    """Returns a copy of the trade stats that the language's trade site has a text for."""
    return trade_stats[trade_stats["text"].notna()].copy()


def text_by_ref(trade_stats: pd.DataFrame) -> dict[str, str]:
    """Returns the language's trade text of each ref that has one."""
    rows = language_text_rows(trade_stats)
    return dict(zip(rows["ref"], rows["text"]))


def share_trade_ids(
    stats: pd.DataFrame, refs_sharing_a_matcher: Iterable[set[str]]
) -> pd.DataFrame:
    """Gives the stats linked by shared matcher texts all of their trade ids, so a search finds any of them."""
    ids_by_ref: dict[str, TradeIds] = {
        ref: trade["ids"] for ref, trade in zip(stats["ref"], stats["trade"])
    }
    linked: dict[str, set[str]] = {}
    for refs in refs_sharing_a_matcher:
        group = set(refs).union(*(linked.get(ref, set()) for ref in refs))
        for ref in group:
            linked[ref] = group

    def trade_of(ref: str, trade: dict[str, TradeIds]) -> dict[str, TradeIds]:
        if ref not in linked:
            return trade
        ids: defaultdict[str, set[str]] = defaultdict(set)
        for other in linked[ref]:
            for mod_type, other_ids in ids_by_ref[other].items():
                ids[mod_type].update(other_ids)
        return {**trade, "ids": {mod_type: sorted(v) for mod_type, v in ids.items()}}

    out = stats.copy()
    out["trade"] = pd.Series(
        [trade_of(ref, trade) for ref, trade in zip(stats["ref"], stats["trade"])],
        index=stats.index,
        dtype=object,
    )
    return out
