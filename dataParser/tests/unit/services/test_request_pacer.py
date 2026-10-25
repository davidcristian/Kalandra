import logging

import pytest
import requests

from services.request_pacer import (
    DEFAULT_RETRY_SECONDS,
    MIN_INTERVAL_SECONDS,
    RequestPacer,
    limit_wait,
)
from tests.fake_http import FakeClock, FakeResponse, FakeSession

URL = "https://www.pathofexile.com/api/trade2/data/stats"
LATENCY = 0.5


def send(responses: list[FakeResponse]) -> FakeSession:
    """Sends one request per queued response through a pacer and returns the session."""
    clock = FakeClock()
    session = FakeSession(clock, [*responses], LATENCY)
    pacer = RequestPacer(session, clock.sleep, clock)
    for _ in responses:
        _ = pacer.get(URL)
    return session


def limited(state: str) -> FakeResponse:
    return FakeResponse(
        headers={
            "X-Rate-Limit-Rules": "Ip",
            "X-Rate-Limit-Ip": "5:10:60,30:300:600",
            "X-Rate-Limit-Ip-State": state,
        }
    )


def test_get_sends_the_first_request_at_once_and_the_next_after_the_interval() -> None:
    clock = FakeClock()
    session = FakeSession(clock, [FakeResponse(), FakeResponse()], LATENCY)
    pacer = RequestPacer(session, clock.sleep, clock)

    _ = pacer.get(URL)
    assert clock.sleeps == []
    _ = pacer.get(URL)

    assert clock.sleeps == [MIN_INTERVAL_SECONDS - LATENCY]
    assert session.gaps() == [MIN_INTERVAL_SECONDS]


def test_get_keeps_the_interval_after_a_request_that_raised() -> None:
    clock = FakeClock()
    session = FakeSession(clock, [requests.ConnectionError("reset"), FakeResponse()])
    pacer = RequestPacer(session, clock.sleep, clock)

    with pytest.raises(requests.ConnectionError):
        _ = pacer.get(URL)
    _ = pacer.get(URL)

    assert session.gaps() == [MIN_INTERVAL_SECONDS]


def test_get_waits_only_the_interval_while_every_rule_has_room() -> None:
    session = send([limited("3:10:0,1:300:0"), FakeResponse()])

    assert session.gaps() == [MIN_INTERVAL_SECONDS]


def test_get_waits_the_window_of_a_rule_one_request_from_its_limit() -> None:
    session = send([limited("1:10:0,29:300:0"), FakeResponse()])

    assert session.gaps() == [LATENCY + 300]


def test_get_waits_a_restriction_the_state_reports() -> None:
    session = send([limited("6:10:45,7:300:0"), FakeResponse()])

    assert session.gaps() == [LATENCY + 45]


def test_get_retries_a_429_after_its_retry_after() -> None:
    clock = FakeClock()
    rate_limited = FakeResponse(429, "", {"Retry-After": "20"})
    session = FakeSession(clock, [rate_limited, FakeResponse()], LATENCY)

    response = RequestPacer(session, clock.sleep, clock).get(URL)

    assert response.status_code == 200
    assert [url for url, _ in session.sent] == [URL, URL]
    assert session.gaps() == [LATENCY + 20]


def test_get_waits_a_minute_on_a_429_without_rate_limit_headers() -> None:
    clock = FakeClock()
    session = FakeSession(clock, [FakeResponse(429, ""), FakeResponse()], LATENCY)

    _ = RequestPacer(session, clock.sleep, clock).get(URL)

    assert session.gaps() == [LATENCY + DEFAULT_RETRY_SECONDS]


def test_get_returns_the_429_after_the_last_retry(
    caplog: pytest.LogCaptureFixture,
) -> None:
    clock = FakeClock()
    responses = [FakeResponse(429, "", {"Retry-After": "5"}) for _ in range(4)]
    session = FakeSession(clock, [*responses, FakeResponse()], LATENCY)

    response = RequestPacer(session, clock.sleep, clock, max_retries=3).get(URL)

    assert response.status_code == 429
    assert len(session.sent) == 4
    assert f"Rate limited 4 times, gave up on: {URL}" in caplog.text


@pytest.mark.parametrize(
    "headers",
    [
        {"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"},
        {"Retry-After": "-5"},
        {"Retry-After": "inf"},
        {"X-Rate-Limit-Rules": "Ip", "X-Rate-Limit-Ip": "5:10:60"},
        {
            "X-Rate-Limit-Rules": "Ip",
            "X-Rate-Limit-Ip": "5:10",
            "X-Rate-Limit-Ip-State": "5:10",
        },
        {
            "X-Rate-Limit-Rules": "Ip",
            "X-Rate-Limit-Ip": "5:10:60,30:300:600",
            "X-Rate-Limit-Ip-State": "5:10:0",
        },
        {
            "X-Rate-Limit-Rules": "Ip",
            "X-Rate-Limit-Ip": "five:10:60",
            "X-Rate-Limit-Ip-State": "5:10:0",
        },
    ],
)
def test_limit_wait_ignores_a_header_it_cannot_read(
    headers: dict[str, str], caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING):
        assert limit_wait(headers) == 0
    assert "Ignored" in caplog.text


def test_limit_wait_reads_header_names_in_any_case() -> None:
    headers = {
        "x-rate-limit-rules": "ip, Account",
        "X-RATE-LIMIT-IP": "5:10:60",
        "x-rate-limit-ip-state": "1:10:0",
        "x-rate-limit-account": "3:5:60",
        "X-Rate-Limit-Account-State": "2:5:0",
    }

    assert limit_wait(headers) == 5
