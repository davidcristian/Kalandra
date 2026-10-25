import pytest
from requests.structures import CaseInsensitiveDict

from services import rate_limiter
from services.rate_limiter import RateLimit, RateLimiter

EXPOSED = (
    "X-Rate-Limit-Policy, X-Rate-Limit-Rules, X-Rate-Limit-Ip, X-Rate-Limit-Ip-State"
)


@pytest.fixture
def waits(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    recorded: list[float] = []
    monkeypatch.setattr(rate_limiter, "sleep", recorded.append)
    return recorded


def headers(**values: str) -> CaseInsensitiveDict:
    out = CaseInsensitiveDict()
    out["access-control-expose-headers"] = EXPOSED
    for name, value in values.items():
        out[name.replace("_", "-")] = value
    return out


def test_parse_rate_limit_reads_each_window() -> None:
    assert RateLimiter().parse_rate_limit("8:10:60,15:60:120") == [
        RateLimit(8, 10, 60),
        RateLimit(15, 60, 120),
    ]


def test_parse_window_limit_rejects_a_window_without_three_parts() -> None:
    with pytest.raises(ValueError, match="limit:interval:penalty"):
        RateLimiter().parse_window_limit("8:10")


def test_get_limits_rejects_a_state_with_other_windows() -> None:
    with pytest.raises(ValueError, match="does not match"):
        RateLimiter().get_limits("8:10:60", "1:5:0")


@pytest.mark.parametrize("duration", [0, -1.5])
def test_wait_rejects_a_duration_that_is_not_positive(
    waits: list[float], duration: float
) -> None:
    with pytest.raises(ValueError, match="cannot wait"):
        RateLimiter().wait(duration)
    assert waits == []


def test_handle_headers_waits_by_the_limits(waits: list[float]) -> None:
    response = headers(
        X_Rate_Limit_Policy="trade-search",
        X_Rate_Limit_Rules="Ip",
        X_Rate_Limit_Ip="8:10:60",
        X_Rate_Limit_Ip_State="1:10:0",
    )

    RateLimiter().handle_headers(response, 200)

    assert waits == pytest.approx([10 / 8 * 2 * 1.4])


def test_handle_headers_waits_for_the_full_penalty(waits: list[float]) -> None:
    response = headers(
        X_Rate_Limit_Policy="trade-search",
        X_Rate_Limit_Rules="Ip",
        X_Rate_Limit_Ip="8:10:60",
        X_Rate_Limit_Ip_State="9:10:30",
    )

    RateLimiter().handle_headers(response, 200)

    assert waits == pytest.approx([60, 10 / 8 * 2 * 1.4, 10 / 8 * 2 * 3])


def test_handle_headers_rejects_a_named_header_that_is_missing(
    waits: list[float],
) -> None:
    response = headers(
        X_Rate_Limit_Policy="trade-search",
        X_Rate_Limit_Rules="Ip",
        X_Rate_Limit_Ip="8:10:60",
    )

    with pytest.raises(ValueError, match="header"):
        RateLimiter().handle_headers(response, 200)
    assert waits == []
