"""Fetches poe.ninja's PoE 2 economy overviews, one request at a time."""

import gzip
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from .transform import Category, Json

BASE_URL = "https://poe.ninja/poe2/api/economy"
MAX_LEAGUES = 12

log = logging.getLogger(__name__)


class NinjaError(RuntimeError):
    """poe.ninja did not return a usable response."""


@dataclass(frozen=True)
class Reply:
    """The parts of an HTTP response the client uses."""

    status: int
    body: bytes
    etag: str | None


class HttpGet(Protocol):
    def __call__(self, url: str, headers: dict[str, str], timeout: float) -> Reply: ...


def urllib_get(url: str, headers: dict[str, str], timeout: float) -> Reply:
    """Sends a GET with urllib and returns a 304 as a reply instead of raising it."""
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
            if response.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            return Reply(response.status, body, response.headers.get("ETag"))
    except urllib.error.HTTPError as error:
        etag = error.headers.get("ETag")
        error.close()
        return Reply(304, b"", etag) if error.code == 304 else Reply(error.code, b"", None)


class NinjaClient:
    """Requests overviews with ETags and falls back to the last good copy on failure."""

    def __init__(
        self,
        get: HttpGet,
        user_agent: str,
        delay_seconds: float = 1.0,
        timeout_seconds: float = 30.0,
        sleep: Callable[[float], None] = time.sleep,
        base_url: str = BASE_URL,
    ) -> None:
        self._get = get
        self._headers = {"User-Agent": user_agent, "Accept": "application/json", "Accept-Encoding": "gzip"}
        self._delay = delay_seconds
        self._timeout = timeout_seconds
        self._sleep = sleep
        self._base = base_url
        self._cache: dict[str, tuple[str | None, object]] = {}

    def leagues(self) -> list[str]:
        """Returns the ids of the leagues poe.ninja lists, at most MAX_LEAGUES of them."""
        data = self._get_json(f"{self._base}/leagues")
        if not isinstance(data, list):
            raise NinjaError("league list is not a list")
        ids = [entry["id"] for entry in data if isinstance(entry, dict) and isinstance(entry.get("id"), str)]
        return ids[:MAX_LEAGUES]

    def overview(self, league: str, category: Category) -> Json:
        """Returns one category's overview for a league."""
        kind = "exchange/current/overview" if category.exchange else "stash/current/item/overview"
        query = urllib.parse.urlencode({"league": league, "type": category.type}, quote_via=urllib.parse.quote)
        data = self._get_json(f"{self._base}/{kind}?{query}")
        if not isinstance(data, dict):
            raise NinjaError(f"{category.type} overview is not an object")
        return data

    def _get_json(self, url: str) -> object:
        cached = self._cache.get(url)
        headers = dict(self._headers)
        if cached and cached[0]:
            headers["If-None-Match"] = cached[0]
        try:
            reply = self._get(url, headers, self._timeout)
        except OSError as error:
            failure = f"{type(error).__name__}: {error}"
        else:
            if reply.status == 304 and cached:
                return cached[1]
            failure = f"HTTP {reply.status}"
            if reply.status == 200:
                try:
                    data = json.loads(reply.body)
                except ValueError as error:
                    failure = f"invalid JSON: {error}"
                else:
                    self._cache[url] = (reply.etag, data)
                    return data
        finally:
            self._sleep(self._delay)
        if cached:
            log.warning("using the last good copy of %s (%s)", url, failure)
            return cached[1]
        raise NinjaError(f"{url}: {failure}")
