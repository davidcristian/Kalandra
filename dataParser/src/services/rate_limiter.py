import logging
import math
import time
from collections import defaultdict
from collections.abc import Callable, Mapping
from typing import Any, Protocol, TypedDict

import cloudscraper

from models.json_value import Json

logger = logging.getLogger(__name__)


class RateLimitError(Exception):
    """Every try of a request got a 429 from the trade site."""


class Response(Protocol):
    @property
    def status_code(self) -> int: ...

    @property
    def headers(self) -> Mapping[str, str]: ...

    @property
    def text(self) -> str: ...

    def json(self) -> Any: ...


class Session(Protocol):
    def get(
        self, url: str, *, json: Json = None, headers: Mapping[str, str] | None = None
    ) -> Response: ...

    def post(
        self, url: str, *, json: Json = None, headers: Mapping[str, str] | None = None
    ) -> Response: ...


class RateLimit:
    def __init__(self, limit: int, window: int, penalty: int) -> None:
        self.max = limit
        self.window = window
        self.penalty = penalty

    def __str__(self) -> str:
        return (
            f"RateLimiter<max={self.max}:window={self.window}:penalty={self.penalty}>"
        )

    def __repr__(self) -> str:
        return (
            f"RateLimiter<max={self.max}:window={self.window}:penalty={self.penalty}>"
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, RateLimit):
            return False
        return (
            self.max == other.max
            and self.window == other.window
            and self.penalty == other.penalty
        )


class PolicyState(TypedDict):
    """The rate limit headers of the last response of one policy, and when it came."""

    policy: str
    rules: str
    limit: str
    state: str
    rate_limits: list[tuple[RateLimit, RateLimit]]
    last_update: float
    prev_state: str | None
    prev_rate_limits: list[tuple[RateLimit, RateLimit]] | None


class RateLimiter:
    def __init__(
        self,
        debug: bool = False,
        session: Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.limits: defaultdict[str, PolicyState] = defaultdict()
        self.session: Session = (
            session
            if session is not None
            else cloudscraper.create_scraper(interpreter="nodejs", debug=debug)
        )
        self.sleep: Callable[[float], None] = sleep
        self.clock: Callable[[], float] = clock

    def wait(self, duration: int | float) -> None:
        """Sleeps for duration seconds, and raises ValueError when duration is not above 0."""
        if duration <= 0:
            raise ValueError(f"cannot wait for {duration} seconds")
        self.sleep(duration)

    def parse_window_limit(self, window: str) -> RateLimit:
        """Returns the RateLimit of one "limit:interval:penalty" entry of a rate limit header."""
        split_window = window.split(":")
        if len(split_window) != 3:
            raise ValueError(f"rate limit {window!r} is not limit:interval:penalty")
        return RateLimit(
            int(split_window[0]),
            int(split_window[1]),
            int(split_window[2]),
        )

    def parse_rate_limit(self, limit: str) -> list[RateLimit]:
        """Returns the RateLimit of each comma-separated entry of a rate limit header."""
        split_limit = limit.split(",")
        windows: list[RateLimit] = []
        for window in split_limit:
            windows.append(self.parse_window_limit(window))
        return windows

    def get_limits(self, limit: str, state: str) -> list[tuple[RateLimit, RateLimit]]:
        """Pairs each entry of the limit header with the state entry in its place, and raises ValueError when their windows differ."""
        limits = self.parse_rate_limit(limit)
        states = self.parse_rate_limit(state)

        limit_groups: list[tuple[RateLimit, RateLimit]] = []
        for limit_group, state_group in zip(limits, states):
            if limit_group.window != state_group.window:
                raise ValueError(f"rate limit state {state!r} does not match {limit!r}")
            limit_groups.append((limit_group, state_group))
        return limit_groups

    def wait_if_exceeded(self, limit: RateLimit, state: RateLimit) -> None:
        """Waits the rule's full penalty, not only the seconds left, when the state reports a restriction."""
        if state.penalty > 0:
            self.wait(limit.penalty)
            # The waits of wait_if_needed should prevent a restriction, so one is logged as an error
            logger.error(
                f"Rate limit exceeded. Waiting for full penalty of {limit.penalty} seconds. RateLimit: {limit}, State: {state}"
            )

    def wait_if_needed(
        self, limit: RateLimit, state: RateLimit, last_update: float | None
    ) -> None:
        two_request_seconds = limit.window / limit.max * 2
        if (
            last_update is not None
            and self.clock() - last_update <= two_request_seconds * 1.5
        ):
            logger.debug(f"Waiting for {two_request_seconds * 1.4} | {limit}, {state}")
            self.wait(two_request_seconds * 1.4)

        # The max of a state entry is the number of requests so far in its window
        if state.max >= math.floor(limit.max * 0.9):
            logger.warning(
                f"Close to exceeding limit, waiting for {two_request_seconds * 3} | {limit}, {state}"
            )
            self.wait(two_request_seconds * 3)

    def wait_limit(
        self,
        policy: str | None,
        rules: str | None,
        limit: str | None,
        state: str | None,
    ) -> None:
        if policy is None or rules is None or limit is None or state is None:
            raise ValueError("a rate limit header named in the response is missing")
        rate_limits = self.get_limits(limit, state)
        previous = self.limits.get(policy)
        self.limits[policy] = {
            "policy": policy,
            "rules": rules,
            "limit": limit,
            "state": state,
            "rate_limits": rate_limits,
            "last_update": self.clock(),
            "prev_state": previous["state"] if previous else None,
            "prev_rate_limits": previous["rate_limits"] if previous else None,
        }
        last_update = previous["last_update"] if previous else None
        rate_limits.reverse()
        for rule_limit, rule_state in rate_limits:
            self.wait_if_exceeded(rule_limit, rule_state)
            self.wait_if_needed(rule_limit, rule_state, last_update)
        logger.debug(f"Current rate limits: {self.limits}")

    def handle_headers(self, headers: Mapping[str, str], status_code: int) -> None:
        """After a 429, sleeps for the seconds in Retry-After, then waits as the IP rate limit headers ask."""
        if status_code == 429:
            logger.error("Rate limit exceeded.")
            retry_after = headers.get("Retry-After")
            if retry_after:
                logger.error(f"Retry after: {retry_after}")
                self.wait(int(retry_after))
            else:
                logger.error("No retry after header found.")

        ac_headers = headers.get("access-control-expose-headers")
        if isinstance(ac_headers, str):
            ac_headers = ac_headers.lower()
            if (
                "x-rate-limit-policy" in ac_headers
                and "x-rate-limit-rules" in ac_headers
                and "x-rate-limit-ip" in ac_headers
                and "x-rate-limit-ip-state" in ac_headers
            ):
                self.wait_limit(
                    headers.get("x-rate-limit-policy"),
                    headers.get("x-rate-limit-rules"),
                    headers.get("x-rate-limit-ip"),
                    headers.get("x-rate-limit-ip-state"),
                )
        else:
            logger.error("No access-control-expose-headers header found.")

    def get(
        self,
        url: str,
        payload: Mapping[str, Json] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Response:
        response = self.session.get(url, json=payload, headers=headers)
        self.handle_headers(response.headers, response.status_code)
        return response

    def post(
        self,
        url: str,
        payload: Mapping[str, Json] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Response:
        response = self.session.post(url, json=payload, headers=headers)
        self.handle_headers(response.headers, response.status_code)
        return response
