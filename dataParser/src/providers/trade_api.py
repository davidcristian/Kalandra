"""
Retrieves all data that is sourced from the trade site
"""

import json
import logging
import os
from typing import TypeGuard

import cloudscraper
from cloudscraper.exceptions import CloudflareException
from requests import RequestException

from constants.lang import LANG
from constants.urls import LANG_URLS, TRADE_QUERY_URLS
from services.request_pacer import RequestPacer

logger = logging.getLogger(__name__)

USER_AGENT_PRODUCT = (
    "kalandra-dataparser/1 (+https://github.com/davidcristian/Kalandra/issues)"
)


def create_trade_session() -> cloudscraper.CloudScraper:
    """Returns a cloudscraper session whose User-Agent also names this tool."""
    session = cloudscraper.create_scraper(interpreter="nodejs")
    # Keeps cloudscraper's browser User-Agent for Cloudflare and adds the tool's name,
    # as the app's Electron User-Agent adds the app's name
    session.headers["User-Agent"] = (
        f"{session.headers['User-Agent']} {USER_AGENT_PRODUCT}"
    )
    return session


class TradeDataError(ValueError):
    """Raised when a trade data response is not the JSON the build reads."""


def is_json_object(value: object) -> TypeGuard[dict[str, object]]:
    """Returns whether a parsed JSON value is an object, whose keys are strings."""
    return isinstance(value, dict)


def is_json_array(value: object) -> TypeGuard[list[object]]:
    """Returns whether a parsed JSON value is an array."""
    return isinstance(value, list)


def sorted_stats_group(group: object) -> dict[str, object]:
    """Returns a group of the stats response with its entries sorted by id."""
    if not is_json_object(group) or "id" not in group or "label" not in group:
        raise TradeDataError("a stats group has no id or label")
    entries = group.get("entries")
    if not is_json_array(entries):
        raise TradeDataError(f"the stats group {group['id']!r} has no entries list")
    objects = [entry for entry in entries if is_json_object(entry) and "id" in entry]
    if len(objects) != len(entries):
        raise TradeDataError(f"an entry of the stats group {group['id']!r} has no id")
    return {
        "entries": sorted(objects, key=lambda entry: str(entry["id"])),
        "id": group["id"],
        "label": group["label"],
    }


def saved_form(filename: str, data: object) -> object:
    """Checks a trade data response and returns it as it is saved, with the stats sorted."""
    result = data.get("result") if is_json_object(data) else None
    if not is_json_array(result):
        raise TradeDataError("the response has no result list")
    if filename != "stats":
        return data
    return {"result": [sorted_stats_group(group) for group in result]}


def write_atomically(path: str, text: str) -> None:
    """Writes text to a temporary file and moves it over path, so a failed write keeps the old file."""
    temporary_path = f"{path}.tmp"
    with open(temporary_path, "w", encoding="utf-8") as file:
        _ = file.write(text)
    os.replace(temporary_path, path)


class TradeApiProvider:
    def __init__(
        self,
        lang: LANG,
        pacer: RequestPacer | None = None,
        output_dir: str | None = None,
    ) -> None:
        self.lang: LANG = lang
        self.pacer: RequestPacer = pacer or RequestPacer(create_trade_session())
        self.output_dir: str = output_dir or os.path.join(
            os.path.dirname(__file__), "../../data/json", self.lang
        )

    def pull(self) -> None:
        base_url = LANG_URLS[self.lang]

        for relative_url in TRADE_QUERY_URLS:
            url = f"{base_url}{relative_url}"
            filename = os.path.basename(relative_url)
            logger.info(f"Fetching JSON from: {url} for language: {self.lang}")

            data = self.fetch(url, filename)
            if data is None:
                continue
            output_path = os.path.join(self.output_dir, f"{filename}.json")
            text = json.dumps(
                data, ensure_ascii=False, indent=4, sort_keys=filename == "stats"
            )
            write_atomically(output_path, text)
            logger.info(f"Saved JSON to: {output_path}")

    def fetch(self, url: str, filename: str) -> object | None:
        """Returns the response in the form it is saved, or None after logging why it is unusable."""
        try:
            response = self.pacer.get(url)
        except (RequestException, CloudflareException) as error:
            logger.error(f"Failed to fetch JSON from: {url}, error: {error}")
            return None
        if response.status_code != 200:
            logger.error(
                f"Failed to fetch JSON from: {url}, code: {response.status_code}"
            )
            return None
        try:
            return saved_form(filename, response.json())
        except ValueError as error:
            logger.error(f"Failed to read JSON from: {url}, error: {error}")
            return None
