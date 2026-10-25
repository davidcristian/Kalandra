"""Names the trade site's unique items in English and in a language, from the game's Words table."""

import logging

import pandas as pd

logger = logging.getLogger(__name__)


def unique_names(ref_words: pd.DataFrame, words: pd.DataFrame) -> pd.DataFrame:
    """Returns the English name (refName) and this language's name of each row of the Words table.

    Text2 is the name the game shows and Text is the game's internal name, which keeps
    an item's old name after a rename, so Text is the same in every language."""
    shown = ref_words[["_index", "Text", "Text2"]].rename(columns={"Text2": "refName"})
    # Two rows can show the same name; the one whose internal name is that name comes first
    shown = shown.assign(renamed=shown["Text"] != shown["refName"])
    shown = shown.sort_values(["renamed", "_index"]).drop_duplicates("refName")
    local = words[["_index", "Text2"]].rename(columns={"Text2": "name"})
    return shown.merge(local, on="_index", validate="1:1")[["refName", "name"]]


def name_uniques(
    uniques: pd.DataFrame, ref_words: pd.DataFrame, words: pd.DataFrame
) -> pd.DataFrame:
    """Adds refName and name to each trade unique by its English name, and drops a unique the Words table lacks."""
    names = unique_names(ref_words, words)
    named = uniques.merge(
        names, left_on="name", right_on="refName", how="left", suffixes=("_trade", "")
    )
    missing = named["refName"].isna()
    for trade_name in sorted(set(named.loc[missing, "name_trade"])):
        logger.warning(f"No unique named {trade_name} in the Words table, left it out")
    return named.loc[~missing].drop(columns="name_trade").reset_index(drop=True)
