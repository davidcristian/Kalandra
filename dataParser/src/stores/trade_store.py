import json
import os
from typing import TypedDict, cast

import pandas as pd

from constants.filenames import ITEMS_JSON, STATIC_JSON, STATS_JSON
from constants.lang import LANG


class TradeGroup(TypedDict):
    """A group of a trade data file."""

    id: str
    label: str
    # Each method checks that entries is a list, then casts it to its file's entry type
    entries: object


class ItemEntry(TypedDict, total=False):
    """An entry of the trade site's items.json."""

    type: str
    text: str
    name: str
    flags: dict[str, bool]


class StatEntry(TypedDict):
    """An entry of the trade site's stats.json."""

    id: str
    text: str | None
    type: str


class StaticEntry(TypedDict, total=False):
    """An entry of the trade site's static.json."""

    id: str
    text: str
    image: str


class TradeStore:
    def __init__(self, lang: LANG) -> None:
        self.lang: LANG = lang
        self.data_dir: str = os.path.join(
            os.path.dirname(__file__), "../../data/json", self.lang
        )

    def load_file(self, filename: str) -> dict[str, list[TradeGroup]]:
        with open(os.path.join(self.data_dir, filename), "r", encoding="utf-8") as f:
            return json.load(f)

    def items(self) -> pd.DataFrame:
        rows: list[dict[str, str | bool | None]] = []
        data = self.load_file(ITEMS_JSON)
        for item in data["result"]:
            if not isinstance(item["entries"], list):
                raise ValueError("Entries should be a list")
            for entry in cast(list[ItemEntry], item["entries"]):
                rows.append(
                    {
                        "id": item["id"],
                        "label": item["label"],
                        "type": entry.get("type"),
                        "text": entry.get("text"),
                        "name": entry.get("name"),
                        "unique": entry.get("flags", {}).get("unique", False),
                    }
                )
        return pd.DataFrame(rows)

    def stats(self) -> pd.DataFrame:
        rows: list[dict[str, str | None]] = []
        data = self.load_file(STATS_JSON)
        for stat in data["result"]:
            if not isinstance(stat["entries"], list):
                raise ValueError("Entries should be a list")
            for entry in cast(list[StatEntry], stat["entries"]):
                text = entry["text"]
                if isinstance(text, str):
                    text = text.replace("+#%", "#%")
                rows.append(
                    {
                        "id": entry["id"],
                        "text": text,
                        "type": entry["type"],
                    }
                )
        return pd.DataFrame(rows).drop_duplicates(subset="id", keep="last")

    def static(self) -> pd.DataFrame:
        rows: list[dict[str, str | None]] = []
        data = self.load_file(STATIC_JSON)
        for item in data["result"]:
            if not isinstance(item["entries"], list):
                raise ValueError("Entries should be a list")
            for entry in cast(list[StaticEntry], item["entries"]):
                tag = entry.get("id")
                rows.append(
                    {
                        "type": item["id"],
                        "tradeTag": tag
                        if tag is not None
                        and (
                            "precursor-tablet" not in tag
                            and "idol-of-estazunti" not in tag
                            and "gaze" not in tag
                            and "waystone" not in tag
                        )
                        else None,
                        "text": entry.get("text"),
                        "image": entry.get("image"),
                    }
                )
        return pd.DataFrame(rows)
