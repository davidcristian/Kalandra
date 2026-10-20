"""Fetches poe.ninja's PoE 2 economy overviews, one request at a time."""

import gzip
import http.client
import json
import logging
import re
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
MAX_SERVER_ERRORS = 3
MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60
# A body cut short raises IncompleteRead or EOFError and a corrupt gzip body zlib.error, and none is an OSError
REQUEST_ERRORS = (OSError, http.client.HTTPException, EOFError, zlib.error)

log = logging.getLogger(__name__)


class NinjaError(RuntimeError):
    """poe.ninja did not return a usable response."""


class StopCycleError(RuntimeError):
    """poe.ninja rate limited the service or failed several times in a row, so the cycle sends no more requests."""

    def __init__(self, message: str, retry_after: float | None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


@dataclass(frozen=True)
class Reply:
    """The parts of an HTTP response the client uses."""

    status: int
    body: bytes
    etag: str | None
    retry_after: str | None = None


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
        etag = error.headers.get("ETag") if error.code == HTTPStatus.NOT_MODIFIED else None
        retry_after = error.headers.get("Retry-After")
        error.close()
        return Reply(error.code, b"", etag, retry_after)


def retry_after_seconds(header: str | None) -> float | None:
    """Reads a Retry-After header in seconds, at most a day; a date or any other text gives None."""
    text = (header or "").strip()
    if not re.fullmatch(r"[0-9]+", text):
        return None
    try:
        seconds = int(text)
    # int() raises on more than 4300 digits, a number far above the cap
    except ValueError:
        seconds = MAX_RETRY_AFTER_SECONDS
    return float(min(seconds, MAX_RETRY_AFTER_SECONDS))


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
        self._server_errors = 0

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
            self._check_status(url, reply)
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

    def _check_status(self, url: str, reply: Reply) -> None:
        """Raises StopCycleError on a 429, or on a 5xx that makes MAX_SERVER_ERRORS of them in a row."""
        server_error = reply.status >= HTTPStatus.INTERNAL_SERVER_ERROR
        self._server_errors = self._server_errors + 1 if server_error else 0
        if reply.status != HTTPStatus.TOO_MANY_REQUESTS and self._server_errors < MAX_SERVER_ERRORS:
            return
        msg = f"{url}: HTTP {reply.status}"
        if server_error:
            msg += f", {self._server_errors} server errors in a row"
        retry_after = retry_after_seconds(reply.retry_after)
        if retry_after is not None:
            msg += f", retry after {retry_after:.0f} seconds"
        raise StopCycleError(msg, retry_after)
