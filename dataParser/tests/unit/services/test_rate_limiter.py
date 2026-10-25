import pytest
from requests.structures import CaseInsensitiveDict

from services.rate_limiter import RateLimit, RateLimiter
from tests.fake_http import FakeClock, FakeResponse, FakeSession

EXPOSED = (
    "X-Rate-Limit-Policy, X-Rate-Limit-Rules, X-Rate-Limit-Ip, X-Rate-Limit-Ip-State"
)
URL = "https://www.pathofexile.com/api/trade2/fetch/a1"


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


def limiter_for(
    clock: FakeClock, responses: list[FakeResponse | Exception] | None = None
) -> tuple[RateLimiter, FakeSession]:
    """Returns a limiter whose requests get the given responses and whose waits move the fake clock."""
    session = FakeSession(clock, responses or [])
    return RateLimiter(session=session, sleep=clock.sleep, clock=clock), session


def headers(**values: str) -> CaseInsensitiveDict:
    out = CaseInsensitiveDict()
    out["access-control-expose-headers"] = EXPOSED
    for name, value in values.items():
        out[name.replace("_", "-")] = value
    return out


def ip_limit(limit: str, state: str) -> CaseInsensitiveDict:
    return headers(
        X_Rate_Limit_Policy="trade-fetch",
        X_Rate_Limit_Rules="Ip",
        X_Rate_Limit_Ip=limit,
        X_Rate_Limit_Ip_State=state,
    )


def test_parse_rate_limit_reads_each_window(clock: FakeClock) -> None:
    limiter, _ = limiter_for(clock)

    assert limiter.parse_rate_limit("8:10:60,15:60:120") == [
        RateLimit(8, 10, 60),
        RateLimit(15, 60, 120),
    ]


def test_parse_window_limit_rejects_a_window_without_three_parts(
    clock: FakeClock,
) -> None:
    limiter, _ = limiter_for(clock)

    with pytest.raises(ValueError, match="limit:interval:penalty"):
        limiter.parse_window_limit("8:10")


def test_get_limits_rejects_a_state_with_other_windows(clock: FakeClock) -> None:
    limiter, _ = limiter_for(clock)

    with pytest.raises(ValueError, match="does not match"):
        limiter.get_limits("8:10:60", "1:5:0")


@pytest.mark.parametrize("duration", [0, -1.5])
def test_wait_rejects_a_duration_that_is_not_positive(
    clock: FakeClock, duration: float
) -> None:
    limiter, _ = limiter_for(clock)

    with pytest.raises(ValueError, match="cannot wait"):
        limiter.wait(duration)
    assert clock.sleeps == []


def test_handle_headers_does_not_wait_after_the_first_response_while_the_limit_has_room(
    clock: FakeClock,
) -> None:
    limiter, _ = limiter_for(clock)

    limiter.handle_headers(ip_limit("8:10:60", "1:10:0"), 200)

    assert clock.sleeps == []


def test_get_waits_after_a_response_that_comes_soon_after_the_previous_one(
    clock: FakeClock,
) -> None:
    response = FakeResponse(headers=ip_limit("8:10:60", "1:10:0"))
    limiter, session = limiter_for(clock, [response, response, response])

    for _ in range(3):
        _ = limiter.get(URL)

    # The third response comes 4 seconds after the second, more than 1.5 times 2.5 seconds
    assert clock.sleeps == pytest.approx([10 / 8 * 2 * 1.4])
    assert session.gaps() == pytest.approx([0.5, 0.5 + 10 / 8 * 2 * 1.4])


def test_handle_headers_does_not_wait_when_the_previous_response_is_old_enough(
    clock: FakeClock,
) -> None:
    limiter, _ = limiter_for(clock)

    limiter.handle_headers(ip_limit("8:10:60", "1:10:0"), 200)
    clock.now += 10 / 8 * 2 * 1.5 + 0.1
    limiter.handle_headers(ip_limit("8:10:60", "2:10:0"), 200)

    assert clock.sleeps == []


def test_handle_headers_counts_the_wait_of_a_longer_rule_for_a_shorter_one(
    clock: FakeClock,
) -> None:
    limiter, _ = limiter_for(clock)

    limiter.handle_headers(ip_limit("8:10:60,15:60:120", "1:10:0,1:60:0"), 200)
    clock.now += 0.5
    limiter.handle_headers(ip_limit("8:10:60,15:60:120", "2:10:0,2:60:0"), 200)

    assert clock.sleeps == pytest.approx([60 / 15 * 2 * 1.4])


def test_handle_headers_waits_for_the_full_penalty(clock: FakeClock) -> None:
    limiter, _ = limiter_for(clock)

    limiter.handle_headers(ip_limit("8:10:60", "9:10:30"), 200)

    assert clock.sleeps == pytest.approx([60, 10 / 8 * 2 * 3])


def test_handle_headers_rejects_a_named_header_that_is_missing(
    clock: FakeClock,
) -> None:
    limiter, _ = limiter_for(clock)
    response = headers(
        X_Rate_Limit_Policy="trade-search",
        X_Rate_Limit_Rules="Ip",
        X_Rate_Limit_Ip="8:10:60",
    )

    with pytest.raises(ValueError, match="header"):
        limiter.handle_headers(response, 200)
    assert clock.sleeps == []
