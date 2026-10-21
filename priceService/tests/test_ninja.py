import gzip
import threading
import unittest
import zlib
from http.client import IncompleteRead
from http.server import BaseHTTPRequestHandler, HTTPServer

from support import FakeGet, fixture, ok

from price_service.ninja import (
    MAX_LEAGUES,
    HttpGet,
    NinjaClient,
    NinjaError,
    Reply,
    StopCycleError,
    retry_after_seconds,
    urllib_get,
)
from price_service.transform import Category

CURRENCY = Category("Currency", exchange=True)
WEAPONS = Category("UniqueWeapons", exchange=False)
FAILURES: list[Reply | BaseException] = [
    Reply(503, b"", None),
    OSError("connection reset"),
    IncompleteRead(b'{"lines"'),
    EOFError("Compressed file ended before the end-of-stream marker was reached"),
    zlib.error("Error -3 while decompressing data: invalid block type"),
    ok(b"not json"),
    ok(b'{"lines": [NaN]}'),
    ok(b'{"lines": [-Infinity]}'),
    ok(b'{"lines": [1e999]}'),
    ok(b'{"lines": ["\\ud800"]}'),
    ok(b"[" * 100_000),
]
GZIP_BODY = gzip.compress(b'{"ok": true}')


def client_for(get: FakeGet, sleeps: list[float] | None = None) -> NinjaClient:
    recorded = sleeps if sleeps is not None else []
    return NinjaClient(get, user_agent="test-agent (+contact)", delay_seconds=0.5, sleep=recorded.append)


class OverviewTest(unittest.TestCase):
    def test_requests_the_exchange_and_stash_endpoints_with_an_encoded_league(self) -> None:
        get = FakeGet({"type=": [ok({"lines": []})]})
        client = client_for(get)
        client.overview("Runes of Aldur", CURRENCY)
        client.overview("Runes of Aldur", WEAPONS)
        self.assertEqual(
            [url for url, _ in get.calls],
            [
                "https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Runes%20of%20Aldur&type=Currency",
                "https://poe.ninja/poe2/api/economy/stash/current/item/overview?league=Runes%20of%20Aldur&type=UniqueWeapons",
            ],
        )

    def test_identifies_itself_and_waits_after_every_request(self) -> None:
        sleeps: list[float] = []
        get = FakeGet({"type=": [ok({"lines": []})]})
        client = client_for(get, sleeps)
        client.overview("Standard", CURRENCY)
        client.overview("Standard", WEAPONS)
        headers = get.calls[0][1]
        self.assertEqual(headers["User-Agent"], "test-agent (+contact)")
        self.assertEqual(headers["Accept-Encoding"], "gzip")
        self.assertEqual(sleeps, [0.5, 0.5])

    def test_revalidates_with_the_etag_and_reuses_the_body_on_304(self) -> None:
        get = FakeGet({"type=Currency": [ok({"lines": [1]}, etag='"v1"'), Reply(304, b"", '"v1"')]})
        client = client_for(get)
        first = client.overview("Standard", CURRENCY)
        second = client.overview("Standard", CURRENCY)
        self.assertNotIn("If-None-Match", get.calls[0][1])
        self.assertEqual(get.calls[1][1]["If-None-Match"], '"v1"')
        self.assertEqual(second, first)

    def test_falls_back_to_the_last_good_copy_when_a_request_fails(self) -> None:
        for failure in FAILURES:
            with self.subTest(failure=repr(failure)[:80]):
                get = FakeGet({"type=Currency": [ok({"lines": [1]}), failure]})
                client = client_for(get)
                client.overview("Standard", CURRENCY)
                with self.assertLogs("price_service.ninja", "WARNING"):
                    self.assertEqual(client.overview("Standard", CURRENCY), {"lines": [1]})

    def test_raises_when_a_request_fails_and_nothing_is_cached(self) -> None:
        for failure in [*FAILURES, ok([1])]:
            with self.subTest(failure=repr(failure)[:80]):
                client = client_for(FakeGet({"type=Currency": [failure]}))
                with self.assertRaises(NinjaError):
                    client.overview("Standard", CURRENCY)


class StopCycleTest(unittest.TestCase):
    def test_a_429_stops_the_cycle_even_with_a_last_good_copy(self) -> None:
        sleeps: list[float] = []
        get = FakeGet({"type=Currency": [ok({"lines": [1]}), Reply(429, b"", None, "120")]})
        client = client_for(get, sleeps)
        client.overview("Standard", CURRENCY)
        with self.assertRaisesRegex(StopCycleError, r"type=Currency: HTTP 429, retry after 120 seconds$") as caught:
            client.overview("Standard", CURRENCY)
        self.assertEqual(caught.exception.retry_after, 120.0)
        self.assertEqual(sleeps, [0.5, 0.5])

    def test_the_third_server_error_in_a_row_stops_the_cycle(self) -> None:
        errors = [Reply(503, b"", None), Reply(500, b"", None), Reply(502, b"", None, "60")]
        get = FakeGet({"type=Currency": [ok({"lines": [1]}), *errors]})
        client = client_for(get)
        client.overview("Standard", CURRENCY)
        with self.assertLogs("price_service.ninja", "WARNING") as logs:
            client.overview("Standard", CURRENCY)
            client.overview("Standard", CURRENCY)
        self.assertEqual(len(logs.records), 2)
        with self.assertRaisesRegex(StopCycleError, r"HTTP 502, 3 server errors in a row, retry after 60") as caught:
            client.overview("Standard", CURRENCY)
        self.assertEqual(caught.exception.retry_after, 60.0)

    def test_any_other_status_starts_the_count_of_server_errors_again(self) -> None:
        for other in (ok({"lines": [2]}), Reply(304, b"", None), Reply(404, b"", None)):
            with self.subTest(status=other.status):
                errors: list[Reply | BaseException] = [Reply(503, b"", None), Reply(503, b"", None)]
                get = FakeGet({"type=Currency": [ok({"lines": [1]}), *errors, other, *errors, ok({"lines": [3]})]})
                client = client_for(get)
                with self.assertLogs("price_service.ninja", "WARNING"):
                    for _ in range(6):
                        client.overview("Standard", CURRENCY)
                self.assertEqual(client.overview("Standard", CURRENCY), {"lines": [3]})

    def test_reads_retry_after_in_seconds_up_to_a_day(self) -> None:
        cases: dict[str | None, float | None] = {
            "120": 120.0,
            " 7 ": 7.0,
            "0": 0.0,
            "86401": 86400.0,
            "9" * 5000: 86400.0,
            None: None,
            "": None,
            "-5": None,
            "1.5": None,
            "Wed, 21 Oct 2026 07:28:00 GMT": None,
        }
        for header, seconds in cases.items():
            with self.subTest(header=(header or "")[:40]):
                self.assertEqual(retry_after_seconds(header), seconds)


class LeaguesTest(unittest.TestCase):
    def test_returns_the_league_ids_in_order(self) -> None:
        client = client_for(FakeGet({"/leagues": [ok(fixture("leagues.json"))]}))
        self.assertEqual(client.leagues()[:2], ["Forbidden Rites", "Runes of Aldur"])

    def test_skips_entries_without_a_text_id(self) -> None:
        entries = [{"id": 7}, "x", {"id": None}, {"name": "Hardcore"}, {"id": "Standard"}, [{"id": "Nested"}]]
        client = client_for(FakeGet({"/leagues": [ok(entries)]}))
        self.assertEqual(client.leagues(), ["Standard"])

    def test_caps_the_count_after_skipping_malformed_entries(self) -> None:
        entries = [{"id": 7}, "x", *({"id": f"League {n}"} for n in range(MAX_LEAGUES + 5))]
        client = client_for(FakeGet({"/leagues": [ok(entries)]}))
        self.assertEqual(client.leagues(), [f"League {n}" for n in range(MAX_LEAGUES)])

    def test_rejects_a_league_list_that_is_not_a_list(self) -> None:
        with self.assertRaises(NinjaError):
            client_for(FakeGet({"/leagues": [ok({"id": "Standard"})]})).leagues()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        length: int | None = None
        if self.path == "/gzip":
            body = GZIP_BODY
            self.send_response(200)
            self.send_header("Content-Encoding", "gzip")
            self.send_header("ETag", '"abc"')
        elif self.path in {"/gzip-cut", "/gzip-corrupt"}:
            body = GZIP_BODY[:-4] if self.path == "/gzip-cut" else GZIP_BODY[:10] + b"\xff" * 8
            self.send_response(200)
            self.send_header("Content-Encoding", "gzip")
        elif self.path == "/plain":
            body = b'{"ok": true}'
            self.send_response(200)
        elif self.path == "/cut":
            body, length = b'{"ok": tr', 12
            self.send_response(200)
        elif self.path == "/busy":
            body = b""
            self.send_response(429)
            self.send_header("Retry-After", "120")
        elif self.path == "/same" and self.headers.get("If-None-Match") == '"abc"':
            body = b""
            self.send_response(304)
            self.send_header("ETag", '"abc"')
        else:
            body = b""
            self.send_response(500)
        self.send_header("Content-Length", str(len(body) if length is None else length))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 the name BaseHTTPRequestHandler uses
        pass


class UrllibGetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = HTTPServer(("127.0.0.1", 0), Handler)
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()

    def test_decompresses_gzip_and_returns_the_etag(self) -> None:
        self.assertEqual(urllib_get(f"{self.base}/gzip", {}, 5), Reply(200, b'{"ok": true}', '"abc"'))

    def test_returns_a_plain_body_unchanged(self) -> None:
        self.assertEqual(urllib_get(f"{self.base}/plain", {}, 5).body, b'{"ok": true}')

    def test_returns_304_and_errors_as_replies(self) -> None:
        self.assertEqual(urllib_get(f"{self.base}/same", {"If-None-Match": '"abc"'}, 5), Reply(304, b"", '"abc"'))
        self.assertEqual(urllib_get(f"{self.base}/missing", {}, 5).status, 500)
        self.assertEqual(urllib_get(f"{self.base}/busy", {}, 5), Reply(429, b"", None, "120"))

    def test_a_body_cut_short_or_corrupt_is_a_failed_request(self) -> None:
        for path, error in (("/cut", "IncompleteRead"), ("/gzip-cut", "EOFError"), ("/gzip-corrupt", "error")):
            with self.subTest(path=path):
                client = NinjaClient(self.get_from(path), user_agent="test", sleep=lambda _: None)
                with self.assertRaisesRegex(NinjaError, f": {error}: "):
                    client.overview("Standard", CURRENCY)

    def get_from(self, path: str) -> HttpGet:
        def get(_url: str, headers: dict[str, str], timeout: float, /) -> Reply:
            return urllib_get(f"{self.base}{path}", headers, timeout)

        return get


if __name__ == "__main__":
    unittest.main()
