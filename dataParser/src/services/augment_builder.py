import logging
from typing import cast

import pandas as pd

from constants.filenames import (
    BASE_ITEM_TYPES,
    ITEM_CLASSES,
    SOUL_CORE_STAT_CATEGORIES,
    SOUL_CORE_STATS,
    SOUL_CORES,
    STATS,
)
from constants.lang import ENGLISH
from services.value_divisors import divided_values, value_divisors
from stores.game_store import GameStore
from stores.trade_store import TradeStore

# The item classes of the soul core stat categories whose TargetItemClasses is empty
SOUL_CORE_CLASS_MAPPINGS = {
    "All": [
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
        "Staff",
        "Wand",
        "Helmet",
        "Body Armour",
        "Boots",
        "Gloves",
        "Buckler",
        "Focus",
        "Shield",
        "Sceptre",
    ],
    "Martial Weapon": [
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
    "Armour": [
        "Helmet",
        "Body Armour",
        "Boots",
        "Gloves",
        "Buckler",
        "Focus",
        "Shield",
    ],
}

logger = logging.getLogger(__name__)


class AugmentBuilder:
    def __init__(self, nd_stats: pd.DataFrame) -> None:
        self.ref_trade_store: TradeStore = TradeStore(ENGLISH)
        self.ref_game_store: GameStore = GameStore(ENGLISH)
        self.nd_stats: pd.DataFrame = nd_stats

    def build(self) -> pd.DataFrame:
        cores = self.get_soul_cores()
        categories = self.get_categories()
        stats = self.get_stats(self.nd_stats)
        cores_with_stats = stats.merge(
            cores, left_on="SoulCore", right_index=True, validate="many_to_one"
        ).drop(columns=["SoulCore"])
        cores_with_stats["Classes"] = cores_with_stats["StatCategory"].apply(
            categories.__getitem__
        )
        renamed = cores_with_stats.rename(
            {
                "Name": "refName",
                "Classes": "categories",
            },
            axis=1,
        )[["refName", "categories", "string", "values", "tradeId"]]
        return renamed

    def get_soul_cores(
        self,
    ) -> pd.DataFrame:
        soul_cores = self.ref_game_store.get(SOUL_CORES).drop(columns=["_index"])
        base_items = self.ref_game_store.get(BASE_ITEM_TYPES).drop(columns=["_index"])
        soul_core_item = soul_cores.merge(
            base_items, "inner", left_on="BaseItemType", right_index=True
        )[["Name", "RequiredLevel"]]

        logger.debug(soul_core_item)
        return soul_core_item

    def get_stats(
        self, nd_stats: pd.DataFrame, divisors: dict[str, int] | None = None
    ) -> pd.DataFrame:
        soul_core_stats = self.ref_game_store.get(SOUL_CORE_STATS).drop(
            columns=["_index"]
        )
        stats = self.ref_game_store.get(STATS).drop(columns=["_index"])

        exploded = soul_core_stats.explode("Stats")
        exploded["position"] = exploded.groupby(level=0).cumcount()
        exploded_joined = exploded.merge(
            stats, how="inner", left_on="Stats", right_index=True
        )[["SoulCore", "StatCategory", "Id", "StatsValues", "position"]]
        with_id = exploded_joined.dropna(subset=["Id"]).reset_index(drop=True)
        joined = with_id.merge(nd_stats, left_on="Id", right_on="id", how="inner")
        divisor_of = value_divisors() if divisors is None else divisors
        joined["StatsValues"] = [
            divided_values(
                values,
                position,
                divisor_of.get(stat_id),
                {matcher.get("value") for matcher in matchers},
            )
            for values, position, stat_id, matchers in zip(
                joined["StatsValues"],
                joined["position"],
                joined["Id"],
                joined["matchers"],
            )
        ]

        joined["matcher"] = joined["matchers"].apply(self.first_non_negated)
        joined["rune_id"] = joined["trade"].apply(self.rune_stat_id)
        return joined[
            ["SoulCore", "StatCategory", "StatsValues", "matcher", "rune_id"]
        ].rename(
            {"matcher": "string", "rune_id": "tradeId", "StatsValues": "values"}, axis=1
        )

    def get_categories(self) -> dict[str, list[str]]:
        soul_core_categories = self.ref_game_store.get(SOUL_CORE_STAT_CATEGORIES).drop(
            columns=["_index"]
        )
        item_classes = self.ref_game_store.get(ITEM_CLASSES)
        class_ids = dict(zip(item_classes["_index"], item_classes["Id"]))

        def classes(row: pd.Series) -> list[str]:
            targets: list[int] = row["TargetItemClasses"]
            if targets:
                return [str(class_ids[target]) for target in targets]
            return SOUL_CORE_CLASS_MAPPINGS.get(row["Id"], [row["Id"]])

        soul_core_categories["Classes"] = soul_core_categories.apply(classes, axis=1)
        logger.debug(soul_core_categories["Classes"])
        # to_dict types the keys as Hashable; the index holds the category ids
        return cast(dict[str, list[str]], soul_core_categories["Classes"].to_dict())

    @staticmethod
    def first_non_negated(
        matchers: list[dict[str, str | int | bool]],
    ) -> str | int | bool:
        """Returns the shortest matcher text: first without a value or negation, then
        without a value, then any."""

        sorted_matchers = sorted(
            matchers,
            key=lambda x: len(x["string"]) if isinstance(x["string"], str) else 9999999,
        )
        for matcher in sorted_matchers:
            if not matcher.get("negate", False) and not matcher.get("value"):
                return matcher["string"]
        for matcher in sorted_matchers:
            if not matcher.get("value"):
                return matcher["string"]
        # A warping rune stat, such as "Can roll Soul modifiers", has only a matcher for value 1
        if sorted_matchers:
            return sorted_matchers[0]["string"]
        raise ValueError("Stat has no matchers")

    def rune_stat_id(
        self, ids: dict[str, dict[str, list[str]]] | None
    ) -> list[str] | None:
        return (ids.get("ids") or {}).get("rune") if ids else None
