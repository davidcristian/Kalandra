import logging
import re

import pandas as pd
from pandas.core.frame import DataFrame

from constants.filenames import MODS, STAT_DESCRIPTIONS, STATS, TAGS
from constants.lang import ENGLISH
from services.nd_builder_service import NdBuilderService
from stores.game_store import GameStore

logger = logging.getLogger(__name__)


def with_id_tags(stat_id: str, tags: list[str]) -> list[str]:
    """Returns a new list with the tags and the tags that the stat id implies."""
    added = list(tags)
    if "strength" in stat_id:
        added.append("strength")
    if "dexterity" in stat_id:
        added.append("dexterity")
    if "intelligence" in stat_id:
        added.append("intelligence")
    if "attribute_requirements" in stat_id:
        added.append("attribute")
    if "gem_level" in stat_id and "gem" not in added:
        added.append("gem")
    if re.search(r"base_max.*res", stat_id):
        added.append("maximum")
    if "shock_chance_" in stat_id:
        added.append("lightning")
    if "ignite_chance_" in stat_id:
        added.append("fire")
    if "hit_damage_freeze_multiplier_" in stat_id:
        added.append("cold")
    if "poison_on_hit" in stat_id:
        added.append("poison")
    return added


class TaggedStats:
    def __init__(self) -> None:
        self.nd: NdBuilderService = NdBuilderService(
            lang=ENGLISH, image_mode="noLookup"
        )
        self.game_store: GameStore = self.nd.game_store

    def get_trade_stats(self) -> DataFrame:
        value_less_stats = self.nd.valueless_trade_stats_df()
        grouped_valueless_stats = self.nd.group_trade_stats(value_less_stats)
        hash_stats = self.nd.add_hash_to_trade_stats(grouped_valueless_stats)[
            ["ref", "hash"]
        ]
        fixed_stats = hash_stats.explode("hash").dropna().reset_index(drop=True)
        typed = fixed_stats.astype({"hash": int, "ref": str})

        logger.info(f"Trade stats with {typed.shape[0]} rows")
        logger.debug(typed)
        return typed

    def get_stats_with_tags(self):
        tags: dict[int, str] = self.game_store.get(TAGS)["Id"].to_dict()  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]

        mods = self.game_store.get(MODS)
        mods["Tags"] = mods["ImplicitTags"].apply(lambda x: [tags[i] for i in x])  # pyright: ignore[reportUnknownLambdaType, reportUnknownVariableType, reportUnknownMemberType]

        tag_by_stat = mods[["Stat1", "Tags"]].rename({"Stat1": "Stat"}, axis=1)
        for i in range(2, 7):
            stat_i = mods[[f"Stat{i}", "Tags"]].rename({f"Stat{i}": "Stat"}, axis=1)
            tag_by_stat = pd.concat([tag_by_stat, stat_i])
        deduped = tag_by_stat.drop_duplicates("Stat").dropna().astype({"Stat": int})  # pyright: ignore[reportUnknownMemberType]
        filtered = deduped.set_index(  # pyright: ignore[reportUnknownMemberType]
            "Stat", drop=True
        )
        logger.info(f"Stats with tags with {filtered.shape[0]} rows")
        logger.debug("stats with tags")
        logger.debug(filtered)
        return filtered

    def get_stat_by_hash(self):
        stats = self.game_store.get(STATS)
        descriptions = self.game_store.get_description(STAT_DESCRIPTIONS)

        joined = pd.merge(
            stats, descriptions, left_on="Id", right_on="id", how="inner"
        ).set_index("_index", drop=True)

        filtered = joined[["id", "hash"]]

        logger.info(f"Stats with hash with {filtered.shape[0]} rows")
        logger.debug("stats with hash")
        logger.debug(filtered)
        return filtered

    def add_bonded(self, trade_joined: DataFrame, trade_stats: DataFrame):
        bonded_trade_stats = trade_stats.copy().loc[
            trade_stats["ref"].str.startswith("Bonded: ")
        ]
        bonded_trade_stats["Tags"] = bonded_trade_stats.apply(
            lambda _: ["bonded"], axis=1
        )
        bonded_trade_stats["id"] = bonded_trade_stats["hash"].apply(
            lambda x: f"bonded_{x}"
        )

        trade_joined = pd.concat([trade_joined, bonded_trade_stats])
        return trade_joined

    def join_all(
        self,
        trade_stats: DataFrame,
        stats_tags: DataFrame,
        hash_by_stat: DataFrame,
    ):
        tag_and_hash = stats_tags.join(hash_by_stat, how="inner")
        # The stats of one mod share one Tags list, so each stat gets a new list
        tag_and_hash["Tags"] = pd.Series(
            [
                with_id_tags(stat_id, tags)
                for stat_id, tags in zip(tag_and_hash["id"], tag_and_hash["Tags"])
            ],
            index=tag_and_hash.index,
            dtype=object,
        )

        filtered = tag_and_hash.loc[tag_and_hash["Tags"].apply(lambda x: len(x) > 0)]  # pyright: ignore[reportUnknownMemberType, reportUnknownLambdaType, reportUnknownArgumentType]

        trade_joined = pd.merge(trade_stats, filtered, on="hash", how="inner")

        added_bonded = self.add_bonded(trade_joined, trade_stats)

        return added_bonded

    def run(self):
        trade_stats = self.get_trade_stats()
        stats_tags = self.get_stats_with_tags()
        hash_by_stat = self.get_stat_by_hash()

        finished = self.join_all(trade_stats, stats_tags, hash_by_stat).astype(
            {"ref": str, "hash": int, "id": str}
        )
        logger.info(f"Tagged stats with {finished.shape[0]} rows")
        logger.debug(finished)

        return finished
