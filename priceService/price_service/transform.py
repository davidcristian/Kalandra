"""Turns poe.ninja overview responses into the price file the app reads."""

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

Json = dict[str, Any]

EMPTY_SPARKLINE: Json = {"totalChange": 0, "data": []}

log = logging.getLogger(__name__)


class SnapshotError(ValueError):
    """A response does not contain what the price file needs."""


@dataclass(frozen=True)
class Category:
    """One poe.ninja overview: its type and whether it comes from the exchange."""

    type: str
    exchange: bool


def load_categories(text: str) -> list[Category]:
    """Reads the categories from the app's namespaceMap.json."""
    document = json.loads(text)
    if document.get("schemaVersion") != 1:
        raise SnapshotError(f"unsupported schemaVersion {document.get('schemaVersion')!r}")
    return [Category(entry["type"], bool(entry["cx"])) for entry in document["map"]]


def league_file_name(league_id: str) -> str:
    """Returns a league's file name: its id in lowercase letters and digits only."""
    slug = re.sub(r"[^a-z0-9]", "", league_id.lower())
    if not slug:
        raise SnapshotError(f"league id has no letters or digits: {league_id!r}")
    return f"{slug}.json"


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _sparkline(value: object) -> Json:
    return value if isinstance(value, dict) else EMPTY_SPARKLINE


def _array(response: Json, key: str) -> list[Any]:
    value = response.get(key, [])
    if isinstance(value, list):
        return value
    log.warning("%s is %s, not a list, so it is read as empty", key, type(value).__name__)
    return []


def divine_factor(response: Json) -> float | None:
    """Returns how many divines one unit of the response's primary currency is worth, or None if unknown."""
    core = response.get("core")
    if not isinstance(core, dict):
        return None
    if core.get("primary") == "divine":
        return 1.0
    rates = core.get("rates")
    rate = rates.get("divine") if isinstance(rates, dict) else None
    return float(rate) if _is_number(rate) and rate > 0 else None


def _in_divines(value: object, factor: float) -> object:
    return value * factor if factor != 1.0 and _is_number(value) else value


def exchange_core(response: Json) -> Json:
    """Returns the exchange rates per divine, keyed in the order the app parses them."""
    core = response.get("core")
    if not isinstance(core, dict):
        raise SnapshotError("exchange response has no core")
    rates, primary, secondary = core.get("rates"), core.get("primary"), core.get("secondary")
    if not isinstance(rates, dict) or not isinstance(primary, str) or not isinstance(secondary, str):
        raise SnapshotError("exchange core needs rates, primary and secondary")
    if primary != "divine":
        factor = divine_factor(response)
        if factor is None:
            raise SnapshotError(f"exchange core in {primary} has no divine rate")
        rates = {name: rate / factor for name, rate in rates.items() if name != "divine" and _is_number(rate)}
        rates[primary] = 1 / factor
        primary, secondary = "divine", primary
    return {"rates": rates, "primary": primary, "secondary": secondary}


def exchange_lines(response: Json) -> list[Json]:
    """Joins exchange lines with their item names and values in divines, skipping lines without a named item."""
    factor = divine_factor(response)
    if factor is None:
        return []
    items = {item.get("id"): item for item in _array(response, "items") if isinstance(item, dict)}
    lines: list[Json] = []
    for line in _array(response, "lines"):
        if not isinstance(line, dict):
            continue
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
    for line in _array(response, "lines"):
        if not isinstance(line, dict):
            continue
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
