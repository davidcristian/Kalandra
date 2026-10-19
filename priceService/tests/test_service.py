import json
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from support import FIXTURES, FakeGet, fixture, league_routes, ok

from price_service.ninja import NinjaClient, Reply
from price_service.service import build_league, run_cycle, write_atomic
from price_service.transform import Category, SnapshotError

CATEGORIES = [
    Category("Currency", exchange=True),
    Category("UniqueWeapons", exchange=False),
    Category("PrecursorTablets", exchange=False),
]
NOW = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)


def client(routes: dict[str, list[Reply | BaseException]]) -> NinjaClient:
    return NinjaClient(FakeGet(routes), user_agent="test", sleep=lambda _: None)


class BuildLeagueTest(unittest.TestCase):
    def test_matches_the_price_file_the_app_tests_read(self) -> None:
        text = build_league(client(league_routes()), CATEGORIES, "Runes of Aldur")
        self.assertEqual(text + "\n", (FIXTURES / "price_file.json").read_text("utf-8"))

    def test_needs_a_currency_category_for_the_exchange_rates(self) -> None:
        with self.assertRaises(SnapshotError):
            build_league(client(league_routes()), CATEGORIES[1:], "Runes of Aldur")


class RunCycleTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.output = Path(self.directory.name)

    def tearDown(self) -> None:
        self.directory.cleanup()

    def test_writes_a_file_per_league_and_an_index(self) -> None:
        routes = league_routes()
        routes["/leagues"] = [ok([{"id": "Runes of Aldur"}, {"id": "Standard"}])]
        index = run_cycle(client(routes), CATEGORIES, self.output, now=lambda: NOW)
        self.assertEqual(
            sorted(path.name for path in self.output.iterdir()), ["index.json", "runesofaldur.json", "standard.json"]
        )
        self.assertEqual(json.loads((self.output / "index.json").read_text("utf-8")), index)
        self.assertEqual(index["generatedAt"], "2026-10-18T12:00:00+00:00")
        leagues = [{"id": "Runes of Aldur", "file": "runesofaldur.json"}, {"id": "Standard", "file": "standard.json"}]
        self.assertEqual(index["leagues"], leagues)

    def test_keeps_the_old_file_of_a_league_that_fails(self) -> None:
        (self.output / "standard.json").write_text("old", encoding="utf-8")
        routes = league_routes()
        routes["/leagues"] = [ok([{"id": "Standard"}, {"id": "///"}])]
        routes["type=Currency"] = [Reply(503, b"", None)]
        with self.assertLogs("price_service.service", "WARNING"):
            index = run_cycle(client(routes), CATEGORIES, self.output, now=lambda: NOW)
        self.assertEqual((self.output / "standard.json").read_text("utf-8"), "old")
        self.assertEqual(index["leagues"], [])
        self.assertEqual(index["failed"], ["Standard", "///"])

    def test_skips_a_league_whose_values_the_file_cannot_hold(self) -> None:
        nan, surrogate = (json.loads(fixture("exchange_currency.json")) for _ in range(2))
        nan["lines"][0]["primaryValue"] = float("nan")
        surrogate["items"][0]["name"] = "\ud800"
        in_chaos = {"core": {"primary": "chaos", "rates": {"divine": 10}}}
        cases = [
            ("type=Currency", nan),
            ("type=Currency", surrogate),
            ("type=UniqueWeapons", {**in_chaos, "lines": [{"name": "Rune", "primaryValue": 1e308}]}),
            ("type=UniqueWeapons", {**in_chaos, "lines": [{"name": "Rune", "primaryValue": 10**400}]}),
        ]
        for fragment, response in cases:
            with self.subTest(fragment=fragment, response=str(response)[:60]), tempfile.TemporaryDirectory() as name:
                output = Path(name)
                routes: dict[str, list[Reply | BaseException]] = {f"league=Bad&{fragment}": [ok(response)]}
                routes.update(league_routes())
                routes["/leagues"] = [ok([{"id": "Bad"}, {"id": "Standard"}])]
                with self.assertLogs("price_service.service", "WARNING"):
                    index = run_cycle(client(routes), CATEGORIES, output, now=lambda: NOW)
                self.assertEqual(index["failed"], ["Bad"])
                self.assertEqual(sorted(path.name for path in output.iterdir()), ["index.json", "standard.json"])


class WriteAtomicTest(unittest.TestCase):
    def test_replaces_the_target_and_leaves_no_temporary_file(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            (directory / "a.json").write_text("old", encoding="utf-8")
            write_atomic(directory, "a.json", "new")
            self.assertEqual([path.name for path in directory.iterdir()], ["a.json"])
            self.assertEqual((directory / "a.json").read_text("utf-8"), "new")


if __name__ == "__main__":
    unittest.main()
