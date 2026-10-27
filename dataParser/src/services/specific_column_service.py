from typing import cast

import pandas as pd

from constants.filenames import (
    ARMOUR_TYPES,
    BASE_ITEM_TYPES,
)
from constants.lang import ENGLISH, LANG
from services.agg import make_list_agg
from services.augment_builder import AugmentBuilder
from services.map_tiers import add_map_column
from stores.game_store import GameStore


class SpecificColumnService:
    def __init__(self, lang: LANG) -> None:
        self.lang: LANG = lang
        self.ref_game_store: GameStore = GameStore(ENGLISH)

    def apply_item_specific_columns(
        self, items: pd.DataFrame, stats: pd.DataFrame
    ) -> pd.DataFrame:
        plus_ar = self.apply_armour_column(items)
        plus_map = add_map_column(plus_ar, self.ref_game_store.get(BASE_ITEM_TYPES))
        plus_augment = self.apply_augment_column(plus_map, stats)
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
