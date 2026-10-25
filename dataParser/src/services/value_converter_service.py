import re
from collections import defaultdict
from collections.abc import Iterable
from pprint import pformat
from typing import Protocol, SupportsInt, cast

import pandas as pd

from constants.filenames import (
    ADVANCED_MOD_STAT_DESCRIPTIONS,
    BLIGHT_CRAFTING_RECIPES,
    BLIGHT_CRAFTING_RESULTS,
    PASSIVE_SKILLS,
)
from constants.known_stats import (
    ALLOCATES_NOTABLE,
    BETTER_LOOKUP,
    DISCONNECTED_PASSIVES_AROUND_KEYSTONE,
    JEWEL_RADIUS_CHANGE,
    JEWEL_RING_RADIUS,
    SUPPORTED_VALUES,
    TIME_LOST_HISTORIC_JEWEL,
    UNIQUE_JEWEL_PLUS_LEVEL,
    VALUE_TO_DESCRIPTION_ID,
    VALUE_TO_REF,
)
from constants.lang import GERMAN, LANG
from stores.game_store import GameStore
from stores.helpers.description import Description


class ValueStatRow(Protocol):
    """A row of the trade stats whose id ends in a value, as itertuples returns it."""

    type: str
    id: str
    text: str
    ref: str
    value: str


def value_stat_rows(in_df: pd.DataFrame) -> Iterable[ValueStatRow]:
    """Returns the rows of a group of trade stats with a value."""
    # itertuples types each field as any scalar, and these columns hold strings
    return cast(Iterable[ValueStatRow], in_df.itertuples())


def group_hash(in_df: pd.DataFrame) -> int:
    """Returns the stat hash of a group of trade stats with a value."""
    # pandas types a row's name as any Hashable; here it is the hash the rows are grouped by
    return int(cast(SupportsInt, in_df.iloc[0].name))


def hash_list(stat_hash: int) -> list[int]:
    return [int(stat_hash)]


class ValueConverterService:
    def __init__(self, lang: LANG) -> None:
        self.lang: LANG = lang
        self.blight = self.get_blight()

    def get_blight(self) -> dict[int, str]:
        g = GameStore(self.lang)
        passives = g.get(PASSIVE_SKILLS)[["_index", "PassiveSkillGraphId"]]
        blight_recipes = g.get(BLIGHT_CRAFTING_RECIPES)[
            ["BlightCraftingResult", "BlightCraftingItems"]
        ]
        blight_results = g.get(BLIGHT_CRAFTING_RESULTS)[["_index", "PassiveSkill"]]

        merged1 = passives.merge(
            blight_results, left_on="_index", right_on="PassiveSkill", how="inner"
        )
        merged2 = merged1.merge(
            blight_recipes,
            left_on="_index_y",
            right_on="BlightCraftingResult",
            how="inner",
        )
        filtered = merged2[["BlightCraftingItems", "PassiveSkillGraphId"]].dropna()
        filtered["PassiveSkillGraphId"] = filtered["PassiveSkillGraphId"].astype(int)
        records = filtered.to_dict(orient="records")
        return {
            r["PassiveSkillGraphId"]: ",".join(
                str(oil) for oil in r["BlightCraftingItems"]
            )
            for r in records
        }

    def convert_value_stats_to_trade(self, in_df: pd.DataFrame) -> pd.DataFrame:
        filtered_to_supported = in_df[in_df["hash"].isin(SUPPORTED_VALUES)]
        grouped = filtered_to_supported.set_index("hash").groupby(level="hash")
        converted = grouped.apply(self.agg_by_hash).reset_index(drop=True)
        converted["dp"] = None
        converted["hash"] = converted["hash"].apply(hash_list)

        return converted[["ref", "dp", "better", "matchers", "trade", "id", "hash"]]

    def agg_by_hash(self, in_df: pd.DataFrame) -> pd.DataFrame:
        hash = group_hash(in_df)
        if hash == JEWEL_RADIUS_CHANGE:
            return self.simple_agg(in_df)
        elif hash == JEWEL_RING_RADIUS:
            return self.simple_agg(in_df)
        elif hash == ALLOCATES_NOTABLE:
            return self.simple_agg(in_df)
        elif hash == TIME_LOST_HISTORIC_JEWEL:
            return self.historic_agg(in_df)
        elif hash == DISCONNECTED_PASSIVES_AROUND_KEYSTONE:
            return self.simple_agg(in_df)
        elif hash == UNIQUE_JEWEL_PLUS_LEVEL:
            return self.simple_agg(in_df)

        return in_df

    def simple_agg(self, in_df: pd.DataFrame) -> pd.DataFrame:
        id = group_hash(in_df)
        out: dict[str, object] = {
            "ref": VALUE_TO_REF[id],
            "id": VALUE_TO_DESCRIPTION_ID[id],
            "hash": id,
            "better": 1 if id not in BETTER_LOOKUP else BETTER_LOOKUP[id],
        }
        ids: defaultdict[str, set[str]] = defaultdict(set)
        matchers: list[dict[str, str | int]] = []
        seen: set[str] = set()
        for row in value_stat_rows(in_df):
            ids[row.type].add(row.id)
            matcher: dict[str, str | int] = {
                "string": row.text,
                "value": int(row.value),
            }
            if id == ALLOCATES_NOTABLE and int(row.value) in self.blight:
                matcher["oils"] = self.blight[int(row.value)]
            if id == UNIQUE_JEWEL_PLUS_LEVEL:
                matcher["string"] = row.text.replace("+", "")
            signature = pformat(matcher)
            if signature not in seen:
                seen.add(signature)
                matchers.append(matcher)
        out["trade"] = {"ids": {k: list(v) for k, v in ids.items()}, "option": True}
        matchers.sort(key=lambda x: x["value"])
        out["matchers"] = matchers

        return pd.DataFrame([out])

    def historic_agg(self, in_df: pd.DataFrame) -> pd.DataFrame:
        advanced_desc = Description(self.lang, ADVANCED_MOD_STAT_DESCRIPTIONS)
        advanced_desc.load()
        # to_dict types the keys as Hashable; the index holds the stat ids
        advanced_df = cast(
            dict[str, list[dict[str, str]]],
            advanced_desc.to_dataframe().set_index("id")["matchers"].to_dict(),
        )
        historic_matchers = advanced_df["local_unique_jewel_alternate_tree_version"]
        advanced_desc_array = [matcher["string"] for matcher in historic_matchers]
        # The German game text names High Templar Dominus on two lines and Description
        # keeps one, so the German list is one shorter before the trade site's values
        missing = 1 if self.lang == GERMAN else 0
        if len(advanced_desc_array) != int(in_df["value"].max()) - missing:
            # Without one advanced text per value, the matchers keep the trade site's texts
            return self.simple_agg(in_df)
        out: list[dict[str, object]] = []
        for row in value_stat_rows(in_df):
            trade_value = int(row.value)
            index = trade_value - 1 - missing

            out_row: dict[str, object] = {
                "ref": row.ref.split("\n")[0],
                "id": VALUE_TO_DESCRIPTION_ID[TIME_LOST_HISTORIC_JEWEL],
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": BETTER_LOOKUP[TIME_LOST_HISTORIC_JEWEL],
                "matchers": [
                    {
                        "string": re.sub(r"\([^)]*\)", "", advanced_desc_array[index]),
                        "advanced": advanced_desc_array[index],
                    }
                ],
                "trade": {
                    "ids": {
                        "explicit": [
                            f"explicit.stat_{TIME_LOST_HISTORIC_JEWEL}|{trade_value}"
                        ]
                    }
                },
            }
            out.append(out_row)

        return pd.DataFrame(out)
