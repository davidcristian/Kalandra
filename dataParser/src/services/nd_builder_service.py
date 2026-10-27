import logging
from collections import defaultdict

import pandas as pd
from pandas.core.frame import DataFrame

from constants.filenames import (
    ATLAS_STAT_DESCRIPTIONS,
    BASE_ITEM_TYPES,
    GOLD_MOD_PRICES,
    ITEM_CLASS_CATEGORIES,
    ITEM_CLASSES,
    MODS,
    STATS,
    TABLET_STAT_DESCRIPTIONS,
    TAGS,
    WORDS,
)
from constants.known_stats import (
    SAME_TRANSLATIONS_DIFFERENT_STATS,
    TRADE_INVERTED,
)
from constants.lang import ENGLISH, LANG
from constants.mod_types import AUGMENT, EXPLICIT, MOD_TYPES, RUNE
from services import english_stat_list
from services.image_provider import DEFAULT_LEAGUE, MODE, ImageProvider
from services.logbook_factions import LogbookFactions
from services.nd_builder_functions import (
    craftable,
    id_list,
    ids_or_empty,
    matcher_key,
    namespace,
    sort_matchers,
    trade_hash,
    unique_field,
)
from services.specific_column_service import SpecificColumnService
from services.static_items import add_static_data
from services.unique_names import name_uniques
from services.value_converter_service import ValueConverterService
from stores.game_store import GameStore
from stores.trade_store import TradeStore

logger = logging.getLogger(__name__)


class NdBuilderService:
    local_lookup: dict[str, str]
    stats: pd.DataFrame
    items: pd.DataFrame

    def __init__(
        self,
        lang: LANG,
        image_mode: MODE,
        image_cache_dir: str | None = None,
        league: str = DEFAULT_LEAGUE,
    ) -> None:
        self.lang: LANG = lang

        self.ref_trade_store: TradeStore = TradeStore(ENGLISH)
        self.trade_store: TradeStore = TradeStore(lang)
        self.ref_game_store: GameStore = GameStore(ENGLISH)
        self.game_store: GameStore = GameStore(lang)

        self.vc = ValueConverterService(lang)
        self.image_mode: MODE = image_mode
        self.image_cache_dir: str | None = image_cache_dir
        self.league: str = league
        self.specific_column_service = SpecificColumnService(lang)
        self.logbook_factions = LogbookFactions(lang)

    def build_stats_ndjson(self) -> pd.DataFrame:
        logger.info("Building stats")
        logger.info("Importing trade site data")
        valueless_trade_stats_df = self.get_output_ready_trade_stats()
        value_trade_stats_df = self.get_output_value_stats()
        logger.info("Importing descriptions")
        desc_df = self.descriptions_hashed()

        logger.info("Joining trade site and descriptions")
        joined_df = self.join_trade_and_descriptions(valueless_trade_stats_df, desc_df)
        english_df = self.join_trade_and_descriptions(
            valueless_trade_stats_df, self.descriptions_hashed(self.ref_game_store)
        )
        deduped = self.dedupe_matchers(joined_df, self.get_refs_to_merge(english_df))
        refs_sharing = self.get_refs_to_merge(deduped)
        shared = english_stat_list.share_trade_ids(deduped, refs_sharing)
        matcher_deduped = self.set_timeless_matchers(shared)

        logger.info("Joining stats with and without values")
        concated = pd.concat([matcher_deduped, value_trade_stats_df]).sort_values("ref")
        map_ids = self.map_stat_ids()

        concated.loc[concated["id"].isin(map_ids), "fromAreaMods"] = True

        joined_df_i = self.add_trade_inverted(concated)

        logger.info("Filling in missing matchers")
        missing_filled = self.fill_in_missing_matchers(joined_df_i)

        logger.info("Adding logbook factions")
        log_faction = self.logbook_factions.get_out_factions()
        log_added = pd.concat([missing_filled, log_faction]).sort_values("ref")

        logger.info("Cleaning up stats")
        return self.clean_up_ndjson(log_added)

    def clean_up_ndjson(self, ndjson: pd.DataFrame) -> pd.DataFrame:
        ndjson = ndjson[
            [
                "ref",
                "dp",
                "better",
                "matchers",
                "trade",
                "fromAreaMods",
                "id",
                "hash",
            ]
        ]
        ndjson["better"] = ndjson["better"].fillna(1).astype(int)
        ndjson["matchers"] = ndjson["matchers"].apply(sort_matchers)
        self.stats = ndjson.sort_values(by="ref").drop(columns=["hash"])
        return self.stats

    def join_trade_and_descriptions(
        self, trade_stats_df: pd.DataFrame, desc_df: pd.DataFrame
    ) -> pd.DataFrame:
        def custom_agg(col: pd.Series) -> object:
            col_name = col.name
            if col_name == "hash":
                return list(col.dropna())

            if col_name == "matchers":
                return list(
                    {
                        frozenset(d.items()): d for sub in col.dropna() for d in sub
                    }.values()
                )

            return col.iloc[0]

        grouped_trade_stats_df_xploded = trade_stats_df.explode("hash")

        merged_trade_stats_df = grouped_trade_stats_df_xploded.merge(
            desc_df, left_on="hash", right_on="hash", how="left"
        )
        merged_trade_stats_df_un_exploded = (
            merged_trade_stats_df.groupby("ref").agg(custom_agg).reset_index()
        )
        return merged_trade_stats_df_un_exploded

    def add_trade_inverted(self, in_df: pd.DataFrame) -> pd.DataFrame:
        def add_inverted(row: pd.Series) -> dict[str, object]:
            trade = row["trade"]
            if len(row["hash"]) > 0 and row["hash"][0] in TRADE_INVERTED:
                trade["inverted"] = True
            return trade

        df = in_df.copy()
        df["trade"] = df.apply(add_inverted, axis=1)
        return df

    def stats_combined_df(self) -> pd.DataFrame:
        ref_stats_df = self.ref_trade_store.stats()[["id", "text", "type"]]
        lang_stats_df = self.trade_store.stats()[["id", "text"]]
        combined_df = english_stat_list.with_language_text(ref_stats_df, lang_stats_df)
        out = combined_df[["id", "text", "ref", "type"]]
        out["ref"] = out["ref"].str.replace(r" \(.*\)", "", regex=True)

        self.local_lookup = english_stat_list.text_by_ref(out)

        return out

    def descriptions_hashed(self, store: GameStore | None = None) -> pd.DataFrame:
        store = store or self.game_store
        all_desc_de_dupped = store.get_all_descriptions().drop_duplicates(
            "id", keep="last"
        )
        atlas_ones = store.get_description(ATLAS_STAT_DESCRIPTIONS)
        tablet_ones = store.get_description(TABLET_STAT_DESCRIPTIONS)

        return pd.concat([atlas_ones, tablet_ones, all_desc_de_dupped])

    def valueless_trade_stats_df(self) -> pd.DataFrame:
        stats_df = self.stats_combined_df()
        return stats_df[~stats_df["id"].str.contains("\\|")]

    def value_trade_stats_df(self) -> pd.DataFrame:
        stats_df = english_stat_list.language_text_rows(self.stats_combined_df())
        value_trade_stats_df: DataFrame = stats_df[
            stats_df["id"].str.contains("\\|")
        ].copy()
        value_trade_stats_df["value"] = (
            value_trade_stats_df["id"].str.split("\\|").str[-1]
        )
        value_trade_stats_df["id"] = value_trade_stats_df["id"].str.split("\\|").str[0]
        value_trade_stats_df["hash"] = value_trade_stats_df.apply(trade_hash, axis=1)
        return value_trade_stats_df

    def group_trade_stats(self, in_df: pd.DataFrame) -> pd.DataFrame:
        if set(in_df.columns) != {"id", "text", "ref", "type"}:
            raise ValueError(f"unexpected trade stat columns {sorted(in_df.columns)}")
        grouped_trade_stats_df = in_df.pivot_table(
            index=["ref"],
            columns="type",
            values="id",
            aggfunc=id_list,  # pyright: ignore[reportArgumentType] pandas also takes an aggfunc that returns a list
        ).reset_index()
        for col in MOD_TYPES:
            grouped_trade_stats_df[col] = (
                grouped_trade_stats_df[col].fillna("").apply(ids_or_empty)
            )
        if set(grouped_trade_stats_df.columns) != {"ref"}.union(MOD_TYPES):
            raise ValueError("trade stats have a type that is not in MOD_TYPES")
        return grouped_trade_stats_df

    def add_hash_to_trade_stats(self, in_df: pd.DataFrame) -> pd.DataFrame:
        def get_hash(row: pd.Series) -> list[int]:
            hashes: set[int] = set()
            for t in MOD_TYPES:
                for trade_id in row[t]:
                    num = trade_id.split("_")[-1]
                    if num.isdigit():
                        hashes.add(int(num))
            return sorted(hashes)

        out_df = in_df.copy()
        out_df["hash"] = out_df.apply(get_hash, axis=1)

        return out_df

    def convert_to_trade_out(self, in_df: pd.DataFrame) -> pd.DataFrame:
        def make_trade(row: pd.Series) -> dict[str, dict[str, list[str]]]:
            ids: dict[str, list[str]] = {}
            for mod in MOD_TYPES:
                if row[mod]:
                    lookup_mod = mod if mod != AUGMENT else RUNE
                    ids[lookup_mod] = sorted(row[mod])
                    if (
                        mod == EXPLICIT
                        and self.lang in SAME_TRANSLATIONS_DIFFERENT_STATS
                    ):
                        for key, related_stats in SAME_TRANSLATIONS_DIFFERENT_STATS[
                            self.lang
                        ].items():
                            if key in ids[mod]:
                                ids[mod].extend(related_stats)
            return {"ids": ids}

        trade_stats_out_closer_df = in_df.copy().drop(columns=MOD_TYPES)
        trade_stats_out_closer_df["trade"] = in_df.apply(make_trade, axis=1)
        return trade_stats_out_closer_df

    def get_output_ready_trade_stats(self) -> pd.DataFrame:
        value_less_stats = self.valueless_trade_stats_df()
        grouped_valueless_stats = self.group_trade_stats(value_less_stats)
        hash_stats = self.add_hash_to_trade_stats(grouped_valueless_stats)
        trade_stats = self.convert_to_trade_out(hash_stats)
        return trade_stats

    def get_output_value_stats(self) -> pd.DataFrame:
        value = self.value_trade_stats_df()
        return self.vc.convert_value_stats_to_trade(value)

    def set_timeless_matchers(self, in_df: pd.DataFrame) -> pd.DataFrame:
        out_df = in_df.copy()
        has_text = out_df["ref"].isin(self.local_lookup)
        is_timeless = out_df["ref"].str.startswith(("Small", "Notable")) & has_text
        column = [
            [{"string": self.local_lookup[ref]}] if timeless else matchers
            for ref, matchers, timeless in zip(
                out_df["ref"], out_df["matchers"], is_timeless
            )
        ]
        out_df["matchers"] = pd.Series(column, index=out_df.index, dtype=object)
        return out_df

    def build_items_ndjson(self) -> pd.DataFrame:
        logger.info("Building items")

        logger.info("Getting unique items")
        unique_items = self.unique_items()
        logger.info("Getting non-unique items")
        non_unique_items = self.non_unique_items()

        logger.info("Applying armour and augment columns")
        col_added = self.specific_column_service.apply_item_specific_columns(
            non_unique_items, self.stats
        )

        logger.info("Joining unique and non-unique dfs")
        combined = pd.concat([unique_items, col_added]).reset_index(drop=True)

        logger.info("Cleaning up items")
        cleaned_items = self.clean_up_items(combined)

        logger.info(f"Applying images at level {self.image_mode}")
        images_added = self.apply_images(cleaned_items)
        images_added.loc[images_added["namespace"] != "UNIQUE", "craftable"] = (
            images_added.loc[images_added["namespace"] != "UNIQUE", "category"].apply(
                craftable
            )
        )

        logger.info("adding static data")
        static_items_added = add_static_data(
            images_added, self.ref_trade_store.static()
        )

        logger.info("Sorting and returning items")
        self.items = static_items_added.sort_values(by=["namespace", "refName"])[
            [
                "name",
                "refName",
                "namespace",
                "unique",
                "icon",
                "tags",
                "tradeTag",
                "craftable",
                "w",
                "h",
                "armour",
                "map",
                "augment",
            ]
        ]
        return self.items

    def get_items_base_types(self) -> pd.DataFrame:
        ref_base_types = self.ref_game_store.get(BASE_ITEM_TYPES)[
            ["_index", "ItemClass", "Width", "Height", "Name", "DropLevel", "Tags"]
        ].rename({"Name": "refName", "_index": "internal_index"}, axis=1)
        base_types = self.game_store.get(BASE_ITEM_TYPES)[["Name"]]
        return base_types.join(ref_base_types, validate="1:1").rename(
            {"refName": "type"}, axis=1
        )

    def unique_items(self) -> pd.DataFrame:
        ts_items = self.ref_trade_store.items()
        joined_base = self.get_items_base_types()

        unique_mask = ts_items["unique"].eq(True)
        unique_items = ts_items.loc[unique_mask].copy()
        unique_items["namespace"] = "UNIQUE"

        named_unique_items = name_uniques(
            unique_items,
            self.ref_game_store.get(WORDS),
            self.game_store.get(WORDS),
        )[["type", "namespace", "name", "refName"]]
        named_unique_items["unique"] = named_unique_items.apply(unique_field, axis=1)
        combined_unique = joined_base.merge(
            named_unique_items, on="type", how="right"
        ).drop("Name", axis=1)
        return combined_unique

    def non_unique_items(self) -> pd.DataFrame:
        ts_items = self.ref_trade_store.items()
        joined_base = self.get_items_base_types()
        non_unique_mask = ts_items["unique"].eq(False)

        non_unique_items = ts_items.loc[non_unique_mask].copy()
        non_unique_items["namespace"] = non_unique_items["id"].apply(namespace)
        non_unique_items.loc[
            non_unique_items["type"].str.startswith("Uncut"), "namespace"
        ] = "ITEM"
        classes = self.ref_game_store.get(ITEM_CLASSES)[
            ["_index", "ItemClassCategory"]
        ].merge(
            self.ref_game_store.get(ITEM_CLASS_CATEGORIES).rename(
                {"_index": "_index2"}, axis=1
            )[["_index2", "Id"]],
            left_on="ItemClassCategory",
            right_on="_index2",
            how="left",
        )
        combined_non_unique = joined_base.merge(
            non_unique_items[["type", "namespace"]], on="type", how="right"
        ).rename({"type": "refName", "Name": "name"}, axis=1)
        combined_non_unique = combined_non_unique.merge(
            classes[["_index", "Id"]],
            left_on="ItemClass",
            right_on="_index",
            validate="m:1",
        ).drop(["_index"], axis=1)
        return combined_non_unique

    def map_stat_ids(self) -> set[str]:
        mods = self.game_store.get(MODS)
        gold = self.game_store.get(GOLD_MOD_PRICES)
        stats_lookup = self.game_store.get(STATS)["Id"].to_dict()

        map_mods = mods.loc[mods["Id"].str.startswith("Map")]
        inner = map_mods.merge(gold, left_on="_index", right_on="Mod", how="inner")

        stat_col = [f"Stat{i}" for i in range(1, 7)]
        all_stats_l: list[pd.Series] = []
        for col in stat_col:
            all_stats_l.append(inner[col].fillna(-1).astype(int))

        all_stats = pd.concat(all_stats_l)
        return set(stats_lookup[x] for x in all_stats[all_stats != -1].dropna())

    def clean_up_items(self, items: pd.DataFrame) -> pd.DataFrame:
        tags = self.ref_game_store.get(TAGS)
        tags_lookup = tags["Id"].to_dict()
        filtered = items.drop(["ItemClass", "type", "DropLevel"], axis=1).rename(
            {"Id": "category", "Width": "w", "Height": "h", "Tags": "tags"}, axis=1
        )

        def tag_names(tag_rows: list[int]) -> list[str]:
            return [tags_lookup[t] for t in tag_rows]

        filtered["tags"] = filtered["tags"].apply(tag_names)
        return filtered

    def apply_images(self, items: pd.DataFrame) -> pd.DataFrame:
        return ImageProvider(
            self.image_mode, self.image_cache_dir, league=self.league
        ).apply_images(items)

    def fill_in_missing_matchers(self, joined_df_i: pd.DataFrame) -> pd.DataFrame:
        trade_stats_df = english_stat_list.language_text_rows(self.stats_combined_df())

        def create_matchers(row: pd.Series) -> list[dict[str, str]]:
            text = row["text"]
            if row["type"] == "pseudo":
                text += " "
            return [{"string": text}]

        trade_stats_df["matchers"] = trade_stats_df.apply(create_matchers, axis=1)
        ref_matchers_dict = trade_stats_df.set_index("ref")["matchers"].to_dict()

        def update_matchers(row: pd.Series) -> object:
            if isinstance(row["matchers"], list) and len(row["matchers"]) == 0:
                if row["ref"] in ref_matchers_dict:
                    return ref_matchers_dict[row["ref"]]
            return row["matchers"]

        joined_df_i["matchers"] = joined_df_i.apply(update_matchers, axis=1)
        return joined_df_i

    def get_refs_to_merge(self, in_df: pd.DataFrame) -> pd.Series:
        """Returns the sets of refs whose rows share at least one matcher."""
        matchers_exploded = in_df.explode("matchers")
        matchers_exploded["matchers"] = matchers_exploded["matchers"].apply(matcher_key)
        matchers_grouped = matchers_exploded.groupby("matchers").agg(list).reset_index()

        matchers_grouped["matchers"] = matchers_grouped["matchers"].apply(list)
        # An empty key holds the stats without matchers, and a key with one ref has no row to merge with
        refs_to_merge = matchers_grouped.loc[
            (matchers_grouped["matchers"].str.len() > 0)
            & (matchers_grouped["ref"].str.len() > 1)
        ]["ref"].apply(set)
        return refs_to_merge

    def dedupe_matchers(
        self, in_df: pd.DataFrame, refs_to_merge: pd.Series
    ) -> pd.DataFrame:
        refs_set = {item for row in refs_to_merge for item in row}

        data_with_saved_refs = (
            in_df.loc[in_df["ref"].isin(refs_set)].copy().sort_values("id")
        )
        data_without_saved_refs = in_df.loc[~in_df["ref"].isin(refs_set)].copy()

        def custom_fn(df: pd.DataFrame) -> pd.Series:
            """Returns the position in refs_to_merge of the set that holds each row's ref."""

            def find_index(c: str) -> int:
                for index, val in enumerate(refs_to_merge):
                    if c in val:
                        return index
                return -1

            r = df["ref"]
            new_series = r.apply(find_index)
            return new_series

        with_groups = data_with_saved_refs.assign(custom_groups=custom_fn)

        def custom_agg_refs(col: pd.Series) -> object:
            col_name = col.name
            if col_name == "hash":
                return list({i for row in col.dropna() for i in row})

            if col_name == "matchers":
                return list(
                    {
                        frozenset(d.items()): d for sub in col.dropna() for d in sub
                    }.values()
                )

            if col_name == "trade":
                new_trade: defaultdict[str, list[str]] = defaultdict(list)
                for row in col:
                    t = row["ids"]
                    for k, v in t.items():
                        new_trade[k].extend(v)
                return {"ids": dict(new_trade)}

            return col.iloc[0]

        merged_refs_df = (
            with_groups.groupby("custom_groups")
            .agg(custom_agg_refs)
            .reset_index()
            .drop(columns="custom_groups")
        )

        matcher_deduped = pd.concat([data_without_saved_refs, merged_refs_df])

        return matcher_deduped
