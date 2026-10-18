import json
from pathlib import Path

from price_service.ninja import Reply

FIXTURES = Path(__file__).parent / "fixtures"
REPO = Path(__file__).resolve().parents[2]
NAMESPACE_MAP = REPO / "renderer" / "public" / "data" / "namespaceMap.json"


def fixture(name: str) -> bytes:
    return (FIXTURES / "ninja" / name).read_bytes()


class FakeGet:
    def __init__(self, routes: dict[str, list[Reply | BaseException]]) -> None:
        self.routes = routes
        self.calls: list[tuple[str, dict[str, str]]] = []

    def __call__(self, url: str, headers: dict[str, str], _timeout: float, /) -> Reply:
        self.calls.append((url, headers))
        for fragment, replies in self.routes.items():
            if fragment in url:
                reply = replies.pop(0) if len(replies) > 1 else replies[0]
                if isinstance(reply, BaseException):
                    raise reply
                return reply
        return Reply(404, b"", None)


def ok(body: bytes | object, etag: str | None = None) -> Reply:
    data = body if isinstance(body, bytes) else json.dumps(body).encode()
    return Reply(200, data, etag)


def league_routes() -> dict[str, list[Reply | BaseException]]:
    return {
        "/leagues": [ok(fixture("leagues.json"))],
        "type=Currency": [ok(fixture("exchange_currency.json"))],
        "type=UniqueWeapons": [ok(fixture("stash_unique_weapons.json"))],
        "type=PrecursorTablets": [ok(fixture("stash_precursor_tablets.json"))],
    }
