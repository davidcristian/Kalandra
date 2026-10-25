"""Adds the trade tags and icons of the trade site's static entries to the item rows."""

import pandas as pd

IMAGE_HOST = "https://web.poecdn.com"


def static_icon(image: object) -> str | None:
    """Returns the icon URL of a static entry's image path, or None when the entry has no image."""
    return f"{IMAGE_HOST}{image}" if isinstance(image, str) and image else None


def add_static_data(items: pd.DataFrame, static: pd.DataFrame) -> pd.DataFrame:
    """Sets the trade tag of each item a static entry names, and its icon where that entry has an image."""
    icons = static.assign(icon_s=static["image"].map(static_icon))
    merged = items.merge(
        icons[["text", "icon_s", "tradeTag"]],
        left_on="refName",
        right_on="text",
        how="left",
    )
    merged.loc[merged["icon_s"].notna(), "icon"] = merged["icon_s"]
    return merged
