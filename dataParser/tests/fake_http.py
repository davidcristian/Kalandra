"""Stand-ins for the trade site session and the clock, so tests send no requests and do not sleep."""

import json
from collections.abc import Mapping
from dataclasses import dataclass, field


class FakeClock:
    """A clock that moves only when sleep is called or a fake request takes time."""

    def __init__(self) -> None:
        self.now: float = 1000.0
        self.sleeps: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


@dataclass
class FakeResponse:
    status_code: int = 200
    text: str = '{"result": []}'
    headers: Mapping[str, str] = field(default_factory=dict[str, str])

    def json(self) -> object:
        return json.loads(self.text)


class FakeSession:
    """Returns or raises the queued results in order, and records each URL with the time it was sent."""

    def __init__(
        self,
        clock: FakeClock,
        results: list[FakeResponse | Exception],
        latency: float = 0.5,
    ) -> None:
        self.clock: FakeClock = clock
        self.results: list[FakeResponse | Exception] = results
        self.latency: float = latency
        self.sent: list[tuple[str, float]] = []

    def get(self, url: str) -> FakeResponse:
        self.sent.append((url, self.clock.now))
        self.clock.now += self.latency
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    def gaps(self) -> list[float]:
        """Returns the seconds between the times two requests in a row were sent."""
        times = [sent_at for _, sent_at in self.sent]
        return [later - earlier for earlier, later in zip(times, times[1:])]
