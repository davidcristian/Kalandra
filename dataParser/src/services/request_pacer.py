"""Sends trade site requests one at a time, waits out its rate limits and retries a 429."""

import logging
import math
import time
from collections.abc import Callable, Mapping
from typing import Protocol

logger = logging.getLogger(__name__)

# The app also starts at one trade request per 5 seconds until the trade site sends its limits
# (RATE_LIMIT_RULES in renderer/src/web/price-check/trade/common.ts)
MIN_INTERVAL_SECONDS = 5.0
MAX_RETRIES = 3
DEFAULT_RETRY_SECONDS = 60.0


class Response(Protocol):
    @property
    def status_code(self) -> int: ...

    @property
    def headers(self) -> Mapping[str, str]: ...

    def json(self) -> object: ...


class Session(Protocol):
    def get(self, url: str) -> Response: ...


def read_retry_after(value: str | None) -> float:
    """Returns the seconds in a Retry-After header, or 0 when it is missing or not a number."""
    if value is None:
        return 0.0
    try:
        seconds = float(value)
    except ValueError:
        seconds = math.nan
    if math.isfinite(seconds) and seconds >= 0:
        return seconds
    logger.warning(f"Ignored Retry-After header {value!r}: not a number of seconds")
    return 0.0


def read_numbers(header: str) -> list[list[int]]:
    """Reads "a:b:c,d:e:f" as [[a, b, c], [d, e, f]] and raises ValueError on other text."""
    rows = [[int(number) for number in entry.split(":")] for entry in header.split(",")]
    if any(len(row) != 3 or min(row) < 0 for row in rows):
        raise ValueError(header)
    return rows


def rule_wait(rule: str, limit: str | None, state: str | None) -> float:
    """Returns the seconds one rate limit rule asks the next request to wait."""
    try:
        limits = read_numbers(limit or "")
        states = read_numbers(state or "")
    except ValueError:
        limits, states = [], []
    if not limits or len(limits) != len(states):
        logger.warning(
            f'Ignored rate limit rule "{rule}": limit header {limit!r}, state header {state!r}'
        )
        return 0.0

    # Waiting at one request from the limit leaves that request for the overlay and
    # other clients on the same address
    wait = 0.0
    for (max_hits, window, _), (hits, _, restricted) in zip(
        limits, states, strict=True
    ):
        if restricted > 0:
            wait = max(wait, float(restricted))
        elif hits >= max_hits - 1:
            wait = max(wait, float(window))
    return wait


def limit_wait(headers: Mapping[str, str]) -> float:
    """Returns the seconds the trade site's rate limit headers ask the next request to wait."""
    lowered = {name.lower(): value for name, value in headers.items()}
    wait = read_retry_after(lowered.get("retry-after"))
    for name in lowered.get("x-rate-limit-rules", "").split(","):
        rule = name.strip().lower()
        if rule:
            limit = lowered.get(f"x-rate-limit-{rule}")
            state = lowered.get(f"x-rate-limit-{rule}-state")
            wait = max(wait, rule_wait(rule, limit, state))
    return wait


class RequestPacer:
    """Sends GET requests at least min_interval seconds apart and retries a 429 up to max_retries times."""

    def __init__(
        self,
        session: Session,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        min_interval: float = MIN_INTERVAL_SECONDS,
        max_retries: int = MAX_RETRIES,
    ) -> None:
        self.session: Session = session
        self.sleep: Callable[[float], None] = sleep
        self.clock: Callable[[], float] = clock
        self.min_interval: float = min_interval
        self.max_retries: int = max_retries
        self.ready_at: float | None = None

    def wait_turn(self) -> None:
        if self.ready_at is not None:
            delay = self.ready_at - self.clock()
            if delay > 0:
                self.sleep(delay)
        self.ready_at = self.clock() + self.min_interval

    def get(self, url: str) -> Response:
        attempt = 0
        while True:
            self.wait_turn()
            response = self.session.get(url)
            wait = limit_wait(response.headers)
            if response.status_code == 429 and wait == 0:
                wait = DEFAULT_RETRY_SECONDS
            if wait > 0:
                logger.info(f"Waiting {wait} seconds for the rate limit of: {url}")
                self.ready_at = max(self.ready_at or 0.0, self.clock() + wait)

            if response.status_code != 429:
                return response
            if attempt == self.max_retries:
                logger.error(f"Rate limited {attempt + 1} times, gave up on: {url}")
                return response
            attempt += 1
            logger.warning(
                f"Rate limited, retry {attempt} of {self.max_retries} for: {url}"
            )
