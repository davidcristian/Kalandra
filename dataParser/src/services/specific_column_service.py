from typing import cast

import pandas as pd

from constants.filenames import (
    ARMOUR_TYPES,
)
from constants.lang import ENGLISH, LANG
from services.agg import make_list_agg
from services.augment_builder import AugmentBuilder
from stores.game_store import GameStore

GENERAL_CLASS_TO_ITEM_CLASS = {
    "armour": [
        "Body Armour",
        "Boots",
        "Buckler",
        "Focus",
        "Gloves",
        "Helmet",
        "Shield",
    ],
    "weapon": [
        "Bow",
        "Claw",
        "Crossbow",
        "Dagger",
        "Flail",
        "One Hand Axe",
        "One Hand Mace",
        "One Hand Sword",
        "Spear",
        "Two Hand Axe",
        "Two Hand Mace",
        "Two Hand Sword",
        "Warstaff",
        "Talisman",
    ],
    "caster": [
        "Staff",
        "Wand",
    ],
}


class SpecificColumnService:
    def __init__(self, lang: LANG) -> None:
        self.lang: LANG = lang

        # self.ref_trade_store: TradeStore = TradeStore(ENGLISH)
        # self.trade_store: TradeStore = TradeStore(lang)
        self.ref_game_store: GameStore = GameStore(ENGLISH)
        # self.game_store: GameStore = GameStore(lang)

    def apply_item_specific_columns(
        self, items: pd.DataFrame, stats: pd.DataFrame
    ) -> pd.DataFrame:
        plus_ar = self.apply_armour_column(items)
        plus_gem = self.apply_gem_column(plus_ar)
        plus_augment = self.apply_augment_column(plus_gem, stats)
        return plus_augment

    def apply_armour_column(self, items: pd.DataFrame) -> pd.DataFrame:
        armour = self.ref_game_store.get(ARMOUR_TYPES)

        def create_armour_dict(row: pd.Series) -> dict[str, list[int]]:
            armour_dict: dict[str, list[int]] = {}
            if row["Armour"] != 0:
                armour_dict["ar"] = [int(row["Armour"]), int(row["Armour"])]
            if row["Evasion"] != 0:
                armour_dict["ev"] = [int(row["Evasion"]), int(row["Evasion"])]
            if row["EnergyShield"] != 0:
                armour_dict["es"] = [int(row["EnergyShield"]), int(row["EnergyShield"])]
            return armour_dict

        armour["armour"] = armour.apply(create_armour_dict, axis=1)
        armour = armour[["BaseItemType", "armour"]]

        return items.merge(
            armour, left_on="internal_index", right_on="BaseItemType", how="left"
        ).drop("BaseItemType", axis=1)

    def apply_gem_column(self, items: pd.DataFrame) -> pd.DataFrame:
        gem = items.copy()

        def create_gem_dict(namespace_col: str) -> dict[str, bool] | None:
            return (
                {"awakened": False, "transfigured": False}
                if namespace_col == "GEM"
                else None
            )

        gem["gem"] = gem["namespace"].apply(create_gem_dict)
        return gem

    def apply_augment_column(
        self, items: pd.DataFrame, stats: pd.DataFrame
    ) -> pd.DataFrame:
        augments = items.copy()
        augment_df = AugmentBuilder(stats).build()

        def create_augment_column(
            row: pd.Series,
        ) -> dict[str, str | list[str] | list[int]]:
            return {
                "categories": row["categories"],
                "string": row["string"],
                "values": row["values"],
                "tradeId": row["tradeId"],
            }

        augment_df["out"] = augment_df.apply(create_augment_column, axis=1)
        # to_dict types the keys as Hashable; the index holds the item names
        augment_dict = cast(
            dict[str, list[dict[str, str | list[str] | list[int]]]],
            augment_df.groupby("refName")
            .agg(make_list_agg(columns_to_list=["out"]))["out"]
            .to_dict(),
        )

        augments["augment"] = augments["refName"].apply(augment_dict.get)

        return augments
