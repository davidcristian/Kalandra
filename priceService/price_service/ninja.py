"""Fetches poe.ninja's PoE 2 economy overviews, one request at a time."""

import gzip
import http.client
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from collections.abc import Callable
from dataclasses import dataclass
from http import HTTPStatus
from typing import Protocol

from .transform import Category, Json, as_array, as_object

BASE_URL = "https://poe.ninja/poe2/api/economy"
MAX_LEAGUES = 12
# A body cut short raises IncompleteRead or EOFError and a corrupt gzip body zlib.error, and none is an OSError
REQUEST_ERRORS = (OSError, http.client.HTTPException, EOFError, zlib.error)

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
    def __call__(self, url: str, headers: dict[str, str], timeout: float, /) -> Reply: ...


def urllib_get(url: str, headers: dict[str, str], timeout: float) -> Reply:
    """Sends a GET with urllib and returns a 304 as a reply instead of raising it."""
    request = urllib.request.Request(url, headers=headers)  # noqa: S310 every URL starts with BASE_URL, an https address
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 the request above has BASE_URL
            body = response.read()
            if response.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            return Reply(response.status, body, response.headers.get("ETag"))
    except urllib.error.HTTPError as error:
        etag = error.headers.get("ETag")
        error.close()
        return Reply(error.code, b"", etag if error.code == HTTPStatus.NOT_MODIFIED else None)


def parse_json(body: bytes) -> object:
    """Parses a response body and rejects a NaN, an infinity or a lone surrogate, which json.loads accepts."""
    data = json.loads(body)
    # Writing the data back as UTF-8 JSON raises ValueError on each of them, as the price file would
    json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
    return data


class NinjaClient:
    """Requests overviews with ETags and falls back to the last good copy on failure."""

    def __init__(
        self,
        get: HttpGet,
        user_agent: str,
        *,
        delay_seconds: float = 1.0,
        timeout_seconds: float = 30.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._get = get
        self._headers = {"User-Agent": user_agent, "Accept": "application/json", "Accept-Encoding": "gzip"}
        self._delay = delay_seconds
        self._timeout = timeout_seconds
        self._sleep = sleep
        self._cache: dict[str, tuple[str | None, object]] = {}

    def leagues(self) -> list[str]:
        """Returns the ids of the leagues poe.ninja lists, at most MAX_LEAGUES of them."""
        entries = as_array(self._get_json(f"{BASE_URL}/leagues"))
        if entries is None:
            msg = "league list is not a list"
            raise NinjaError(msg)
        ids: list[str] = []
        for entry in entries:
            league_id = (as_object(entry) or {}).get("id")
            if isinstance(league_id, str):
                ids.append(league_id)
        return ids[:MAX_LEAGUES]

    def overview(self, league: str, category: Category) -> Json:
        """Returns one category's overview for a league."""
        kind = "exchange/current/overview" if category.exchange else "stash/current/item/overview"
        query = urllib.parse.urlencode({"league": league, "type": category.type}, quote_via=urllib.parse.quote)
        data = as_object(self._get_json(f"{BASE_URL}/{kind}?{query}"))
        if data is None:
            msg = f"{category.type} overview is not an object"
            raise NinjaError(msg)
        return data

    def _get_json(self, url: str) -> object:
        cached = self._cache.get(url)
        headers = dict(self._headers)
        if cached and cached[0]:
            headers["If-None-Match"] = cached[0]
        try:
            reply = self._get(url, headers, self._timeout)
        except REQUEST_ERRORS as error:
            failure = f"{type(error).__name__}: {error}"
        else:
            if reply.status == HTTPStatus.NOT_MODIFIED and cached:
                return cached[1]
            failure = f"HTTP {reply.status}"
            if reply.status == HTTPStatus.OK:
                try:
                    data = parse_json(reply.body)
                except (ValueError, RecursionError) as error:
                    failure = f"invalid JSON: {error}"
                else:
                    self._cache[url] = (reply.etag, data)
                    return data
        finally:
            self._sleep(self._delay)
        if cached:
            log.warning("using the last good copy of %s (%s)", url, failure)
            return cached[1]
        msg = f"{url}: {failure}"
        raise NinjaError(msg)
