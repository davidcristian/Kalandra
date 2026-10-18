"""Turns poe.ninja overview responses into the price file the app reads."""

import json
import logging
import re
from dataclasses import dataclass
from typing import TypeGuard, cast

Json = dict[str, object]

EMPTY_SPARKLINE: Json = {"totalChange": 0, "data": []}
SCHEMA_VERSION = 1

log = logging.getLogger(__name__)


class SnapshotError(ValueError):
    """A response does not contain what the price file needs."""


@dataclass(frozen=True)
class Category:
    """One poe.ninja overview: its type and whether it comes from the exchange."""

    type: str
    exchange: bool


# A dict or list that json.loads returned has string keys and JSON values, which isinstance cannot check
def as_object(value: object) -> Json | None:
    """Returns a JSON object as a dict, or None for any other value."""
    return cast("Json", value) if isinstance(value, dict) else None


def as_array(value: object) -> list[object] | None:
    """Returns a JSON array as a list, or None for any other value."""
    return cast("list[object]", value) if isinstance(value, list) else None


def load_categories(text: str) -> list[Category]:
    """Reads the categories from the app's namespaceMap.json."""
    document = as_object(json.loads(text)) or {}
    version = document.get("schemaVersion")
    if version != SCHEMA_VERSION:
        msg = f"unsupported schemaVersion {version!r}"
        raise SnapshotError(msg)
    entries = as_array(document.get("map"))
    if entries is None:
        msg = "namespaceMap.json has no map list"
        raise SnapshotError(msg)
    categories: list[Category] = []
    for value in entries:
        entry = as_object(value) or {}
        category_type = entry.get("type")
        if not isinstance(category_type, str) or "cx" not in entry:
            msg = f"namespaceMap.json has an entry without type and cx: {value!r}"
            raise SnapshotError(msg)
        categories.append(Category(category_type, bool(entry["cx"])))
    return categories


def league_file_name(league_id: str) -> str:
    """Returns a league's file name: its id in lowercase letters and digits only."""
    slug = re.sub(r"[^a-z0-9]", "", league_id.lower())
    if not slug:
        msg = f"league id has no letters or digits: {league_id!r}"
        raise SnapshotError(msg)
    return f"{slug}.json"


def _is_number(value: object) -> TypeGuard[float]:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _sparkline(value: object) -> Json:
    sparkline = as_object(value)
    return EMPTY_SPARKLINE if sparkline is None else sparkline


def _objects(response: Json, key: str) -> list[Json]:
    values = as_array(response.get(key, []))
    if values is None:
        log.warning("%s is %s, not a list, so it is read as empty", key, type(response.get(key)).__name__)
        return []
    return [entry for value in values if (entry := as_object(value)) is not None]


def divine_factor(response: Json) -> float | None:
    """Returns how many divines one unit of the response's primary currency is worth, or None if unknown."""
    core = as_object(response.get("core"))
    if core is None:
        return None
    if core.get("primary") == "divine":
        return 1.0
    rate = (as_object(core.get("rates")) or {}).get("divine")
    return float(rate) if _is_number(rate) and rate > 0 else None


def _in_divines(value: object, factor: float) -> object:
    return value * factor if factor != 1.0 and _is_number(value) else value


def exchange_core(response: Json) -> Json:
    """Returns the exchange rates per divine, keyed in the order the app parses them."""
    core = as_object(response.get("core"))
    if core is None:
        msg = "exchange response has no core"
        raise SnapshotError(msg)
    rates, primary, secondary = as_object(core.get("rates")), core.get("primary"), core.get("secondary")
    if rates is None or not isinstance(primary, str) or not isinstance(secondary, str):
        msg = "exchange core needs rates, primary and secondary"
        raise SnapshotError(msg)
    if primary != "divine":
        factor = divine_factor(response)
        if factor is None:
            msg = f"exchange core in {primary} has no divine rate"
            raise SnapshotError(msg)
        converted: Json = {name: rate / factor for name, rate in rates.items() if name != "divine" and _is_number(rate)}
        converted[primary] = 1 / factor
        rates, primary, secondary = converted, "divine", primary
    return {"rates": rates, "primary": primary, "secondary": secondary}


def exchange_lines(response: Json) -> list[Json]:
    """Joins exchange lines with their item names and values in divines, skipping lines without a named item."""
    factor = divine_factor(response)
    if factor is None:
        return []
    items = {item.get("id"): item for item in _objects(response, "items")}
    lines: list[Json] = []
    for line in _objects(response, "lines"):
        item = items.get(line.get("id"))
        if item is None or not isinstance(item.get("name"), str) or not _is_number(line.get("primaryValue")):
            continue
        lines.append(
            {
                "name": item["name"],
                "primaryValue": _in_divines(line["primaryValue"], factor),
                "detailsId": item.get("detailsId"),
                "id": line["id"],
                "volumePrimaryValue": _in_divines(line.get("volumePrimaryValue"), factor),
                "maxVolumeCurrency": line.get("maxVolumeCurrency"),
                "maxVolumeRate": line.get("maxVolumeRate"),
                "sparkline": _sparkline(line.get("sparkline")),
            }
        )
    return lines


def stash_lines(response: Json) -> list[Json]:
    """Keeps the name, variant, value in divines, details id and sparkline of each stash line."""
    factor = divine_factor(response)
    if factor is None:
        return []
    lines: list[Json] = []
    for line in _objects(response, "lines"):
        if not isinstance(line.get("name"), str) or not _is_number(line.get("primaryValue")):
            continue
        entry: Json = {"name": line["name"]}
        variant = line.get("variant") or line.get("baseType")
        if isinstance(variant, str):
            entry["variant"] = variant
        entry["primaryValue"] = _in_divines(line["primaryValue"], factor)
        entry["detailsId"] = line.get("detailsId")
        entry["sparkline"] = _sparkline(line.get("sparkLine"))
        lines.append(entry)
    return lines


def price_file(core: Json, overviews: list[tuple[str, list[Json]]]) -> str:
    """Serializes the price file. The app searches its raw text, so keys stay in this order."""
    document = {
        "core": core,
        "itemOverviews": [{"type": type_, "lines": lines} for type_, lines in overviews],
    }
    return json.dumps(document, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
