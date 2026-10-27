"""Builds the `map` field that the app reads a Waystone's tier from."""

import re

import pandas as pd

WAYSTONE_ID = re.compile(r"Metadata/Items/Maps/MapKeyTier(\d+)")


def map_field(base_item_id: object) -> dict[str, int] | None:
    """Returns the map field of a BaseItemTypes id, or None for an item that is not a Waystone."""
    if not isinstance(base_item_id, str):
        return None
    match = WAYSTONE_ID.fullmatch(base_item_id)
    return {"tier": int(match.group(1))} if match else None


def add_map_column(items: pd.DataFrame, base_item_types: pd.DataFrame) -> pd.DataFrame:
    """Adds the map field to each item row, by the BaseItemTypes row its internal_index names."""
    by_index = dict(zip(base_item_types["_index"], base_item_types["Id"]))
    out = items.copy()
    out["map"] = pd.Series(
        [map_field(by_index.get(index)) for index in out["internal_index"]],
        index=out.index,
        dtype=object,
    )
    return out
